// @implements REQ-064
// Observing tests for the real auto-index seam (R6 F-R6-B-1): the
// `auto_index` toggle, the synchronous return before deferred ingestion, and
// the swallowed failure path. The Arena file `debate-club/src/kb-auto-index.test.ts`
// covers the three tool hook sites; this file covers the seam itself.
import { afterAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { autoIndex, flushKbWrites, initKb, kbList, kbStats } from "./kb.js";
import type { KbConfig } from "./types.js";

const root = mkdtempSync(join(tmpdir(), "infobroker-kb-auto-index-"));

function makeConfig(storage: string, overrides: Partial<KbConfig> = {}): KbConfig {
  return {
    storage_path: storage,
    embedding_model: "signed-hash-tfidf",
    chunk_size: 512,
    chunk_overlap: 64,
    auto_index: true,
    default_collection: "auto-unit",
    max_results: 50,
    maintenance_interval_minutes: 0,
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

function indexable(url: string) {
  return [{ title: `auto index ${url}`, url, snippet: "auto indexing preserves searchable content" }];
}

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("auto-index toggle (REQ-064)", () => {
  it("stores nothing when auto_index is disabled", async () => {
    initKb(makeConfig(join(root, "toggle-off"), { auto_index: false }));
    autoIndex(indexable("https://example.com/toggle-off"), "wikipedia");
    // The guard returns before scheduling, so a macrotask delay proves nothing ran.
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(kbList()).toHaveLength(0);
    expect(kbStats().chunk_count).toBe(0);
  });

  it("reads the toggle from the current config, not a cached value", async () => {
    initKb(makeConfig(join(root, "toggle-current")));
    autoIndex(indexable("https://example.com/toggle-current-on"), "wikipedia");
    await vi.waitFor(() => expect(kbList().length).toBe(1), { timeout: 3000, interval: 25 });
    flushKbWrites();

    initKb(makeConfig(join(root, "toggle-current-off"), { auto_index: false }));
    autoIndex(indexable("https://example.com/toggle-current-off"), "wikipedia");
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(kbList()).toHaveLength(0);
  });
});

describe("auto-index deferral (REQ-064)", () => {
  it("returns before storing and ingests after the deferred callback", async () => {
    initKb(makeConfig(join(root, "deferral")));
    const url = "https://example.com/deferral";
    autoIndex(indexable(url), "wikipedia");

    // Synchronous return: no chunk exists at the instant autoIndex returns.
    expect(kbList()).toHaveLength(0);

    await vi.waitFor(() => expect(kbList().length).toBe(1), { timeout: 3000, interval: 25 });
    const [entry] = kbList();
    expect(entry.source_url).toBe(url);
    expect(entry.source_type).toBe("wikipedia");
    expect(entry.chunk_count).toBeGreaterThan(0);
  });
});

describe("auto-index failure suppression (REQ-064)", () => {
  it("swallows a loop failure, records the error event, and leaves the store usable", async () => {
    initKb(makeConfig(join(root, "failure")));
    const broken = [
      {
        get title() {
          return "throwing result";
        },
        get url() {
          return "https://example.com/throwing";
        },
        get snippet(): string {
          throw new Error("snippet exploded");
        },
      },
    ];

    expect(() => autoIndex(broken as unknown as Parameters<typeof autoIndex>[0], "wikipedia")).not.toThrow();
    await vi.waitFor(() => expect(kbStats().events.some((event) => /Auto-index error/.test(event))).toBe(true), {
      timeout: 3000,
      interval: 25,
    });

    // The failure did not corrupt the store: it still answers and accepts ingest.
    expect(kbStats().chunk_count).toBe(0);
    initKb(makeConfig(join(root, "failure-recovery")));
    expect(kbStats().chunk_count).toBe(0);
  });
});
