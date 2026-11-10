// Probe for the R6 encryption and capacity remediation plan (2026-11-10).
// Reproduces F-R6-D-1 (events lost on rekey, ciphertext after disable),
// F-R6-D-2 (no format marker; a read-write open creates sidecars), and
// F-R6-E-1 (a corrupt live store has no REQ-108 recovery path).
// Every directory is a disposable temp dir; no repository state is touched.
// Run: npx tsx probe.ts
import { mkdtempSync, openSync, closeSync, ftruncateSync, readFileSync, readSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { SqliteStore, sqliteStoreFormat } from "../../../src/kb-sqlite.ts";
import { rawKeyFromString } from "../../../src/kb-crypto.ts";

const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16);
const report = (label: string, e: unknown) => {
  const err = e as Error & { code?: string; errcode?: number };
  console.log(`${label} throw:`, err.code, err.errcode, JSON.stringify(err.message));
};

function seed(dir: string): void {
  const s = new SqliteStore(dir, { journalMode: "DELETE" });
  s.init();
  s.insertChunks([
    {
      id: "c1",
      source_url: "https://example.com/a",
      title: "a",
      text: "alpha beta gamma",
      source_type: "test",
      ingested_at: 1,
      collection: "default",
      embedding: [1, 0, 0],
      freshness: "stable",
    } as never,
  ]);
  s.setMeta({ idf: { alpha: 1 }, docCount: 1 });
  s.close();
}

// --- 1. No format marker; a zero-length live file opens with no marker ---
const empty = mkdtempSync(join(tmpdir(), "probe-empty-"));
writeFileSync(join(empty, "vector-store.sqlite"), "");
{
  const s = new SqliteStore(empty, {});
  s.init();
  const keys = (s as unknown as { db: DatabaseSync }).db.prepare("SELECT key FROM meta").all();
  console.log("P1 zero-length dir:", readdirSync(empty), "meta:", JSON.stringify(keys));
  s.close();
}

// --- 2. A recognized SQLite store with corrupt pages (SQLITE_CORRUPT 11) ---
const truncated = mkdtempSync(join(tmpdir(), "probe-trunc-"));
seed(truncated);
{
  const p = join(truncated, "vector-store.sqlite");
  const fd = openSync(p, "r+");
  ftruncateSync(fd, 600);
  closeSync(fd);
  try {
    const s = new SqliteStore(truncated, {});
    s.init();
    console.log("P2 init ok (unexpected)");
    s.close();
  } catch (e) {
    report("P2 (truncated, magic intact)", e);
  }
  console.log("P2 dir:", readdirSync(truncated), "backup? none expected");
}

// --- 3. A non-SQLite file (unrecognized format, SQLITE_NOTADB 26) ---
const notdb = mkdtempSync(join(tmpdir(), "probe-notdb-"));
writeFileSync(join(notdb, "vector-store.sqlite"), "this is not a sqlite database at all");
try {
  const s = new SqliteStore(notdb, {});
  s.init();
  console.log("P3 init ok (unexpected)");
  s.close();
} catch (e) {
  report("P3 (non-SQLite bytes)", e);
}
console.log("P3 dir:", readdirSync(notdb));

// --- 4. A read-write open creates sidecars even when it later throws ---
const sidecar = mkdtempSync(join(tmpdir(), "probe-sidecar-"));
seed(sidecar);
{
  const p = join(sidecar, "vector-store.sqlite");
  const bytes = readFileSync(p);
  writeFileSync(p, Buffer.concat([bytes.subarray(0, 4096), Buffer.alloc(4096), bytes.subarray(8192)]));
  const before = readdirSync(sidecar);
  try {
    const s = new SqliteStore(sidecar, {});
    s.init();
    s.close();
  } catch (e) {
    report("P4 (zeroed page 2)", e);
  }
  console.log("P4 before:", before, "after:", readdirSync(sidecar), "main sha:", sha(p));
}

// --- 5. A read-only open plus quick_check detects page damage ---
{
  const damaged = mkdtempSync(join(tmpdir(), "probe-quick-"));
  seed(damaged);
  const p = join(damaged, "vector-store.sqlite");
  const bytes = readFileSync(p);
  writeFileSync(p, Buffer.concat([bytes.subarray(0, 4096), Buffer.alloc(4096), bytes.subarray(8192)]));
  try {
    const db = new DatabaseSync(p, { readOnly: true });
    try {
      db.prepare("PRAGMA quick_check").all();
      console.log("P5 quick_check: ok (unexpected)");
    } catch (e) {
      report("P5 quick_check (zeroed page 2)", e);
    }
    db.close();
  } catch (e) {
    report("P5 open (zeroed page 2)", e);
  }
}

// --- 6. The read-only format probe creates sidecars on a clean WAL store ---
const formatProbe = mkdtempSync(join(tmpdir(), "probe-fmt-"));
{
  // Default journal mode is WAL, which persists in the file header.
  const s = new SqliteStore(formatProbe, {});
  s.init();
  s.appendEvent("hello");
  s.close();
  const before = readdirSync(formatProbe);
  const format = sqliteStoreFormat(formatProbe);
  console.log("P6 before:", before, "format:", format, "after:", readdirSync(formatProbe));
}

// --- 7. Header bytes are readable without opening SQLite ---
const header = mkdtempSync(join(tmpdir(), "probe-header-"));
{
  seed(header);
  const fd = openSync(join(header, "vector-store.sqlite"), "r");
  const buf = Buffer.alloc(100);
  readSync(fd, buf, 0, 100, 0);
  closeSync(fd);
  console.log(
    "P7 magic:",
    JSON.stringify(buf.subarray(0, 16).toString("binary")),
    "user_version:",
    buf.readUInt32BE(60),
    "dir:",
    readdirSync(header)
  );
}

// --- 8. Event history across rekey and disable ---
const events = mkdtempSync(join(tmpdir(), "probe-events-"));
const key1 = rawKeyFromString("a".repeat(64))!;
const key2 = rawKeyFromString("b".repeat(64))!;
{
  const s = new SqliteStore(events, { secret: key1, encryptionEnabled: true });
  s.init();
  s.appendEvent("event-before-rekey");
  s.appendEvent("second-event-before-rekey");
  console.log("P8 before:", s.events());
  s.rekey(key1, key2);
  console.log("P8 after rekey:", s.events());
  s.close();

  const s2 = new SqliteStore(events, { secret: key2 });
  s2.init();
  console.log("P8 reopened after rekey:", s2.events());
  s2.disableEncryption(key2);
  console.log("P8 after disable:", s2.events());
  s2.close();

  const s3 = new SqliteStore(events, { secret: key2 });
  s3.init();
  console.log("P8 reopened after disable:", s3.events());
  console.log("P8 meta keys:", JSON.stringify((s3 as unknown as { db: DatabaseSync }).db.prepare("SELECT key FROM meta").all()));
  s3.close();
}
