// @implements REQ-075
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initKb, kbIngest, kbSearch, kbStats } from "./kb.js";
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
