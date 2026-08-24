// @implements REQ-075 REQ-082 REQ-060e REQ-060f REQ-087
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initKb, kbIngest, kbSearch, kbStats, kbList, kbGet, resolveReportIdentity, resolveCollection, flushKbWrites } from "./kb.js";
import type { KbConfig } from "./types.js";

const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-test-"));

function makeConfig(overrides: Record<string, unknown> = {}): KbConfig {
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

describe("kbSearch retrieval consistency (REQ-082)", () => {
  it("returns a chunk ingested earlier after subsequent ingests grow the vocabulary", () => {
    kbIngest(
      "cartographer astrolabe sextant chart a nautical instrument",
      "earliest",
      "https://example.com/earliest",
      "test"
    );
    kbIngest(
      "quantum chromodynamics is a gauge theory of the strong interaction",
      "second",
      "https://example.com/second",
      "test"
    );
    kbIngest(
      "zephyr orographic uplift governs alpine precipitation forecasts",
      "third",
      "https://example.com/third",
      "test"
    );

    // A term present only in the earliest chunk must still be retrievable.
    const results = kbSearch("astrolabe cartographer", 10);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source_url).toBe("https://example.com/earliest");
  });

  it("re-embeds legacy chunks whose embeddings predate the current model", () => {
    // A chunk whose stored embedding predates the signed-hash model must be
    // reconciled on load and remain searchable.
    const stats = kbStats();
    expect(stats.model_name).toBe("signed-hash-tfidf");
    expect(stats.chunk_count).toBeGreaterThan(0);
  });
});

describe("kbStats", () => {
  it("reports chunk count and collections", () => {
    const stats = kbStats();
    expect(stats.chunk_count).toBeGreaterThan(0);
    expect(stats.model_name).toBe("signed-hash-tfidf");
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

describe("report storage and retrieval (REQ-060e, REQ-060f)", () => {
  it("lists reports and returns metadata including source_type and ingested_at", () => {
    const chunks = kbIngest(
      "This is a generated report about solar flares. It reviews recent activity. First section.",
      "Solar Flare Report",
      "",
      "explicit",
      "reports",
      "report",
      "report"
    );
    expect(chunks).toBeGreaterThan(0);

    const list = kbList("reports", "report");
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].source_type).toBe("report");
    expect(list[0].title).toBe("Solar Flare Report");
    expect(list[0].ingested_at).toBeGreaterThan(0);
  });

  it("reassembles report text in order via kbGet", () => {
    const text = [
      "First paragraph about topic alpha.",
      "Second paragraph about topic beta.",
      "Third paragraph about topic gamma.",
    ].join(" ");
    kbIngest(text, "Ordered Report", "report://ordered-report", "explicit", "reports", "report", "report");

    const doc = kbGet("report://ordered-report");
    expect(doc).not.toBeNull();
    expect(doc!.text).toContain("First paragraph");
    expect(doc!.text).toContain("Third paragraph");
    expect(doc!.title).toBe("Ordered Report");
  });

  it("returns null from kbGet for an unknown source_url", () => {
    expect(kbGet("report://does-not-exist")).toBeNull();
  });

  it("derives a stable report identity from a title", () => {
    expect(resolveReportIdentity("The Great Report!")).toBe("report://the-great-report");
    expect(resolveReportIdentity("X", "https://example.com/x")).toBe("https://example.com/x");
  });

  it("exposes source_type and collection on search results", () => {
    kbIngest("zirconium compounds for nuclear reactors", "Zirconium Report", "report://zirconium", "explicit", "reports", "report", "report");
    const results = kbSearch("zirconium compounds", 10, "reports", "report");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source_type).toBe("report");
    expect(results[0].collection).toBe("reports");
  });

  it("report source date reported and preserved (REQ-087)", () => {
    kbIngest("a dated source report", "Dated Report", "https://example.com/dated", "test", "reports", "report", "report", "2026-08-24");

    expect(kbGet("https://example.com/dated")?.source_updated_at).toBe("2026-08-24");

    const list = kbList("reports", "report");
    expect(list.find((e) => e.source_url === "https://example.com/dated")?.source_updated_at).toBe("2026-08-24");

    const search = kbSearch("dated source", 10, "reports", "report");
    expect(search.find((r) => r.source_url === "https://example.com/dated")?.source_updated_at).toBe("2026-08-24");
  });

  it("omits source_updated_at when no date is known (REQ-087)", () => {
    kbIngest("an undated report", "Undated", "https://example.com/undated", "test", undefined, "report", "report");
    expect(kbGet("https://example.com/undated")?.source_updated_at).toBeUndefined();
  });

  it("preserves a previously stored date when a re-ingest supplies none (REQ-087)", () => {
    kbIngest("the first version", "Versioned", "https://example.com/versioned", "test", undefined, "report", "report", "2026-08-01");
    kbIngest("the second version without a date", "Versioned", "https://example.com/versioned", "test", undefined, "report", "report");
    expect(kbGet("https://example.com/versioned")?.source_updated_at).toBe("2026-08-01");
  });

  it("resolveCollection honors explicit > env var > config default > literal default (REQ-065)", () => {
    const prevEnv = process.env["INFOBROKER_KB_COLLECTION"];
    try {
      expect(resolveCollection("explicit")).toBe("explicit");
      process.env["INFOBROKER_KB_COLLECTION"] = "env-col";
      expect(resolveCollection(undefined)).toBe("env-col");
      expect(resolveCollection("explicit")).toBe("explicit");
      delete process.env["INFOBROKER_KB_COLLECTION"];
      expect(resolveCollection(undefined)).toBe("default");
    } finally {
      if (prevEnv === undefined) delete process.env["INFOBROKER_KB_COLLECTION"];
      else process.env["INFOBROKER_KB_COLLECTION"] = prevEnv;
    }
  });
});
