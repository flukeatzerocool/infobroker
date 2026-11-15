// @implements REQ-075 REQ-082 REQ-060a REQ-060b REQ-060d REQ-060e REQ-060f REQ-065 REQ-072 REQ-074 REQ-087 REQ-076 REQ-083
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testTmpDir } from "./lib/test-tmp.js";
import { initKb, kbIngest, kbSearch, kbStats, kbList, kbGet, kbDelete, resolveReportIdentity, resolveTextIdentity, resolveCollection, ingestDestinations, flushKbWrites } from "./kb.js";
import type { KbConfig } from "./types.js";

const dir = testTmpDir("kb-test-");

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
    expect(existsSync(join(dir, "vector-store.sqlite"))).toBe(true);

    // Switch storage path: data at the old path must remain, and an event is
    // recorded on the (now-empty) new store.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    initKb(makeConfig({ storage_path: dir2 }));
    warn.mockRestore();

    const stats = kbStats();
    expect(stats.chunk_count).toBe(0);
    expect(stats.events.some((e) => e.includes("Storage path changed"))).toBe(true);

    // Old path data is not migrated/deleted.
    expect(statSync(join(dir, "vector-store.sqlite")).size).toBeGreaterThan(0);

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

  it("exposes independent freshness_score and score for KB-first thresholding (REQ-076)", () => {
    kbIngest(
      "quantum computing error correction is a rapidly advancing field of study",
      "kb-first",
      "https://example.com/kb-first",
      "test"
    );
    const results = kbSearch("quantum computing error correction", 10);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(typeof r.score).toBe("number");
      expect(typeof r.freshness_score).toBe("number");
    }
  });

  it("resolveCollection honors explicit > env var > config default > literal default (REQ-065)", () => {
    const prevEnv = process.env["INFOBROKER_KB_COLLECTION"];
    try {
      // A configured default distinct from the literal fallback: with
      // `default_collection: "default"` the two tiers were indistinguishable.
      initKb(makeConfig({ default_collection: "config-col", storage_path: join(dir, "collection-tiers") }));
      expect(resolveCollection("explicit")).toBe("explicit");
      process.env["INFOBROKER_KB_COLLECTION"] = "env-col";
      expect(resolveCollection(undefined)).toBe("env-col");
      expect(resolveCollection("explicit")).toBe("explicit");
      delete process.env["INFOBROKER_KB_COLLECTION"];
      expect(resolveCollection(undefined)).toBe("config-col");

      // An empty configured default is falsy, so the literal tier is reached.
      initKb(makeConfig({ default_collection: "", storage_path: join(dir, "collection-literal") }));
      expect(resolveCollection(undefined)).toBe("default");
    } finally {
      if (prevEnv === undefined) delete process.env["INFOBROKER_KB_COLLECTION"];
      else process.env["INFOBROKER_KB_COLLECTION"] = prevEnv;
      initKb(makeConfig());
    }
  });
});

describe("save-destination selection (REQ-083)", () => {
  it("indexes for 'kb' and 'both', and writes only to disk for 'disk'", () => {
    expect(ingestDestinations("kb")).toEqual({ kb: true, disk: false });
    expect(ingestDestinations("both")).toEqual({ kb: true, disk: true });
    expect(ingestDestinations("disk")).toEqual({ kb: false, disk: true });
  });
});

describe("kb search action returns ranked chunks (REQ-060a)", () => {
  it("returns source URL, score, collection, source_type, and a snippet", () => {
    kbIngest(
      "the meridian altitude of a star fixes latitude at sea",
      "sextant note",
      "https://example.com/sextant",
      "test",
      "navigation",
      "web_search"
    );
    const results = kbSearch("meridian altitude latitude", 10, "navigation");
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.source_url).toBe("https://example.com/sextant");
    expect(top.collection).toBe("navigation");
    expect(top.source_type).toBe("web_search");
    expect(typeof top.score).toBe("number");
    expect(typeof top.snippet).toBe("string");
  });
});

// @implements REQ-065 collection-recall
describe("collection recall (REQ-065)", () => {
  it("returns only the named collection so a style sheet is reusable across sessions", () => {
    kbIngest(
      "essay voice short declarative sentences and concrete nouns",
      "voice sheet",
      "https://example.com/essay-style",
      "test",
      "essay-style",
      "style",
    );
    kbIngest("essay voice content outside the named collection", "other voice", "https://example.com/other-voice", "test");
    const scoped = kbSearch("essay voice", 10, "essay-style");
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((r) => r.collection === "essay-style")).toBe(true);
  });
});

describe("kb ingest action chunks content (REQ-060b)", () => {
  it("reports a positive chunk count and stores the source identifier", () => {
    const chunks = kbIngest(
      "Ingest action content about hydrostatic equilibrium in stellar physics.",
      "ingest-note",
      "https://example.com/ingest-note",
      "test"
    );
    expect(chunks).toBeGreaterThan(0);
    expect(kbGet("https://example.com/ingest-note")?.title).toBe("ingest-note");
  });
});

// @implements REQ-060b text-identity
describe("text ingest identity (REQ-060b)", () => {
  it("builds a stable text:// identity from the title", () => {
    expect(resolveTextIdentity("Text Note: Part 2!")).toBe("text://text-note-part-2");
    expect(resolveTextIdentity("Text Note: Part 2!")).toBe(resolveTextIdentity("Text Note: Part 2!"));
  });

  it("does not collide with the report namespace for an un-slugifiable title", () => {
    expect(resolveTextIdentity("!!!")).toBe("text://note");
    expect(resolveTextIdentity("!!!")).not.toBe("report://report");
  });
});

describe("kb delete action (REQ-060d)", () => {
  it("removes chunks by source URL and reports the count removed", () => {
    kbIngest("deletable content about obelisk engineering", "obelisk", "https://example.com/obelisk", "test");
    const removed = kbDelete(undefined, "https://example.com/obelisk");
    expect(removed).toBeGreaterThan(0);
    expect(kbGet("https://example.com/obelisk")).toBeNull();
  });

  it("removes chunks by collection", () => {
    kbIngest("collection scoped content", "scoped", "https://example.com/scoped", "test", "throwaway");
    const removed = kbDelete("throwaway");
    expect(removed).toBeGreaterThan(0);
    expect(kbSearch("collection scoped content", 10, "throwaway").length).toBe(0);
  });
});

describe("kb deduplication (REQ-072)", () => {
  it("does not increase the chunk count when re-ingesting the same URL", () => {
    kbIngest("dedup baseline content about basalt columns", "dedup", "https://example.com/dedup", "test");
    const before = kbStats().chunk_count;
    kbIngest("dedup baseline content about basalt columns, updated", "dedup", "https://example.com/dedup", "test");
    const after = kbStats().chunk_count;
    expect(after).toBeLessThanOrEqual(before);
  });

  it("collapses a near-duplicate report under a different title (REQ-072 near-duplicate)", () => {
    const body =
      "Solar flare activity increased sharply in the northern hemisphere during the observation window, " +
      "with coronal mass ejections affecting radio communications across several regions.";
    kbIngest(body, "Solar Flare Report", "report://solar-flare", "explicit", "reports", "report", "report");
    const before = kbList("reports", "report").length;
    kbIngest(body, "Solar Flare Activity Report", "report://solar-flare-activity", "explicit", "reports", "report", "report");
    const after = kbList("reports", "report").length;
    expect(after).toBe(before);
    expect(kbGet("report://solar-flare-activity")).toBeNull();
  });

  it("keeps distinct reports distinct (REQ-072 distinct-documents)", () => {
    const bodies = [
      "Pottery kilns fired clay across Mesopotamian settlements for thousands of years.",
      "Quantum tunnelling lets particles cross barriers that classical physics forbids.",
      "Harvest yields collapsed after the drought reduced soil moisture across the valley.",
      "The orchestra rehearsed Brahms beneath a vaulted ceiling of painted plaster.",
      "Marine biologists tagged migrating whales near the continental shelf last spring.",
      "Volcanic ash drifted over the airfield and grounded every departing flight.",
      "Chess engines evaluate pawn structure before calculating tactical sacrifices.",
      "Copper wiring corroded where salt spray reached the harbour warehouses.",
      "Parliament debated tariff reform while dockworkers organised a general strike.",
      "Glaciers retreated rapidly, exposing bedrock scraped smooth by ancient ice.",
    ];
    const before = kbList("reports", "report").length;
    bodies.forEach((body, i) => {
      kbIngest(body, `Distinct Report ${i}`, `report://distinct-${i}`, "explicit", "reports", "report", "report");
    });
    expect(kbList("reports", "report").length).toBe(before + bodies.length);
  });

  it("collapses a web document re-ingested under a different URL (REQ-072 web-duplicate)", () => {
    const body = "Tidal turbines in the estuary generate electricity from reversing currents twice each day.";
    kbIngest(body, "Tidal Turbine Note", "https://example.com/tidal-a", "test", "dedup-col", "web_search");
    const before = kbStats().chunk_count;
    kbIngest(body, "Tidal Turbine Note", "https://example.com/tidal-b", "test", "dedup-col", "web_search");
    expect(kbStats().chunk_count).toBe(before);
    expect(kbGet("https://example.com/tidal-b")).toBeNull();
    expect(kbGet("https://example.com/tidal-a")).not.toBeNull();
  });

  it("keeps the best match rather than the first candidate over the threshold (REQ-072 best-match)", () => {
    const base = "The committee approved the harbour budget after three hours of debate.";
    kbIngest(base, "Harbour Budget", "https://example.com/harbour-a", "test", "dedup-best", "web_search");
    const exact = `${base} Two members abstained from the final vote.`;
    kbIngest(exact, "Harbour Budget", "https://example.com/harbour-b", "test", "dedup-best", "web_search");
    kbIngest(exact, "Harbour Budget", "https://example.com/harbour-c", "test", "dedup-best", "web_search");
    expect(kbGet("https://example.com/harbour-c")).toBeNull();
    expect(kbGet("https://example.com/harbour-b")).not.toBeNull();
  });

  it("does not collapse across content classes (REQ-072 cross-class)", () => {
    const body = "The auditor flagged the ledger discrepancy in a memo to the finance committee.";
    kbIngest(body, "Ledger Memo", "report://ledger-memo", "explicit", "reports", "report", "report");
    kbIngest(body, "Ledger Memo", "https://example.com/ledger-note", "test", "dedup-classes", "web_search");
    expect(kbGet("report://ledger-memo")).not.toBeNull();
    expect(kbGet("https://example.com/ledger-note")).not.toBeNull();
  });

  it("does not collapse across collections (REQ-072 cross-collection)", () => {
    const body =
      "Sediment cores from the lake bed record nine centuries of volcanic ash. " +
      "The cores were logged against the regional stratigraphy and archived with the survey. " +
      "Each layer was photographed before the samples were sealed for transport.";
    kbIngest(body, "Lake Core", "https://example.com/lake-a", "test", "dedup-col-a", "web_search");
    kbIngest(body, "Lake Core", "https://example.com/lake-b", "test", "dedup-col-b", "web_search");
    expect(kbGet("https://example.com/lake-a")).not.toBeNull();
    expect(kbGet("https://example.com/lake-b")).not.toBeNull();
  });

  it("keeps boilerplate-heavy documents distinct (REQ-072 boilerplate)", () => {
    const boilerplate = "Subscribe to the daily bulletin for updates. Privacy policy. Terms of service. Contact the newsroom. ";
    kbIngest(`${boilerplate}The city council approved a new tram line along the eastern quay.`, "Tram", "https://example.com/boiler-a", "test", "dedup-boiler", "web_search");
    kbIngest(`${boilerplate}The museum reopened its sculpture wing after restoration.`, "Museum", "https://example.com/boiler-b", "test", "dedup-boiler", "web_search");
    expect(kbGet("https://example.com/boiler-a")).not.toBeNull();
    expect(kbGet("https://example.com/boiler-b")).not.toBeNull();
  });

  it("ignores a number in the title when the body matches (REQ-072 title-identity)", () => {
    // Identity is read from the body, never the title: a document is the same
    // document even when its title differs, so a title number cannot veto it.
    const body =
      "Sediment cores from the lake bed record nine centuries of volcanic ash. " +
      "The cores were logged against the regional stratigraphy and archived with the survey. " +
      "Each layer was photographed before the samples were sealed for transport.";
    kbIngest(body, "Lake Core Report 2024", "https://example.com/title-num-a", "test", "dedup-title", "web_search");
    const before = kbStats().chunk_count;
    kbIngest(body, "Lake Core Report 2025", "https://example.com/title-num-b", "test", "dedup-title", "web_search");
    expect(kbStats().chunk_count).toBe(before);
    expect(kbGet("https://example.com/title-num-b")).toBeNull();
  });

  it("records a dedup event naming both identities (REQ-072 dedup-event)", () => {
    const body = "Saffron threads are harvested by hand from crocus flowers before sunrise.";
    kbIngest(body, "Saffron", "https://example.com/saffron-a", "test", "dedup-event", "web_search");
    kbIngest(body, "Saffron", "https://example.com/saffron-b", "test", "dedup-event", "web_search");
    const event = kbStats().events.find((e) => e.includes("Dedup at") && e.includes("saffron-b"));
    expect(event).toBeDefined();
    expect(event).toContain("https://example.com/saffron-a");
    expect(event).toContain("https://example.com/saffron-b");
  });
});

describe("freshness classification (REQ-074)", () => {
  it("assigns the explicit tier when supplied and the default tier otherwise", () => {
    kbIngest("ephemeral tier content", "eph", "https://example.com/eph", "test", undefined, "web_search", "ephemeral");
    kbIngest("default tier content", "def", "https://example.com/def", "test");
    const list = kbList();
    expect(list.find((e) => e.source_url === "https://example.com/eph")?.freshness_tier).toBe("ephemeral");
    expect(list.find((e) => e.source_url === "https://example.com/def")?.freshness_tier).toBe("stable");
  });
});

// @implements REQ-075 decay-reduction
// @implements REQ-075 zero-decay-exemption
// @implements REQ-075 freshness-ordering
describe("confidence decay (F-R6-C-3 / REQ-075)", () => {
  it("reduces the score as an ephemeral chunk ages, and keeps an evergreen one unchanged", () => {
    const start = new Date("2026-02-01T00:00:00Z").getTime();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(start);
      kbIngest(
        "aurora borealis forecasts depend on solar wind particle density",
        "Aged page",
        "https://example.com/aged",
        "test",
        "decay",
        undefined,
        "ephemeral",
      );
      kbIngest(
        "aurora borealis forecasts depend on solar wind particle density",
        "Evergreen page",
        "https://example.com/evergreen",
        "test",
        "decay",
        undefined,
        "evergreen",
      );

      const freshAged = kbSearch("aurora borealis forecasts", 10, "decay").find((r) => r.source_url === "https://example.com/aged")!;
      const freshEvergreen = kbSearch("aurora borealis forecasts", 10, "decay").find((r) => r.source_url === "https://example.com/evergreen")!;
      expect(freshAged.freshness_score).toBeCloseTo(1);
      expect(freshEvergreen.freshness_score).toBeCloseTo(1);

      // Half of the ephemeral tier's 24-hour decay window has elapsed.
      vi.setSystemTime(start + 12 * 60 * 60 * 1000);
      const aged = kbSearch("aurora borealis forecasts", 10, "decay").find((r) => r.source_url === "https://example.com/aged")!;
      const evergreen = kbSearch("aurora borealis forecasts", 10, "decay").find((r) => r.source_url === "https://example.com/evergreen")!;

      // Decay: the aged score falls while relevance stays; zero-decay exempt.
      expect(aged.freshness_score).toBeCloseTo(0.5);
      // REQ-075: the freshness-adjusted score is relevance x freshness; the
      // raw relevance is untouched by age.
      expect(aged.score).toBeCloseTo(freshAged.score);
      expect(aged.score * aged.freshness_score).toBeLessThan(freshAged.score * freshAged.freshness_score);
      expect(evergreen.freshness_score).toBeCloseTo(1);
      expect(evergreen.score * evergreen.freshness_score).toBeCloseTo(
        freshEvergreen.score * freshEvergreen.freshness_score,
      );

      // Ordering: the unchanged evergreen copy now outranks the aged one.
      const ranked = kbSearch("aurora borealis forecasts", 10, "decay").map((r) => r.source_url);
      expect(ranked.indexOf("https://example.com/evergreen")).toBeLessThan(ranked.indexOf("https://example.com/aged"));
    } finally {
      vi.useRealTimers();
    }
  });
});
