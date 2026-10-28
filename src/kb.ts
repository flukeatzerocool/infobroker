// @implements REQ-060 REQ-060a REQ-060b REQ-060c REQ-060d REQ-060e REQ-060f REQ-060g REQ-060h REQ-064 REQ-065 REQ-066 REQ-067 REQ-072 REQ-074 REQ-075 REQ-076 REQ-082 REQ-083 REQ-084 REQ-085 REQ-086 REQ-087 REQ-097 REQ-098 REQ-099 REQ-109 REQ-110 REQ-060i
import { randomUUID, randomBytes } from "node:crypto";
import {
  writeSync,
  existsSync,
  mkdirSync,
  renameSync,
  copyFileSync,
  openSync,
  closeSync,
  fsyncSync,
  unlinkSync,
  readdirSync,
  statSync,
  chmodSync,
} from "node:fs";
import { join, dirname, basename, relative, isAbsolute } from "node:path";
import { homedir, tmpdir } from "node:os";
import type {
  KbConfig,
  KbChunk,
  KbSearchResult,
  KbListEntry,
  KbStats,
  ClaimLedgerQuery,
  ClaimLedgerResult,
  ClaimRecord,
  ReportReceiptInput,
  ReportReceiptRecord,
  ReportVerificationResult,
} from "./types.js";
import {
  buildReceiptManifest,
  normalizeReceiptInput,
  sha256Hex,
  verifyReceipt,
  type ReceiptInputError,
} from "./kb-receipt.js";
import {
  sealEnvelope,
  openEnvelope,
  resolveKeySource,
  rawKeyFromString,
  passphraseKey,
  readKeyFile,
  type ResolvedKey,
} from "./kb-crypto.js";
import { checkContent } from "./content-policy.js";
import { audit } from "./audit-log.js";
import {
  createModel,
  cosineSimilarity,
  pairwiseSimilarity,
  tokenize,
  DEFAULT_MODEL,
  type EmbeddingModel,
} from "./embed.js";
import { SqliteStore, sqliteStoreFormat } from "./kb-sqlite.js";
import { migrateLegacyJson } from "./kb-migrate.js";
import { SNIPPET_SOURCE_TYPE } from "./kb-store.js";
import { KbPrefilter } from "./kb-prefilter.js";

let sqliteStore: SqliteStore | null = null;
let kbConfig: KbConfig | null = null;
let storagePath: string | null = null;
let maintenanceTimer: ReturnType<typeof setInterval> | null = null;
let resolvedKey: ResolvedKey | null = null;
let lockError: { code: string; message: string; remediation: string } | null = null;
/**
 * In-memory, capacity-bounded candidate filter for lexical search (REQ-108).
 * Built lazily from stored embeddings and discarded on any write or model
 * change; never persisted, so encrypted stores get the same behavior.
 */
let prefilter: KbPrefilter | null = null;
const CONFIG_ERROR_CODE = "config_error";
const TRUNC_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function resolvePath(p: string): string {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

// Resolve a configured key source without throwing: a missing or malformed key
// file must lock the store and report a remediation (REQ-084, REQ-085), never
// crash the server at startup.
function safeResolveKeySource(keyFile?: string): { key: ResolvedKey | null; error: string | null } {
  try {
    return { key: resolveKeySource(keyFile), error: null };
  } catch (e) {
    return { key: null, error: e instanceof Error ? e.message : String(e) };
  }
}

// REQ-083: the caller's save destination selects the stores. "disk" writes a
// report file instead of indexing it; "kb" indexes; "both" does both.
export function ingestDestinations(saveTo: string): { kb: boolean; disk: boolean } {
  return { kb: saveTo !== "disk", disk: saveTo === "disk" || saveTo === "both" };
}

// The active in-process embedding model (REQ-103). It is selected from
// `kb.embedding_model` at init; an unknown reference is reported as
// unavailable (F9) while retrieval falls back to the built-in model so the
// server keeps operating. Model state is loaded from the persisted store
// before each use so queries project into the same basis as stored chunks.
let activeModel: EmbeddingModel = createModel(DEFAULT_MODEL)!;
let modelConfiguredName: string = DEFAULT_MODEL;
let modelAvailable = true;

function configureModel(name: string | undefined): void {
  const requested = name && name.length > 0 ? name : DEFAULT_MODEL;
  modelConfiguredName = requested;
  const model = createModel(requested);
  if (!model) {
    modelAvailable = false;
    activeModel = createModel(DEFAULT_MODEL)!;
    sqliteStore?.appendEvent(
      `Embedding model "${requested}" is unavailable at ${new Date().toISOString()}; retrieval degraded to "${DEFAULT_MODEL}"`
    );
    return;
  }
  activeModel = model;
  modelAvailable = true;
}

// Mirror the persisted model state into the active model before embedding.
function syncModelState(): void {
  if (sqliteStore) {
    const meta = sqliteStore.meta();
    if (activeModel.name === "signed-hash-tfidf") {
      activeModel.load({ idf: meta.idf, docCount: meta.docCount });
    } else if (meta.embed_state) {
      activeModel.load(meta.embed_state);
    }
    return;
  }
}

// Re-fit a fitted model (LSA) over all stored text and re-embed every chunk so
// stored and query vectors share one basis. Stateless models no-op.
function refitFittedModel(): void {
  if (sqliteStore) {
    if (!activeModel.requiresFit) return;
    const chunks = [...sqliteStore.iterateChunks()];
    if (chunks.length === 0) {
      const meta = sqliteStore.meta();
      meta.embed_state = undefined;
      sqliteStore.setMeta(meta);
      prefilter = null;
      return;
    }
    activeModel.fit(chunks.map((c) => c.text));
    sqliteStore.replaceAllChunks(
      chunks.map((chunk) => ({ ...chunk, embedding: activeModel.embed(chunk.text) }))
    );
    const meta = sqliteStore.meta();
    meta.embed_state = activeModel.serialize();
    meta.model = activeModel.name;
    sqliteStore.setMeta(meta);
  }
}

function keywordScore(regexes: RegExp[], text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const re of regexes) {
    const matches = lower.match(re);
    if (matches) score += matches.length;
  }
  return score / (text.length || 1);
}

function atomicWriteFile(fpath: string, bytes: Buffer): void {
  const dir = dirname(fpath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmp = join(dir, `.${basename(fpath)}.tmp-${randomUUID()}`);
  try {
    const fd = openSync(tmp, "w", 0o600);
    try {
      writeSync(fd, bytes);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    chmodSync(tmp, 0o600);
    renameSync(tmp, fpath);
    // Best-effort directory fsync for rename durability (POSIX); harmless where
    // unsupported (Windows, some FUSE filesystems).
    try {
      const dfd = openSync(dir, "r");
      try {
        fsyncSync(dfd);
      } finally {
        closeSync(dfd);
      }
    } catch {
      // ignore
    }
  } catch (e) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      // ignore
    }
    throw e;
  }
}

function chunkText(text: string, title: string): string[] {
  if (!kbConfig) return [text];
  const chunkSize = kbConfig.chunk_size;
  const overlap = kbConfig.chunk_overlap;
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + chunkSize;
    if (end >= text.length) {
      const c = text.slice(start).trim();
      if (c) chunks.push(title ? `${title}: ${c}` : c);
      break;
    }
    const slice = text.slice(start, end);
    const lastPeriod = slice.lastIndexOf(".");
    const lastNewline = slice.lastIndexOf("\n");
    const splitPoint = Math.max(lastPeriod, lastNewline);
    if (splitPoint > chunkSize * 0.5) {
      end = start + splitPoint + 1;
    }
    const c = text.slice(start, end).trim();
    if (c) chunks.push(title ? `${title}: ${c}` : c);
    start = end - overlap;
  }
  return chunks;
}

function classifyFreshness(query?: string, timeRange?: string, provider?: string, sourceType?: string): string {
  if (!kbConfig?.freshness?.auto_classify) {
    return kbConfig?.freshness?.default_tier || "stable";
  }

  if (timeRange === "day") return "ephemeral";
  if (timeRange === "week") return "recent";

  if (provider === "wikipedia") return "evergreen";
  if (sourceType === "corroborate") return "stable";
  if (sourceType === "fetch_page") return "stable";

  if (query) {
    const lower = query.toLowerCase();
    if (/\b(latest|current|today|breaking|live|now|just\s+in)\b/.test(lower)) return "ephemeral";
    if (/\b(recent|update|this\s+week|this\s+month)\b/.test(lower)) return "recent";
    if (/\b(202\d|this\s+year)\b/.test(lower)) return "recent";
  }

  return kbConfig?.freshness?.default_tier || "stable";
}

function computeFreshnessScore(tier: string, ingestedAt: number, now: number): number {
  const tiers = kbConfig?.freshness?.tiers;
  if (!tiers || !tiers[tier]) return 1;
  const def = tiers[tier];
  if (!def.decay_hours || def.decay_hours === 0) return 1;
  const ageHours = (now - ingestedAt) / (1000 * 60 * 60);
  const factor = Math.max(0, 1 - ageHours / def.decay_hours);
  return factor;
}

export function initKb(config: KbConfig): void {
  prefilter = null;
  const raw = resolvePath(config.storage_path);
  const previousPath = storagePath;

  sqliteStore?.close();
  sqliteStore = null;
  kbConfig = config;
  storagePath = raw;
  resolvedKey = null;
  lockError = null;
  if (!existsSync(raw)) mkdirSync(raw, { recursive: true, mode: 0o700 });

  const keyResult = config.encryption?.key_file
    ? safeResolveKeySource(config.encryption.key_file)
    : { key: null, error: null };
  let secret = keyResult.key;
  if (!secret && config.encryption?.enabled) {
    try {
      secret = resolveKeySource(config.encryption.key_file);
    } catch {
      secret = null;
    }
  }
  if (config.encryption?.enabled && !secret) {
    lockError = {
      code: "config_error",
      message: "Knowledge base encryption is enabled but no key is available",
      remediation: "Set INFOBROKER_KB_KEY / INFOBROKER_KB_PASSPHRASE or kb.encryption.key_file, then reload.",
    };
  } else {
    const migration = migrateLegacyJson({
      storagePath: raw,
      encryptionEnabled: config.encryption?.enabled ?? false,
      ...(config.encryption?.key_file ? { keyFile: config.encryption.key_file } : {}),
    });
    if (migration.status === "locked" || migration.status === "error") {
      lockError = {
        code: "config_error",
        message: migration.message ?? "Knowledge base migration failed",
        remediation: migration.remediation ?? "Fix the reported error and restart.",
      };
    } else if (!secret && sqliteStoreFormat(raw) === "encrypted") {
      lockError = {
        code: "config_error",
        message: "Knowledge base is encrypted but no key is available",
        remediation:
          "Provide the key and reload. If the key is lost, restore it from your backup; without the key the store is unrecoverable by design.",
      };
    } else {
      try {
        sqliteStore = new SqliteStore(raw, {
          secret,
          encryptionEnabled: config.encryption?.enabled ?? false,
        });
        sqliteStore.init();
        if (migration.event) sqliteStore.appendEvent(migration.event);
        if (previousPath !== null && previousPath !== raw) {
          const event =
            `Storage path changed at ${new Date().toISOString()}: ${previousPath} → ${raw}. ` +
            `Data at the previous path is not migrated; set kb.storage_path in config.local.json to restore it.`;
          console.warn(`[infobroker] ${event}`);
          sqliteStore.appendEvent(event);
        }
        if (!config.encryption?.enabled && sqliteStore.format() === "encrypted") {
          if (!secret) {
            lockError = {
              code: "config_error",
              message: "Knowledge base is encrypted but no key is available to disable encryption",
              remediation: "Provide the key, then reload. The store is untouched.",
            };
          } else {
            sqliteStore.disableEncryption(secret);
          }
        }
        resolvedKey = secret;
      } catch (e) {
        lockError = {
          code: "config_error",
          message: `Knowledge base could not be opened: ${e instanceof Error ? e.message : String(e)}`,
          remediation: "Inspect the knowledge-base directory and its permissions, or provide the correct key.",
        };
        sqliteStore?.close();
        sqliteStore = null;
      }
    }
  }

  configureModel(config.embedding_model);
  runTruncSweep();
  if (sqliteStore) syncModelState();
  runMaintenance();
  if (maintenanceTimer) clearInterval(maintenanceTimer);
  // REQ-066: a non-positive interval disables periodic maintenance rather than
  // scheduling a tight zero-delay loop.
  if (config.maintenance_interval_minutes > 0) {
    maintenanceTimer = setInterval(runMaintenance, config.maintenance_interval_minutes * 60 * 1000);
  }
}

export function flushKbWrites(): void {
  sqliteStore?.flush();
}

export function isKbConfigured(): boolean {
  return kbConfig !== null;
}

/** The lock state when the store could not be loaded (REQ-085), else null. */
export function getKbLockError(): { code: string; message: string; remediation: string } | null {
  return lockError;
}

export function getKbEncryptionState(): "enabled" | "disabled" | "locked" {
  if (lockError) return "locked";
  if (sqliteStore) return sqliteStore.format() === "encrypted" ? "enabled" : "disabled";
  return "disabled";
}

/**
 * Sweep stale truncated-response spill files from $TMPDIR/infobroker. Content
 * that exceeds the output length limit is written there in plaintext; these
 * files are transient and never cleaned elsewhere, so age them out here without
 * ever touching quota.json or any other persistent state.
 */
export function runTruncSweep(ttlMs: number = TRUNC_TTL_MS): number {
  const dir = join(tmpdir(), "infobroker");
  let removed = 0;
  try {
    if (!existsSync(dir)) return 0;
    const now = Date.now();
    for (const name of readdirSync(dir)) {
      if (!name.startsWith("trunc-") || !name.endsWith(".txt")) continue;
      const fpath = join(dir, name);
      try {
        if (now - statSync(fpath).mtimeMs > ttlMs) {
          unlinkSync(fpath);
          removed++;
        }
      } catch {
        // best effort
      }
    }
  } catch {
    // best effort
  }
  return removed;
}

// REQ-065: resolve the active collection from the most-specific specifier —
// a tool-provided parameter, then INFOBROKER_KB_COLLECTION, then the
// configured default, then the literal "default".
export function resolveCollection(explicit?: string): string {
  if (explicit && explicit.length > 0) return explicit;
  const env = process.env["INFOBROKER_KB_COLLECTION"];
  if (env && env.length > 0) return env;
  if (kbConfig?.default_collection) return kbConfig.default_collection;
  return "default";
}

function sqliteSearch(
  query: string,
  maxResults: number,
  collection?: string,
  sourceType?: string
): KbSearchResult[] {
  if (!sqliteStore) return [];
  syncModelState();
  const queryTokens = tokenize(query);
  const queryVec = activeModel.embed(query);
  const kwRegexes = queryTokens.map((t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
  const actualMax = Math.min(maxResults, kbConfig?.max_results ?? maxResults);
  const results: KbSearchResult[] = [];
  const now = Date.now();
  const collect = (chunk: KbChunk): void => {
    if (collection && chunk.collection !== collection) return;
    if (sourceType && chunk.source_type !== sourceType) return;
    const vecSimilarity = cosineSimilarity(queryVec, chunk.embedding);
    const kwScore = keywordScore(kwRegexes, chunk.text);
    const combinedScore = vecSimilarity * 0.7 + kwScore * 0.3;
    if (combinedScore <= 0) return;
    results.push({
      score: combinedScore,
      freshness_score: computeFreshnessScore(chunk.freshness_tier, chunk.ingested_at, now),
      freshness_tier: chunk.freshness_tier,
      source_url: chunk.source_url,
      title: chunk.title,
      snippet: chunk.text.slice(0, 200),
      collection: chunk.collection,
      provider: chunk.provider,
      source_type: chunk.source_type,
      ingested_at: chunk.ingested_at,
      ...(chunk.source_updated_at ? { source_updated_at: chunk.source_updated_at } : {}),
    });
  };

  // The bucket-overlap filter is sound only for the sparse lexical model.
  // LSA vectors are dense, so pruning would drop semantic-only matches.
  const lexical = activeModel.name === "signed-hash-tfidf" && !activeModel.requiresFit;
  if (lexical && !prefilter) {
    const built = new KbPrefilter();
    for (const chunk of sqliteStore.iterateChunks()) {
      built.add(chunk);
      collect(chunk);
    }
    prefilter = built;
  } else {
    let chunks = sqliteStore.iterateChunks();
    if (lexical && prefilter) {
      const candidates = prefilter.candidates(queryVec);
      if (candidates) chunks = sqliteStore.iterateChunksByIds(candidates);
    }
    for (const chunk of chunks) collect(chunk);
  }

  results.sort((a, b) => b.score * b.freshness_score - a.score * a.freshness_score);
  return results.slice(0, actualMax);
}

function sqliteIngest(
  text: string,
  title: string,
  sourceUrl: string,
  provider: string,
  collection?: string,
  sourceType?: string,
  freshnessTier?: string,
  sourceUpdatedAt?: string
): number {
  if (!sqliteStore) return 0;
  const resolvedCollection = resolveCollection(collection);
  const resolvedSourceType = sourceType || "web_search";
  const resolvedTier = freshnessTier || kbConfig?.freshness?.default_tier || "stable";
  const chunks = chunkText(text, title);
  if (chunks.length === 0) {
    sqliteStore.appendEvent(`Ingest skipped at ${new Date().toISOString()}: empty or unsplittable text (${text.slice(0, 80)})`);
    return 0;
  }
  const now = Date.now();

  if (sourceUrl && sourceUrl.startsWith("report://")) {
    const existingIds = new Set<string>();
    for (const chunk of sqliteStore.iterateChunks()) {
      if (chunk.source_url.startsWith("report://")) existingIds.add(chunk.source_url);
    }
    const incoming = `${title} ${text.slice(0, 500)}`;
    for (const id of existingIds) {
      if (id === sourceUrl) continue;
      let existingText = "";
      for (const chunk of sqliteStore.iterateChunks()) {
        if (chunk.source_url === id) {
          existingText = chunk.text;
          break;
        }
      }
      if (!existingText) continue;
      const sim = pairwiseSimilarity([incoming, `${title} ${existingText.slice(0, 500)}`], "lsa")[0]?.[1] ?? 0;
      if (sim >= 0.92) {
        sourceUrl = id;
        break;
      }
    }
  }

  if (sourceUrl) {
    if (!sourceUpdatedAt) {
      for (const chunk of sqliteStore.iterateChunks()) {
        if (chunk.source_url === sourceUrl && chunk.source_updated_at) {
          sourceUpdatedAt = chunk.source_updated_at;
          break;
        }
      }
    }
  }

  const useFitted = activeModel.requiresFit;
  if (!useFitted) syncModelState();
  const newChunks: KbChunk[] = chunks.map((chunkBody, index) => ({
    id: randomUUID(),
    text: chunkBody,
    embedding: useFitted ? [] : activeModel.embed(chunkBody),
    source_url: sourceUrl,
    chunk_index: index,
    title,
    provider,
    collection: resolvedCollection,
    source_type: resolvedSourceType,
    freshness_tier: resolvedTier,
    ingested_at: now,
    ...(sourceUpdatedAt ? { source_updated_at: sourceUpdatedAt } : {}),
  }));

  if (sourceUrl) {
    sqliteStore.replaceChunks(sourceUrl, newChunks);
    prefilter = null;
  } else {
    sqliteStore.insertChunks(newChunks);
    if (useFitted) prefilter = null;
    else if (prefilter) for (const chunk of newChunks) prefilter.add(chunk);
  }

  const meta = sqliteStore.meta();
  for (const chunkBody of chunks) {
    const seen = new Set<string>();
    for (const term of tokenize(chunkBody)) {
      if (seen.has(term)) continue;
      seen.add(term);
      meta.idf[term] = (meta.idf[term] || 0) + 1;
    }
    meta.docCount++;
  }
  sqliteStore.setMeta(meta);
  if (useFitted) refitFittedModel();
  return chunks.length;
}

function sqliteStats(): KbStats {
  const collections: Record<string, number> = {};
  const tiers: Record<string, number> = {};
  let count = 0;
  let lastIngestion = 0;
  if (sqliteStore) {
    for (const chunk of sqliteStore.iterateChunks()) {
      count++;
      collections[chunk.collection] = (collections[chunk.collection] || 0) + 1;
      tiers[chunk.freshness_tier] = (tiers[chunk.freshness_tier] || 0) + 1;
      if (chunk.ingested_at > lastIngestion) lastIngestion = chunk.ingested_at;
    }
  }
  let sizeBytes = 0;
  for (const name of [sqliteStore?.path ?? "", `${sqliteStore?.path ?? ""}-wal`, `${sqliteStore?.path ?? ""}-shm`]) {
    if (name && existsSync(name)) {
      try {
        sizeBytes += statSync(name).size;
      } catch {
        // sidecar disappeared between stat and open
      }
    }
  }
  return {
    chunk_count: count,
    collections,
    freshness_tiers: Object.keys(tiers).length > 0 ? tiers : undefined,
    storage_size_bytes: sizeBytes,
    last_ingestion: lastIngestion ? new Date(lastIngestion).toISOString() : null,
    model_available: modelAvailable,
    model_name: modelAvailable ? activeModel.name : modelConfiguredName,
    events: sqliteStore?.events() ?? [],
    encryption: getKbEncryptionState(),
  };
}

function sqliteList(collection?: string, sourceType?: string): KbListEntry[] {
  if (!sqliteStore) return [];
  const bySource = new Map<string, KbListEntry>();
  for (const chunk of sqliteStore.iterateChunks()) {
    if (collection && chunk.collection !== collection) continue;
    if (sourceType && chunk.source_type !== sourceType) continue;
    const key = chunk.source_url || `chunk:${chunk.id}`;
    const existing = bySource.get(key);
    if (existing) {
      existing.chunk_count++;
      if (chunk.ingested_at > existing.ingested_at) existing.ingested_at = chunk.ingested_at;
    } else {
      bySource.set(key, {
        source_url: chunk.source_url,
        title: chunk.title,
        collection: chunk.collection,
        source_type: chunk.source_type,
        freshness_tier: chunk.freshness_tier,
        chunk_count: 1,
        ingested_at: chunk.ingested_at,
        ...(chunk.source_updated_at ? { source_updated_at: chunk.source_updated_at } : {}),
      });
    }
  }
  return [...bySource.values()].sort((a, b) => b.ingested_at - a.ingested_at);
}

function sqliteGet(sourceUrl: string): ReturnType<typeof kbGet> {
  if (!sqliteStore) return null;
  const matches: KbChunk[] = [];
  for (const chunk of sqliteStore.iterateChunks()) {
    if (chunk.source_url === sourceUrl) matches.push(chunk);
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0));
  const first = matches[0];
  return {
    title: first.title,
    source_url: first.source_url,
    collection: first.collection,
    source_type: first.source_type,
    freshness_tier: first.freshness_tier,
    ingested_at: matches.reduce((m, c) => Math.max(m, c.ingested_at), 0),
    text: matches.map((c) => c.text).join("\n"),
    ...(first.source_updated_at ? { source_updated_at: first.source_updated_at } : {}),
  };
}

function sqliteDelete(collection?: string, sourceUrl?: string): number {
  if (!sqliteStore) return 0;
  if (!collection && !sourceUrl) throw new Error("invalid_input");
  const removed = sqliteStore.deleteWhere(
    (c) => (!!collection && c.collection === collection) || (!!sourceUrl && c.source_url === sourceUrl)
  );
  if (removed > 0) {
    prefilter = null;
    rebuildIdf();
    refitFittedModel();
  }
  return removed;
}

export function kbSearch(
  query: string,
  maxResults: number = 10,
  collection?: string,
  sourceType?: string
): KbSearchResult[] {
  if (!kbConfig) throw new Error(CONFIG_ERROR_CODE);
  if (!sqliteStore) return [];
  return sqliteSearch(query, maxResults, collection, sourceType);
}

export function kbIngest(
  text: string,
  title: string,
  sourceUrl: string,
  provider: string,
  collection?: string,
  sourceType?: string,
  freshnessTier?: string,
  sourceUpdatedAt?: string
): number {
  if (!kbConfig) throw new Error(CONFIG_ERROR_CODE);
  if (!sqliteStore) return 0;
  return sqliteIngest(text, title, sourceUrl, provider, collection, sourceType, freshnessTier, sourceUpdatedAt);
}

export function kbStats(): KbStats {
  if (!kbConfig) {
    return {
      chunk_count: 0,
      collections: {},
      storage_size_bytes: 0,
      last_ingestion: null,
      model_available: false,
      model_name: "none",
      events: ["knowledge base not configured"],
    };
  }

  if (!sqliteStore) {
    return {
      chunk_count: 0,
      collections: {},
      storage_size_bytes: 0,
      last_ingestion: null,
      model_available: modelAvailable,
      model_name: modelAvailable ? activeModel.name : modelConfiguredName,
      events: ["knowledge base store unavailable"],
    };
  }
  return sqliteStats();
}

export function kbList(collection?: string, sourceType?: string): KbListEntry[] {
  if (!kbConfig) throw new Error(CONFIG_ERROR_CODE);
  if (!sqliteStore) return [];
  return sqliteList(collection, sourceType);
}

export function kbGet(sourceUrl: string): { title: string; source_url: string; collection: string; source_type: string; freshness_tier: string; ingested_at: number; text: string; source_updated_at?: string } | null {
  if (!kbConfig) throw new Error(CONFIG_ERROR_CODE);
  if (!sqliteStore) return null;
  return sqliteGet(sourceUrl);
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "report";
}

export function resolveReportIdentity(title: string, providedUrl?: string): string {
  if (providedUrl) return providedUrl;
  return `report://${slugify(title)}`;
}

/** True when the active backend persists the claim ledger (REQ-109). */
export function kbSupportsClaims(): boolean {
  return sqliteStore !== null;
}

/**
 * REQ-109: persist the claims from one verification run. Best-effort by
 * contract: the caller (verify_claims) must never fail because of this, so
 * every error is swallowed here and reported only as a false return.
 */
export function kbRecordClaims(
  claims: ReadonlyArray<{
    claim: string;
    verdict: ClaimRecord["verdict"];
    confidence: number;
    sources: ReadonlyArray<{ url: string; title: string; retrieved_at: string }>;
  }>
): boolean {
  try {
    if (!sqliteStore) return false;
    sqliteStore.upsertClaims(claims);
    return true;
  } catch {
    return false;
  }
}

/**
 * REQ-060h: read persisted claims newest-first from the SQLite ledger.
 */
export function kbClaims(query: ClaimLedgerQuery = {}): ClaimLedgerResult | null {
  if (!kbConfig) throw new Error(CONFIG_ERROR_CODE);
  if (!sqliteStore) return null;
  return sqliteStore.claims(query);
}

/** True when the active backend can persist report receipts (REQ-110). */
export function kbSupportsReportReceipts(): boolean {
  return sqliteStore !== null;
}

/** Read the cached document text for one identity, or null when absent. */
function cachedDocument(url: string): { text: string; title: string } | null {
  const doc = url === "" ? null : kbGet(url);
  // REQ-122: a snippet snapshot is an excerpt, not a document. Treating it as
  // a cached document would let a receipt report document-grade verification.
  if (doc === null || doc.source_type === SNIPPET_SOURCE_TYPE) return null;
  return { text: doc.text, title: doc.title };
}

/**
 * REQ-110: compute and store the receipt for a report. The caller has already
 * validated the structure; the identity and the content hash come from the
 * stored document, never from the caller.
 */
export function kbPutReportReceipt(
  reportId: string,
  receipt: ReportReceiptInput,
): { ok: true; record: ReportReceiptRecord } | { ok: false; error: ReceiptInputError } {
  const normalized = normalizeReceiptInput(receipt);
  if (!normalized.ok) return normalized;
  if (!sqliteStore) {
    return {
      ok: false,
      error: { code: "receipt_requires_kb", message: "report receipts require the SQLite knowledge-base store" },
    };
  }
  const doc = kbGet(reportId);
  if (doc === null) {
    return { ok: false, error: { code: "invalid_input", message: "report is not stored in the knowledge base" } };
  }
  // The report hash covers the canonical stored document (kbGet text), which
  // differs from the pre-chunk input because chunking prefixes the title.
  const manifest = buildReceiptManifest({
    reportId,
    contentSha256: sha256Hex(doc.text),
    claims: normalized.value.claims,
    ...(normalized.value.report ? { report: normalized.value.report } : {}),
    cachedDocument,
  });
  const record = sqliteStore.putReportReceipt(reportId, manifest);
  return { ok: true, record };
}

/** Read a stored receipt without verifying it (tests and diagnostics). */
export function kbGetReportReceipt(reportId: string): ReportReceiptRecord | null {
  if (!sqliteStore?.getReportReceipt) return null;
  return sqliteStore.getReportReceipt(reportId);
}

/**
 * REQ-060i: revalidate a stored receipt offline. No network access is made;
 * the report and every cited source are compared against the cache only.
 */
export function kbVerifyReport(
  reportId: string,
): { ok: true; result: ReportVerificationResult } | { ok: false; error: { code: string; message: string } } {
  if (!kbConfig) throw new Error(CONFIG_ERROR_CODE);
  if (!sqliteStore) {
    return { ok: false, error: { code: "config_error", message: "knowledge base store is unavailable" } };
  }
  const record = sqliteStore.getReportReceipt(reportId);
  if (record === null) {
    return {
      ok: false,
      error: { code: "receipt_not_found", message: `No report receipt is stored for "${reportId}"` },
    };
  }
  const doc = kbGet(reportId);
  const result = verifyReceipt({
    manifest: record.manifest,
    reportText: doc === null ? null : doc.text,
    cachedDocument: (url) => cachedDocument(url)?.text ?? null,
  });
  const createdAtMs = Date.parse(record.created_at);
  const ageDays = Number.isFinite(createdAtMs) ? Math.floor((Date.now() - createdAtMs) / 86_400_000) : undefined;
  const tier = doc?.freshness_tier;
  const decayHours = tier ? kbConfig.freshness?.tiers?.[tier]?.decay_hours : undefined;
  const ageHours = Number.isFinite(createdAtMs) ? (Date.now() - createdAtMs) / 3_600_000 : undefined;
  const stale = decayHours !== undefined && decayHours > 0 && ageHours !== undefined ? ageHours > decayHours : undefined;
  return {
    ok: true,
    result: {
      ...result,
      created_at: record.created_at,
      ...(ageDays !== undefined ? { age_days: ageDays } : {}),
      ...(tier ? { freshness_tier: tier } : {}),
      ...(stale !== undefined ? { stale } : {}),
    },
  };
}

export function kbDelete(collection?: string, sourceUrl?: string): number {
  if (!kbConfig) throw new Error(CONFIG_ERROR_CODE);
  if (!sqliteStore) return 0;
  return sqliteDelete(collection, sourceUrl);
}

function rebuildIdf(): void {
  if (sqliteStore) {
    const meta = sqliteStore.meta();
    meta.idf = {};
    meta.docCount = 0;
    for (const chunk of sqliteStore.iterateChunks()) {
      const seen = new Set<string>();
      for (const t of tokenize(chunk.text)) {
        if (seen.has(t)) continue;
        seen.add(t);
        meta.idf[t] = (meta.idf[t] || 0) + 1;
      }
      meta.docCount++;
    }
    sqliteStore.setMeta(meta);
  }
}

export function autoIndex(
  results: Array<{ title: string; url: string; snippet: string; source_updated_at?: string }>,
  provider: string,
  collection?: string,
  sourceType?: string,
  query?: string,
  timeRange?: string
): void {
  if (!kbConfig || !kbConfig.auto_index) return;
  if (!sqliteStore) return;

  setImmediate(async () => {
    try {
      let totalChunks = 0;
      let flagged = 0;
      const tier = classifyFreshness(query, timeRange, provider, sourceType || provider);
      for (const r of results) {
        if (!r.snippet && !r.title) continue;
        const text = r.snippet || r.title;
        const sourceUrl = r.url || "";
        // REQ-097: content the policy flags is never stored, in every mode.
        const policy = await checkContent(`${r.title}\n${text}`, sourceUrl);
        if (policy.flagged) {
          flagged++;
          continue;
        }
        totalChunks += kbIngest(text, r.title, sourceUrl, provider, collection, sourceType || provider, tier, r.source_updated_at);
      }
      if (flagged > 0) {
        sqliteStore?.appendEvent(`Auto-index skipped ${flagged} flagged item(s) at ${new Date().toISOString()}`);
      }
      if (totalChunks > 0) flushKbWrites();
    } catch {
      sqliteStore?.appendEvent(`Auto-index error at ${new Date().toISOString()}`);
    }
  });
}

/**
 * REQ-099: the directory within which tool-surface key-material file
 * operations are confined. Defaults to a `keys` sibling of the storage path
 * when not configured; always resolves `~` to the home directory.
 */
function resolveKeysDir(): string {
  const configured = kbConfig?.keys_dir;
  if (configured) return resolvePath(configured);
  if (storagePath) return join(resolvePath(storagePath), "..", "keys");
  return join(homedir(), ".local", "share", "infobroker", "keys");
}

/**
 * REQ-099: resolve a caller-supplied key path and refuse it when it escapes
 * the keys directory. Returns the resolved absolute path on success.
 */
export function resolveKeyFile(path: string): string {
  const dir = resolveKeysDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const resolved = resolvePath(path);
  const rel = relative(dir, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Key file path "${path}" is outside the keys directory (${dir})`);
  }
  return resolved;
}

export function runMaintenance(): void {
  if (sqliteStore) {
    const tiers = kbConfig?.freshness?.tiers;
    if (!tiers) return;
    const now = Date.now();
    const removed = sqliteStore.deleteWhere((chunk) => {
      const def = tiers[chunk.freshness_tier];
      if (!def || !def.expiry_hours || def.expiry_hours <= 0) return false;
      const cutoff = now - def.expiry_hours * 60 * 60 * 1000;
      return chunk.ingested_at <= cutoff;
    });
    if (removed > 0) {
      prefilter = null;
      rebuildIdf();
      refitFittedModel();
      sqliteStore.appendEvent(`Maintenance at ${new Date().toISOString()}: removed ${removed} expired chunks`);
    }
  }
}

/**
 * Encrypt report bytes for disk save when encryption is enabled. Returns the
 * sealed envelope bytes, or the plaintext bytes when encryption is disabled
 * (or no key is resolved).
 */
export function sealReportBytes(clear: Buffer): Buffer {
  if (kbConfig?.encryption?.enabled) {
    const key = resolvedKey ?? resolveKeySource(kbConfig.encryption.key_file);
    // REQ-084: with encryption enabled there is no plaintext fallback. A
    // missing key is an error, never a silent plaintext report on disk.
    if (!key) {
      throw new Error("Knowledge base encryption is enabled but no key is available");
    }
    const sealed = sealEnvelope(key, clear);
    const rechecked = openEnvelope(key, sealed);
    if (!rechecked.equals(clear)) {
      throw new Error("report encryption self-verify failed");
    }
    return sealed;
  }
  return clear;
}

/**
 * Re-seal an on-disk encrypted store from one key to another without loss of
 * stored content (REQ-084 "change the secret"). Verifies the result before the
 * atomic commit. Returns a human-readable result, or null when the store is not
 * encrypted. Supports null `from` (use the currently-resolved/in-hand key) for
 * in-tool re-key where the source secret is already loaded.
 */
export function rekeyStoreTo(from: ResolvedKey | null, to: ResolvedKey): string | null {
  if (!sqliteStore) return null;
  const src = from ?? resolvedKey;
  if (!src) return null;
  const result = sqliteStore.rekey(src, to);
  if (result) {
    resolvedKey = to;
    audit("key_rekeyed", sqliteStore.path);
  }
  return result;
}

/**
 * Re-key the store from one secret to another (REQ-084 "change the secret
 * without loss of stored content"). Reads the rekey source/target from the
 * environment; wraps rekeyStoreTo, which re-seals the store atomically and
 * records the operation in the store events. Returns a human-readable result,
 * or null when no rekey is requested or the store is not encrypted.
 */
export function rekeyStore(): string | null {
  const fromEnv = rawKeyFromString(process.env["INFOBROKER_KB_REKEY_FROM"])
    ?? passphraseKey(process.env["INFOBROKER_KB_REKEY_FROM_PASSPHRASE"]);
  const toFromKeyFile = process.env["INFOBROKER_KB_REKEY_TO_KEY_FILE"]
    ? { kind: "raw", dek: readKeyFile(process.env["INFOBROKER_KB_REKEY_TO_KEY_FILE"]) } as ResolvedKey
    : null;
  const to = rawKeyFromString(process.env["INFOBROKER_KB_REKEY_TO"])
    ?? passphraseKey(process.env["INFOBROKER_KB_REKEY_TO_PASSPHRASE"])
    ?? toFromKeyFile;

  if (!fromEnv || !to) return null;
  return rekeyStoreTo(fromEnv, to);
}

/**
 * Write a fresh 32-byte raw key (base64) to `path` with 0600 permissions and
 * return the path. Never returns the secret material — the caller learns only
 * where the key lives and that it must be backed up.
 */
export function generateKeyFile(path: string): string {
  const key = randomBytes(32).toString("base64");
  const resolved = resolveKeyFile(path);
  const dir = dirname(resolved);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  atomicWriteFile(resolved, Buffer.from(`${key}\n`, "utf-8"));
  audit("key_generated", resolved);
  return resolved;
}

/**
 * Verify the currently-resolved (or explicitly provided) secret against the
 * on-disk store without writing anything. Returns true when the secret opens
 * the envelope to a valid store, false otherwise (missing store, plaintext
 * store, wrong key, or tampered store).
 */
export function verifyStoreKey(key?: ResolvedKey): boolean {
  if (!sqliteStore) return false;
  const candidate = key ?? resolvedKey;
  return candidate ? sqliteStore.verifyKey(candidate) : false;
}

/**
 * Copy the currently-resolved key file to a backup path (0600) so the user has
 * a recovery artifact. Returns the backup path. The secret itself is never
 * returned. If the active key source is not a file, returns null.
 */
export function backupKeyFile(backupPath: string): string | null {
  const keyFile = kbConfig?.encryption?.key_file;
  const resolved = safeResolveKeySource(keyFile).key;
  if (!keyFile || !resolved || resolved.kind !== "raw") return null;
  const src = resolvePath(keyFile);
  if (!existsSync(src)) return null;
  const dst = resolveKeyFile(backupPath);
  const dir = dirname(dst);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  copyFileSync(src, dst);
  chmodSync(dst, 0o600);
  sqliteStore?.appendEvent(`Encryption key backed up at ${new Date().toISOString()}: ${dst}`);
  audit("key_backed_up", dst);
  return dst;
}

/** On-disk format of the store at rest: "encrypted", "plaintext", or "none". */
export function kbStoreFormat(): "encrypted" | "plaintext" | "none" {
  if (sqliteStore) return sqliteStore.format();
  if (storagePath) return sqliteStoreFormat(storagePath);
  return "none";
}

/**
 * Structured encryption status for the client-facing `encryption` action:
 * current state, on-disk format, active key-source kind, whether the key
 * currently resolves, and (when locked) the lock error with its remediation.
 */
export function kbEncryptionStatus(): {
  state: "enabled" | "disabled" | "locked";
  on_disk_format: "encrypted" | "plaintext" | "none";
  key_source: "key_file" | "raw_env" | "passphrase" | "none";
  key_resolvable: boolean;
  lock: { code: string; message: string; remediation: string } | null;
} {
  const keyFile = kbConfig?.encryption?.key_file;
  const resolved = safeResolveKeySource(keyFile).key;
  let keySource: "key_file" | "raw_env" | "passphrase" | "none" = "none";
  if (keyFile) keySource = "key_file";
  else if (process.env["INFOBROKER_KB_KEY"]) keySource = "raw_env";
  else if (process.env["INFOBROKER_KB_PASSPHRASE"]) keySource = "passphrase";
  return {
    state: getKbEncryptionState(),
    on_disk_format: kbStoreFormat(),
    key_source: keySource,
    key_resolvable: resolved !== null,
    lock: lockError,
  };
}
