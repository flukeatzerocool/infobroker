// @implements REQ-109 REQ-060h
// Claim ledger persistence (REQ-109) and the read-only `claims` action
// (REQ-060h). A locked store must error without hiding the findings
// `verify_claims` already produced.
import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { DatabaseSync, StatementSync } from "node:sqlite";
import {
  initKb,
  flushKbWrites,
  kbRecordClaims,
  kbClaims,
  kbSupportsClaims,
  kbStoreFormat,
  getKbLockError,
  rekeyStoreTo,
} from "./kb.js";
import { SqliteStore, CLAIM_SCAN_LIMIT } from "./kb-sqlite.js";
import { resolveKeySource } from "./kb-crypto.js";
import type { ClaimLedgerResult, ClaimRecord, KbConfig } from "./types.js";

const CLAIM_TEXT = "the bridge is structurally sound after the 2026 inspection";
const SOURCE_URL = "https://example.com/bridge-inspection";

function baseConfig(dir: string): KbConfig {
  return {
    storage_path: dir,
    embedding_model: "signed-hash-tfidf",
    chunk_size: 512,
    chunk_overlap: 64,
    auto_index: false,
    default_collection: "default",
    max_results: 50,
    maintenance_interval_minutes: 0,
    kb_first_relevance_threshold: 0.3,
    kb_first_confidence_threshold: 0.5,
    freshness: {
      tiers: { stable: { decay_hours: 720, expiry_hours: 0 } },
      auto_classify: false,
      default_tier: "stable",
    },
  };
}

function encryptedConfig(dir: string, keyFile: string): KbConfig {
  return { ...baseConfig(dir), encryption: { enabled: true, key_file: keyFile } };
}

function newKeyFile(dir: string, name: string): string {
  const path = join(dir, name);
  writeFileSync(path, `${randomBytes(32).toString("base64")}\n`, { mode: 0o600 });
  return path;
}

interface Bundle {
  claim: string;
  verdict: ClaimRecord["verdict"];
  confidence: number;
  sources: Array<{ url: string; title: string; retrieved_at: string }>;
}

function bundle(overrides: Partial<Bundle> = {}): Bundle {
  return {
    claim: CLAIM_TEXT,
    verdict: "confirmed",
    confidence: 0.9,
    sources: [{ url: SOURCE_URL, title: "Bridge inspection", retrieved_at: "2026-10-01T10:00:00.000Z" }],
    ...overrides,
  };
}

/** Read the ledger, asserting the backend supports it (SQLite tests). */
function readClaims(query: Parameters<typeof kbClaims>[0] = {}): ClaimLedgerResult {
  const result = kbClaims(query);
  expect(result).not.toBeNull();
  return result as ClaimLedgerResult;
}

const dirs: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

function readRaw(dbPath: string): string {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const claims = db.prepare("SELECT claim_key, payload FROM claims").all() as Array<{ claim_key: string; payload: Uint8Array }>;
    const edges = db.prepare("SELECT source_key, payload FROM claim_sources").all() as Array<{ source_key: string; payload: Uint8Array }>;
    const rows = db.prepare("SELECT claim_key, encrypted FROM claims").all() as Array<{ encrypted: number }>;
    return JSON.stringify({
      claims,
      edges,
      encryptedFlags: rows.map((r) => r.encrypted),
      bytes: Buffer.concat([...claims.map((c) => Buffer.from(c.payload)), ...edges.map((e) => Buffer.from(e.payload))]).toString("latin1"),
    });
  } finally {
    db.close();
  }
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
  delete process.env["INFOBROKER_KB_KEY"];
});

describe("claim ledger persistence (REQ-109)", () => {
  it("persists one row per claim and one edge per source with retrieved_at", () => {
    const dir = tempDir("ibk-claims-");
    initKb(baseConfig(dir));
    expect(kbSupportsClaims()).toBe(true);
    const ok = kbRecordClaims([
      bundle({
        sources: [
          { url: SOURCE_URL, title: "Bridge inspection", retrieved_at: "2026-10-01T10:00:00.000Z" },
          { url: "https://example.com/second", title: "Second", retrieved_at: "2026-10-02T11:30:00.000Z" },
        ],
      }),
    ]);
    expect(ok).toBe(true);
    const ledger = readClaims();
    expect(ledger.claims.length).toBe(1);
    expect(ledger.claims[0].claim).toBe(CLAIM_TEXT);
    expect(ledger.claims[0].verdict).toBe("confirmed");
    expect(ledger.claims[0].sources.length).toBe(2);
    for (const edge of ledger.claims[0].sources) {
      expect(Date.parse(edge.retrieved_at)).not.toBeNaN();
    }
  });

  it("re-verification updates in place, preserves first_seen_at, and does not duplicate", () => {
    const dir = tempDir("ibk-claims-");
    initKb(baseConfig(dir));
    kbRecordClaims([bundle({ confidence: 0.5 })]);
    const first = readClaims().claims[0];
    kbRecordClaims([
      bundle({
        confidence: 0.95,
        verdict: "contested",
        sources: [{ url: "https://example.com/replacement", title: "Replacement", retrieved_at: "2026-10-05T00:00:00.000Z" }],
      }),
    ]);
    const ledger = readClaims();
    expect(ledger.claims.length).toBe(1);
    const again = ledger.claims[0];
    expect(again.id).toBe(first.id);
    expect(again.first_seen_at).toBe(first.first_seen_at);
    expect(again.confidence).toBe(0.95);
    expect(again.verdict).toBe("contested");
    // The source set is replaced, not appended (history is deferred).
    expect(again.sources.length).toBe(1);
    expect(again.sources[0].url).toBe("https://example.com/replacement");
  });

  it("returns newest-first and applies query and source_url filters", () => {
    const dir = tempDir("ibk-claims-");
    initKb(baseConfig(dir));
    // Two claims written in order; the second is the most recently updated.
    kbRecordClaims([bundle({ claim: "alpha claim about the river", sources: [{ url: "https://example.com/river", title: "River", retrieved_at: "2026-10-01T00:00:00.000Z" }] })]);
    kbRecordClaims([bundle({ claim: "beta claim about the bridge", sources: [{ url: "https://example.com/bridge", title: "Bridge", retrieved_at: "2026-10-02T00:00:00.000Z" }] })]);
    const all = readClaims().claims;
    expect(all.map((c) => c.claim)).toEqual(["beta claim about the bridge", "alpha claim about the river"]);
    expect(all[0].updated_at >= all[1].updated_at).toBe(true);

    const filtered = readClaims({ query: "RIVER" }).claims;
    expect(filtered.length).toBe(1);
    expect(filtered[0].claim).toContain("river");

    const bySource = readClaims({ source_url: "https://example.com/bridge" }).claims;
    expect(bySource.length).toBe(1);
    expect(bySource[0].claim).toContain("bridge");
    expect(readClaims({ source_url: "https://example.com/absent" }).claims.length).toBe(0);
  });

  it("honours max_results", () => {
    const dir = tempDir("ibk-claims-");
    initKb(baseConfig(dir));
    for (let i = 0; i < 5; i++) {
      kbRecordClaims([bundle({ claim: `bounded claim number ${i}` })]);
    }
    expect(readClaims({ max_results: 2 }).claims.length).toBe(2);
    expect(readClaims({ max_results: 500 }).claims.length).toBe(5);
  });
});

describe("claim ledger encryption (REQ-109)", () => {
  it("seals claim text and URL at rest, marks rows encrypted, and still reads them", () => {
    const dir = tempDir("ibk-claims-enc-");
    const key = newKeyFile(dir, "good.key");
    initKb(encryptedConfig(dir, key));
    kbRecordClaims([bundle()]);
    flushKbWrites();
    expect(kbStoreFormat()).toBe("encrypted");

    const raw = readRaw(join(dir, "vector-store.sqlite"));
    expect(raw).not.toContain("bridge");
    expect(raw).not.toContain("example.com");
    const parsed = JSON.parse(raw) as { encryptedFlags: number[] };
    expect(parsed.encryptedFlags.every((f) => f === 1)).toBe(true);

    const ledger = readClaims();
    expect(ledger.claims[0].claim).toBe(CLAIM_TEXT);
    expect(ledger!.claims[0].sources[0].url).toBe(SOURCE_URL);
  });

  it("reseals claims when encryption is enabled after they exist", () => {
    const dir = tempDir("ibk-claims-enc-late-");
    const key = newKeyFile(dir, "good.key");
    initKb(baseConfig(dir));
    kbRecordClaims([bundle()]);
    flushKbWrites();
    expect(readRaw(join(dir, "vector-store.sqlite"))).toContain("bridge");

    initKb(encryptedConfig(dir, key));
    flushKbWrites();
    expect(kbStoreFormat()).toBe("encrypted");
    const raw = readRaw(join(dir, "vector-store.sqlite"));
    expect(raw).not.toContain("bridge");
    expect(raw).not.toContain("example.com");
    expect(readClaims({ query: "bridge" }).claims.length).toBe(1);
  });

  it("decrypts claims when encryption is disabled", () => {
    const dir = tempDir("ibk-claims-enc-off-");
    const key = newKeyFile(dir, "good.key");
    initKb(encryptedConfig(dir, key));
    kbRecordClaims([bundle()]);
    flushKbWrites();
    // REQ-084: disabling is a store transition that needs the current key, so
    // drive it through the store the same way `initKb` does when the config
    // turns encryption off while the key still resolves.
    const store = new SqliteStore(dir, { secret: resolveKeySource(key)!, encryptionEnabled: true });
    store.init();
    try {
      store.disableEncryption(resolveKeySource(key)!);
    } finally {
      store.close();
    }
    initKb(baseConfig(dir));
    flushKbWrites();
    expect(kbStoreFormat()).toBe("plaintext");
    expect(readClaims().claims[0].claim).toBe(CLAIM_TEXT);

    // The payloads are genuinely readable without the key now.
    const raw = readRaw(join(dir, "vector-store.sqlite"));
    expect(raw).toContain("bridge");
    const parsed = JSON.parse(raw) as { encryptedFlags: number[] };
    expect(parsed.encryptedFlags.every((f) => f === 0)).toBe(true);
  });

  it("keeps claims readable under a new key after rekey", () => {
    const dir = tempDir("ibk-claims-rekey-");
    const from = newKeyFile(dir, "from.key");
    const to = newKeyFile(dir, "to.key");
    initKb(encryptedConfig(dir, from));
    kbRecordClaims([bundle()]);
    flushKbWrites();
    const result = rekeyStoreTo(null, resolveKeySource(to)!);
    expect(result).toBeTruthy();
    expect(readClaims().claims[0].claim).toBe(CLAIM_TEXT);
    expect(readClaims({ source_url: SOURCE_URL }).claims.length).toBe(1);
  });
});

describe("claim ledger failure modes (REQ-109 REQ-060h)", () => {
  it("streams claim rows instead of materializing the ledger before the bound", () => {
    const dir = tempDir("ibk-claims-stream-");
    initKb(baseConfig(dir));
    const store = new SqliteStore(dir);
    store.init();
    const all = vi.spyOn(StatementSync.prototype, "all");
    try {
      // Seed past the bound so a materializing read would have to decode all
      // of them; the streaming read must stop at CLAIM_SCAN_LIMIT.
      const claims = Array.from({ length: CLAIM_SCAN_LIMIT + 1 }, (_, i) => ({
        claim: `streamed claim ${i}`,
        verdict: "unverified" as const,
        confidence: 0.3,
        sources: [] as Array<{ url: string; title: string; retrieved_at: string }>,
      }));
      store.upsertClaims(claims);
      all.mockClear();
      // A filter matching nothing forces the scan to run to its bound.
      const result = store.claims({ query: "no such claim text anywhere", max_results: 50 });
      expect(result.scanned).toBe(CLAIM_SCAN_LIMIT);
      expect(result.truncated).toBe(true);
      expect(result.claims.length).toBe(0);
      // The claim SELECT must not go through `.all()` (materialize); it streams.
      expect(all).not.toHaveBeenCalled();
    } finally {
      all.mockRestore();
      store.close();
    }
  });

  it("reports truncated when the scan bound is hit", () => {
    const dir = tempDir("ibk-claims-cap-");
    initKb(baseConfig(dir));
    // Drive the store directly so the bound is exercised without 5k inserts
    // through the public write path.
    const store = new SqliteStore(dir);
    store.init();
    try {
      const claims = Array.from({ length: CLAIM_SCAN_LIMIT + 1 }, (_, i) => ({
        claim: `filler claim ${i}`,
        verdict: "unverified" as const,
        confidence: 0.3,
        sources: [{ url: `https://example.com/${i}`, title: `S${i}`, retrieved_at: "2026-10-01T00:00:00.000Z" }],
      }));
      store.upsertClaims(claims);
      // A filter that matches nothing keeps the scan running: the bound, not
      // the result cap, is what stops the read and raises truncated.
      const result = store.claims({ query: "no such claim text anywhere", max_results: 50 });
      expect(result.truncated).toBe(true);
      expect(result.scanned).toBe(CLAIM_SCAN_LIMIT);
      expect(result.claims.length).toBe(0);

      // An unfiltered read is capped by max_results first and is not truncated.
      const capped = store.claims({ max_results: 50 });
      expect(capped.claims.length).toBe(50);
      expect(capped.truncated).toBe(false);
    } finally {
      store.close();
    }
  });

  it("errors on a locked store but leaves verify_claims findings intact", () => {
    const dir = tempDir("ibk-claims-locked-");
    const key = newKeyFile(dir, "good.key");
    initKb(encryptedConfig(dir, key));
    kbRecordClaims([bundle()]);
    flushKbWrites();
    // Reopen with encryption enabled but the key file gone: the store locks.
    rmSync(key, { force: true });
    initKb(encryptedConfig(dir, key));
    expect(getKbLockError()).not.toBeNull();
    expect(() => kbClaims({})).not.toThrow();

    // REQ-109: a write attempt under the lock is best-effort and silent.
    expect(kbRecordClaims([bundle({ claim: "cannot persist while locked" })])).toBe(false);
    expect(existsSync(join(dir, "vector-store.sqlite"))).toBe(true);
  });
});
