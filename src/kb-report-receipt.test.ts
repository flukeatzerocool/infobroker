// @implements REQ-110 REQ-060i REQ-060b
// Report verification receipts (REQ-110) and the read-only offline
// `verify_report` action (REQ-060i). The receipt is a canonical manifest the
// server computes at ingest; verification rehashes the cached report and its
// cited sources without touching the network.
import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  initKb,
  flushKbWrites,
  kbIngest,
  kbGet,
  kbPutReportReceipt,
  kbVerifyReport,
  kbGetReportReceipt,
  kbSupportsReportReceipts,
  getKbLockError,
  rekeyStoreTo,
  resolveReportIdentity,
  ingestDestinations,
} from "./kb.js";
import { canonicalJson, receiptDigest, normalizeReceiptInput, verifyReceipt, RECEIPT_LIMITS } from "./kb-receipt.js";
import { SqliteStore } from "./kb-sqlite.js";
import type { KbConfig, ReportReceiptInput } from "./types.js";

const REPORT_TITLE = "Receipt verification report";
const REPORT_BODY =
  "The bridge inspection found the structure sound. The deck coating needs repair in 2026. " +
  "Inspectors recorded no load-rating change and recommended a two-year follow-up.";

function baseConfig(dir: string): KbConfig {
  return {
    storage_path: dir,
    embedding_model: "signed-hash-tfidf",
    chunk_size: 128,
    chunk_overlap: 16,
    auto_index: false,
    default_collection: "default",
    max_results: 50,
    maintenance_interval_minutes: 0,
    kb_first_relevance_threshold: 0.3,
    kb_first_confidence_threshold: 0.5,
    freshness: {
      tiers: { report: { decay_hours: 720, expiry_hours: 0 }, stable: { decay_hours: 720, expiry_hours: 0 } },
      auto_classify: false,
      default_tier: "stable",
    },
  };
}

const dirs: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

function cleanEnv(): void {
  delete process.env["INFOBROKER_KB_KEY"];
  delete process.env["INFOBROKER_KB_PASSPHRASE"];
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    try {
      flushKbWrites();
    } catch {
      // a locked store may refuse to flush; cleanup still proceeds
    }
    rmSync(dir, { recursive: true, force: true });
  }
  cleanEnv();
  vi.restoreAllMocks();
});

/** Ingest one report plus one cached source document; returns the report identity. */
function seedReport(body = REPORT_BODY): { dir: string; reportId: string; sourceUrl: string } {
  const dir = tempDir("ibk-receipt-");
  initKb(baseConfig(dir));
  const sourceUrl = "https://example.com/bridge-inspection";
  const reportId = resolveReportIdentity(REPORT_TITLE);
  kbIngest(body, REPORT_TITLE, reportId, "explicit", "reports", "report", "report");
  kbIngest("The bridge inspection found the structure sound after the 2026 review.", "Bridge inspection", sourceUrl, "fetch_page", undefined, "fetch_page", "stable");
  return { dir, reportId, sourceUrl };
}

function receipt(): ReportReceiptInput {
  return {
    claims: [
      {
        claim: "the bridge inspection found the structure sound",
        grade: "A",
        sources: [
          { url: "https://example.com/bridge-inspection", title: "Bridge inspection", retrieved_at: "2026-10-01T10:00:00.000Z" },
        ],
      },
    ],
  };
}

/** Ingest a report under an explicit identity (an empty identity is not stored). */
function ingestReport(dir: string, body: string, reportId = resolveReportIdentity(REPORT_TITLE)): string {
  initKb(baseConfig(dir));
  kbIngest(body, REPORT_TITLE, reportId, "explicit", "reports", "report", "report");
  return reportId;
}

function storeReceipt(body = REPORT_BODY) {
  const seeded = seedReport(body);
  const stored = kbPutReportReceipt(seeded.reportId, receipt());
  expect(stored.ok).toBe(true);
  if (!stored.ok) throw new Error("unreachable");
  return { ...seeded, record: stored.record };
}

function verify(reportId: string) {
  const verified = kbVerifyReport(reportId);
  expect(verified.ok).toBe(true);
  if (!verified.ok) throw new Error("unreachable");
  return verified.result;
}

function readRawReceipts(dbPath: string): {
  rows: Array<{ id: string; report_key: string; encrypted: number; payload: Uint8Array }>;
  bytes: string;
} {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = db.prepare("SELECT id, report_key, encrypted, payload FROM report_receipts").all() as Array<{
      id: string;
      report_key: string;
      encrypted: number;
      payload: Uint8Array;
    }>;
    const bytes = Buffer.concat(rows.map((r) => Buffer.from(r.payload))).toString("latin1");
    return { rows, bytes };
  } finally {
    db.close();
  }
}

describe("report receipt storage (REQ-110)", () => {
  it("stores a receipt and verify_report returns verified with digest_match", () => {
    const { reportId, record } = storeReceipt();
    expect(kbSupportsReportReceipts()).toBe(true);
    expect(record.manifest.claims.length).toBe(1);
    expect(record.manifest.digest_sha256).toMatch(/^[0-9a-f]{64}$/);

    const result = verify(reportId);
    expect(result.state).toBe("verified");
    expect(result.digest_match).toBe(true);
    expect(result.digest_sha256).toBe(record.manifest.digest_sha256);
    expect(result.report).toBe("verified");
    expect(result.sources.verified).toBe(1);
    expect(result.sources.drift).toBe(0);
  });

  it("hashes the canonical stored document, not the pre-chunk input", () => {
    const { reportId, record } = storeReceipt();
    const doc = kbGet(reportId);
    expect(doc).not.toBeNull();
    // Chunking prefixes the title, so the stored text differs from REPORT_BODY.
    expect(doc!.text).not.toBe(REPORT_BODY);
    expect(record.manifest.content_sha256).toBe(createHash("sha256").update(doc!.text, "utf-8").digest("hex"));
  });

  it("produces a canonical digest that excludes itself and sorts keys", () => {
    const { record } = storeReceipt();
    const { digest_sha256: _stored, ...rest } = record.manifest;
    expect(receiptDigest(rest)).toBe(record.manifest.digest_sha256);
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
  });

  it("ignores caller-supplied hashes and the digest (REQ-060i caller-digest)", () => {
    const seeded = seedReport();
    const forged = {
      content_sha256: "0".repeat(64),
      digest_sha256: "f".repeat(64),
      claims: [
        {
          claim: "the bridge inspection found the structure sound",
          source_sha256: "1".repeat(64),
          sources: [{ url: "https://example.com/bridge-inspection", source_sha256: "2".repeat(64) }],
        },
      ],
    } as unknown as ReportReceiptInput;
    const stored = kbPutReportReceipt(seeded.reportId, forged);
    expect(stored.ok).toBe(true);
    const result = verify(seeded.reportId);
    expect(result.digest_match).toBe(true);
    expect(result.state).toBe("verified");
  });

  it("persists the receipt through a reopened store", () => {
    const { dir, reportId, record } = storeReceipt();
    flushKbWrites();
    initKb(baseConfig(dir));
    const reread = kbGetReportReceipt(reportId);
    expect(reread?.manifest.digest_sha256).toBe(record.manifest.digest_sha256);
    expect(verify(reportId).state).toBe("verified");
  });

  it("preserves the receipt when the report is re-ingested without one (drift)", () => {
    const { reportId } = storeReceipt();
    const before = kbGetReportReceipt(reportId);
    kbIngest(`${REPORT_BODY} A later revision adds a second inspection date.`, REPORT_TITLE, reportId, "explicit", "reports", "report", "report");
    const after = kbGetReportReceipt(reportId);
    expect(after?.manifest.digest_sha256).toBe(before?.manifest.digest_sha256);
    const result = verify(reportId);
    expect(result.report).toBe("drift");
    expect(result.digest_match).toBe(true);
    expect(result.state).toBe("drift");
  });
});

describe("report drift detection (REQ-060i)", () => {
  it("reports report content drift", () => {
    const { reportId } = storeReceipt();
    kbIngest(`${REPORT_BODY} Corrected: the deck coating needs repair in 2027.`, REPORT_TITLE, reportId, "explicit", "reports", "report", "report");
    const result = verify(reportId);
    expect(result.report).toBe("drift");
    expect(result.state).toBe("drift");
  });

  it("reports cited-source drift", () => {
    const { reportId, sourceUrl } = storeReceipt();
    kbIngest("The bridge inspection found the structure unsound after the 2026 review.", "Bridge inspection", sourceUrl, "fetch_page", undefined, "fetch_page", "stable");
    const result = verify(reportId);
    expect(result.report).toBe("verified");
    expect(result.sources.drift).toBe(1);
    expect(result.sources.details[0]).toMatchObject({
      url: sourceUrl,
      state: "drift",
      hash_basis: "document",
    });
    expect(result.state).toBe("drift");
  });

  it("reports an uncached source as unverifiable with hash_basis snippet, not drift", () => {
    const dir = tempDir("ibk-receipt-snippet-");
    const reportId = ingestReport(dir, REPORT_BODY);
    const stored = kbPutReportReceipt(reportId, {
      claims: [
        {
          claim: "the deck coating needs repair",
          sources: [{ url: "https://example.com/not-cached", snippet: "the deck coating needs repair", retrieved_at: "2026-10-02T09:00:00.000Z" }],
        },
      ],
    });
    expect(stored.ok).toBe(true);
    const result = verify(reportId);
    expect(result.sources.unverifiable).toBe(1);
    expect(result.sources.drift).toBe(0);
    expect(result.sources.details[0]).toMatchObject({
      state: "unverifiable",
      hash_basis: "snippet",
    });
    expect(result.report).toBe("verified");
    expect(result.state).toBe("unverifiable");
  });

  it("makes no network call during verification (REQ-060i offline)", () => {
    const { reportId } = storeReceipt();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = verify(reportId);
    expect(result.state).toBe("verified");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("detects a tampered payload as a digest mismatch (incomplete)", () => {
    const { dir, reportId } = storeReceipt();
    flushKbWrites();
    const dbPath = join(dir, "vector-store.sqlite");
    const db = new DatabaseSync(dbPath);
    try {
      const row = db.prepare("SELECT id, payload FROM report_receipts").get() as { id: string; payload: Uint8Array };
      const body = JSON.parse(Buffer.from(row.payload).toString("utf-8")) as {
        manifest: { claims: Array<{ claim: string }> };
      };
      body.manifest.claims[0]!.claim = "the bridge inspection found the structure unsound";
      db.prepare("UPDATE report_receipts SET payload = ? WHERE id = ?").run(
        Buffer.from(JSON.stringify(body), "utf-8"),
        row.id
      );
    } finally {
      db.close();
    }
    initKb(baseConfig(dir));
    const result = verify(reportId);
    expect(result.digest_match).toBe(false);
    expect(result.state).toBe("incomplete");
  });

  it("returns receipt_not_found for a report without a receipt", () => {
    const { reportId } = storeReceipt();
    const missing = kbVerifyReport("report://no-such-report");
    expect(missing.ok).toBe(false);
    if (missing.ok) throw new Error("unreachable");
    expect(missing.error.code).toBe("receipt_not_found");
    expect(kbVerifyReport(reportId).ok).toBe(true);
  });
});

describe("receipt bounds (REQ-110)", () => {
  it("rejects oversize input with invalid_input instead of truncating", () => {
    const { reportId } = storeReceipt();
    const tooMany = kbPutReportReceipt(reportId, {
      claims: Array.from({ length: 101 }, (_, i) => ({ claim: `claim ${i}`, sources: [] })),
    });
    expect(tooMany.ok).toBe(false);
    if (tooMany.ok) throw new Error("unreachable");
    expect(tooMany.error.code).toBe("invalid_input");

    const tooLong = kbPutReportReceipt(reportId, { claims: [{ claim: "x".repeat(2001), sources: [] }] });
    expect(tooLong.ok === false && tooLong.error.code).toBe("invalid_input");

    const tooManySources = kbPutReportReceipt(reportId, {
      claims: [
        {
          claim: "one claim",
          sources: Array.from({ length: 26 }, (_, i) => ({ url: `https://example.com/${i}` })),
        },
      ],
    });
    expect(tooManySources.ok === false && tooManySources.error.code).toBe("invalid_input");

    const longUrl = kbPutReportReceipt(reportId, {
      claims: [{ claim: "one claim", sources: [{ url: `https://example.com/${"a".repeat(2048)}` }] }],
    });
    expect(longUrl.ok === false && longUrl.error.code).toBe("invalid_input");
  });

  it("rejects an invalid or oversized receipt before storing anything", () => {
    // The tool layer validates with this normalizer before kbIngest, so a
    // rejected receipt can never leave a stored report behind. A new report
    // identity stays absent when the receipt is refused.
    const dir = tempDir("ibk-receipt-prevalidate-");
    initKb(baseConfig(dir));
    const reportId = resolveReportIdentity("A report that must not be stored");
    expect(kbGet(reportId)).toBeNull();

    const invalid = normalizeReceiptInput({ claims: [] });
    expect(invalid.ok).toBe(false);
    if (invalid.ok) throw new Error("unreachable");
    expect(invalid.error.code).toBe("invalid_input");

    const oversized = normalizeReceiptInput({
      claims: [{ claim: "one claim", sources: [{ url: "https://example.com/x", snippet: "s".repeat(RECEIPT_LIMITS.snippetChars + 1) }] }],
    });
    expect(oversized.ok).toBe(false);
    if (oversized.ok) throw new Error("unreachable");
    expect(oversized.error.code).toBe("invalid_input");

    // Nothing was written: the report identity is still absent and no receipt
    // exists for it.
    expect(kbGet(reportId)).toBeNull();
    expect(kbGetReportReceipt(reportId)).toBeNull();
  });

  it("rejects a source snippet over the 2,000-character bound before hashing", () => {
    const atLimit = normalizeReceiptInput({
      claims: [{ claim: "one claim", sources: [{ url: "https://example.com/x", snippet: "s".repeat(RECEIPT_LIMITS.snippetChars) }] }],
    });
    expect(atLimit.ok).toBe(true);

    const overLimit = normalizeReceiptInput({
      claims: [{ claim: "one claim", sources: [{ url: "https://example.com/x", snippet: "s".repeat(RECEIPT_LIMITS.snippetChars + 1) }] }],
    });
    expect(overLimit.ok).toBe(false);
    if (overLimit.ok) throw new Error("unreachable");
    expect(overLimit.error.code).toBe("invalid_input");
    expect(RECEIPT_LIMITS.snippetChars).toBe(2000);
  });

  it("rejects an empty claim list and a non-array receipt", () => {
    const { reportId } = storeReceipt();
    expect(kbPutReportReceipt(reportId, { claims: [] }).ok).toBe(false);
    expect(kbPutReportReceipt(reportId, null as unknown as ReportReceiptInput).ok).toBe(false);
  });

  it("accepts the maximum claim count and source count", () => {
    const { reportId } = storeReceipt();
    const atLimit = kbPutReportReceipt(reportId, {
      claims: Array.from({ length: 100 }, (_, i) => ({
        claim: `claim ${i}`,
        sources: Array.from({ length: 25 }, (_, j) => ({ url: `https://example.com/${i}/${j}`, snippet: "s" })),
      })),
    });
    expect(atLimit.ok).toBe(true);
  });
});

describe("receipt encryption transitions (REQ-110)", () => {
  it("seals the receipt at rest and keeps reads working", () => {
    const { dir, reportId } = storeReceipt();
    flushKbWrites();
    const dbPath = join(dir, "vector-store.sqlite");
    const clear = readRawReceipts(dbPath);
    expect(clear.bytes).toContain("https://example.com/bridge-inspection");

    const secret = { kind: "raw" as const, dek: randomBytes(32) };
    const store = new SqliteStore(dir);
    store.init();
    store.enableEncryption(secret);
    store.close();

    const sealed = readRawReceipts(dbPath);
    expect(sealed.rows.length).toBe(1);
    expect(sealed.rows[0]!.encrypted).toBe(1);
    expect(sealed.bytes).not.toContain("bridge-inspection");
    expect(sealed.bytes).not.toContain(reportId);
    expect(sealed.bytes).not.toContain("the bridge inspection found the structure sound");
    expect(sealed.rows[0]!.report_key).not.toContain("report://");

    // Reads decrypt after a fresh open with the key.
    process.env["INFOBROKER_KB_KEY"] = secret.dek.toString("base64");
    initKb({ ...baseConfig(dir), encryption: { enabled: true } });
    expect(verify(reportId).state).toBe("verified");
  });

  it("reseals on enable, disable, and rekey after a receipt exists", () => {
    const dir = tempDir("ibk-receipt-transitions-");
    initKb(baseConfig(dir));
    const reportId = resolveReportIdentity(REPORT_TITLE);
    kbIngest(REPORT_BODY, REPORT_TITLE, reportId, "explicit", "reports", "report", "report");
    // The cited source is cached, so the receipt is fully verifiable.
    kbIngest("The bridge inspection found the structure sound after the 2026 review.", "Bridge inspection", "https://example.com/bridge-inspection", "fetch_page", undefined, "fetch_page", "stable");
    expect(kbPutReportReceipt(reportId, receipt()).ok).toBe(true);
    flushKbWrites();

    // Enable: the transition reseals the receipt.
    const first = { kind: "raw" as const, dek: randomBytes(32) };
    const enable = new SqliteStore(dir);
    enable.init();
    enable.enableEncryption(first);
    enable.close();

    process.env["INFOBROKER_KB_KEY"] = first.dek.toString("base64");
    initKb({ ...baseConfig(dir), encryption: { enabled: true } });
    expect(verify(reportId).state).toBe("verified");
    flushKbWrites();

    // Rekey: the report_key and payload are recomputed under the new key.
    const second = { kind: "raw" as const, dek: randomBytes(32) };
    expect(rekeyStoreTo(first, second)).not.toBeNull();
    process.env["INFOBROKER_KB_KEY"] = second.dek.toString("base64");
    initKb({ ...baseConfig(dir), encryption: { enabled: true } });
    expect(verify(reportId).state).toBe("verified");
    flushKbWrites();

    // Disable: the transition decrypts the receipt and verification still works.
    const disable = new SqliteStore(dir, { secret: second, encryptionEnabled: true });
    disable.init();
    disable.disableEncryption(second);
    disable.close();
    cleanEnv();
    initKb(baseConfig(dir));
    expect(verify(reportId).state).toBe("verified");
    const plain = readRawReceipts(join(dir, "vector-store.sqlite"));
    expect(plain.rows[0]!.encrypted).toBe(0);
    expect(plain.bytes).toContain("bridge-inspection");
  });

  it("reports the store lock instead of a false verdict", () => {
    const { dir } = storeReceipt();
    flushKbWrites();
    const secret = { kind: "raw" as const, dek: randomBytes(32) };
    const store = new SqliteStore(dir);
    store.init();
    store.enableEncryption(secret);
    store.close();

    cleanEnv();
    initKb({ ...baseConfig(dir), encryption: { enabled: true } });
    expect(getKbLockError()?.code).toBe("config_error");
  });
});

describe("receipt ingest destination (REQ-060b)", () => {
  it("maps save destinations to knowledge-base and disk writes", () => {
    expect(ingestDestinations("disk")).toEqual({ kb: false, disk: true });
    expect(ingestDestinations("both")).toEqual({ kb: true, disk: true });
    expect(ingestDestinations("kb")).toEqual({ kb: true, disk: false });
  });
});

describe("report manifest metadata (REQ-114, REQ-110)", () => {
  it("round-trips report metadata and per-claim grading fields", () => {
    const seeded = seedReport();
    const withMeta: ReportReceiptInput = {
      ...receipt(),
      report: {
        shape: "Deep-Dive",
        audience: "analyst",
        methodology: "Two independent fetches plus corroboration.",
        assumptions: ["The cached page reflects the live source."],
        alternatives: ["The inspection record may be superseded."],
        gaps: ["No load-rating baseline was available."],
        supersedes: "report://previous",
        revision: 2,
      },
    };
    withMeta.claims[0]!.verdict = "Mostly True";
    withMeta.claims[0]!.confidence = "Medium";
    withMeta.claims[0]!.likelihood = "likely";
    const stored = kbPutReportReceipt(seeded.reportId, withMeta);
    expect(stored.ok).toBe(true);
    if (!stored.ok) throw new Error("unreachable");
    expect(stored.record.manifest.report?.audience).toBe("analyst");
    expect(stored.record.manifest.claims[0]!.confidence).toBe("Medium");

    const result = verify(seeded.reportId);
    expect(result.state).toBe("verified");
    expect(result.report_meta?.shape).toBe("Deep-Dive");
    expect(result.revision).toBe(2);
    expect(result.supersedes).toBe("report://previous");
    expect(result.created_at).toBeDefined();
    expect(result.age_days).toBeGreaterThanOrEqual(0);
    expect(result.freshness_tier).toBe("report");
    expect(result.stale).toBe(false);
  });

  it("verifies a version-1 manifest that predates the report block", () => {
    const seeded = seedReport();
    const doc = kbGet(seeded.reportId);
    expect(doc).not.toBeNull();
    const base = {
      version: 1 as const,
      report_id: seeded.reportId,
      content_sha256: createHash("sha256").update(doc!.text).digest("hex"),
      claims: [],
    };
    const manifest = { ...base, digest_sha256: receiptDigest(base) };
    const result = verifyReceipt({
      manifest,
      reportText: doc!.text,
      cachedDocument: () => null,
    });
    expect(result.digest_match).toBe(true);
    expect(result.report).toBe("verified");
    expect(result.report_meta).toBeUndefined();
  });

  it("rejects an invalid confidence value and leaves the report writable", () => {
    const bad = normalizeReceiptInput({
      claims: [{ claim: "x", confidence: "Certain", sources: [] }],
    });
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("unreachable");
    expect(bad.error.code).toBe("invalid_input");

    const good = normalizeReceiptInput({
      claims: [{ claim: "x", confidence: "High", verdict: "True", sources: [] }],
      report: { shape: "Fact-Check", assumptions: ["one"] },
    });
    expect(good.ok).toBe(true);
    if (!good.ok) throw new Error("unreachable");
    expect(good.value.report?.shape).toBe("Fact-Check");
    expect(good.value.claims[0]!.confidence).toBe("High");
  });
});
