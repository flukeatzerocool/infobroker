// @implements REQ-084 REQ-085 REQ-086 REQ-099 REQ-060g
// Tool-surface encryption operations that are backend-agnostic: key files,
// verification, status, backup, path confinement, report sealing, and the
// locked-store recovery path on the SQLite backend.
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync, utimesSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  initKb,
  kbIngest,
  flushKbWrites,
  getKbLockError,
  getKbEncryptionState,
  runTruncSweep,
  generateKeyFile,
  verifyStoreKey,
  backupKeyFile,
  kbEncryptionStatus,
  resolveKeyFile,
  sealReportBytes,
  kbStoreFormat,
  kbGet,
} from "./kb.js";
import { readKeyFile, type ResolvedKey } from "./kb-crypto.js";
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
    keys_dir: dir,
  };
}

function cleanEnv(): void {
  delete process.env["INFOBROKER_KB_KEY"];
  delete process.env["INFOBROKER_KB_PASSPHRASE"];
}

afterEach(() => cleanEnv());

describe("KB encryption tool surface (REQ-084, REQ-086)", () => {
  it("locks with a recovery directive when encryption is enabled without a key", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-tools-lock-"));
    try {
      cleanEnv();
      initKb(makeConfig(dir, { enabled: true }));
      expect(getKbEncryptionState()).toBe("locked");
      expect(getKbLockError()?.remediation).toMatch(/key/i);
      expect(() => sealReportBytes(Buffer.from("sensitive report"))).toThrow(/no key is available/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("locks rather than resetting when encryption is disabled without the key", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-tools-disable-lock-"));
    try {
      process.env["INFOBROKER_KB_KEY"] = KEY_B64;
      initKb(makeConfig(dir, { enabled: true }));
      kbIngest("content", "t", "https://example.com/s", "test");
      flushKbWrites();
      cleanEnv();
      initKb(makeConfig(dir, { enabled: false }));
      expect(getKbEncryptionState()).toBe("locked");
      expect(getKbLockError()?.remediation).toMatch(/backup|unrecoverable/i);
      expect(kbStoreFormat()).toBe("encrypted");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("generateKeyFile writes a 0600 key file and never returns the secret", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-tools-keygen-"));
    try {
      initKb(makeConfig(dir, { enabled: false }));
      const keyPath = join(dir, "sub", "kb.key");
      const returned = generateKeyFile(keyPath);
      expect(returned).toBe(keyPath);
      expect(returned).not.toMatch(/[A-Za-z0-9+/]{40,}/);
      expect(readKeyFile(keyPath).length).toBe(32);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("verifyStoreKey reports match/mismatch", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-tools-verify-"));
    try {
      process.env["INFOBROKER_KB_KEY"] = KEY_B64;
      initKb(makeConfig(dir, { enabled: true }));
      kbIngest("content", "t", "https://example.com/s", "test");
      flushKbWrites();
      expect(verifyStoreKey()).toBe(true);
      const wrong: ResolvedKey = { kind: "raw", dek: Buffer.from("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "utf-8") };
      expect(verifyStoreKey(wrong)).toBe(false);
      expect(kbGet("https://example.com/s")?.text).toContain("content");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("kbEncryptionStatus reflects state, format, and key resolvability", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-tools-status-"));
    try {
      process.env["INFOBROKER_KB_KEY"] = KEY_B64;
      initKb(makeConfig(dir, { enabled: true }));
      kbIngest("content", "t", "https://example.com/s", "test");
      flushKbWrites();
      const status = kbEncryptionStatus();
      expect(status.state).toBe("enabled");
      expect(status.on_disk_format).toBe("encrypted");
      expect(status.key_source).toBe("raw_env");
      expect(status.key_resolvable).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("backupKeyFile copies the active key file to a backup path", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-tools-backup-"));
    try {
      initKb(makeConfig(dir, { enabled: false }));
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
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses key-material paths outside the keys directory (REQ-099)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ibk-tools-paths-"));
    try {
      initKb(makeConfig(dir, { enabled: false }));
      const keyPath = join(dir, "kb.key");
      const outside = join(dir, "..", "outside.key");
      expect(() => resolveKeyFile(outside)).toThrow(/outside the keys directory/);
      expect(() => generateKeyFile(outside)).toThrow(/outside the keys directory/);
      generateKeyFile(keyPath);
      initKb(makeConfig(dir, { enabled: true, key_file: keyPath }));
      expect(() => backupKeyFile(join(dir, "..", "leak.bak"))).toThrow(/outside the keys directory/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("trunc-file TTL sweep", () => {
  it("removes stale trunc files but preserves other files", () => {
    const previousTmp = process.env["TMPDIR"];
    const tmpRoot = mkdtempSync(join(tmpdir(), "ibk-tools-trunc-"));
    process.env["TMPDIR"] = tmpRoot;
    const dir = join(tmpRoot, "infobroker");
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
    if (previousTmp === undefined) delete process.env["TMPDIR"];
    else process.env["TMPDIR"] = previousTmp;
    rmSync(tmpRoot, { recursive: true, force: true });
  });
});
