// @implements REQ-132 analysis-alternatives
// @implements REQ-132 analysis-gaps
// @implements REQ-132 analysis-no-likelihood
// analysis.test.ts — each judgment states its alternatives and gaps explicitly,
// and never carries a per-claim likelihood.

import { describe, expect, it } from "vitest";
import { annotateAnalysis } from "./corroborate.js";
import type { CorroborationFinding } from "./types.js";

function finding(overrides: Partial<CorroborationFinding>): CorroborationFinding {
  return {
    topic: "t",
    claim: "c",
    confidence: 0.9,
    verdict: "confirmed",
    sources: [{ title: "s", url: "https://a.example/x", snippet: "s" }],
    family_count: 2,
    ...overrides,
  };
}

describe("annotateAnalysis", () => {
  it("states no gaps for a confident, multi-family, sourced finding", () => {
    const [out] = annotateAnalysis([finding({})], 0.8);
    expect(out!.gaps).toEqual([]);
    expect(out!.alternatives).toEqual([]);
  });

  it("names the condition that limits confidence", () => {
    const [out] = annotateAnalysis(
      [finding({ confidence: 0.4, family_count: 1, sources: [] })],
      0.8
    );
    expect(out!.gaps).toEqual([
      "no attributed source",
      "fewer than two independent source families",
      "confidence below the confirmation threshold",
    ]);
  });

  it("reports the competing perspectives of a contested claim as alternatives", () => {
    const [out] = annotateAnalysis(
      [finding({ verdict: "contested", perspectives: ["it is X", "it is Y"] })],
      0.8
    );
    expect(out!.alternatives).toEqual(["it is X", "it is Y"]);
  });

  it("never emits a per-claim likelihood", () => {
    const [out] = annotateAnalysis([finding({})], 0.8);
    expect("likelihood" in out!).toBe(false);
  });
});
