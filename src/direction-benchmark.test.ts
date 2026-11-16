// @implements REQ-135 offer-rate false-offer-rate slot-recall
// direction-benchmark.test.ts — the requirement-quality corpus runs the live
// classifier and ambiguity rule, deterministically and offline, and fails below
// the recorded floor.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runDirectionBenchmark, type DirectionCase } from "./direction-benchmark.js";

const ROOT = join(import.meta.dirname, "..");
const corpus = JSON.parse(
  readFileSync(join(ROOT, "test-fixtures", "direction", "cases.json"), "utf8"),
) as { floor: number; cases: DirectionCase[] };
const config = JSON.parse(readFileSync(join(ROOT, "config.json"), "utf8")) as {
  dispatch: Record<string, string[]>;
};
const resolve = (taskType: string): string[] => config.dispatch[taskType] ?? [];

describe("requirement-quality benchmark (REQ-135)", () => {
  const run = runDirectionBenchmark(corpus.cases, resolve, corpus.floor);

  it("runs the committed corpus", () => {
    expect(run.report.corpus).toBe(20);
    expect(corpus.cases.filter((c) => c.expect_offer).length).toBeGreaterThan(0);
    expect(corpus.cases.filter((c) => !c.expect_offer).length).toBeGreaterThan(0);
  });

  it("offers a choice for every case that carries two requirements", () => {
    // The floor, not an exact match: a regression shows as a drop below it.
    expect(run.report.offer_rate).toBeGreaterThanOrEqual(0.75);
    expect(run.report.false_offer_rate).toBeLessThanOrEqual(0.25);
  });

  it("reports the requirement attributes the corpus expects", () => {
    expect(run.report.mean_slot_recall).toBeGreaterThanOrEqual(0.9);
  });

  it("is deterministic run to run", () => {
    const again = runDirectionBenchmark(corpus.cases, resolve, corpus.floor);
    expect(again.report).toEqual(run.report);
  });
});
