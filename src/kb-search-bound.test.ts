// @implements REQ-075
// A store larger than the requested result set must return the same ranking a
// full sort would: the bounded selection may not drop or reorder a result that
// belongs in the top slice.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync } from "node:fs";
import { testTmpDir } from "./lib/test-tmp.js";
import { initKb, kbIngest, kbSearch } from "./kb.js";
import type { KbConfig } from "./types.js";

const dir = testTmpDir("kb-bound-search-");

function makeConfig(): KbConfig {
  return {
    storage_path: dir,
    embedding_model: "signed-hash-tfidf",
    chunk_size: 512,
    chunk_overlap: 64,
    auto_index: false,
    default_collection: "default",
    max_results: 500,
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
  };
}

const TOPICS = ["retrieval", "generation", "ranking", "embedding", "passage"];

beforeAll(() => {
  initKb(makeConfig());
  for (let i = 0; i < 200; i++) {
    const topic = TOPICS[i % TOPICS.length];
    kbIngest(
      `retrieval augmented generation note ${i} discussing ${topic} and ranking quality`,
      `doc-${i}`,
      `https://example.com/bound-${i}`,
      "web",
    );
  }
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("sqliteSearch bounded selection (F-R6-E-4)", () => {
  it("returns the same top results a full ranking would", () => {
    const bounded = kbSearch("retrieval augmented generation ranking", 25);
    const full = kbSearch("retrieval augmented generation ranking", 500).slice(0, 25);
    expect(bounded).toHaveLength(25);
    expect(bounded.map((r) => r.source_url)).toEqual(full.map((r) => r.source_url));
    expect(bounded.map((r) => r.score)).toEqual(full.map((r) => r.score));
  });

  it("honours a capacity smaller than the number of matching chunks", () => {
    const matches = kbSearch("retrieval augmented generation", 500);
    expect(matches.length).toBeGreaterThan(25);
    expect(kbSearch("retrieval augmented generation", 3)).toHaveLength(3);
  });
});
