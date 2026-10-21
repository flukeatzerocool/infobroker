// @implements REQ-108 REQ-060 REQ-060a REQ-060b REQ-060c REQ-060d REQ-060e REQ-060f REQ-085
// SQLite-backed knowledge base. Chunks stream from the database one row at a
// time, so search/list/get/stats do not require the full store in memory.
import { DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { KbChunk } from "./types.js";
import {
  LIVE_SQLITE_STORE,
  isKbStoreArtifact,
  type KbMeta,
  type KbStore,
} from "./kb-store.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  ingested_at INTEGER NOT NULL,
  encrypted INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chunks_ingested ON chunks(ingested_at);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  message TEXT NOT NULL
);
`;

export class SqliteStore implements KbStore {
  readonly backend = "sqlite" as const;
  readonly path: string;
  private db: DatabaseSync | null = null;
  private metaCache: KbMeta | null = null;

  constructor(storagePath: string) {
    this.path = join(storagePath, LIVE_SQLITE_STORE);
  }

  init(): void {
    const dir = dirname(this.path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(this.path);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA secure_delete = ON");
    this.db.exec(SCHEMA);
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
      if (typeof payload !== "string") continue;
      try {
        yield JSON.parse(payload) as KbChunk;
      } catch {
        // A single unreadable row is skipped; the store remains usable.
      }
    }
  }

  private insertOne(chunk: KbChunk): void {
    if (!this.db) throw new Error("knowledge base store is not open");
    this.db
      .prepare("INSERT OR REPLACE INTO chunks (id, ingested_at, encrypted, payload) VALUES (?, ?, 0, ?)")
      .run(chunk.id, chunk.ingested_at, JSON.stringify(chunk));
  }

  insertChunks(chunks: readonly KbChunk[]): void {
    if (!this.db) throw new Error("knowledge base store is not open");
    this.db.exec("BEGIN");
    try {
      for (const chunk of chunks) this.insertOne(chunk);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    this.hardenPermissions();
  }

  replaceChunks(sourceUrl: string, chunks: readonly KbChunk[]): void {
    if (!this.db) throw new Error("knowledge base store is not open");
    this.db.exec("BEGIN");
    try {
      const ids: string[] = [];
      for (const chunk of this.iterateChunks()) {
        if (chunk.source_url === sourceUrl) ids.push(chunk.id);
      }
      const del = this.db.prepare("DELETE FROM chunks WHERE id = ?");
      for (const id of ids) del.run(id);
      for (const chunk of chunks) this.insertOne(chunk);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    this.hardenPermissions();
  }

  deleteWhere(predicate: (chunk: KbChunk) => boolean): number {
    if (!this.db) return 0;
    const ids: string[] = [];
    for (const chunk of this.iterateChunks()) {
      if (predicate(chunk)) ids.push(chunk.id);
    }
    if (ids.length === 0) return 0;
    this.db.exec("BEGIN");
    try {
      const del = this.db.prepare("DELETE FROM chunks WHERE id = ?");
      for (const id of ids) del.run(id);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    this.hardenPermissions();
    return ids.length;
  }

  replaceAllChunks(chunks: readonly KbChunk[]): void {
    if (!this.db) throw new Error("knowledge base store is not open");
    this.db.exec("BEGIN");
    try {
      this.db.exec("DELETE FROM chunks");
      for (const chunk of chunks) this.insertOne(chunk);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    this.hardenPermissions();
  }

  meta(): KbMeta {
    if (this.metaCache) return this.metaCache;
    const meta: KbMeta = { idf: {}, docCount: 0 };
    if (!this.db) return meta;
    const rows = this.db.prepare("SELECT key, value FROM meta").all() as Array<{ key: string; value: string }>;
    for (const row of rows) {
      if (row.key === "docCount") meta.docCount = Number(row.value) || 0;
      else if (row.key === "model") meta.model = row.value;
      else if (row.key === "idf") meta.idf = JSON.parse(row.value) as Record<string, number>;
      else if (row.key === "embed_state") meta.embed_state = JSON.parse(row.value) as Record<string, unknown>;
    }
    this.metaCache = meta;
    return meta;
  }

  setMeta(meta: KbMeta): void {
    if (!this.db) throw new Error("knowledge base store is not open");
    const put = this.db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)");
    this.db.exec("BEGIN");
    try {
      put.run("docCount", String(meta.docCount));
      if (meta.model) put.run("model", meta.model);
      put.run("idf", JSON.stringify(meta.idf));
      if (meta.embed_state) put.run("embed_state", JSON.stringify(meta.embed_state));
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    this.metaCache = meta;
  }

  appendEvent(message: string): void {
    if (!this.db) return;
    this.db.prepare("INSERT INTO events (at, message) VALUES (?, ?)").run(new Date().toISOString(), message);
    this.db.exec("DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY id DESC LIMIT 100)");
  }

  events(): string[] {
    if (!this.db) return [];
    const rows = this.db.prepare("SELECT message FROM events ORDER BY id ASC").all() as Array<{ message: string }>;
    return rows.map((row) => row.message);
  }

  format(): "encrypted" | "plaintext" | "none" {
    if (!existsSync(this.path)) return "none";
    const row = this.db?.prepare("SELECT MAX(encrypted) AS e FROM chunks").get() as { e: number | null } | undefined;
    return row?.e === 1 ? "encrypted" : "plaintext";
  }
}

export { isKbStoreArtifact };
