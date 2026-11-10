// @implements REQ-108 REQ-060 REQ-060a REQ-060b REQ-060c REQ-060d REQ-060e REQ-060f REQ-060h REQ-084 REQ-085 REQ-109 REQ-110 REQ-060i
// SQLite-backed knowledge base. Chunks stream from the database one row at a
// time, so search/list/get/stats do not require the full store in memory.
// When encryption is enabled the whole row payload, the model state, and event
// messages are sealed; the salt and encryption marker live in `meta`.
import { DatabaseSync } from "node:sqlite";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { chmodSync, closeSync, copyFileSync, existsSync, mkdirSync, openSync, readSync, readdirSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  ClaimLedgerQuery,
  ClaimLedgerResult,
  ClaimRecord,
  ClaimSourceEdge,
  KbChunk,
  ReportReceiptManifest,
  ReportReceiptRecord,
} from "./types.js";
import {
  LEGACY_JSON_STORE,
  LIVE_SQLITE_STORE,
  isKbArchiveArtifact,
  type KbMeta,
  type KbStore,
} from "./kb-store.js";
import { deriveRowKey, newRowSalt, openRow, sealRow } from "./kb-row-crypto.js";
import type { ResolvedKey } from "./kb-crypto.js";

/** Row bound for one claim read (REQ-060h); hitting it reports truncated. */
export const CLAIM_SCAN_LIMIT = 5000;

/**
 * REQ-085/REQ-108: the store format this build writes and accepts. The value
 * lives in the SQLite header (`user_version`, offset 60), so the check needs no
 * database handle and creates no `-wal`/`-shm` sidecar.
 *
 * 0 is the reserved legacy marker: every store written before this marker
 * existed reports 0 and is read as version 1. Only a marker *above* this value
 * means "written by a newer build".
 */
export const SQLITE_FORMAT_VERSION = 1;
const SQLITE_HEADER_MAGIC = Buffer.from("SQLite format 3\0", "binary");
const HEADER_READ_BYTES = 100;
const USER_VERSION_OFFSET = 60;

/** REQ-085: the store's format is unrecognized or newer than this build. */
export class KbStoreFormatError extends Error {
  readonly code: "kb_store_newer_format" | "kb_store_unrecognized_format";
  constructor(code: "kb_store_newer_format" | "kb_store_unrecognized_format", message: string) {
    super(message);
    this.name = "KbStoreFormatError";
    this.code = code;
  }
}

/** REQ-108: the store is a recognized SQLite file whose content is corrupt. */
export class KbStoreCorruptError extends Error {
  readonly code = "kb_store_corrupt" as const;
  readonly path: string;
  readonly sqliteCode: number | null;
  constructor(path: string, sqliteCode: number | null, message: string) {
    super(message);
    this.name = "KbStoreCorruptError";
    this.path = path;
    this.sqliteCode = sqliteCode;
  }
}

export type StoreProbeState = "new" | "ok" | "unrecognized" | "newer" | "corrupt" | "locked";

export interface StoreProbe {
  state: StoreProbeState;
  marker?: number;
  detail?: string;
  /** The underlying failure for `locked`, so `init()` can rethrow it unchanged. */
  error?: unknown;
}

export const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  ingested_at INTEGER NOT NULL,
  encrypted INTEGER NOT NULL DEFAULT 0,
  payload BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS chunks_ingested ON chunks(ingested_at);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  encrypted INTEGER NOT NULL DEFAULT 0,
  message BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  claim_key TEXT NOT NULL UNIQUE,
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  encrypted INTEGER NOT NULL DEFAULT 0,
  payload BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS claims_updated ON claims(updated_at);
CREATE TABLE IF NOT EXISTS claim_sources (
  claim_id TEXT NOT NULL,
  source_key TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  encrypted INTEGER NOT NULL DEFAULT 0,
  payload BLOB NOT NULL,
  PRIMARY KEY (claim_id, source_key)
);
CREATE INDEX IF NOT EXISTS claim_sources_key ON claim_sources(source_key);
CREATE TABLE IF NOT EXISTS report_receipts (
  id TEXT PRIMARY KEY,
  report_key TEXT NOT NULL UNIQUE,
  encrypted INTEGER NOT NULL DEFAULT 0,
  payload BLOB NOT NULL
);
`;

export interface SqliteStoreOptions {
  secret?: ResolvedKey | null;
  encryptionEnabled?: boolean;
  fileName?: string;
  journalMode?: "WAL" | "DELETE";
  /**
   * REQ-108: recover a corrupt store instead of refusing it. The live store
   * passes `true`; scratch and migrated stores keep the default so a corrupt
   * temporary file is never silently replaced.
   */
  allowRecovery?: boolean;
  /** Header probe and recovery opener; injectable for tests. */
  openDatabase?: (path: string, options?: { readOnly?: boolean }) => DatabaseSync;
  /**
   * Migration guard: the legacy JSON store is the migration's own source and
   * must survive until the database commit and archive rename complete.
   */
  protectedLegacyPath?: string;
}

const defaultOpenDatabase = (path: string, options?: { readOnly?: boolean }): DatabaseSync =>
  options ? new DatabaseSync(path, options) : new DatabaseSync(path);

/**
 * REQ-085/REQ-108: classify a store file before anything opens it read-write.
 *
 * The magic and the marker come from the first 100 bytes, so no handle is
 * needed for the format decisions. Only a magic-bearing, marker-supported file
 * is opened (read-only) and checked with `PRAGMA quick_check`: an open plus a
 * schema read succeeds over a store with damaged pages, so the integrity read
 * is the only thing that detects latent corruption.
 *
 * Sidecars that the read-only open itself creates are removed when the result
 * is `locked` or `unrecognized`, so "the store was not touched" stays true for
 * those outcomes.
 */
export function probeStoreFile(
  path: string,
  open: (path: string, options?: { readOnly?: boolean }) => DatabaseSync = defaultOpenDatabase
): StoreProbe {
  if (!existsSync(path)) return { state: "new" };

  const header = Buffer.alloc(HEADER_READ_BYTES);
  let read = 0;
  {
    const fd = openSync(path, "r");
    try {
      read = readSync(fd, header, 0, HEADER_READ_BYTES, 0);
    } finally {
      closeSync(fd);
    }
  }
  if (read === 0) return { state: "new" }; // zero-byte file: SQLite treats it as a new database
  if (read < SQLITE_HEADER_MAGIC.length || !header.subarray(0, SQLITE_HEADER_MAGIC.length).equals(SQLITE_HEADER_MAGIC)) {
    return { state: "unrecognized", detail: "file does not start with the SQLite header" };
  }
  if (read < HEADER_READ_BYTES) {
    return { state: "corrupt", detail: "truncated SQLite header" };
  }
  const marker = header.readUInt32BE(USER_VERSION_OFFSET);
  if (marker > SQLITE_FORMAT_VERSION) {
    return { state: "newer", marker, detail: `store format ${marker} is newer than supported ${SQLITE_FORMAT_VERSION}` };
  }

  const sidecars = [`${path}-wal`, `${path}-shm`];
  const preexisting = sidecars.filter((name) => existsSync(name));
  const cleanup = (): void => {
    for (const name of sidecars) {
      if (preexisting.includes(name)) continue;
      if (!existsSync(name)) continue;
      try {
        unlinkSync(name);
      } catch {
        // best effort: a sidecar that cannot be removed still belongs to the store
      }
    }
  };

  let db: DatabaseSync | null = null;
  try {
    db = open(path, { readOnly: true });
    const rows = db.prepare("PRAGMA quick_check").all() as Array<Record<string, unknown>>;
    const values = rows.flatMap((row) => Object.values(row).map(String));
    if (values.length > 0 && values.every((value) => value.toLowerCase() === "ok")) {
      return { state: "ok", marker };
    }
    return { state: "corrupt", marker, detail: values.slice(0, 3).join("; ") };
  } catch (e) {
    const errcode = sqliteErrorCode(e);
    // A locked/busy/io/permission failure is not evidence of corruption: the
    // store may be healthy and merely unavailable right now.
    if (errcode === 11) return { state: "corrupt", marker, detail: errorMessage(e) };
    return { state: "locked", marker, detail: errorMessage(e), error: e };
  } finally {
    try {
      db?.close();
    } catch {
      // an unclosed read-only handle is released by the OS at process exit
    }
    cleanup();
  }
}

function sqliteErrorCode(error: unknown): number | null {
  const candidate = error as { errcode?: unknown; code?: unknown } | null;
  if (candidate && typeof candidate.errcode === "number") return candidate.errcode;
  return null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class SqliteStore implements KbStore {
  readonly backend = "sqlite" as const;
  readonly supportsClaims = true;
  readonly supportsReportReceipts = true;
  readonly path: string;
  private db: DatabaseSync | null = null;
  private metaCache: KbMeta | null = null;
  private opts: SqliteStoreOptions;
  private rowKey: Buffer | null = null;
  private encrypted = false;
  private salt: Buffer | null = null;
  /** Set when a metadata value cannot be parsed during `meta()` (REQ-108). */
  private metaCorrupt: string | null = null;
  private corruptionBackup: string | null = null;

  constructor(storagePath: string, opts: SqliteStoreOptions = {}) {
    this.path = join(storagePath, opts.fileName ?? LIVE_SQLITE_STORE);
    this.opts = opts;
  }

  init(): void {
    const dir = dirname(this.path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });

    const probe = probeStoreFile(this.path, this.openDatabase);
    switch (probe.state) {
      case "unrecognized":
        throw new KbStoreFormatError(
          "kb_store_unrecognized_format",
          `knowledge base store format is unrecognized: ${probe.detail ?? "unknown file layout"}`
        );
      case "newer":
        throw new KbStoreFormatError(
          "kb_store_newer_format",
          `knowledge base store was written by a newer version (format ${probe.marker}); this build supports up to ${SQLITE_FORMAT_VERSION}`
        );
      case "locked":
        throw probe.error instanceof Error ? probe.error : new Error(`knowledge base store is unavailable: ${probe.detail ?? "unknown error"}`);
      case "corrupt":
        if (!this.opts.allowRecovery) {
          throw new KbStoreCorruptError(this.path, null, `knowledge base store is corrupt: ${probe.detail ?? "integrity check failed"}`);
        }
        this.recoverCorruptStore();
        return;
      case "new":
        this.bootstrap(true);
        return;
      case "ok":
        this.bootstrap(false);
        return;
    }
  }

  private get openDatabase(): (path: string, options?: { readOnly?: boolean }) => DatabaseSync {
    return this.opts.openDatabase ?? defaultOpenDatabase;
  }

  /**
   * Open the store and run the existing startup sequence. `fresh` is true for a
   * newly created file, which owes the format marker.
   */
  private bootstrap(fresh: boolean): void {
    try {
      this.db = this.openDatabase(this.path);
      this.db.exec(`PRAGMA journal_mode = ${this.opts.journalMode ?? "WAL"}`);
      this.db.exec("PRAGMA secure_delete = ON");
      this.db.exec(SQLITE_SCHEMA);
      if (fresh) this.db.exec(`PRAGMA user_version = ${SQLITE_FORMAT_VERSION}`);
      this.startup();
    } catch (e) {
      this.db?.close();
      this.db = null;
      throw e;
    }
  }

  private startup(): void {
    const marker = this.rawMeta("encryption");
    this.salt = this.rawMeta("salt") ? Buffer.from(this.rawMeta("salt")!, "base64") : null;
    if (marker === "1") {
      if (!this.opts.secret || !this.salt) {
        throw new Error("knowledge base is encrypted but no key is available");
      }
      this.rowKey = deriveRowKey(this.opts.secret, this.salt);
      this.encrypted = true;
      if (!this.verifyKey(this.opts.secret)) {
        throw new Error("knowledge base key does not match the encrypted store");
      }
      // REQ-084: opening an encrypted store must not leave a plaintext
      // migration/corruption archive behind (for example one created by the
      // migration that just completed, or by an interrupted earlier run).
      this.removePlaintextArchives();
    } else if (this.opts.encryptionEnabled) {
      if (!this.opts.secret) throw new Error("encryption is enabled but no key is available");
      this.enableEncryption(this.opts.secret);
    }
    // REQ-108: a metadata value that cannot be parsed must not be fatal. Force
    // one parse so the guard runs, then preserve the pre-repair file before the
    // caller rebuilds the index.
    this.meta();
    if (this.metaCorrupt) {
      // An encrypted store's copy is ciphertext; use a non-archive suffix so the
      // plaintext-archive sweep does not reap it on the next open (REQ-084).
      const suffix = this.encrypted ? "sqlite.enc" : "sqlite";
      const backup = join(dirname(this.path), `vector-store.corrupt-${Date.now()}.${suffix}`);
      try {
        this.db?.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      } catch {
        // best effort: a busy checkpoint still leaves a usable main file
      }
      copyFileSync(this.path, backup);
      chmodSync(backup, 0o600);
      this.corruptionBackup = backup;
    }
    this.hardenPermissions();
  }

  /**
   * REQ-108: preserve a corrupt store as a backup, continue with an empty one,
   * and report the recovery as a status event.
   *
   * Order is backup → create → verify → report, and any failure restores the
   * archive: a recovery attempt must never leave the operator with neither the
   * original nor a working store.
   */
  private recoverCorruptStore(): void {
    const dir = dirname(this.path);
    const base = `vector-store.corrupt-${Date.now()}`;
    // The plaintext suffix stays an archive artifact (so the plaintext sweep can
    // reap it once encryption is on); the `.enc` suffix deliberately does not
    // match, so a possibly-ciphertext backup is never reaped (REQ-084).
    const suffix = this.opts.encryptionEnabled ? ".sqlite.enc" : ".sqlite";
    const archiveMain = join(dir, `${base}${suffix}`);
    if (existsSync(archiveMain)) {
      throw new Error(`corruption backup already exists: ${archiveMain}`);
    }

    const moved: Array<{ from: string; to: string }> = [];
    try {
      this.db?.close();
      this.db = null;
      const sources: Array<{ from: string; side: string }> = [
        { from: this.path, side: "" },
        { from: `${this.path}-wal`, side: "-wal" },
        { from: `${this.path}-shm`, side: "-shm" },
      ];
      for (const source of sources) {
        if (!existsSync(source.from)) continue;
        const to = join(dir, `${base}${suffix}${source.side}`);
        renameSync(source.from, to);
        chmodSync(to, 0o600);
        moved.push({ from: source.from, to });
      }
      // A sidecar recreated between the rename and the creation would otherwise
      // attach to the new store.
      for (const name of [`${this.path}-wal`, `${this.path}-shm`]) {
        if (existsSync(name)) unlinkSync(name);
      }
      this.bootstrap(true);
      // Verify before reporting: a store that cannot answer a trivial query is
      // not a recovery.
      this.db!.prepare("SELECT count(*) AS n FROM chunks").get();
    } catch (e) {
      try {
        this.db?.close();
      } catch {
        // already closed
      }
      this.db = null;
      for (const name of [this.path, `${this.path}-wal`, `${this.path}-shm`]) {
        try {
          if (existsSync(name)) unlinkSync(name);
        } catch {
          // best effort; the restore below is the authority
        }
      }
      for (const item of moved.reverse()) {
        try {
          renameSync(item.to, item.from);
        } catch {
          // the original error is the one worth reporting
        }
      }
      throw e;
    }
    this.appendEvent(
      `Storage corruption detected at ${new Date().toISOString()}. Backup: ${archiveMain}. Starting with an empty knowledge base.`
    );
  }

  /**
   * REQ-108: report and clear a corrupt-metadata flag discovered during
   * `meta()`, together with the preserved backup path (null when none).
   */
  takeMetaCorruption(): { key: string; backup: string | null } | null {
    if (!this.metaCorrupt) return null;
    const result = { key: this.metaCorrupt, backup: this.corruptionBackup };
    this.metaCorrupt = null;
    this.corruptionBackup = null;
    return result;
  }

  private hardenPermissions(): void {
    for (const name of [this.path, `${this.path}-wal`, `${this.path}-shm`]) {
      if (existsSync(name)) {
        try {
          chmodSync(name, 0o600);
        } catch {
          // best effort; the directory is 0700
        }
      }
    }
  }

  private rawMeta(key: string): string | null {
    if (!this.db) return null;
    const row = this.db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  private writeRawMeta(key: string, value: string): void {
    if (!this.db) throw new Error("knowledge base store is not open");
    this.db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run(key, value);
  }

  private encodePayload(chunk: KbChunk): Buffer {
    const clear = Buffer.from(JSON.stringify(chunk), "utf-8");
    return this.encrypted && this.rowKey ? sealRow(this.rowKey, clear) : clear;
  }

  private decodePayload(payload: Uint8Array): KbChunk | null {
    try {
      const clear = this.encrypted && this.rowKey ? openRow(this.rowKey, Buffer.from(payload)) : Buffer.from(payload);
      return JSON.parse(clear.toString("utf-8")) as KbChunk;
    } catch {
      return null;
    }
  }

  close(): void {
    this.db?.close();
    this.db = null;
    this.metaCache = null;
  }

  flush(): void {
    if (!this.db) return;
    try {
      this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch {
      // a busy checkpoint is not fatal; rows are already committed
    }
    this.hardenPermissions();
  }

  *iterateChunks(): Iterable<KbChunk> {
    if (!this.db) return;
    const stmt = this.db.prepare("SELECT payload FROM chunks ORDER BY ingested_at, rowid");
    for (const row of stmt.iterate() as Iterable<Record<string, unknown>>) {
      const payload = row["payload"];
      if (!(payload instanceof Uint8Array)) continue;
      const chunk = this.decodePayload(payload);
      if (chunk) yield chunk;
    }
  }

  *iterateChunksByIds(ids: Iterable<string>): Iterable<KbChunk> {
    if (!this.db) return;
    const list = [...ids];
    // Stay well under SQLite's bound-parameter limit.
    const batchSize = 400;
    for (let start = 0; start < list.length; start += batchSize) {
      const batch = list.slice(start, start + batchSize);
      const placeholders = batch.map(() => "?").join(",");
      const stmt = this.db.prepare(
        `SELECT payload FROM chunks WHERE id IN (${placeholders}) ORDER BY ingested_at, rowid`
      );
      for (const row of stmt.iterate(...batch) as Iterable<Record<string, unknown>>) {
        const payload = row["payload"];
        if (!(payload instanceof Uint8Array)) continue;
        const chunk = this.decodePayload(payload);
        if (chunk) yield chunk;
      }
    }
  }

  private insertOne(chunk: KbChunk): void {
    if (!this.db) throw new Error("knowledge base store is not open");
    this.db
      .prepare("INSERT OR REPLACE INTO chunks (id, ingested_at, encrypted, payload) VALUES (?, ?, ?, ?)")
      .run(chunk.id, chunk.ingested_at, this.encrypted ? 1 : 0, this.encodePayload(chunk));
  }

  insertChunks(chunks: readonly KbChunk[]): void {
    this.transaction(() => {
      for (const chunk of chunks) this.insertOne(chunk);
    });
    this.hardenPermissions();
  }

  replaceChunks(sourceUrl: string, chunks: readonly KbChunk[]): KbChunk[] {
    const removed: KbChunk[] = [];
    this.transaction(() => {
      const ids: string[] = [];
      for (const chunk of this.iterateChunks()) {
        if (chunk.source_url === sourceUrl) {
          ids.push(chunk.id);
          removed.push(chunk);
        }
      }
      const del = this.db!.prepare("DELETE FROM chunks WHERE id = ?");
      for (const id of ids) del.run(id);
      for (const chunk of chunks) this.insertOne(chunk);
    });
    this.hardenPermissions();
    return removed;
  }

  /**
   * REQ-082: re-embed every stored chunk in place after a model change. Ids are
   * collected up front (small), then rows are rewritten in bounded batches so
   * the whole chunk payload is never resident (REQ-108).
   */
  reembedChunks(embed: (chunk: KbChunk) => readonly number[]): number {
    if (!this.db) return 0;
    const ids = (this.db.prepare("SELECT id FROM chunks ORDER BY ingested_at, rowid").all() as Array<{ id: string }>).map(
      (row) => row.id
    );
    const batchSize = 100;
    let updated = 0;
    for (let start = 0; start < ids.length; start += batchSize) {
      const batch = ids.slice(start, start + batchSize);
      this.transaction(() => {
        const update = this.db!.prepare("UPDATE chunks SET payload = ? WHERE id = ?");
        for (const chunk of this.iterateChunksByIds(batch)) {
          update.run(this.encodePayload({ ...chunk, embedding: [...embed(chunk)] }), chunk.id);
          updated++;
        }
      });
    }
    this.hardenPermissions();
    return updated;
  }

  deleteWhere(predicate: (chunk: KbChunk) => boolean): number {
    if (!this.db) return 0;
    const ids: string[] = [];
    for (const chunk of this.iterateChunks()) {
      if (predicate(chunk)) ids.push(chunk.id);
    }
    if (ids.length === 0) return 0;
    this.transaction(() => {
      const del = this.db!.prepare("DELETE FROM chunks WHERE id = ?");
      for (const id of ids) del.run(id);
    });
    this.hardenPermissions();
    return ids.length;
  }

  replaceAllChunks(chunks: readonly KbChunk[]): void {
    this.transaction(() => {
      this.db!.exec("DELETE FROM chunks");
      for (const chunk of chunks) this.insertOne(chunk);
    });
    this.hardenPermissions();
  }

  private transaction(fn: () => void): void {
    if (!this.db) throw new Error("knowledge base store is not open");
    this.db.exec("BEGIN");
    try {
      fn();
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  meta(): KbMeta {
    if (this.metaCache) return this.metaCache;
    const meta: KbMeta = { idf: {}, docCount: 0 };
    if (!this.db) return meta;
    const parse = (key: string, value: string): unknown => {
      try {
        const parsed = JSON.parse(this.openMetaValue(value)) as unknown;
        if (!parsed || typeof parsed !== "object") throw new Error("metadata is not an object");
        return parsed;
      } catch {
        // REQ-108: a corrupt value must not crash the server. Flag it so init can
        // preserve a backup and rebuild the index, and continue with defaults.
        this.metaCorrupt = key;
        return null;
      }
    };
    for (const row of this.db.prepare("SELECT key, value FROM meta").all() as Array<{ key: string; value: string }>) {
      if (row.key === "docCount") meta.docCount = Number(row.value) || 0;
      else if (row.key === "model") meta.model = row.value;
      else if (row.key === "idf") {
        const idf = parse(row.key, row.value);
        meta.idf = (idf as Record<string, number> | null) ?? {};
      } else if (row.key === "embed_state") {
        const state = parse(row.key, row.value);
        meta.embed_state = (state as Record<string, unknown> | null) ?? undefined;
      }
    }
    this.metaCache = meta;
    return meta;
  }

  private openMetaValue(value: string): string {
    if (!this.encrypted || !this.rowKey) return value;
    return openRow(this.rowKey, Buffer.from(value, "base64")).toString("utf-8");
  }

  private sealMetaValue(value: string): string {
    if (!this.encrypted || !this.rowKey) return value;
    return sealRow(this.rowKey, Buffer.from(value, "utf-8")).toString("base64");
  }

  setMeta(meta: KbMeta): void {
    if (!this.db) throw new Error("knowledge base store is not open");
    this.transaction(() => {
      this.writeRawMeta("docCount", String(meta.docCount));
      if (meta.model) this.writeRawMeta("model", meta.model);
      this.writeRawMeta("idf", this.sealMetaValue(JSON.stringify(meta.idf)));
      if (meta.embed_state) this.writeRawMeta("embed_state", this.sealMetaValue(JSON.stringify(meta.embed_state)));
    });
    this.metaCache = meta;
  }

  appendEvent(message: string): void {
    if (!this.db) return;
    this.db.prepare("INSERT INTO events (at, encrypted, message) VALUES (?, ?, ?)").run(
      new Date().toISOString(),
      this.encrypted ? 1 : 0,
      this.encodeEvent(Buffer.from(message, "utf-8"))
    );
    this.db.exec("DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY id DESC LIMIT 100)");
  }

  /** Seal an event payload when encryption is on, else store it in the clear. */
  private encodeEvent(clear: Buffer): Buffer {
    return this.encrypted && this.rowKey && this.rowKey.length > 0 ? sealRow(this.rowKey, clear) : clear;
  }

  events(): string[] {
    if (!this.db) return [];
    const rows = this.db.prepare("SELECT encrypted, message FROM events ORDER BY id ASC").all() as Array<{
      encrypted: number;
      message: Uint8Array;
    }>;
    const out: string[] = [];
    for (const row of rows) {
      try {
        // A row marked encrypted needs a non-empty key and a successful open;
        // an empty key (a disabled store's residue) must be skipped, not used to
        // decode ciphertext into mojibake.
        const clear =
          row.encrypted === 1
            ? this.rowKey && this.rowKey.length > 0
              ? openRow(this.rowKey, Buffer.from(row.message))
              : null
            : Buffer.from(row.message);
        if (!clear) continue;
        out.push(clear.toString("utf-8"));
      } catch {
        // a single unreadable event is skipped
      }
    }
    return out;
  }

  format(): "encrypted" | "plaintext" | "none" {
    if (!existsSync(this.path)) return "none";
    return this.rawMeta("encryption") === "1" ? "encrypted" : "plaintext";
  }

  // --- Claim ledger (REQ-109, REQ-060h) -------------------------------------
  //
  // Claim rows mirror the chunk store's at-rest rule: only the identifiers
  // (claim_key, source_key) stay in clear columns; the claim text, verdict,
  // confidence, URL, title, and retrieval time live in the sealed payload.
  // The identifiers are keyed with the row key when encryption is on, so the raw
  // database cannot be dictionary-matched against candidate claims or URLs.

  /** Normalize claim text before keying: trim, collapse, lowercase, strip terminal punctuation. */
  static normalizeClaim(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase()
      .replace(/[.!?;,]+$/g, "")
      .trim();
  }

  private keyedHash(value: string): string {
    if (this.encrypted && this.rowKey) {
      return createHmac("sha256", this.rowKey).update(value, "utf-8").digest("hex");
    }
    return createHash("sha256").update(value, "utf-8").digest("hex");
  }

  claimKey(claimText: string): string {
    return this.keyedHash(SqliteStore.normalizeClaim(claimText));
  }

  sourceKey(url: string): string {
    return this.keyedHash(url.trim());
  }

  private encodeClaim(claim: {
    claim: string;
    verdict: ClaimRecord["verdict"];
    confidence: number;
  }): Buffer {
    const clear = Buffer.from(
      JSON.stringify({ claim: claim.claim, verdict: claim.verdict, confidence: claim.confidence }),
      "utf-8"
    );
    return this.encrypted && this.rowKey ? sealRow(this.rowKey, clear) : clear;
  }

  private decodeClaim(payload: Uint8Array): { claim: string; verdict: ClaimRecord["verdict"]; confidence: number } | null {
    try {
      const clear = this.encrypted && this.rowKey ? openRow(this.rowKey, Buffer.from(payload)) : Buffer.from(payload);
      return JSON.parse(clear.toString("utf-8")) as { claim: string; verdict: ClaimRecord["verdict"]; confidence: number };
    } catch {
      return null;
    }
  }

  private encodeEdge(edge: Pick<ClaimSourceEdge, "url" | "title" | "retrieved_at">): Buffer {
    const clear = Buffer.from(JSON.stringify({ url: edge.url, title: edge.title, retrieved_at: edge.retrieved_at }), "utf-8");
    return this.encrypted && this.rowKey ? sealRow(this.rowKey, clear) : clear;
  }

  private decodeEdge(payload: Uint8Array): { url: string; title: string; retrieved_at?: string } | null {
    try {
      const clear = this.encrypted && this.rowKey ? openRow(this.rowKey, Buffer.from(payload)) : Buffer.from(payload);
      return JSON.parse(clear.toString("utf-8")) as { url: string; title: string; retrieved_at?: string };
    } catch {
      return null;
    }
  }

  /**
   * Persist the claims from one verification run. A claim upserts by key and
   * keeps its random id and first_seen_at; its source set is replaced in the
   * same transaction. Returns the number of claims written.
   */
  upsertClaims(
    claims: ReadonlyArray<{
      claim: string;
      verdict: ClaimRecord["verdict"];
      confidence: number;
      sources: ReadonlyArray<{ url: string; title: string; retrieved_at: string }>;
    }>
  ): number {
    if (!this.db || claims.length === 0) return 0;
    const now = new Date().toISOString();
    const findId = this.db.prepare("SELECT id FROM claims WHERE claim_key = ?");
    const insertClaim = this.db.prepare(
      "INSERT INTO claims (id, claim_key, first_seen_at, updated_at, encrypted, payload) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const updateClaim = this.db.prepare(
      "UPDATE claims SET updated_at = ?, encrypted = ?, payload = ? WHERE id = ?"
    );
    const deleteEdges = this.db.prepare("DELETE FROM claim_sources WHERE claim_id = ?");
    const insertEdge = this.db.prepare(
      "INSERT OR REPLACE INTO claim_sources (claim_id, source_key, retrieved_at, encrypted, payload) VALUES (?, ?, ?, ?, ?)"
    );
    let written = 0;
    this.transaction(() => {
      for (const claim of claims) {
        const claimKey = this.claimKey(claim.claim);
        const existing = findId.get(claimKey) as { id: string } | undefined;
        const id = existing?.id ?? randomUUID();
        const payload = this.encodeClaim(claim);
        if (existing) {
          updateClaim.run(now, this.encrypted ? 1 : 0, payload, id);
        } else {
          insertClaim.run(id, claimKey, now, now, this.encrypted ? 1 : 0, payload);
        }
        // Each verification replaces the claim's source set (history deferred).
        // REQ-109: the retrieval time travels inside the sealed edge payload, so
        // the clear column keeps only an empty placeholder. A row written by an
        // older build still carries its time there and is read through the
        // fallback; a key transition rewrites it into the payload.
        deleteEdges.run(id);
        const seen = new Set<string>();
        for (const src of claim.sources) {
          if (!src.url || seen.has(src.url)) continue;
          seen.add(src.url);
          insertEdge.run(
            id,
            this.sourceKey(src.url),
            "",
            this.encrypted ? 1 : 0,
            this.encodeEdge({ url: src.url, title: src.title, retrieved_at: src.retrieved_at })
          );
        }
        written++;
      }
    });
    this.hardenPermissions();
    return written;
  }

  /** Number of claim rows, used by tests and stats without materializing payloads. */
  claimCount(): number {
    if (!this.db) return 0;
    const row = this.db.prepare("SELECT COUNT(*) AS n FROM claims").get() as { n: number } | undefined;
    return row?.n ?? 0;
  }

  /**
   * Read claims newest-first. The scan is bounded by CLAIM_SCAN_LIMIT so a
   * large ledger cannot turn one read into an unbounded decrypt; hitting the
   * bound reports truncated. Filters run on decrypted payloads because the
   * claim text and URL are sealed.
   */
  claims(query: ClaimLedgerQuery = {}): ClaimLedgerResult {
    if (!this.db) return { claims: [], truncated: false, scanned: 0 };
    const max = Math.max(1, Math.min(50, query.max_results ?? 8));
    const needle = query.query ? SqliteStore.normalizeClaim(query.query) : null;
    const wantedUrl = query.source_url?.trim() || null;
    // Stream the rows so the scan bound stops the read before every payload is
    // decoded; `.all()` would materialize the whole ledger first.
    const rows = this.db
      .prepare("SELECT id, claim_key, first_seen_at, updated_at, payload FROM claims ORDER BY updated_at DESC")
      .iterate() as Iterable<{ id: string; claim_key: string; first_seen_at: string; updated_at: string; payload: Uint8Array }>;

    const out: ClaimRecord[] = [];
    let scanned = 0;
    let truncated = false;
    for (const row of rows) {
      if (scanned >= CLAIM_SCAN_LIMIT) {
        truncated = true;
        break;
      }
      scanned++;
      const body = this.decodeClaim(row.payload);
      if (!body) continue;
      if (needle && !body.claim.toLowerCase().includes(needle)) continue;
      const sources = this.claimSources(row.id);
      if (wantedUrl && !sources.some((s) => s.url === wantedUrl)) continue;
      out.push({
        id: row.id,
        claim_key: row.claim_key,
        claim: body.claim,
        verdict: body.verdict,
        confidence: body.confidence,
        first_seen_at: row.first_seen_at,
        updated_at: row.updated_at,
        sources,
      });
      if (out.length >= max) break;
    }
    return { claims: out, truncated, scanned };
  }

  // --- Report verification receipts (REQ-110, REQ-060i) ---------------------
  //
  // A receipt row keeps only the random id and the keyed `report_key` in clear
  // columns; the report identity, claims, URLs, and hashes live in the sealed
  // payload. The key is HMAC-SHA256 with the row key when encryption is on and
  // SHA-256 otherwise, so the raw database cannot be matched against a
  // candidate report identity.

  reportKey(reportId: string): string {
    return this.keyedHash(reportId.trim());
  }

  private encodeReceipt(receipt: Omit<ReportReceiptRecord, "id" | "report_key">): Buffer {
    const clear = Buffer.from(JSON.stringify(receipt), "utf-8");
    return this.encrypted && this.rowKey ? sealRow(this.rowKey, clear) : clear;
  }

  private decodeReceipt(payload: Uint8Array): Omit<ReportReceiptRecord, "id" | "report_key"> | null {
    try {
      const clear = this.encrypted && this.rowKey ? openRow(this.rowKey, Buffer.from(payload)) : Buffer.from(payload);
      return JSON.parse(clear.toString("utf-8")) as Omit<ReportReceiptRecord, "id" | "report_key">;
    } catch {
      return null;
    }
  }

  /**
   * Store or replace the receipt for a report identity. The row keeps its
   * random id and first `created_at`; the manifest is replaced.
   */
  putReportReceipt(
    reportId: string,
    manifest: ReportReceiptManifest,
    reportKey = this.reportKey(reportId)
  ): ReportReceiptRecord {
    if (!this.db) throw new Error("knowledge base store is not open");
    const now = new Date().toISOString();
    const existing = this.db
      .prepare("SELECT id, payload FROM report_receipts WHERE report_key = ?")
      .get(reportKey) as { id: string; payload: Uint8Array } | undefined;
    const prior = existing ? this.decodeReceipt(existing.payload) : null;
    const id = existing?.id ?? randomUUID();
    const createdAt = prior?.created_at ?? now;
    const body = { report_id: reportId, created_at: createdAt, updated_at: now, manifest };
    this.db
      .prepare(
        "INSERT OR REPLACE INTO report_receipts (id, report_key, encrypted, payload) VALUES (?, ?, ?, ?)"
      )
      .run(id, reportKey, this.encrypted ? 1 : 0, this.encodeReceipt(body));
    this.hardenPermissions();
    return { id, report_key: reportKey, ...body };
  }

  getReportReceipt(reportId: string): ReportReceiptRecord | null {
    if (!this.db) return null;
    const row = this.db
      .prepare("SELECT id, report_key, payload FROM report_receipts WHERE report_key = ?")
      .get(this.reportKey(reportId)) as { id: string; report_key: string; payload: Uint8Array } | undefined;
    if (!row) return null;
    const body = this.decodeReceipt(row.payload);
    if (!body) return null;
    return { id: row.id, report_key: row.report_key, ...body };
  }

  reportReceiptCount(): number {
    if (!this.db) return 0;
    const row = this.db.prepare("SELECT COUNT(*) AS n FROM report_receipts").get() as { n: number } | undefined;
    return row?.n ?? 0;
  }

  private claimSources(claimId: string): ClaimSourceEdge[] {
    if (!this.db) return [];
    const rows = this.db
      .prepare("SELECT source_key, retrieved_at, payload FROM claim_sources WHERE claim_id = ?")
      .all(claimId) as Array<{ source_key: string; retrieved_at: string; payload: Uint8Array }>;
    const out: ClaimSourceEdge[] = [];
    for (const row of rows) {
      const edge = this.decodeEdge(row.payload);
      if (!edge) continue;
      // REQ-109: the payload is authoritative. A row written before the
      // retrieval time moved into the payload still has it in the clear
      // column, so the read falls back rather than dropping the time.
      out.push({
        source_key: row.source_key,
        url: edge.url,
        title: edge.title,
        retrieved_at: edge.retrieved_at ?? row.retrieved_at,
      });
    }
    return out;
  }

  /**
   * Re-seal every row under a new key. Used by enable, disable, and rekey.
   * The caller supplies the new secret; the old key opens the current rows.
   *
   * REQ-086: the transition is atomic and lossless. Chunk, claim, edge, and
   * receipt payloads are decoded before the first write and any undecodable row
   * aborts the transition, and the in-memory key state is restored if the
   * transaction fails.
   *
   * Event history is part of the transition. A row that is marked encrypted but
   * no longer opens under the current key is preserved byte-for-byte and keeps
   * its flag instead of aborting: such a row was already unreadable before the
   * transition, and aborting would make it impossible to ever rekey or disable a
   * store that holds one. The row stays unreadable afterwards, which `events()`
   * handles by skipping it rather than rendering ciphertext.
   */
  private resealAll(next: { key: Buffer; encrypted: boolean; salt: Buffer | null }): void {
    if (!this.db) throw new Error("knowledge base store is not open");
    const meta = this.metaCache ?? this.meta();
    const rows = this.db.prepare("SELECT id, payload FROM chunks").all() as Array<{ id: string; payload: Uint8Array }>;
    const decoded = rows.map((row) => ({ id: row.id, chunk: this.decodePayload(row.payload) }));
    if (decoded.some((item) => item.chunk === null)) {
      throw new Error("chunk row could not be decoded during reseal");
    }
    // REQ-109: claim and edge payloads are sealed too. Decode them under the
    // current key before the switch, then re-encode under the next key.
    const claimRows = this.db
      .prepare("SELECT id, claim_key, payload FROM claims")
      .all() as Array<{ id: string; claim_key: string; payload: Uint8Array }>;
    const decodedClaims = claimRows.map((row) => ({ id: row.id, claim: this.decodeClaim(row.payload) }));
    if (decodedClaims.some((item) => item.claim === null)) {
      throw new Error("claim row could not be decoded during reseal");
    }
    const edgeRows = this.db
      .prepare("SELECT claim_id, source_key, retrieved_at, payload FROM claim_sources")
      .all() as Array<{ claim_id: string; source_key: string; retrieved_at: string; payload: Uint8Array }>;
    const decodedEdges = edgeRows.map((row) => ({ claim_id: row.claim_id, edge: this.decodeEdge(row.payload) }));
    if (decodedEdges.some((item) => item.edge === null)) {
      throw new Error("claim source row could not be decoded during reseal");
    }
    // REQ-110: receipt payloads are sealed too. Decode them under the current
    // key before the switch, then re-encode and re-key under the next key.
    const receiptRows = this.db
      .prepare("SELECT id, payload FROM report_receipts")
      .all() as Array<{ id: string; payload: Uint8Array }>;
    const decodedReceipts = receiptRows.map((row) => ({ id: row.id, body: this.decodeReceipt(row.payload) }));
    if (decodedReceipts.some((item) => item.body === null)) {
      throw new Error("report receipt row could not be decoded during reseal");
    }
    // REQ-084/REQ-086: event history reseals with the rest of the store. A row
    // that does not open under the current key is preserved unchanged (see the
    // method comment); readable rows are re-encoded under the next key.
    const eventRows = this.db
      .prepare("SELECT id, encrypted, message FROM events")
      .all() as Array<{ id: number; encrypted: number; message: Uint8Array }>;
    const decodedEvents = eventRows.map((row) => {
      const bytes = Buffer.from(row.message);
      if (row.encrypted !== 1) return { id: row.id, clear: bytes as Buffer | null };
      if (!this.rowKey || this.rowKey.length === 0) return { id: row.id, clear: null };
      try {
        return { id: row.id, clear: openRow(this.rowKey, bytes) };
      } catch {
        return { id: row.id, clear: null };
      }
    });

    const previous = {
      rowKey: this.rowKey,
      encrypted: this.encrypted,
      salt: this.salt,
      metaCache: this.metaCache,
    };
    this.rowKey = next.key;
    this.encrypted = next.encrypted;
    this.salt = next.salt;
    try {
      this.transaction(() => {
        const update = this.db!.prepare("UPDATE chunks SET encrypted = ?, payload = ? WHERE id = ?");
        for (const item of decoded) {
          if (!item.chunk) continue; // unreachable: checked above
          update.run(next.encrypted ? 1 : 0, this.encodePayload(item.chunk), item.id);
        }
        const updateClaim = this.db!.prepare(
          "UPDATE claims SET claim_key = ?, encrypted = ?, payload = ? WHERE id = ?"
        );
        for (const item of decodedClaims) {
          if (!item.claim) continue; // unreachable: checked above
          updateClaim.run(
            this.keyedHash(SqliteStore.normalizeClaim(item.claim.claim)),
            next.encrypted ? 1 : 0,
            this.encodeClaim(item.claim),
            item.id
          );
        }
        const clearEdges = this.db!.prepare("DELETE FROM claim_sources");
        const insertEdge = this.db!.prepare(
          "INSERT INTO claim_sources (claim_id, source_key, retrieved_at, encrypted, payload) VALUES (?, ?, ?, ?, ?)"
        );
        // Source keys change with the key, so re-key by position: the decoded
        // edges are in the same order as the rows they came from. The retrieval
        // time re-seals with the edge, and a row written before it moved into
        // the payload contributes its clear value once before the column is
        // blanked (REQ-109).
        clearEdges.run();
        decodedEdges.forEach((item, i) => {
          const row = edgeRows[i];
          if (!item.edge) return; // unreachable: checked above
          insertEdge.run(
            row.claim_id,
            this.sourceKey(item.edge.url),
            "",
            next.encrypted ? 1 : 0,
            this.encodeEdge({
              url: item.edge.url,
              title: item.edge.title,
              retrieved_at: item.edge.retrieved_at ?? row.retrieved_at,
            })
          );
        });
        const updateReceipt = this.db!.prepare(
          "UPDATE report_receipts SET report_key = ?, encrypted = ?, payload = ? WHERE id = ?"
        );
        for (const item of decodedReceipts) {
          if (!item.body) continue; // unreachable: checked above
          updateReceipt.run(
            this.keyedHash(item.body.report_id),
            next.encrypted ? 1 : 0,
            this.encodeReceipt(item.body),
            item.id
          );
        }
        const updateEvent = this.db!.prepare("UPDATE events SET encrypted = ?, message = ? WHERE id = ?");
        for (const item of decodedEvents) {
          if (!item.clear) continue; // unreadable under the current key: preserved unchanged
          updateEvent.run(next.encrypted ? 1 : 0, this.encodeEvent(item.clear), item.id);
        }
        this.metaCache = null;
        this.writeRawMeta("encryption", next.encrypted ? "1" : "0");
        if (next.salt) this.writeRawMeta("salt", next.salt.toString("base64"));
        this.writeRawMeta("idf", this.sealMetaValue(JSON.stringify(meta.idf)));
        if (meta.embed_state) this.writeRawMeta("embed_state", this.sealMetaValue(JSON.stringify(meta.embed_state)));
        this.writeRawMeta("check", this.sealMetaValue("ok"));
      });
    } catch (e) {
      this.rowKey = previous.rowKey;
      this.encrypted = previous.encrypted;
      this.salt = previous.salt;
      this.metaCache = previous.metaCache;
      throw e;
    }
  }

  enableEncryption(secret: ResolvedKey): void {
    if (this.encrypted) return;
    const salt = newRowSalt();
    this.resealAll({ key: deriveRowKey(secret, salt), encrypted: true, salt });
    if (!this.verifyKey(secret)) {
      throw new Error("knowledge base encryption self-verify failed");
    }
    this.checkpoint();
    this.removePlaintextArchives();
  }

  /**
   * REQ-084: once encryption is enabled, a plaintext migration/corruption/
   * rollback archive (or a leftover legacy JSON store) must not survive.
   * Failure is fatal to the transition; the caller must not report success.
   */
  private removePlaintextArchives(): void {
    const dir = dirname(this.path);
    for (const name of readdirSync(dir)) {
      if (name === LIVE_SQLITE_STORE || name.startsWith(`${LIVE_SQLITE_STORE}-`)) continue;
      if (!isKbArchiveArtifact(name) && name !== LEGACY_JSON_STORE) continue;
      const candidate = join(dir, name);
      if (this.opts.protectedLegacyPath && candidate === this.opts.protectedLegacyPath) continue;
      try {
        unlinkSync(candidate);
      } catch (e) {
        throw new Error(
          `plaintext archive "${name}" could not be removed after enabling encryption: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  }

  disableEncryption(secret: ResolvedKey): void {
    if (!this.encrypted) return;
    if (!this.salt) throw new Error("encrypted store has no salt");
    this.rowKey = deriveRowKey(secret, this.salt);
    this.resealAll({ key: Buffer.alloc(0), encrypted: false, salt: null });
    this.salt = null;
    if (this.db) {
      this.db.prepare("DELETE FROM meta WHERE key IN ('salt','encryption','check')").run();
    }
    this.checkpoint();
  }

  rekey(secret: ResolvedKey, to: ResolvedKey): string | null {
    if (!this.encrypted || !this.salt) return null;
    this.rowKey = deriveRowKey(secret, this.salt);
    const salt = newRowSalt();
    this.resealAll({ key: deriveRowKey(to, salt), encrypted: true, salt });
    if (!this.verifyKey(to)) {
      throw new Error("knowledge base re-key self-verify failed");
    }
    this.checkpoint();
    return "knowledge base re-keyed";
  }

  verifyKey(secret: ResolvedKey): boolean {
    if (!this.encrypted || !this.salt) return false;
    const check = this.rawMeta("check");
    if (!check) return false;
    try {
      const key = deriveRowKey(secret, this.salt);
      return openRow(key, Buffer.from(check, "base64")).toString("utf-8") === "ok";
    } catch {
      return false;
    }
  }

  private checkpoint(): void {
    if (!this.db) return;
    try {
      this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      this.db.exec("VACUUM");
      this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch {
      // checkpoint/VACUUM are best effort; rows are committed
    }
    this.metaCache = null;
    this.hardenPermissions();
  }
}

/** Read the on-disk format without opening the store for use (REQ-060g). */
export function sqliteStoreFormat(storagePath: string): "encrypted" | "plaintext" | "none" {
  const path = join(storagePath, LIVE_SQLITE_STORE);
  if (!existsSync(path)) return "none";
  try {
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      const row = db.prepare("SELECT value FROM meta WHERE key = 'encryption'").get() as { value: string } | undefined;
      return row?.value === "1" ? "encrypted" : "plaintext";
    } finally {
      db.close();
    }
  } catch {
    return "plaintext";
  }
}
