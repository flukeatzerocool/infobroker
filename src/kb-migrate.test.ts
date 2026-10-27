// @implements REQ-108 REQ-085
import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { migrateLegacyJson } from "./kb-migrate.js";
import { sealEnvelope } from "./kb-crypto.js";
import { join } from "node:path";
import { initKb, kbGet, kbStats, kbStoreFormat } from "./kb.js";
import type { KbConfig, KbChunk } from "./types.js";

function config(dir: string): KbConfig {
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
      tiers: {
        stable: { decay_hours: 720, expiry_hours: 0 },
      },
      auto_classify: false,
      default_tier: "stable",
    },
  };
}

function legacy(chunk: KbChunk, events: string[] = []) {
  return JSON.stringify({
    chunks: [chunk],
    idf: { alpha: 1 },
    docCount: 1,
    events,
  });
}

const baseChunk = (text: string, source = "https://example.com/legacy"): KbChunk => ({
  id: "legacy-1",
  text,
  embedding: [1, 0, 0],
  source_url: source,
  chunk_index: 0,
  title: "Legacy",
  provider: "test",
  collection: "default",
  source_type: "web_search",
  freshness_tier: "stable",
  ingested_at: Date.now(),
});

describe("legacy JSON migration (REQ-108)", () => {
  it("migrates non-destructively and preserves a backup", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-migrate-"));
    try {
      writeFileSync(join(dir, "vector-store.json"), legacy(baseChunk("legacy alpha text")));
      initKb(config(dir));
      expect(existsSync(join(dir, "vector-store.sqlite"))).toBe(true);
      expect(kbGet("https://example.com/legacy")?.text).toContain("legacy alpha text");
      expect(readdirSync(dir).some((f) => f.startsWith("vector-store.json.migrated-"))).toBe(true);
      expect(kbStats().events.some((e) => e.includes("migrated to vector-store.sqlite"))).toBe(true);
      // Idempotent: a second open does not create another backup.
      const before = readdirSync(dir).filter((f) => f.startsWith("vector-store.json.migrated-")).length;
      initKb(config(dir));
      const after = readdirSync(dir).filter((f) => f.startsWith("vector-store.json.migrated-")).length;
      expect(after).toBe(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("migrates into an encrypted store without deleting its source (REQ-084, REQ-085)", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-migrate-enc-"));
    try {
      writeFileSync(join(dir, "vector-store.json"), legacy(baseChunk("legacy alpha text")));
      const keyFile = join(dir, "key");
      writeFileSync(keyFile, `${randomBytes(32).toString("base64")}\n`, { mode: 0o600 });
      initKb({ ...config(dir), encryption: { enabled: true, key_file: keyFile } });
      expect(kbStoreFormat()).toBe("encrypted");
      expect(kbGet("https://example.com/legacy")?.text).toContain("legacy alpha text");
      expect(existsSync(join(dir, "vector-store.json"))).toBe(false);
      expect(readdirSync(dir).some((f) => f.startsWith("vector-store.json.migrated-"))).toBe(false);
      expect(kbStats().events.some((e) => e.includes("plaintext prior store removed"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a newer encrypted legacy format without modifying it (REQ-085)", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-migrate-newer-"));
    try {
      const key = { kind: "raw" as const, dek: randomBytes(32) };
      const sealed = sealEnvelope(key, Buffer.from(legacy(baseChunk("future format"))));
      sealed[Buffer.from("INFOKB1", "utf-8").length] = 99;
      const jsonPath = join(dir, "vector-store.json");
      writeFileSync(jsonPath, sealed);
      const keyFile = join(dir, "key");
      writeFileSync(keyFile, `${key.dek.toString("base64")}\n`, { mode: 0o600 });
      const result = migrateLegacyJson({ storagePath: dir, encryptionEnabled: true, keyFile });
      expect(result.status).toBe("locked");
      expect(readFileSync(jsonPath)[Buffer.from("INFOKB1", "utf-8").length]).toBe(99);
      expect(existsSync(join(dir, "vector-store.sqlite"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("backs up a corrupt legacy store and starts empty (F10)", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-migrate-corrupt-"));
    try {
      writeFileSync(join(dir, "vector-store.json"), "{ not json");
      initKb(config(dir));
      expect(readdirSync(dir).some((f) => f.startsWith("vector-store.corrupt-"))).toBe(true);
      expect(kbStats().chunk_count).toBe(0);
      expect(kbStats().events.some((e) => e.includes("Storage corruption detected"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
