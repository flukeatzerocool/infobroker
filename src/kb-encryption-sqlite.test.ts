// @implements REQ-084 REQ-108 REQ-085
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  initKb,
  kbIngest,
  kbSearch,
  kbStoreFormat,
  verifyStoreKey,
  getKbLockError,
  rekeyStoreTo,
} from "./kb.js";
import { SqliteStore } from "./kb-sqlite.js";
import { resolveKeySource, rawKeyFromString } from "./kb-crypto.js";
import { openRow, sealRow } from "./kb-row-crypto.js";
import type { KbConfig } from "./types.js";

function config(dir: string, keyFile: string, enabled: boolean): KbConfig {
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

  it("keeps lexical search results identical with the in-memory prefilter", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-enc-prefilter-"));
    try {
      const key = keyFile(dir, "prefilter.key");
      initKb(config(dir, key, true));
      for (let i = 0; i < 25; i++) {
        kbIngest(
          `encrypted alpha beta document ${i} with shared terms`,
          `enc ${i}`,
          `https://example.com/encrypted-${i}`,
          "test"
        );
      }
      const first = kbSearch("encrypted alpha beta", 10);
      expect(first.length).toBeGreaterThan(0);
      const second = kbSearch("encrypted alpha beta", 10);
      const rank = (rows: typeof first) => rows.map((r) => ({ url: r.source_url, score: r.score, title: r.title }));
      expect(rank(second)).toEqual(rank(first));
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

describe("event history across key transitions (REQ-084, REQ-086)", () => {
  it("never renders an encrypted row as text in a plaintext store", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-events-mixed-"));
    const path = join(dir, "vector-store.sqlite");
    try {
      const store = new SqliteStore(dir, { journalMode: "DELETE" });
      store.init();
      store.appendEvent("visible event");
      store.close();

      const raw = new DatabaseSync(path);
      raw
        .prepare("INSERT INTO events (at, encrypted, message) VALUES (?, ?, ?)")
        .run(new Date().toISOString(), 1, sealRow(randomBytes(32), Buffer.from("hidden event")));
      raw.close();

      const plain = new SqliteStore(dir, { journalMode: "DELETE" });
      plain.init();
      expect(plain.events()).toEqual(["visible event"]);
      expect(plain.events().some((event) => event.startsWith("INFOKB1"))).toBe(false);
      plain.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  const keyA = rawKeyFromString("a".repeat(64))!;
  const keyB = rawKeyFromString("b".repeat(64))!;
  const BOTH = ["first event", "second event"];

  it("reseals event history on rekey and renders it as plaintext after disable", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-events-"));
    try {
      const store = new SqliteStore(dir, { secret: keyA, encryptionEnabled: true, journalMode: "DELETE" });
      store.init();
      store.appendEvent("first event");
      store.appendEvent("second event");
      expect(store.events()).toEqual(BOTH);

      store.rekey(keyA, keyB);
      expect(store.events()).toEqual(BOTH);
      store.close();

      const reopened = new SqliteStore(dir, { secret: keyB, journalMode: "DELETE" });
      reopened.init();
      expect(reopened.events()).toEqual(BOTH);

      reopened.disableEncryption(keyB);
      expect(reopened.events()).toEqual(BOTH);
      expect(reopened.events().some((event) => event.startsWith("INFOKB1"))).toBe(false);
      reopened.close();

      const plain = new SqliteStore(dir, { journalMode: "DELETE" });
      plain.init();
      expect(plain.events()).toEqual(BOTH);
      plain.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves an unreadable event row and still completes a rekey", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-events-legacy-"));
    const path = join(dir, "vector-store.sqlite");
    try {
      const store = new SqliteStore(dir, { secret: keyA, encryptionEnabled: true, journalMode: "DELETE" });
      store.init();
      store.appendEvent("readable before");
      store.close();

      const raw = new DatabaseSync(path);
      raw
        .prepare("INSERT INTO events (at, encrypted, message) VALUES (?, ?, ?)")
        .run(new Date().toISOString(), 1, randomBytes(48));
      const before = raw.prepare("SELECT message FROM events ORDER BY id DESC LIMIT 1").get() as { message: Uint8Array };
      raw.close();

      const reopened = new SqliteStore(dir, { secret: keyA, journalMode: "DELETE" });
      reopened.init();
      expect(reopened.events()).toEqual(["readable before"]);
      reopened.rekey(keyA, keyB);
      expect(reopened.events()).toEqual(["readable before"]);
      // Disabling leaves the preserved row marked encrypted while the in-memory
      // key becomes empty; events() must skip it rather than decode ciphertext.
      reopened.disableEncryption(keyB);
      expect(reopened.events()).toEqual(["readable before"]);
      reopened.close();

      const raw2 = new DatabaseSync(path);
      const after = raw2.prepare("SELECT message FROM events ORDER BY id DESC LIMIT 1").get() as { message: Uint8Array };
      raw2.close();
      expect(Buffer.from(after.message)).toEqual(Buffer.from(before.message));
      expect(() => openRow(keyB.kind === "raw" ? keyB.dek : Buffer.alloc(32), Buffer.from(after.message))).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
