// @implements REQ-060 REQ-061 REQ-062 REQ-063 REQ-064 REQ-065 REQ-066 REQ-067 REQ-072
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { KbConfig, KbChunk, KbSearchResult, KbStats } from "./types.js";

interface VectorStore {
  chunks: KbChunk[];
  idf: Record<string, number>;
  docCount: number;
  events: string[];
  sortedVocab?: string[];
}

let store: VectorStore | null = null;
let kbConfig: KbConfig | null = null;
let storagePath: string | null = null;
let maintenanceTimer: ReturnType<typeof setInterval> | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
const WRITE_INTERVAL_MS = 30_000;
const modelAvailable = true;
const modelName = "tf-idf";
const CONFIG_ERROR_CODE = "config_error";
const KB_UNINITIALIZED = "knowledge base not configured";

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
  const tf = computeTf(tokens);
  const vocab = getSortedVocab();
  const cap = kbConfig?.max_vocab_terms;
  const effectiveVocab = cap && cap > 0 && cap < vocab.length ? vocab.slice(0, cap) : vocab;
  const vec: number[] = new Array(effectiveVocab.length).fill(0);
  const nDocs = docCount || 1;
  for (let i = 0; i < effectiveVocab.length; i++) {
    const term = effectiveVocab[i];
    const tfVal = tf[term] || 0;
    const idfVal = Math.log((nDocs + 1) / ((idf[term] || 0) + 1)) + 1;
    vec[i] = tfVal * idfVal;
  }
  return vec;
}

function getSortedVocab(): string[] {
  if (store?.sortedVocab?.length) return store.sortedVocab;
  if (!store) return [];
  store.sortedVocab = Object.keys(store.idf).sort();
  return store.sortedVocab;
}

function invalidateVocab(): void {
  if (store) store.sortedVocab = undefined;
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

function loadStore(): void {
  if (!storagePath) return;
  const fpath = join(storagePath, "vector-store.json");
  if (existsSync(fpath)) {
    try {
      const raw = JSON.parse(readFileSync(fpath, "utf-8"));
      if (raw && Array.isArray(raw.chunks) && typeof raw.idf === "object") {
        const loaded: VectorStore = raw;
        loaded.sortedVocab = undefined;
        store = loaded;
        return;
      }
    } catch {
      backupCorruptStore();
    }
  }
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
  }
}

process.on("beforeExit", () => flushWrite());
process.on("exit", () => flushWrite());

function saveStore(): void {
  if (!storagePath || !store) return;
  try {
    if (!existsSync(storagePath)) mkdirSync(storagePath, { recursive: true });
    writeFileSync(join(storagePath, "vector-store.json"), JSON.stringify(store));
  } catch {
    // fail silently — will retry on next write
  }
}

function backupCorruptStore(): void {
  if (!storagePath) return;
  const fpath = join(storagePath, "vector-store.json");
  if (!existsSync(fpath)) return;
  try {
    const backup = join(storagePath, `vector-store.corrupt.${Date.now()}.json`);
    renameSync(fpath, backup);
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

export function initKb(config: KbConfig): void {
  kbConfig = config;
  const raw = resolvePath(config.storage_path);
  storagePath = raw;
  if (!existsSync(raw)) mkdirSync(raw, { recursive: true });
  loadStore();
  getSortedVocab();
  runMaintenance();
  if (maintenanceTimer) clearInterval(maintenanceTimer);
  maintenanceTimer = setInterval(runMaintenance, config.maintenance_interval_minutes * 60 * 1000);
}

export function isKbConfigured(): boolean {
  return kbConfig !== null;
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

  for (const chunk of store.chunks) {
    if (collection && chunk.collection !== collection) continue;
    if (sourceType && chunk.source_type !== sourceType) continue;

    const vecSimilarity = cosineSimilarity(queryVec, chunk.embedding);
    const kwScore = keywordScore(kwRegexes, chunk.text);
    const combinedScore = vecSimilarity * 0.7 + kwScore * 0.3;

    if (combinedScore > 0) {
      results.push({
        chunk_id: chunk.id,
        text: chunk.text,
        score: combinedScore,
        source_url: chunk.source_url,
        title: chunk.title,
        provider: chunk.provider,
        collection: chunk.collection,
        snippet: chunk.text.slice(0, 200),
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, actualMax);
}

export function kbIngest(
  text: string,
  title: string,
  sourceUrl: string,
  provider: string,
  collection?: string,
  sourceType?: string
): number {
  if (!kbConfig) throw new Error(CONFIG_ERROR_CODE);
  if (!store) return 0;

  const resolvedCollection = collection || kbConfig.default_collection || "default";
  const resolvedSourceType = sourceType || "web_search";
  const chunks = chunkText(text, title);

  if (chunks.length === 0) {
    store.events.push(`Ingest skipped at ${new Date().toISOString()}: empty or unsplittable text (${text.slice(0, 80)})`);
    return 0;
  }

  const now = Date.now();

  if (sourceUrl) {
    store.chunks = store.chunks.filter((c) => c.source_url !== sourceUrl);
  }

  const preIngestIdf = { ...store.idf };
  const preIngestDocCount = store.docCount;

  for (const chunkText of chunks) {
    const tokens = tokenize(chunkText);
    const embedding = computeTfIdfVector(tokens, preIngestIdf, preIngestDocCount);
    const id = randomUUID();
    store.chunks.push({
      id,
      text: chunkText,
      embedding,
      source_url: sourceUrl,
      title,
      provider,
      collection: resolvedCollection,
      source_type: resolvedSourceType,
      ingested_at: now,
    });
  }

  for (const chunkText of chunks) {
    updateIdf(tokenize(chunkText));
  }

  invalidateVocab();
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
  let lastIngestion = 0;
  for (const c of store?.chunks ?? []) {
    collections[c.collection] = (collections[c.collection] || 0) + 1;
    if (c.ingested_at > lastIngestion) lastIngestion = c.ingested_at;
  }

  let sizeBytes = 0;
  if (storagePath && existsSync(join(storagePath, "vector-store.json"))) {
    try {
      sizeBytes = readFileSync(join(storagePath, "vector-store.json")).length;
    } catch {
      // ignore
    }
  }

  return {
    chunk_count: store?.chunks.length ?? 0,
    collections,
    storage_size_bytes: sizeBytes,
    last_ingestion: lastIngestion ? new Date(lastIngestion).toISOString() : null,
    model_available: modelAvailable,
    model_name: modelName,
    events: store?.events ?? [],
  };
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
  invalidateVocab();
}

export function autoIndex(
  results: Array<{ title: string; url: string; snippet: string }>,
  provider: string,
  collection?: string,
  sourceType?: string
): void {
  if (!kbConfig || !kbConfig.auto_index) return;
  if (!store) return;

  setImmediate(() => {
    try {
      let totalChunks = 0;
      for (const r of results) {
        if (!r.snippet && !r.title) continue;
        const text = r.snippet || r.title;
        const sourceUrl = r.url || "";
        totalChunks += kbIngest(text, r.title, sourceUrl, provider, collection, sourceType || provider);
      }
      if (totalChunks > 0) flushWrite();
    } catch {
      if (store) store.events.push(`Auto-index error at ${new Date().toISOString()}`);
    }
  });
}

export function runMaintenance(): void {
  if (!kbConfig || !store) return;
  const now = Date.now();
  const before = store.chunks.length;

  for (const [sourceType, hours] of Object.entries(kbConfig.expiry)) {
    if (!hours || hours <= 0) continue;
    const cutoff = now - hours * 60 * 60 * 1000;
    store.chunks = store.chunks.filter(
      (c) => c.source_type !== sourceType || c.ingested_at > cutoff
    );
  }

  const removed = before - store.chunks.length;
  if (removed > 0) {
    rebuildIdf();
    scheduleWrite();
    store.events.push(`Maintenance at ${new Date().toISOString()}: removed ${removed} expired chunks`);
  }
}
