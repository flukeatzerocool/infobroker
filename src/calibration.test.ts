// @implements REQ-123
import { describe, it, expect } from "vitest";
import { buildCalibrationReport, capConfidence, brierScore, reliabilityCurve, isSecondaryOnly } from "./calibration.js";
import { computeConfidence } from "./corroborate.js";

describe("confidence calibration (REQ-123)", () => {
  it("caps secondary-only evidence", () => {
    expect(capConfidence(1.0, [{ source_type: "web_search" }, { source_type: "news" }], {
      enabled: true,
      secondaryOnlyCap: 0.7,
    })).toBe(0.7);
  });

  it("does not cap primary or mixed evidence", () => {
    expect(capConfidence(0.9, [{ source_type: "academic" }], { enabled: true, secondaryOnlyCap: 0.7 })).toBe(0.9);
    expect(capConfidence(0.9, [{ source_type: "web_search" }, { source_type: "encyclopedia" }], {
      enabled: true,
      secondaryOnlyCap: 0.7,
    })).toBe(0.9);
  });

  it("does not treat unknown source types as secondary", () => {
    expect(isSecondaryOnly([{ source_type: undefined }])).toBe(false);
  });

  it("computes Brier score and reliability buckets", () => {
    expect(brierScore([])).toBe(0);
    expect(brierScore([{ confidence: 1, correct: true }, { confidence: 0, correct: false }])).toBe(0);
    const curve = reliabilityCurve([
      { confidence: 0.9, correct: true },
      { confidence: 0.65, correct: false },
    ]);
    expect(curve.find((b) => b.band === "0.9-1.0")?.count).toBe(1);
    expect(curve.find((b) => b.band === "0.5-0.7")?.observedRate).toBe(0);
  });
});

// @implements REQ-026a
describe("calibration report under the authority adjustment", () => {
  // The shipped authority map, hardcoded here on purpose: the assertion must
  // not read config.json, or a wrong constant would produce a self-consistent
  // curve that no test can catch.
  const SHIPPED_WEIGHTS = {
    academic: 1.0,
    encyclopedia: 1.0,
    archive: 1.0,
    structured_fact: 1.0,
    definition: 1.0,
    location: 1.0,
    code: 0.9,
    semantic: 0.9,
    synthesis: 0.9,
    news: 0.8,
    web_search: 0.7,
  };

  it("applies the adjustment and the cap to each gold row", () => {
    const report = buildCalibrationReport(
      [
        { id: "x", confidence: 0.7, correct: true, sources: ["web_search", "news"] },
        { id: "y", confidence: 0.9, correct: false, sources: ["academic", "encyclopedia", "web_search"] },
      ],
      SHIPPED_WEIGHTS,
    );
    expect(report.entries).toBe(2);
    expect(report.rows[0]).toEqual({ id: "x", raw: 0.7, adjusted: 0.65625, correct: true });
    expect(report.rows[1]!.adjusted).toBeCloseTo(0.8775, 10);
    expect(report.brier_score).toBeCloseTo(0.44408515625, 10);
  });

  it("matches computeConfidence for a one-source-per-family set", () => {
    const report = buildCalibrationReport(
      [{ id: "m", confidence: 0.9, correct: true, sources: ["web_search", "encyclopedia", "academic"] }],
      SHIPPED_WEIGHTS,
    );
    const direct = computeConfidence(
      [
        { title: "a", url: "https://a.example/1", snippet: "x", source_type: "web_search" },
        { title: "b", url: "https://b.example/1", snippet: "x", source_type: "encyclopedia" },
        { title: "c", url: "https://c.example/1", snippet: "x", source_type: "academic" },
      ],
      SHIPPED_WEIGHTS,
    );
    expect(report.rows[0]!.adjusted).toBeCloseTo(direct, 10);
  });

  it("pins the ladder-to-reported values at the shipped weights", () => {
    const webFamilies = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        title: "w",
        url: `https://${i}.example/1`,
        snippet: "x",
        source_type: "web_search",
        source_family: `family-${i}`,
      }));
    expect(computeConfidence(webFamilies(2), SHIPPED_WEIGHTS)).toBeCloseTo(0.6475, 10);
    expect(computeConfidence(webFamilies(3), SHIPPED_WEIGHTS)).toBeCloseTo(0.8325, 10);
  });
});
