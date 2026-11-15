// @implements REQ-060c REQ-060d REQ-060e REQ-060f
// Action evidence (R6 F-R6-A-4): the stats, list, get, and delete contracts were
// cited in `kb.test.ts` but not asserted. This file drives an isolated store so
// ingest timestamps can be controlled and one document never leaks into another
// test's view.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { rmSync } from "node:fs";
import { testTmpDir } from "./lib/test-tmp.js";

import { initKb, kbIngest, kbStats, kbList, kbGet, kbDelete, flushKbWrites } from "./kb.js";
import type { KbConfig } from "./types.js";

const dir = testTmpDir("kb-evidence-");

function config(): KbConfig {
  return {
    storage_path: dir,
    embedding_model: "signed-hash-tfidf",
    chunk_size: 64,
    chunk_overlap: 16,
    auto_index: false,
    default_collection: "default",
    max_results: 50,
    maintenance_interval_minutes: 0,
    kb_first_relevance_threshold: 0.3,
    kb_first_confidence_threshold: 0.5,
    freshness: {
      tiers: { report: { decay_hours: 720, expiry_hours: 0 }, stable: { decay_hours: 720, expiry_hours: 0 } },
      auto_classify: false,
      default_tier: "stable",
    },
  };
}

beforeAll(() => {
  initKb(config());
});

afterAll(() => {
  flushKbWrites();
  rmSync(dir, { recursive: true, force: true });
});

// @implements REQ-060c
describe("stats action (REQ-060c)", () => {
  it("reports per-collection counts, the last ingestion time, and storage size", () => {
    const now = Date.now() + 60_000;
    const spy = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      kbIngest("alpha evidence text", "Alpha", "https://example.com/alpha", "test", "alpha-collection");
      kbIngest("beta evidence text", "Beta", "https://example.com/beta", "test", "beta-collection");
    } finally {
      spy.mockRestore();
    }
    flushKbWrites();

    const stats = kbStats();
    expect(stats.chunk_count).toBe(2);
    expect(stats.collections).toMatchObject({ "alpha-collection": 1, "beta-collection": 1 });
    expect(stats.last_ingestion).toBe(new Date(now).toISOString());
    expect(stats.storage_size_bytes).toBeGreaterThan(0);
  });
});

// @implements REQ-060e
describe("list action (REQ-060e)", () => {
  it("orders distinct documents newest first", () => {
    const base = Date.now() + 120_000;
    const spy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(base)
      .mockReturnValueOnce(base + 1_000);
    try {
      kbIngest("older ordered document", "Older", "https://example.com/order-old", "test", "ordering");
      kbIngest("newer ordered document", "Newer", "https://example.com/order-new", "test", "ordering");
    } finally {
      spy.mockRestore();
    }

    const entries = kbList("ordering");
    expect(entries.map((e) => e.source_url)).toEqual([
      "https://example.com/order-new",
      "https://example.com/order-old",
    ]);
    expect(entries[0]!.ingested_at - entries[1]!.ingested_at).toBe(1_000);
  });

  it("reports the chunk count for each document", () => {
    const body = Array.from(
      { length: 10 },
      (_, i) => `Sentence ${i} covers a distinct evidentiary point about the archived survey.`
    ).join(" ");
    const chunks = kbIngest(body, "Chunked", "https://example.com/chunked", "test", "chunked");
    expect(chunks).toBeGreaterThan(1);

    const entries = kbList("chunked");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.chunk_count).toBe(chunks);
  });
});

// @implements REQ-060f
describe("get action (REQ-060f)", () => {
  it("reassembles chunks in stored order", () => {
    const text = [
      "First paragraph about alpha.",
      "Second paragraph about beta.",
      "Third paragraph about gamma.",
    ].join(" ");
    kbIngest(text, "Order Title", "https://example.com/ordered-document", "test", "ordered");

    const doc = kbGet("https://example.com/ordered-document");
    expect(doc).not.toBeNull();
    const content = doc!.text;
    expect(content.startsWith("Order Title:")).toBe(true);
    const first = content.indexOf("First paragraph");
    const second = content.indexOf("Second paragraph");
    const third = content.indexOf("Third paragraph");
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(second);
    expect(second).toBeLessThan(third);
  });

  it("returns null for a source URL with no stored document", () => {
    expect(kbGet("report://absent")).toBeNull();
  });
});

// @implements REQ-060d
describe("delete action (REQ-060d)", () => {
  it("refuses a delete with no filter", () => {
    expect(() => kbDelete()).toThrow(/invalid_input/);
  });
});
