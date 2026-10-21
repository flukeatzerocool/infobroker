// @implements REQ-108 REQ-060 REQ-060a REQ-060b REQ-060c REQ-060d REQ-060e REQ-060f REQ-085
// Storage seam for the knowledge base. A backend owns persistence and chunk
// iteration; the chunking, freshness, policy, and tool-response logic stays in
// kb.ts. The JSON backend keeps the legacy in-memory array; the SQLite backend
// streams rows so the whole store is never resident.
import type { KbChunk } from "./types.js";

export const LIVE_SQLITE_STORE = "vector-store.sqlite";
export const LEGACY_JSON_STORE = "vector-store.json";

export interface KbMeta {
  idf: Record<string, number>;
  docCount: number;
  model?: string;
  embed_state?: Record<string, unknown>;
}

export interface KbStore {
  readonly backend: "json" | "sqlite";
  readonly path: string;
  init(): void;
  close(): void;
  flush(): void;
  /** Stream every chunk in insertion order. Never materialize the full set. */
  iterateChunks(): Iterable<KbChunk>;
  insertChunks(chunks: readonly KbChunk[]): void;
  /** Replace all chunks belonging to a source URL in one transaction. */
  replaceChunks(sourceUrl: string, chunks: readonly KbChunk[]): void;
  deleteWhere(predicate: (chunk: KbChunk) => boolean): number;
  /** Drop and rewrite every chunk (used by model reconciliation). */
  replaceAllChunks(chunks: readonly KbChunk[]): void;
  meta(): KbMeta;
  setMeta(meta: KbMeta): void;
  appendEvent(message: string): void;
  events(): string[];
  format(): "encrypted" | "plaintext" | "none";
}

// --- Canonical artifact names (D3a) -----------------------------------------
//
// Migration, corruption, and rollback archives are never the live store.
// isKbArchiveArtifact drives encryption-enable deletion; isKbStoreArtifact
// also matches the live stores and sidecars and drives the shipped-KB gate.

const ARCHIVE_RE =
  /^(vector-store\.json\.migrated-\d+|vector-store\.corrupt-\d+\.(json|sqlite)(-(wal|shm))?|vector-store\.corrupt\.\d+\.json|vector-store\.pre-rollback-\d+\.sqlite(-(wal|shm))?)$/;

const LIVE_RE =
  /^(vector-store\.json|vector-store\.sqlite(-(wal|shm))?|config\.local\.json|\S*\.vector-store\.json)$/;

/** True for a migration, corruption, or rollback archive. */
export function isKbArchiveArtifact(name: string): boolean {
  return ARCHIVE_RE.test(name);
}

/** True for a live store/sidecar, a legacy name, or any archive. */
export function isKbStoreArtifact(name: string): boolean {
  return LIVE_RE.test(name) || isKbArchiveArtifact(name);
}
