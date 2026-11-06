// @implements REQ-116 modality-attribution
// @implements REQ-120 modality-preserved
// Modality and attribution in the report contract (REQ-116, REQ-120): a claim
// whose evidence is hedged must carry an attribution that appears in the body.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateReport } from "./lib/report-manifest.js";

const FIXTURES = join(import.meta.dirname, "..", "test-fixtures", "reports");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf-8");
}

function codes(text: string): string[] {
  return validateReport(text).findings.map((finding) => finding.code);
}

describe("report modality (REQ-116)", () => {
  it("accepts a reported claim whose attribution appears in the body", () => {
    const result = validateReport(fixture("good-modality.md"));
    expect(result.findings.filter((finding) => finding.level === "error")).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("rejects a reported claim whose attribution is absent from the body", () => {
    const result = validateReport(fixture("bad-modality.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "modality-attribution-missing")).toBe(true);
  });

  it("rejects a non-asserted claim with no attribution", () => {
    const text = fixture("good-report.md").replace(
      '"sources": ["S1"]',
      '"sources": ["S1"],\n      "modality": "speculative"'
    );
    expect(codes(text)).toContain("manifest-modality-attribution");
  });

  it("rejects an unknown modality value", () => {
    const text = fixture("good-report.md").replace(
      '"sources": ["S1"]',
      '"sources": ["S1"],\n      "modality": "rumoured"'
    );
    expect(codes(text)).toContain("manifest-modality");
  });

  it("does not fire on a report that declares no modality", () => {
    expect(codes(fixture("good-report.md"))).not.toContain("modality-attribution-missing");
    expect(codes(fixture("good-report.md"))).not.toContain("manifest-modality-attribution");
  });

  it("ignores an attribution phrase that only appears inside the manifest fence", () => {
    const text = fixture("good-modality.md").replaceAll(
      "The bridge inspection reportedly found the structure sound. [S1]",
      "The bridge inspection found the structure sound. [S1]"
    );
    expect(codes(text)).toContain("modality-attribution-missing");
  });
});
