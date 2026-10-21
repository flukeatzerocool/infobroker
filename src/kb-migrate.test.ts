// @implements REQ-108 REQ-085
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initKb, kbGet, kbStats } from "./kb.js";
import type { KbConfig, KbChunk } from "./types.js";

function config(dir: string): KbConfig {
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
