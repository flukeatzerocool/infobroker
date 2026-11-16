// @implements REQ-136 dedup-precision dedup-recall collapsed-total
// processing-benchmark.test.ts — the deduplication corpus runs the real
// reconciler, derives the collapse total independently of the processing block,
// and fails below the committed floor.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  runProcessingBenchmark,
  scoreProcessingCase,
  type ProcessingCase,
  type ProcessingFloor,
} from "./processing-benchmark.js";

const ROOT = join(import.meta.dirname, "..");
const corpus = JSON.parse(
  readFileSync(join(ROOT, "test-fixtures", "processing", "cases.json"), "utf8"),
) as { floor: ProcessingFloor; cases: ProcessingCase[] };

describe("processing-quality benchmark (REQ-136)", () => {
  const report = runProcessingBenchmark(corpus.cases, corpus.floor);

  it("runs the committed corpus", () => {
    expect(report.corpus).toBeGreaterThanOrEqual(6);
    expect(corpus.cases.some((c) => c.must_collapse.length > 0)).toBe(true);
    expect(corpus.cases.some((c) => c.must_collapse.length === 0)).toBe(true);
  });

  it("meets the committed floor on dedup recall, precision, and total accuracy", () => {
    expect(report.dedup_recall).toBeGreaterThanOrEqual(corpus.floor.dedup_recall);
    expect(report.dedup_precision).toBeGreaterThanOrEqual(corpus.floor.dedup_precision);
    expect(report.collapsed_total_accuracy).toBeGreaterThanOrEqual(corpus.floor.collapsed_total_accuracy);
    expect(report.meetsFloor).toBe(true);
  });

  it("derives the collapse total from input and output lengths, not the block", () => {
    const testCase = corpus.cases.find((c) => c.must_collapse.length > 0)!;
    const { outcome, kept } = scoreProcessingCase(testCase);
    expect(outcome.collapsed_actual).toBe(testCase.results.length - kept.length);
  });

  it("fails the floor when a reconciler stops collapsing", () => {
    // A reconciler that keeps everything models the regression this guards.
    const degraded = runProcessingBenchmark(corpus.cases, corpus.floor, (results) => results);
    expect(degraded.dedup_recall).toBeLessThan(corpus.floor.dedup_recall);
    expect(degraded.meetsFloor).toBe(false);
  });

  it("collapses every duplicate pair with a perfect reconciler", () => {
    const perfect = runProcessingBenchmark(corpus.cases, corpus.floor, (results) => {
      const seen = new Set<string>();
      return results.filter((result) => {
        // Keep one representative per must_collapse group, drop everything else
        // only when the corpus declares it a duplicate of an earlier result.
        const duplicateOf = corpus.cases
          .flatMap((entry) => entry.must_collapse)
          .find(([, b]) => b === result.url);
        if (duplicateOf && seen.has(duplicateOf[0])) return false;
        seen.add(result.url);
        return true;
      });
    });
    expect(perfect.dedup_recall).toBe(1);
  });
});
