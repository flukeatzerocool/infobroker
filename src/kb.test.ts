// @implements REQ-075
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initKb, kbIngest, kbSearch, kbStats, flushKbWrites } from "./kb.js";
import type { KbConfig } from "./types.js";

const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-test-"));

function makeConfig(overrides: Record<string, unknown> = {}): KbConfig {
  return {
    storage_path: dir,
    embedding_model: "tf-idf",
    chunk_size: 512,
    chunk_overlap: 64,
    auto_index: false,
    default_collection: "default",
    max_results: 50,
    max_vocab_terms: 10000,
    maintenance_interval_minutes: 60,
    kb_first_relevance_threshold: 0.3,
    kb_first_confidence_threshold: 0.5,
    freshness: {
      tiers: {
        ephemeral: { decay_hours: 24, expiry_hours: 168 },
        recent: { decay_hours: 168, expiry_hours: 720 },
        stable: { decay_hours: 720, expiry_hours: 0 },
        evergreen: { decay_hours: 0, expiry_hours: 0 },
      },
      auto_classify: false,
      default_tier: "stable",
    },
    ...overrides,
  };
}

beforeAll(() => {
  initKb(makeConfig());
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("kbSearch ranking (REQ-075)", () => {
  it("ranks a more relevant result above a less relevant one at equal freshness", () => {
    kbIngest(
      "quantum computing error correction is a rapidly advancing field",
      "relevant",
      "https://example.com/relevant",
      "test"
    );
    kbIngest(
      "the history of ancient pottery in mesopotamia is long and varied",
      "irrelevant",
      "https://example.com/irrelevant",
      "test"
    );

    const results = kbSearch("quantum computing error correction", 10);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source_url).toBe("https://example.com/relevant");
  });

  it("reports a freshness-adjusted score alongside relevance", () => {
    const results = kbSearch("quantum computing", 10);
    for (const r of results) {
      expect(r.score).toBeGreaterThan(0);
      expect(r.freshness_score).toBeDefined();
    }
  });
});

describe("kbStats", () => {
  it("reports chunk count and collections", () => {
    const stats = kbStats();
    expect(stats.chunk_count).toBeGreaterThan(0);
    expect(stats.model_name).toBe("tf-idf");
  });
});

describe("storage path change and write flush", () => {
  it("flushes pending writes and records an event when storage_path changes", () => {
    const dir2 = mkdtempSync(join(tmpdir(), "infobroker-kb-test2-"));

    // Ingest into the primary store and flush so it is durable at `dir`.
    kbIngest("the sky is blue on a clear day", "path-change", "https://example.com/path", "test");
    flushKbWrites();
    expect(existsSync(join(dir, "vector-store.json"))).toBe(true);

    // Switch storage path: data at the old path must remain, and an event is
    // recorded on the (now-empty) new store.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    initKb(makeConfig({ storage_path: dir2 }));
    warn.mockRestore();

    const stats = kbStats();
    expect(stats.chunk_count).toBe(0);
    expect(stats.events.some((e) => e.includes("Storage path changed"))).toBe(true);

    // Old path data is not migrated/deleted.
    const oldStore = JSON.parse(readFileSync(join(dir, "vector-store.json"), "utf-8"));
    expect(oldStore.chunks.length).toBeGreaterThan(0);

    rmSync(dir2, { recursive: true, force: true });
  });
});
