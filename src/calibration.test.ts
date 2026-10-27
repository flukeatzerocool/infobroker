// @implements REQ-123
import { describe, it, expect } from "vitest";
import { capConfidence, brierScore, reliabilityCurve, isSecondaryOnly } from "./calibration.js";

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
