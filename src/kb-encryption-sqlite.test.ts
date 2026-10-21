// @implements REQ-084 REQ-108 REQ-085
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import {
  initKb,
  kbIngest,
  kbSearch,
  kbStoreFormat,
  verifyStoreKey,
  getKbLockError,
  rekeyStoreTo,
} from "./kb.js";
import { resolveKeySource } from "./kb-crypto.js";
import type { KbConfig } from "./types.js";

function config(dir: string, keyFile: string, enabled: boolean): KbConfig {
  return {
    storage_path: dir,
    store_backend: "sqlite",
    embedding_model: "signed-hash-tfidf",
    chunk_size: 512,
    chunk_overlap: 64,
    auto_index: false,
    default_collection: "default",
    max_results: 50,
    maintenance_interval_minutes: 0,
    kb_first_relevance_threshold: 0.3,
    kb_first_confidence_threshold: 0.5,
    encryption: { enabled, key_file: keyFile },
    freshness: {
      tiers: { stable: { decay_hours: 720, expiry_hours: 0 } },
      auto_classify: false,
      default_tier: "stable",
    },
  };
}

function keyFile(dir: string, name: string): string {
  const path = join(dir, name);
  writeFileSync(path, `${randomBytes(32).toString("base64")}\n`, { mode: 0o600 });
  return path;
}

describe("SQLite at-rest encryption (REQ-084)", () => {
  it("enables encryption, verifies the key, and disables it", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-enc-sqlite-"));
    try {
      const good = keyFile(dir, "good.key");
      writeFileSync(join(dir, "vector-store.json.migrated-123"), "plaintext archive");
      writeFileSync(join(dir, "vector-store.corrupt-123.json"), "plaintext backup");
      initKb(config(dir, good, true));
      expect(existsSync(join(dir, "vector-store.json.migrated-123"))).toBe(false);
      expect(existsSync(join(dir, "vector-store.corrupt-123.json"))).toBe(false);
      kbIngest("encrypted alpha content", "alpha", "https://example.com/alpha", "test");
      expect(kbStoreFormat()).toBe("encrypted");
      expect(verifyStoreKey()).toBe(true);
      expect(kbSearch("alpha content", 5).length).toBeGreaterThan(0);

      initKb(config(dir, good, false));
      expect(kbStoreFormat()).toBe("plaintext");
      expect(kbSearch("alpha content", 5).length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rekeys without loss of content", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-rekey-"));
    try {
      const good = keyFile(dir, "good.key");
      initKb(config(dir, good, true));
      kbIngest("rekey content", "rekey", "https://example.com/rekey", "test");
      const oldKey = resolveKeySource(good)!;
      const next = { kind: "raw" as const, dek: randomBytes(32) };
      expect(rekeyStoreTo(null, next)).toBe("knowledge base re-keyed");
      expect(verifyStoreKey(next)).toBe(true);
      expect(verifyStoreKey(oldKey)).toBe(false);
      expect(kbSearch("rekey content", 5).length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("locks an encrypted store opened with the wrong key", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-enc-wrong-"));
    try {
      const good = keyFile(dir, "good.key");
      writeFileSync(join(dir, "vector-store.json.migrated-123"), "plaintext archive");
      writeFileSync(join(dir, "vector-store.corrupt-123.json"), "plaintext backup");
      initKb(config(dir, good, true));
      expect(existsSync(join(dir, "vector-store.json.migrated-123"))).toBe(false);
      expect(existsSync(join(dir, "vector-store.corrupt-123.json"))).toBe(false);
      kbIngest("secret content", "secret", "https://example.com/secret", "test");

      const wrong = keyFile(dir, "wrong.key");
      initKb(config(dir, wrong, true));
      expect(getKbLockError()?.code).toBe("config_error");
      expect(kbStoreFormat()).toBe("encrypted");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
