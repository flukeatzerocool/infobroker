// @implements REQ-026h modality-preserved
// @implements REQ-026h modality-advisory
// @implements REQ-026h modality-asserted
// @implements REQ-026h modality-reported
// @implements REQ-026h modality-speculative
// @implements REQ-026h modality-month-name
// @implements REQ-026h marker-lexicon-configurable
import { describe, it, expect } from "vitest";
import { readModality, resolveMarkers } from "./modality.js";

describe("readModality", () => {
  it("classifies a flat statement as asserted", () => {
    expect(readModality("The reactor opened in 1974.")).toEqual({ modality: "asserted" });
  });

  it("classifies attribution as reported and reports the marker", () => {
    const reading = readModality("The policy reportedly reduced emissions.");
    expect(reading.modality).toBe("reported");
    expect(reading.marker).toBe("reportedly");
  });

  it("classifies possibility as speculative", () => {
    const reading = readModality("The policy may reduce emissions.");
    expect(reading.modality).toBe("speculative");
    expect(reading.marker).toBe("may");
  });

  it("prefers attribution when a sentence both attributes and hedges", () => {
    const reading = readModality("The plan reportedly could cut costs.");
    expect(reading.modality).toBe("reported");
  });

  it("does not fire on a word boundary miss", () => {
    expect(readModality("Maybe it happened.").modality).toBe("asserted");
  });

  it("does not read the month May as speculation", () => {
    expect(readModality("The plant opened in May 1974 and still runs.").modality).toBe("asserted");
    expect(readModality("May 2020 was the warmest on record.").modality).toBe("asserted");
  });

  it("still reads a lowercase may as speculation", () => {
    expect(readModality("The plant may close next year.").modality).toBe("speculative");
  });

  it("treats empty text as asserted", () => {
    expect(readModality("").modality).toBe("asserted");
    expect(readModality(undefined).modality).toBe("asserted");
  });

  it("accepts a configured marker override without mutating the default", () => {
    const reading = readModality("The report says the bridge is open.", { reported: ["the report says"] });
    expect(reading.modality).toBe("reported");
    expect(reading.marker).toBe("the report says");
    expect(resolveMarkers().reported).toContain("reportedly");
    expect(resolveMarkers().reported).not.toContain("the report says");
  });
});
