// @implements REQ-084 REQ-085 REQ-086
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync, utimesSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initKb, kbIngest, kbStats, kbGet, kbSearch, flushKbWrites, getKbLockError, getKbEncryptionState, runTruncSweep, rekeyStore, generateKeyFile, verifyStoreKey, backupKeyFile, kbEncryptionStatus, rekeyStoreTo } from "./kb.js";
import { openEnvelope, readKeyFile, type ResolvedKey } from "./kb-crypto.js";
import type { KbConfig } from "./types.js";

const KEY = "0123456789abcdef0123456789abcdef";
const KEY_B64 = Buffer.from(KEY, "utf-8").toString("base64");

function makeConfig(dir: string, encryption: { enabled: boolean; key_file?: string } | undefined): KbConfig {
  return {
    storage_path: dir,
    embedding_model: "signed-hash-tfidf",
    chunk_size: 512,
    chunk_overlap: 64,
    auto_index: false,
    default_collection: "default",
    max_results: 50,
    maintenance_interval_minutes: 60,
    kb_first_relevance_threshold: 0.3,
    kb_first_confidence_threshold: 0.5,
    freshness: {
      tiers: { stable: { decay_hours: 720, expiry_hours: 0 } },
      auto_classify: false,
      default_tier: "stable",
    },
    encryption,
  };
}

function cleanEnv(): void {
  delete process.env["INFOBROKER_KB_KEY"];
  delete process.env["INFOBROKER_KB_PASSPHRASE"];
  delete process.env["INFOBROKER_KB_REKEY_FROM"];
  delete process.env["INFOBROKER_KB_REKEY_TO"];
  delete process.env["INFOBROKER_KB_REKEY_FROM_PASSPHRASE"];
  delete process.env["INFOBROKER_KB_REKEY_TO_PASSPHRASE"];
  delete process.env["INFOBROKER_KB_REKEY_TO_KEY_FILE"];
}

afterEach(() => cleanEnv());

describe("KB at-rest encryption (REQ-084)", () => {
  it("encrypts the store at rest when enabled via env key", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-enc-"));
    process.env["INFOBROKER_KB_KEY"] = KEY_B64;
    initKb(makeConfig(dir, { enabled: true }));
    kbIngest("sensitive payload", "t", "https://example.com/s", "test");
    flushKbWrites();

    const fpath = join(dir, "vector-store.json");
    const onDisk = readFileSync(fpath, "utf-8");
    expect(onDisk).not.toContain("sensitive payload");
    expect(onDisk.startsWith("INFOKB1")).toBe(true);
    expect(getKbEncryptionState()).toBe("enabled");

    const stats = kbStats();
    expect(stats.encryption).toBe("enabled");

    const doc = kbGet("https://example.com/s");
    expect(doc?.text).toContain("sensitive payload");

    rmSync(dir, { recursive: true, force: true });
  });

  it("reports 'locked' and errors when enabled with no key, leaving the file untouched", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-lock-"));
    process.env["INFOBROKER_KB_KEY"] = KEY_B64;
    initKb(makeConfig(dir, { enabled: true }));
    kbIngest("payload", "t", "https://example.com/s", "test");
    flushKbWrites();
    const fpath = join(dir, "vector-store.json");
    const before = readFileSync(fpath);

    cleanEnv();
    initKb(makeConfig(dir, { enabled: true }));
    expect(getKbLockError()).not.toBeNull();
    expect(getKbEncryptionState()).toBe("locked");
    expect(readFileSync(fpath).equals(before)).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });

  it("leaves the store untouched and locks on wrong key", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-wrong-"));
    process.env["INFOBROKER_KB_KEY"] = KEY_B64;
    initKb(makeConfig(dir, { enabled: true }));
    kbIngest("payload", "t", "https://example.com/s", "test");
    flushKbWrites();
    const fpath = join(dir, "vector-store.json");
    const before = readFileSync(fpath);

    process.env["INFOBROKER_KB_KEY"] = Buffer.from("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "utf-8").toString("base64");
    initKb(makeConfig(dir, { enabled: true }));
    expect(getKbLockError()).not.toBeNull();
    expect(readFileSync(fpath).equals(before)).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });

  it("migrates a legacy plaintext store to encrypted on enable", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-migrate-"));
    // First write a plaintext store.
    initKb(makeConfig(dir, undefined));
    kbIngest("legacy content", "t", "https://example.com/s", "test");
    flushKbWrites();
    const fpath = join(dir, "vector-store.json");
    expect(readFileSync(fpath, "utf-8").startsWith("INFOKB1")).toBe(false);

    // Enable encryption: eager migration encrypts in place.
    process.env["INFOBROKER_KB_KEY"] = KEY_B64;
    initKb(makeConfig(dir, { enabled: true }));
    expect(readFileSync(fpath, "utf-8").startsWith("INFOKB1")).toBe(true);
    expect(kbGet("https://example.com/s")?.text).toContain("legacy content");

    rmSync(dir, { recursive: true, force: true });
  });

  it("downgrades to plaintext when disabled with the key present", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-down-"));
    process.env["INFOBROKER_KB_KEY"] = KEY_B64;
    initKb(makeConfig(dir, { enabled: true }));
    kbIngest("content", "t", "https://example.com/s", "test");
    flushKbWrites();
    const fpath = join(dir, "vector-store.json");
    expect(readFileSync(fpath, "utf-8").startsWith("INFOKB1")).toBe(true);

    // Disable but keep the key available (so the store can be read).
    initKb(makeConfig(dir, undefined));
    kbIngest("more content", "t2", "https://example.com/s2", "test");
    flushKbWrites();
    expect(readFileSync(fpath, "utf-8").startsWith("INFOKB1")).toBe(false);
    expect(kbGet("https://example.com/s")?.text).toContain("content");
    expect(kbSearch("more", 5).length).toBeGreaterThan(0);

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("KB data preservation invariants (REQ-085)", () => {
  it("does not rewrite a store with a newer-format version byte", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-ver-"));
    process.env["INFOBROKER_KB_KEY"] = KEY_B64;
    initKb(makeConfig(dir, { enabled: true }));
    kbIngest("x", "t", "https://example.com/s", "test");
    flushKbWrites();
    const fpath = join(dir, "vector-store.json");
    const bytes = readFileSync(fpath);
    // Bump the format version byte (index 7 after "INFOKB1").
    bytes[Buffer.from("INFOKB1", "utf-8").length] = 99;
    writeFileSync(fpath, bytes);

    initKb(makeConfig(dir, { enabled: true }));
    expect(getKbLockError()).not.toBeNull();
    // The file is untouched (version byte still 99).
    const after = readFileSync(fpath);
    expect(after[Buffer.from("INFOKB1", "utf-8").length]).toBe(99);

    rmSync(dir, { recursive: true, force: true });
  });

  it("detects concurrent modification and warns via a status event", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-ccw-"));
    initKb(makeConfig(dir, undefined));
    kbIngest("first", "t", "https://example.com/s", "test");
    flushKbWrites();
    const fpath = join(dir, "vector-store.json");

    // Simulate another process writing after our load: mutate the file.
    utimesSync(fpath, new Date(), new Date());
    const payload = readFileSync(fpath, "utf-8");
    writeFileSync(fpath, payload); // unchanged bytes
    utimesSync(fpath, new Date(), new Date());

    kbIngest("second", "t2", "https://example.com/s2", "test");
    flushKbWrites();
    const events = kbStats().events.join("\n");
    expect(events).toContain("changed on disk");

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("KB re-key (REQ-084 secret change)", () => {
  it("re-keys the store to a new raw key and preserves content", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-rekey-"));
    process.env["INFOBROKER_KB_KEY"] = KEY_B64;
    initKb(makeConfig(dir, { enabled: true }));
    kbIngest("rekeyable content", "t", "https://example.com/s", "test");
    flushKbWrites();
    const fpath = join(dir, "vector-store.json");
    const before = readFileSync(fpath);

    // Re-key to a new key.
    const newKey = Buffer.from("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "utf-8").toString("base64");
    process.env["INFOBROKER_KB_REKEY_FROM"] = KEY_B64;
    process.env["INFOBROKER_KB_REKEY_TO"] = newKey;
    const result = rekeyStore();
    expect(result).toBe("knowledge base re-keyed");

    const after = readFileSync(fpath);
    expect(after.equals(before)).toBe(false); // ciphertext changed
    expect(getKbEncryptionState()).toBe("enabled");
    expect(kbGet("https://example.com/s")?.text).toContain("rekeyable content");

    // The store now opens under the new key, not the old one.
    requireKeyMatches(after, newKey, true);
    requireKeyMatches(after, KEY_B64, false);

    rmSync(dir, { recursive: true, force: true });
  });
});

function requireKeyMatches(sealed: Buffer, keyB64: string, shouldOpen: boolean): void {
  const key: ResolvedKey = { kind: "raw", dek: Buffer.from(keyB64, "base64") };
  if (shouldOpen) {
    expect(() => openEnvelope(key, sealed)).not.toThrow();
  } else {
    expect(() => openEnvelope(key, sealed)).toThrow();
  }
}

describe("KB encryption user journey (enable/disable/recover)", () => {
  it("decrypts to plaintext immediately on disable, not on the next write", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-odis-"));
    process.env["INFOBROKER_KB_KEY"] = KEY_B64;
    initKb(makeConfig(dir, { enabled: true }));
    kbIngest("content", "t", "https://example.com/s", "test");
    flushKbWrites();
    const fpath = join(dir, "vector-store.json");
    expect(readFileSync(fpath, "utf-8").startsWith("INFOKB1")).toBe(true);

    // Disable with the key still resolvable (env): decrypt happens on init,
    // before any future write.
    initKb(makeConfig(dir, undefined));
    expect(readFileSync(fpath, "utf-8").startsWith("INFOKB1")).toBe(false);
    expect(kbGet("https://example.com/s")?.text).toContain("content");

    rmSync(dir, { recursive: true, force: true });
  });

  it("locks (does not silently reset) when disabled while the store is still encrypted and the key is gone", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-olock-"));
    process.env["INFOBROKER_KB_KEY"] = KEY_B64;
    initKb(makeConfig(dir, { enabled: true }));
    kbIngest("content", "t", "https://example.com/s", "test");
    flushKbWrites();
    const fpath = join(dir, "vector-store.json");
    const before = readFileSync(fpath);

    cleanEnv();
    // Disable encryption AND drop the key in one step: store is still encrypted
    // on disk with no key, so it locks with a recovery directive — never reset.
    initKb(makeConfig(dir, undefined));
    expect(getKbEncryptionState()).toBe("locked");
    expect(getKbLockError()).not.toBeNull();
    expect(getKbLockError()!.remediation).toMatch(/backup|unrecoverable/i);
    expect(readFileSync(fpath).equals(before)).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });

  it("generateKeyFile writes a 0600 key file and never returns the secret", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-keygen-"));
    const keyPath = join(dir, "sub", "kb.key");
    const returned = generateKeyFile(keyPath);
    expect(returned).toBe(keyPath);
    expect(returned).not.toMatch(/[A-Za-z0-9+/]{40,}/);
    const key = readKeyFile(keyPath);
    expect(key.length).toBe(32);
    rmSync(dir, { recursive: true, force: true });
  });

  it("verifyStoreKey reports match/mismatch without modifying the store", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-verify-"));
    process.env["INFOBROKER_KB_KEY"] = KEY_B64;
    initKb(makeConfig(dir, { enabled: true }));
    kbIngest("content", "t", "https://example.com/s", "test");
    flushKbWrites();
    const fpath = join(dir, "vector-store.json");
    const before = readFileSync(fpath);

    expect(verifyStoreKey()).toBe(true);

    const wrong: ResolvedKey = { kind: "raw", dek: Buffer.from("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "utf-8") };
    expect(verifyStoreKey(wrong)).toBe(false);
    expect(readFileSync(fpath).equals(before)).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });

  it("kbEncryptionStatus reflects state, format, and key resolvability", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-status-"));
    process.env["INFOBROKER_KB_KEY"] = KEY_B64;
    initKb(makeConfig(dir, { enabled: true }));
    kbIngest("content", "t", "https://example.com/s", "test");
    flushKbWrites();

    const status = kbEncryptionStatus();
    expect(status.state).toBe("enabled");
    expect(status.on_disk_format).toBe("encrypted");
    expect(status.key_source).toBe("raw_env");
    expect(status.key_resolvable).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });

  it("rekeyStoreTo re-keys from the in-hand key to a new file-provided key", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-rkeyto-"));
    process.env["INFOBROKER_KB_KEY"] = KEY_B64;
    initKb(makeConfig(dir, { enabled: true }));
    kbIngest("content", "t", "https://example.com/s", "test");
    flushKbWrites();
    const fpath = join(dir, "vector-store.json");
    const before = readFileSync(fpath);

    const newKeyPath = join(dir, "new.key");
    generateKeyFile(newKeyPath);
    const newKey: ResolvedKey = { kind: "raw", dek: readKeyFile(newKeyPath) };
    const result = rekeyStoreTo(null, newKey);
    expect(result).toBe("knowledge base re-keyed");

    const after = readFileSync(fpath);
    expect(after.equals(before)).toBe(false);
    expect(kbGet("https://example.com/s")?.text).toContain("content");

    rmSync(dir, { recursive: true, force: true });
  });

  it("backupKeyFile copies the active key file to a backup path", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-bkp-"));
    const keyPath = join(dir, "kb.key");
    generateKeyFile(keyPath);
    initKb(makeConfig(dir, { enabled: true, key_file: keyPath }));
    kbIngest("content", "t", "https://example.com/s", "test");
    flushKbWrites();

    const backupPath = join(dir, "backup", "kb.key.bak");
    const backed = backupKeyFile(backupPath);
    expect(backed).toBe(backupPath);
    expect(existsSync(backupPath)).toBe(true);
    expect(readKeyFile(backupPath).equals(readKeyFile(keyPath))).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("trunc-file TTL sweep", () => {
  it("removes stale trunc files but preserves other files", () => {
    const dir = join(tmpdir(), "infobroker");
    const oldTrunc = join(dir, "trunc-old.txt");
    const freshTrunc = join(dir, "trunc-fresh.txt");
    const quota = join(dir, "quota.json");
    mkdirSync(dir, { recursive: true });
    writeFileSync(oldTrunc, "x");
    writeFileSync(freshTrunc, "y");
    writeFileSync(quota, "{}");

    const past = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    utimesSync(oldTrunc, past, past);

    const removed = runTruncSweep();
    expect(removed).toBe(1);
    expect(existsSync(oldTrunc)).toBe(false);
    expect(existsSync(freshTrunc)).toBe(true);
    expect(existsSync(quota)).toBe(true);

    unlinkSync(freshTrunc);
    unlinkSync(quota);
  });
});
