// @implements REQ-108 REQ-060 REQ-060a REQ-060b REQ-060c REQ-060d REQ-060e REQ-060f REQ-060h REQ-084 REQ-085 REQ-109 REQ-110 REQ-060i
// SQLite-backed knowledge base. Chunks stream from the database one row at a
// time, so search/list/get/stats do not require the full store in memory.
// When encryption is enabled the whole row payload, the model state, and event
// messages are sealed; the salt and encryption marker live in `meta`.
import { DatabaseSync } from "node:sqlite";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
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
   * Migration guard: the legacy JSON store is the migration's own source and
   * must survive until the database commit and archive rename complete.
   */
  protectedLegacyPath?: string;
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
      // REQ-084: opening an encrypted store must not leave a plaintext
      // migration/corruption archive behind (for example one created by the
      // migration that just completed, or by an interrupted earlier run).
      this.removePlaintextArchives();
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

  // --- Claim ledger (REQ-109, REQ-060h) -------------------------------------
  //
  // Claim rows mirror the chunk store's at-rest rule: only the identifiers
  // (claim_key, source_key) and timestamps stay in clear columns; the claim
  // text, verdict, confidence, and URL live in the sealed payload. The
  // identifiers are keyed with the row key when encryption is on, so the raw
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

  private encodeEdge(edge: Pick<ClaimSourceEdge, "url" | "title">): Buffer {
    const clear = Buffer.from(JSON.stringify({ url: edge.url, title: edge.title }), "utf-8");
    return this.encrypted && this.rowKey ? sealRow(this.rowKey, clear) : clear;
  }

  private decodeEdge(payload: Uint8Array): { url: string; title: string } | null {
    try {
      const clear = this.encrypted && this.rowKey ? openRow(this.rowKey, Buffer.from(payload)) : Buffer.from(payload);
      return JSON.parse(clear.toString("utf-8")) as { url: string; title: string };
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
        deleteEdges.run(id);
        const seen = new Set<string>();
        for (const src of claim.sources) {
          if (!src.url || seen.has(src.url)) continue;
          seen.add(src.url);
          insertEdge.run(
            id,
            this.sourceKey(src.url),
            src.retrieved_at,
            this.encrypted ? 1 : 0,
            this.encodeEdge({ url: src.url, title: src.title })
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
      out.push({ source_key: row.source_key, url: edge.url, title: edge.title, retrieved_at: row.retrieved_at });
    }
    return out;
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
    // REQ-109: claim and edge payloads are sealed too. Decode them under the
    // current key before the switch, then re-encode under the next key.
    const claimRows = this.db
      .prepare("SELECT id, claim_key, payload FROM claims")
      .all() as Array<{ id: string; claim_key: string; payload: Uint8Array }>;
    const decodedClaims = claimRows.map((row) => ({ id: row.id, claim: this.decodeClaim(row.payload) }));
    const edgeRows = this.db
      .prepare("SELECT claim_id, source_key, retrieved_at, payload FROM claim_sources")
      .all() as Array<{ claim_id: string; source_key: string; retrieved_at: string; payload: Uint8Array }>;
    const decodedEdges = edgeRows.map((row) => ({ claim_id: row.claim_id, edge: this.decodeEdge(row.payload) }));
    // REQ-110: receipt payloads are sealed too. Decode them under the current
    // key before the switch, then re-encode and re-key under the next key.
    const receiptRows = this.db
      .prepare("SELECT id, payload FROM report_receipts")
      .all() as Array<{ id: string; payload: Uint8Array }>;
    const decodedReceipts = receiptRows.map((row) => ({ id: row.id, body: this.decodeReceipt(row.payload) }));
    this.rowKey = next.key;
    this.encrypted = next.encrypted;
    this.transaction(() => {
      const update = this.db!.prepare("UPDATE chunks SET encrypted = ?, payload = ? WHERE id = ?");
      for (const item of decoded) {
        if (!item.chunk) continue;
        update.run(next.encrypted ? 1 : 0, this.encodePayload(item.chunk), item.id);
      }
      const updateClaim = this.db!.prepare(
        "UPDATE claims SET claim_key = ?, encrypted = ?, payload = ? WHERE id = ?"
      );
      for (const item of decodedClaims) {
        if (!item.claim) throw new Error("claim row could not be decoded during reseal");
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
      // edges are in the same order as the rows they came from.
      clearEdges.run();
      decodedEdges.forEach((item, i) => {
        const row = edgeRows[i];
        if (!item.edge) throw new Error("claim source row could not be decoded during reseal");
        insertEdge.run(
          row.claim_id,
          this.sourceKey(item.edge.url),
          row.retrieved_at,
          next.encrypted ? 1 : 0,
          this.encodeEdge(item.edge)
        );
      });
      const updateReceipt = this.db!.prepare(
        "UPDATE report_receipts SET report_key = ?, encrypted = ?, payload = ? WHERE id = ?"
      );
      for (const item of decodedReceipts) {
        if (!item.body) throw new Error("report receipt row could not be decoded during reseal");
        updateReceipt.run(
          this.keyedHash(item.body.report_id),
          next.encrypted ? 1 : 0,
          this.encodeReceipt(item.body),
          item.id
        );
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
