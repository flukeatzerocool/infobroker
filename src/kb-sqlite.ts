// @implements REQ-108 REQ-060 REQ-060a REQ-060b REQ-060c REQ-060d REQ-060e REQ-060f REQ-084 REQ-085
// SQLite-backed knowledge base. Chunks stream from the database one row at a
// time, so search/list/get/stats do not require the full store in memory.
// When encryption is enabled the whole row payload, the model state, and event
// messages are sealed; the salt and encryption marker live in `meta`.
import { DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import type { KbChunk } from "./types.js";
import {
  LEGACY_JSON_STORE,
  LIVE_SQLITE_STORE,
  isKbArchiveArtifact,
  type KbMeta,
  type KbStore,
} from "./kb-store.js";
import { deriveRowKey, newRowSalt, openRow, sealRow } from "./kb-row-crypto.js";
import type { ResolvedKey } from "./kb-crypto.js";

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
`;

export interface SqliteStoreOptions {
  secret?: ResolvedKey | null;
  encryptionEnabled?: boolean;
  fileName?: string;
  journalMode?: "WAL" | "DELETE";
}

export class SqliteStore implements KbStore {
  readonly backend = "sqlite" as const;
  readonly path: string;
  private db: DatabaseSync | null = null;
  private metaCache: KbMeta | null = null;
  private opts: SqliteStoreOptions;
  private rowKey: Buffer | null = null;
  private encrypted = false;
  private salt: Buffer | null = null;

  constructor(storagePath: string, opts: SqliteStoreOptions = {}) {
    this.path = join(storagePath, opts.fileName ?? LIVE_SQLITE_STORE);
    this.opts = opts;
  }

  init(): void {
    const dir = dirname(this.path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(this.path);
    this.db.exec(`PRAGMA journal_mode = ${this.opts.journalMode ?? "WAL"}`);
    this.db.exec("PRAGMA secure_delete = ON");
    this.db.exec(SQLITE_SCHEMA);

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
    } else if (this.opts.encryptionEnabled) {
      if (!this.opts.secret) throw new Error("encryption is enabled but no key is available");
      this.enableEncryption(this.opts.secret);
    }
    this.hardenPermissions();
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

  replaceChunks(sourceUrl: string, chunks: readonly KbChunk[]): void {
    this.transaction(() => {
      const ids: string[] = [];
      for (const chunk of this.iterateChunks()) {
        if (chunk.source_url === sourceUrl) ids.push(chunk.id);
      }
      const del = this.db!.prepare("DELETE FROM chunks WHERE id = ?");
      for (const id of ids) del.run(id);
      for (const chunk of chunks) this.insertOne(chunk);
    });
    this.hardenPermissions();
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
    for (const row of this.db.prepare("SELECT key, value FROM meta").all() as Array<{ key: string; value: string }>) {
      if (row.key === "docCount") meta.docCount = Number(row.value) || 0;
      else if (row.key === "model") meta.model = row.value;
      else if (row.key === "idf") meta.idf = JSON.parse(this.openMetaValue(row.value)) as Record<string, number>;
      else if (row.key === "embed_state") meta.embed_state = JSON.parse(this.openMetaValue(row.value)) as Record<string, unknown>;
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
    const bytes = this.encrypted && this.rowKey
      ? sealRow(this.rowKey, Buffer.from(message, "utf-8"))
      : Buffer.from(message, "utf-8");
    this.db.prepare("INSERT INTO events (at, encrypted, message) VALUES (?, ?, ?)").run(
      new Date().toISOString(),
      this.encrypted ? 1 : 0,
      bytes
    );
    this.db.exec("DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY id DESC LIMIT 100)");
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
        const clear = row.encrypted === 1 && this.rowKey ? openRow(this.rowKey, Buffer.from(row.message)) : Buffer.from(row.message);
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

  /**
   * Re-seal every row under a new key. Used by enable, disable, and rekey.
   * The caller supplies the new secret; the old key opens the current rows.
   */
  private resealAll(next: { key: Buffer; encrypted: boolean }): void {
    if (!this.db) throw new Error("knowledge base store is not open");
    const meta = this.metaCache ?? this.meta();
    const rows = this.db.prepare("SELECT id, payload FROM chunks").all() as Array<{ id: string; payload: Uint8Array }>;
    const decoded = rows.map((row) => ({ id: row.id, chunk: this.decodePayload(row.payload) }));
    this.rowKey = next.key;
    this.encrypted = next.encrypted;
    this.transaction(() => {
      const update = this.db!.prepare("UPDATE chunks SET encrypted = ?, payload = ? WHERE id = ?");
      for (const item of decoded) {
        if (!item.chunk) continue;
        update.run(next.encrypted ? 1 : 0, this.encodePayload(item.chunk), item.id);
      }
      this.metaCache = null;
      this.writeRawMeta("encryption", next.encrypted ? "1" : "0");
      if (this.salt) this.writeRawMeta("salt", this.salt.toString("base64"));
      this.writeRawMeta("idf", this.sealMetaValue(JSON.stringify(meta.idf)));
      if (meta.embed_state) this.writeRawMeta("embed_state", this.sealMetaValue(JSON.stringify(meta.embed_state)));
      this.writeRawMeta("check", this.sealMetaValue("ok"));
    });
  }

  enableEncryption(secret: ResolvedKey): void {
    if (this.encrypted) return;
    this.salt = newRowSalt();
    const key = deriveRowKey(secret, this.salt);
    this.resealAll({ key, encrypted: true });
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
      try {
        unlinkSync(join(dir, name));
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
    this.resealAll({ key: Buffer.alloc(0), encrypted: false });
    this.salt = null;
    if (this.db) {
      this.db.prepare("DELETE FROM meta WHERE key IN ('salt','encryption','check')").run();
    }
    this.checkpoint();
  }

  rekey(secret: ResolvedKey, to: ResolvedKey): string | null {
    if (!this.encrypted || !this.salt) return null;
    this.rowKey = deriveRowKey(secret, this.salt);
    this.salt = newRowSalt();
    this.resealAll({ key: deriveRowKey(to, this.salt), encrypted: true });
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
