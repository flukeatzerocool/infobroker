// @implements REQ-060 REQ-060a REQ-060b REQ-060c REQ-060d REQ-060e REQ-060f REQ-064 REQ-065 REQ-066 REQ-067 REQ-072 REQ-074 REQ-075 REQ-076 REQ-082 REQ-083 REQ-084 REQ-085 REQ-086
import { randomUUID, randomBytes } from "node:crypto";
import {
  readFileSync,
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
import { join, dirname, basename } from "node:path";
import { homedir, tmpdir } from "node:os";
import type { KbConfig, KbChunk, KbSearchResult, KbListEntry, KbStats } from "./types.js";
import {
  sealEnvelope,
  openEnvelope,
  isEncryptedEnvelope,
  resolveKeySource,
  rawKeyFromString,
  passphraseKey,
  readKeyFile,
  type ResolvedKey,
} from "./kb-crypto.js";

interface VectorStore {
  chunks: KbChunk[];
  idf: Record<string, number>;
  docCount: number;
  events: string[];
  model?: string;
}

let store: VectorStore | null = null;
let kbConfig: KbConfig | null = null;
let storagePath: string | null = null;
let maintenanceTimer: ReturnType<typeof setInterval> | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let resolvedKey: ResolvedKey | null = null;
let lockError: { code: string; message: string; remediation: string } | null = null;
let loadedStat: { mtimeMs: number; size: number } | null = null;
const WRITE_INTERVAL_MS = 30_000;
const modelAvailable = true;
const CONFIG_ERROR_CODE = "config_error";
const KB_UNINITIALIZED = "knowledge base not configured";
const TRUNC_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const STORE_FILENAME = "vector-store.json";

function resolvePath(p: string): string {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function computeTf(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }
  const total = tokens.length || 1;
  for (const k of Object.keys(tf)) {
    tf[k] /= total;
  }
  return tf;
}

function computeTfIdfVector(tokens: string[], idf: Record<string, number>, docCount: number): number[] {
  return activeModel.vectorize(tokens, idf, docCount);
}

interface EmbeddingModel {
  name: string;
  vectorize(tokens: string[], idf: Record<string, number>, docCount: number): number[];
}

// The built-in, zero-dependency model. A richer model can be registered at
// startup without changing call sites: assign `activeModel` to a new
// implementation and report its `name` via kbStats (REQ-060c).
const HASH_DIMS = 4096;

function hashIndex(token: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hashSign(token: string): number {
  let h = 5381;
  for (let i = 0; i < token.length; i++) {
    h = ((h << 5) + h) ^ token.charCodeAt(i);
  }
  return h >>> 0;
}

const activeModel: EmbeddingModel = {
  name: "signed-hash-tfidf",
  vectorize(tokens, idf, docCount) {
    return tfIdfVectorize(tokens, idf, docCount);
  },
};

function tfIdfVectorize(tokens: string[], idf: Record<string, number>, docCount: number): number[] {
  const tf = computeTf(tokens);
  const nDocs = docCount || 1;
  const vec: number[] = new Array(HASH_DIMS).fill(0);
  for (const term of Object.keys(tf)) {
    const idfVal = Math.log((nDocs + 1) / ((idf[term] || 0) + 1)) + 1;
    const weight = tf[term] * idfVal;
    const idx = hashIndex(term) % HASH_DIMS;
    const sign = (hashSign(term) & 1) === 0 ? 1 : -1;
    vec[idx] += sign * weight;
  }
  return vec;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
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

function storeFilePath(): string | null {
  return storagePath ? join(storagePath, STORE_FILENAME) : null;
}

function atomicWriteFile(fpath: string, bytes: Buffer): void {
  const dir = dirname(fpath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
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

function readStoreBytes(): Buffer | null {
  const fpath = storeFilePath();
  if (!fpath || !existsSync(fpath)) return null;
  return readFileSync(fpath, null);
}

function loadStore(): void {
  lockError = null;
  loadedStat = null;
  const fpath = storeFilePath();
  if (!fpath || !existsSync(fpath)) {
    store = { chunks: [], idf: {}, docCount: 0, events: [] };
    return;
  }

  const st = statSync(fpath);
  loadedStat = { mtimeMs: st.mtimeMs, size: st.size };

  const bytes = readStoreBytes()!;
  const encrypted = isEncryptedEnvelope(bytes);

  if (encrypted) {
    // The on-disk state is authoritative: an encrypted store requires a key
    // regardless of the current `enabled` flag. Never rename, never reset.
    const key = resolveKeySource(kbConfig?.encryption?.key_file);
    if (!key) {
      store = null;
      lockError = {
        code: "config_error",
        message: "Knowledge base is encrypted but no key is configured",
        remediation:
          "Set INFOBROKER_KB_KEY or INFOBROKER_KB_PASSPHRASE, or point kb.encryption.key_file at a key file, then reload. Data is preserved and untouched. If the key is lost, restore it from a backup (see kb encryption 'backup' action) — without the key the store is unrecoverable by design.",
      };
      return;
    }
    try {
      const plain = openEnvelope(key, bytes).toString("utf-8");
      const raw = JSON.parse(plain);
      if (raw && Array.isArray(raw.chunks) && typeof raw.idf === "object") {
        resolvedKey = key;
        store = raw as VectorStore;
        return;
      }
      throw new Error("decrypted store is not a valid knowledge base");
    } catch {
      store = null;
      lockError = {
        code: "config_error",
        message: "Knowledge base could not be decrypted (wrong key or tampered store)",
        remediation:
          "Verify the key matches the one used to encrypt the store (see kb encryption 'verify' action). The store file has not been modified; fix the key and restart. If the key was lost, restore it from a backup or re-key from a known secret (kb encryption 'rekey').",
      };
      return;
    }
  }

  // Plaintext (legacy) store.
  try {
    const raw = JSON.parse(bytes.toString("utf-8"));
    if (raw && Array.isArray(raw.chunks) && typeof raw.idf === "object") {
      store = raw as VectorStore;
      return;
    }
  } catch {
    // fall through to corruption handling below
  }

  // The file is plaintext but unreadable as a store.
  if (kbConfig?.encryption?.enabled) {
    // When encryption is enabled we must not guess or reset: leave the file
    // untouched for recovery.
    store = null;
    lockError = {
      code: "config_error",
      message: "Knowledge base store is unreadable; enabled encryption prevents automatic recovery",
      remediation: "Inspect vector-store.json; restore a backup or disable encryption to enable legacy recovery.",
    };
    return;
  }

  backupCorruptStore();
  store = { chunks: [], idf: {}, docCount: 0, events: [] };
}

function scheduleWrite(): void {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    saveStore();
  }, WRITE_INTERVAL_MS);
}

function flushWrite(): void {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
    saveStore();
  } else {
    saveStore();
  }
}

process.on("beforeExit", () => flushWrite());
process.on("exit", () => flushWrite());

function saveStore(): void {
  const fpath = storeFilePath();
  if (!fpath || !store) return;

  // Detect-and-warn: if another process wrote the store since we loaded it,
  // surface the hazard rather than silently overwriting (single-writer model).
  if (loadedStat) {
    try {
      const st = statSync(fpath);
      if (st.mtimeMs !== loadedStat.mtimeMs || st.size !== loadedStat.size) {
        store.events.push(
          `Concurrent-write detected at ${new Date().toISOString()}: the store changed on disk since it was loaded; this process's pending changes may overwrite those of another instance`
        );
        loadedStat = { mtimeMs: st.mtimeMs, size: st.size };
      }
    } catch {
      // file vanished; loadedStat reset on next load
    }
  }

  let bytes: Buffer;
  const clearJson = Buffer.from(JSON.stringify(store), "utf-8");

  if (kbConfig?.encryption?.enabled) {
    const key = resolvedKey ?? resolveKeySource(kbConfig?.encryption?.key_file);
    if (!key) {
      // Should not happen after a successful load, but never write plaintext
      // when encryption is enabled.
      lockError = {
        code: "config_error",
        message: "Knowledge base encryption key unavailable at write time",
        remediation: "Reconfigure the key and restart; no data was written.",
      };
      return;
    }
    try {
      const sealed = sealEnvelope(key, clearJson);
      // Self-verify before rename: the sealed blob must round-trip to the same
      // plaintext, otherwise the atomic rename is skipped and the old file
      // remains intact.
      const rechecked = openEnvelope(key, sealed).toString("utf-8");
      if (rechecked !== clearJson.toString("utf-8")) {
        throw new Error("encryption self-verify failed");
      }
      bytes = sealed;
      resolvedKey = key;
    } catch (e) {
      store.events.push(`Encryption write failed at ${new Date().toISOString()}: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
  } else {
    bytes = clearJson;
  }

  try {
    atomicWriteFile(fpath, bytes);
    const st = statSync(fpath);
    loadedStat = { mtimeMs: st.mtimeMs, size: st.size };
  } catch {
    // fail silently — will retry on next write
  }
}

function backupCorruptStore(): void {
  const fpath = storeFilePath();
  if (!fpath || !existsSync(fpath)) return;
  try {
    const backup = join(storagePath!, `vector-store.corrupt.${Date.now()}.json`);
    renameSync(fpath, backup);
    chmodSync(backup, 0o600);
    if (store) store.events.push(`Storage corruption detected at ${new Date().toISOString()}. Backup: ${backup}`);
  } catch {
    // best effort
  }
}

function getIdf(): Record<string, number> {
  return store?.idf ?? {};
}

function getDocCount(): number {
  return store?.docCount ?? 0;
}

function updateIdf(tokens: string[]): void {
  if (!store) return;
  const seen = new Set<string>();
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    store.idf[t] = (store.idf[t] || 0) + 1;
  }
  store.docCount++;
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
  const raw = resolvePath(config.storage_path);
  const wasEncrypted = storagePath !== null && (kbConfig?.encryption?.enabled ?? false);

  // If the storage path changes (e.g. an update alters the shipped default, or
  // a user overlay stops overriding it), flush any pending in-memory writes to
  // the *current* path before re-initializing — otherwise unflushed chunks
  // would be silently dropped. Data at the previous path is never migrated.
  if (storagePath !== null && storagePath !== raw) {
    flushWrite();
    const oldPath = storagePath;
    kbConfig = config;
    storagePath = raw;
    resolvedKey = null;
    lockError = null;
    if (!existsSync(raw)) mkdirSync(raw, { recursive: true });
    loadStore();
    const event =
      `Storage path changed at ${new Date().toISOString()}: ${oldPath} → ${raw}. ` +
      `Data at the previous path is not migrated; set kb.storage_path in config.local.json to restore it.`;
    console.warn(`[infobroker] ${event}`);
    if (store) store.events.push(event);
  } else {
    kbConfig = config;
    storagePath = raw;
    if (!existsSync(raw)) mkdirSync(raw, { recursive: true });
    resolvedKey = null;
    lockError = null;
    loadStore();
  }

  // Resolve the encryption key after load so the in-hand key is registered for
  // subsequent writes. Warn loudly when encryption was just enabled.
  const newlyEnabled = config.encryption?.enabled && !wasEncrypted;
  const newlyDisabled = wasEncrypted && !(config.encryption?.enabled ?? false);
  if (config.encryption?.enabled && !resolvedKey && store !== null) {
    resolvedKey = resolveKeySource(config.encryption?.key_file) ?? null;
  }
  // Re-key runs as a one-shot at init (operator shell, not a client) when the
  // rekey source/target environment variables are present. rekeyStore re-seals
  // the file and updates the in-memory store directly, so no reload is needed.
  try {
    const result = rekeyStore();
    if (result) {
      console.warn(`[infobroker] ${result}`);
    }
  } catch (e) {
    console.error(`[infobroker] rekey failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (newlyEnabled && config.encryption?.enabled) {
    if (!resolvedKey && !lockError) {
      lockError = {
        code: "config_error",
        message: "Knowledge base encryption is enabled but no key is available",
        remediation: "Set INFOBROKER_KB_KEY / INFOBROKER_KB_PASSPHRASE or kb.encryption.key_file, then reload.",
      };
      store = null;
    } else {
      console.warn(
        "[infobroker] Knowledge base encryption has been enabled. Enabling encryption makes the store unrecoverable without the key — back up your key now."
      );
      // Eager migration: encrypt the legacy plaintext store immediately so no
      // plaintext copy lingers on disk.
      if (store !== null && resolvedKey) saveStore();
    }
  }

  // Disabling encryption is an explicit, immediate transition: the store is
  // already decrypted in memory (loadStore requires the key regardless of the
  // enabled flag), so flush it to plaintext now rather than deferring to the
  // next write. This is the reverse of the eager migrate-on-enable above.
  if (newlyDisabled && store !== null) {
    try {
      saveStore();
      console.warn("[infobroker] Knowledge base encryption has been disabled. The store has been decrypted to plaintext on disk.");
    } catch (e) {
      console.error(`[infobroker] decryption-on-disable failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  runTruncSweep();

  if (store) ensureStableEmbeddings();
  runMaintenance();
  if (maintenanceTimer) clearInterval(maintenanceTimer);
  maintenanceTimer = setInterval(runMaintenance, config.maintenance_interval_minutes * 60 * 1000);
}

function ensureStableEmbeddings(): void {
  if (!store) return;
  if (store.model === activeModel.name) return;
  let reembedded = 0;
  for (const chunk of store.chunks) {
    chunk.embedding = activeModel.vectorize(tokenize(chunk.text), store.idf, store.docCount);
    reembedded++;
  }
  store.model = activeModel.name;
  store.events.push(
    `Embedding model reconciled at ${new Date().toISOString()}: "${activeModel.name}", ${reembedded} chunk(s) re-embedded`
  );
  saveStore();
}

export function flushKbWrites(): void {
  flushWrite();
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
  return kbConfig?.encryption?.enabled ? "enabled" : "disabled";
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

export function getKbConfig(): KbConfig | null {
  return kbConfig;
}

export function kbSearch(
  query: string,
  maxResults: number = 10,
  collection?: string,
  sourceType?: string
): KbSearchResult[] {
  if (!kbConfig) throw new Error(CONFIG_ERROR_CODE);
  if (!store) return [];

  const queryTokens = tokenize(query);
  const queryVec = computeTfIdfVector(queryTokens, getIdf(), getDocCount());
  const kwRegexes = queryTokens.map((t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
  const actualMax = Math.min(maxResults, kbConfig.max_results);
  const results: KbSearchResult[] = [];
  const now = Date.now();

  for (const chunk of store.chunks) {
    if (collection && chunk.collection !== collection) continue;
    if (sourceType && chunk.source_type !== sourceType) continue;

    const vecSimilarity = cosineSimilarity(queryVec, chunk.embedding);
    const kwScore = keywordScore(kwRegexes, chunk.text);
    const combinedScore = vecSimilarity * 0.7 + kwScore * 0.3;

    if (combinedScore > 0) {
      const freshnessScore = computeFreshnessScore(chunk.freshness_tier, chunk.ingested_at, now);
      results.push({
        score: combinedScore,
        freshness_score: freshnessScore,
        freshness_tier: chunk.freshness_tier,
        source_url: chunk.source_url,
        title: chunk.title,
        snippet: chunk.text.slice(0, 200),
        collection: chunk.collection,
        provider: chunk.provider,
        source_type: chunk.source_type,
        ingested_at: chunk.ingested_at,
      });
    }
  }

  results.sort((a, b) => (b.score * b.freshness_score) - (a.score * a.freshness_score));
  return results.slice(0, actualMax);
}

export function kbIngest(
  text: string,
  title: string,
  sourceUrl: string,
  provider: string,
  collection?: string,
  sourceType?: string,
  freshnessTier?: string
): number {
  if (!kbConfig) throw new Error(CONFIG_ERROR_CODE);
  if (!store) return 0;
  const s = store;

  const resolvedCollection = collection || kbConfig.default_collection || "default";
  const resolvedSourceType = sourceType || "web_search";
  const resolvedTier = freshnessTier || kbConfig?.freshness?.default_tier || "stable";
  const chunks = chunkText(text, title);

  if (chunks.length === 0) {
    s.events.push(`Ingest skipped at ${new Date().toISOString()}: empty or unsplittable text (${text.slice(0, 80)})`);
    return 0;
  }

  const now = Date.now();

  if (sourceUrl) {
    s.chunks = s.chunks.filter((c) => c.source_url !== sourceUrl);
  }

  const preIngestIdf = { ...s.idf };
  const preIngestDocCount = s.docCount;

  chunks.forEach((chunkText, index) => {
    const tokens = tokenize(chunkText);
    const embedding = computeTfIdfVector(tokens, preIngestIdf, preIngestDocCount);
    const id = randomUUID();
    s.chunks.push({
      id,
      text: chunkText,
      embedding,
      source_url: sourceUrl,
      chunk_index: index,
      title,
      provider,
      collection: resolvedCollection,
      source_type: resolvedSourceType,
      freshness_tier: resolvedTier,
      ingested_at: now,
    });
  });

  for (const chunkText of chunks) {
    updateIdf(tokenize(chunkText));
  }

  scheduleWrite();
  return chunks.length;
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

  const collections: Record<string, number> = {};
  const tiers: Record<string, number> = {};
  let lastIngestion = 0;
  for (const c of store?.chunks ?? []) {
    collections[c.collection] = (collections[c.collection] || 0) + 1;
    tiers[c.freshness_tier] = (tiers[c.freshness_tier] || 0) + 1;
    if (c.ingested_at > lastIngestion) lastIngestion = c.ingested_at;
  }

  let sizeBytes = 0;
  if (storagePath && existsSync(join(storagePath, STORE_FILENAME))) {
    try {
      sizeBytes = readFileSync(join(storagePath, STORE_FILENAME)).length;
    } catch {
      // ignore
    }
  }

  return {
    chunk_count: store?.chunks.length ?? 0,
    collections,
    freshness_tiers: Object.keys(tiers).length > 0 ? tiers : undefined,
    storage_size_bytes: sizeBytes,
    last_ingestion: lastIngestion ? new Date(lastIngestion).toISOString() : null,
    model_available: modelAvailable,
    model_name: activeModel.name,
    events: store?.events ?? [],
    encryption: getKbEncryptionState(),
  };
}

export function kbList(collection?: string, sourceType?: string): KbListEntry[] {
  if (!kbConfig) throw new Error(CONFIG_ERROR_CODE);
  if (!store) return [];

  const bySource = new Map<string, KbListEntry>();
  for (const chunk of store.chunks) {
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
      });
    }
  }

  return [...bySource.values()].sort((a, b) => b.ingested_at - a.ingested_at);
}

export function kbGet(sourceUrl: string): { title: string; source_url: string; collection: string; source_type: string; freshness_tier: string; ingested_at: number; text: string } | null {
  if (!kbConfig) throw new Error(CONFIG_ERROR_CODE);
  if (!store) return null;

  const matches = store.chunks
    .filter((c) => c.source_url === sourceUrl)
    .sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0));

  if (matches.length === 0) return null;

  const first = matches[0];
  return {
    title: first.title,
    source_url: first.source_url,
    collection: first.collection,
    source_type: first.source_type,
    freshness_tier: first.freshness_tier,
    ingested_at: matches.reduce((m, c) => Math.max(m, c.ingested_at), 0),
    text: matches.map((c) => c.text).join("\n"),
  };
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

export function kbDelete(collection?: string, sourceUrl?: string): number {
  if (!kbConfig) throw new Error(CONFIG_ERROR_CODE);
  if (!store) return 0;
  if (!collection && !sourceUrl) throw new Error("invalid_input");

  const before = store.chunks.length;
  store.chunks = store.chunks.filter((c) => {
    if (collection && c.collection === collection) return false;
    if (sourceUrl && c.source_url === sourceUrl) return false;
    return true;
  });
  const removed = before - store.chunks.length;

  if (removed > 0) {
    rebuildIdf();
    scheduleWrite();
  }
  return removed;
}

function rebuildIdf(): void {
  if (!store) return;
  store.idf = {};
  store.docCount = 0;
  for (const chunk of store.chunks) {
    const tokens = tokenize(chunk.text);
    const seen = new Set<string>();
    for (const t of tokens) {
      if (seen.has(t)) continue;
      seen.add(t);
      store.idf[t] = (store.idf[t] || 0) + 1;
    }
    store.docCount++;
  }
}

export function autoIndex(
  results: Array<{ title: string; url: string; snippet: string }>,
  provider: string,
  collection?: string,
  sourceType?: string,
  query?: string,
  timeRange?: string
): void {
  if (!kbConfig || !kbConfig.auto_index) return;
  if (!store) return;

  setImmediate(() => {
    try {
      let totalChunks = 0;
      const tier = classifyFreshness(query, timeRange, provider, sourceType || provider);
      for (const r of results) {
        if (!r.snippet && !r.title) continue;
        const text = r.snippet || r.title;
        const sourceUrl = r.url || "";
        totalChunks += kbIngest(text, r.title, sourceUrl, provider, collection, sourceType || provider, tier);
      }
      if (totalChunks > 0) flushWrite();
    } catch {
      if (store) store.events.push(`Auto-index error at ${new Date().toISOString()}`);
    }
  });
}

export function runMaintenance(): void {
  if (!kbConfig || !store) return;
  const tiers = kbConfig.freshness?.tiers;
  if (!tiers) return;
  const now = Date.now();
  const before = store.chunks.length;

  store.chunks = store.chunks.filter((c) => {
    const def = tiers[c.freshness_tier];
    if (!def || !def.expiry_hours || def.expiry_hours <= 0) return true;
    const cutoff = now - def.expiry_hours * 60 * 60 * 1000;
    return c.ingested_at > cutoff;
  });

  const removed = before - store.chunks.length;
  if (removed > 0) {
    rebuildIdf();
    scheduleWrite();
    store.events.push(`Maintenance at ${new Date().toISOString()}: removed ${removed} expired chunks`);
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
    if (key) {
      const sealed = sealEnvelope(key, clear);
      const rechecked = openEnvelope(key, sealed);
      if (rechecked.equals(clear)) return sealed;
    }
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
  const fpath = storeFilePath();
  if (!fpath || !existsSync(fpath)) return null;
  const bytes = readStoreBytes()!;
  if (!isEncryptedEnvelope(bytes)) return null;

  const src = from ?? resolvedKey;
  if (!src) return null;

  const plain = openEnvelope(src, bytes);
  const sealed = sealEnvelope(to, plain);
  const rechecked = openEnvelope(to, sealed);
  if (!rechecked.equals(plain)) throw new Error("rekey self-verify failed");

  atomicWriteFile(fpath, sealed);
  const st = statSync(fpath);
  loadedStat = { mtimeMs: st.mtimeMs, size: st.size };

  // Load the re-keyed content directly (no file re-read, so the new key need
  // not be resolvable from config yet) and register the new key for writes.
  try {
    const parsed = JSON.parse(plain.toString("utf-8"));
    if (parsed && Array.isArray(parsed.chunks) && typeof parsed.idf === "object") {
      store = parsed as VectorStore;
      resolvedKey = to;
      lockError = null;
      store.events.push(`Encryption key changed at ${new Date().toISOString()}`);
    }
  } catch {
    // Leave re-keyed file in place; memory state refreshes on next load.
  }
  return "knowledge base re-keyed";
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
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  atomicWriteFile(path, Buffer.from(`${key}\n`, "utf-8"));
  return path;
}

/**
 * Verify the currently-resolved (or explicitly provided) secret against the
 * on-disk store without writing anything. Returns true when the secret opens
 * the envelope to a valid store, false otherwise (missing store, plaintext
 * store, wrong key, or tampered store).
 */
export function verifyStoreKey(key?: ResolvedKey): boolean {
  const fpath = storeFilePath();
  if (!fpath || !existsSync(fpath)) return false;
  const bytes = readStoreBytes()!;
  if (!isEncryptedEnvelope(bytes)) return false;
  const candidate = key ?? resolveKeySource(kbConfig?.encryption?.key_file) ?? resolvedKey;
  if (!candidate) return false;
  try {
    const plain = openEnvelope(candidate, bytes).toString("utf-8");
    const raw = JSON.parse(plain);
    return !!raw && Array.isArray(raw.chunks) && typeof raw.idf === "object";
  } catch {
    return false;
  }
}

/**
 * Copy the currently-resolved key file to a backup path (0600) so the user has
 * a recovery artifact. Returns the backup path. The secret itself is never
 * returned. If the active key source is not a file, returns null.
 */
export function backupKeyFile(backupPath: string): string | null {
  const keyFile = kbConfig?.encryption?.key_file;
  const resolved = resolveKeySource(keyFile);
  if (!keyFile || !resolved || resolved.kind !== "raw") return null;
  const src = resolvePath(keyFile);
  if (!existsSync(src)) return null;
  const dir = dirname(backupPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  copyFileSync(src, backupPath);
  chmodSync(backupPath, 0o600);
  if (store) store.events.push(`Encryption key backed up at ${new Date().toISOString()}: ${backupPath}`);
  return backupPath;
}

/** On-disk format of the store at rest: "encrypted", "plaintext", or "none". */
export function kbStoreFormat(): "encrypted" | "plaintext" | "none" {
  const fpath = storeFilePath();
  if (!fpath || !existsSync(fpath)) return "none";
  const bytes = readStoreBytes()!;
  return isEncryptedEnvelope(bytes) ? "encrypted" : "plaintext";
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
  const resolved = resolveKeySource(keyFile);
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
