// @implements REQ-076b measurement
// @implements REQ-076b judged-population
// @implements REQ-076b shipped-floor
// The sufficiency benchmark must score the server's own admission predicate,
// must be able to fail, and must not leak its internal evidence field.
import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadSufficiencyFixtures,
  runSufficiencyBenchmark,
  type SufficiencyReport,
} from "./kb-sufficiency-benchmark.js";
import { initKb, kbIngest, kbSearch, publicSearchResults } from "./kb.js";
import { partitionBySufficiency, sufficiencyThresholds } from "./kb-sufficiency.js";

const KB = { chunk_size: 1024, chunk_overlap: 64 } as const;
const TIMEOUT = 120_000;

let main: SufficiencyReport[] = [];

beforeAll(() => {
  main = runSufficiencyBenchmark({ kb: KB, scales: ["snippet", "page"] });
}, TIMEOUT);

describe("KB-first sufficiency measurement", () => {
  it("measures both chunk scales over the committed corpus", () => {
    expect(main.map((report) => report.scale)).toEqual(["snippet", "page"]);
    // 114 results, 111 distinct URLs: three URLs appear in two cases' result sets.
    const distinct = new Set(
      loadSufficiencyFixtures().fixture.queries.flatMap((entry) => entry.results.map((result) => result.url)),
    ).size;
    for (const report of main) {
      expect(report.documents).toBe(distinct);
      expect(report.cases).toHaveLength(26);
      // Every admitted row is accounted for by exactly one label bucket.
      for (const entry of report.cases) {
        const labelled = entry.labels.relevant + entry.labels.irrelevant + entry.labels.unjudged;
        expect(entry.admitted).toBe(labelled);
      }
    }
    // The page-scale corpus really is page scale: no short-chunk shortcut.
    const page = main.find((report) => report.scale === "page")!;
    expect(page.stored_chunks).toBeGreaterThanOrEqual(page.documents - 5);
  });

  it("is falsifiable: the corpus can admit a cross-topic chunk", () => {
    // The measured rate must be able to move: at snippet scale the corpus does
    // admit a cross-topic chunk, so a zero at page scale is a real zero.
    const failing = main.filter((report) => report.admitted_irrelevant_rate > 0);
    expect(failing.length, "corpus admits no irrelevant chunk at either scale").toBeGreaterThan(0);
  });

  it("drives the shared admission predicate", () => {
    const strict = runSufficiencyBenchmark({
      kb: { ...KB, kb_first_relevance_threshold: 0.99 },
      scales: ["snippet"],
    })[0];
    const baseline = main.find((report) => report.scale === "snippet")!;
    const admitted = (report: SufficiencyReport): number =>
      report.cases.reduce((sum, entry) => sum + entry.admitted, 0);
    expect(admitted(baseline)).toBeGreaterThan(0);
    expect(admitted(strict)).toBeLessThan(admitted(baseline));
  }, TIMEOUT);

  it("reports deterministically on ranks, labels, and counts", () => {
    const again = runSufficiencyBenchmark({ kb: KB, scales: ["snippet"] })[0];
    const baseline = main.find((report) => report.scale === "snippet")!;
    const shape = (report: SufficiencyReport) =>
      report.cases.map((entry) => ({
        id: entry.id,
        returned: entry.returned,
        admitted: entry.admitted,
        labels: entry.labels,
        top_url: entry.top_url,
        top_label: entry.top_label,
        binary: entry.binary_hit_admitted,
      }));
    expect(shape(again)).toEqual(shape(baseline));
  }, TIMEOUT);

  it("keeps matched-token evidence out of the client projection", () => {
    const root = mkdtempSync(join(tmpdir(), "infobroker-kb-suff-unit-"));
    try {
      initKb({
        storage_path: root,
        embedding_model: "signed-hash-tfidf",
        chunk_size: 1024,
        chunk_overlap: 64,
        auto_index: false,
        default_collection: "default",
        max_results: 50,
        kb_first_relevance_threshold: 0.3,
        kb_first_confidence_threshold: 0.5,
        maintenance_interval_minutes: 0,
        encryption: { enabled: false },
      });
      kbIngest("Quantum error correction improves logical qubit stability.", "QEC", "https://q.example/1", "fixture");
      const rows = kbSearch("quantum error correction", 5);
      expect(rows.length).toBeGreaterThan(0);
      expect(typeof rows[0]!.matched_tokens).toBe("number");
      expect(rows[0]!.matched_tokens!).toBeGreaterThanOrEqual(2);

      const projected = publicSearchResults(rows);
      expect(projected[0]).not.toHaveProperty("matched_tokens");
      expect(projected[0]!.source_url).toBe("https://q.example/1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, TIMEOUT);

  it("keeps the shipped floor: no case is made sufficient by unrelated content alone", () => {
    // REQ-076b shipped-floor: the shipped thresholds must never let cross-topic
    // or unjudged chunks satisfy sufficiency on their own. Raising the floor to
    // 0.34 would zero the instance-level cross-topic admission at a measured
    // recall cost (snippet 0.654, page 0.308), so the shipped value stays 0.3
    // and this assertion is what keeps that decision honest (D-143).
    const shipped = JSON.parse(
      readFileSync(join(import.meta.dirname, "..", "config.json"), "utf8"),
    ) as { kb: { kb_first_relevance_threshold: number; kb_first_confidence_threshold: number } };
    const reports = runSufficiencyBenchmark({
      kb: {
        kb_first_relevance_threshold: shipped.kb.kb_first_relevance_threshold,
        kb_first_confidence_threshold: shipped.kb.kb_first_confidence_threshold,
      },
      scales: ["snippet", "page"],
    });
    expect(shipped.kb.kb_first_relevance_threshold).toBe(0.3);
    for (const report of reports) {
      expect(report.cases_sufficient_on_non_relevant, `scale ${report.scale}`).toBe(0);
    }
  }, TIMEOUT);

  it("splits admission into sufficient and rejected without dropping rows", () => {
    const rows = [
      { score: 0.9, freshness_score: 0.9 } as never,
      { score: 0.1, freshness_score: 0.9 } as never,
      { score: 0.9, freshness_score: 0.1 } as never,
    ];
    const { sufficient, rejected } = partitionBySufficiency(rows, sufficiencyThresholds());
    expect(sufficient).toHaveLength(1);
    expect(rejected).toHaveLength(2);
  });
});
