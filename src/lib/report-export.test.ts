// @implements REQ-126
// @implements REQ-126 export-validates
// @implements REQ-126 explicit-skip
// @implements REQ-126 export-determinism
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { reportToJson, reportToSourcesCsv, reportToClaimsCsv, ReportExportError } from "./report-export.js";

const report = readFileSync(join(import.meta.dirname, "..", "..", "test-fixtures", "reports", "good-report.md"), "utf-8");
const invalidReport = readFileSync(join(import.meta.dirname, "..", "..", "test-fixtures", "reports", "bad-confidence.md"), "utf-8");

describe("report export (REQ-126)", () => {
  it("exports the manifest, sections, sources, and claims", () => {
    const json = reportToJson(report);
    expect(json.manifest).toBeTruthy();
    expect(json.sections).toContain("Source Register");
    expect(json.sources.length).toBeGreaterThan(0);
    expect(json.sources[0]?.url).toMatch(/^https?:\/\//);
    expect(json.claims.length).toBeGreaterThan(0);
  });

  it("exports Source Register and claims CSV", () => {
    const sources = reportToSourcesCsv(report);
    expect(sources.split("\n")[0]).toContain("#");
    expect(sources).toContain("http");
    const claims = reportToClaimsCsv(report);
    expect(claims.split("\n")[0]).toContain("claim");
    expect(claims.split("\n").length).toBeGreaterThan(1);
  });

  it("refuses a JSON export of a report that fails validation", () => {
    expect(() => reportToJson(invalidReport)).toThrow(ReportExportError);
  });

  it("refuses a Source Register CSV export of a report that fails validation", () => {
    expect(() => reportToSourcesCsv(invalidReport)).toThrow(ReportExportError);
  });

  it("refuses a claims CSV export of a report that fails validation", () => {
    expect(() => reportToClaimsCsv(invalidReport)).toThrow(ReportExportError);
  });

  it("carries the error-level findings and no report text on the refusal", () => {
    let caught: unknown;
    try {
      reportToJson(invalidReport);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ReportExportError);
    const findings = (caught as ReportExportError).findings;
    expect(findings.some((finding) => finding.code === "manifest-confidence" && finding.level === "error")).toBe(true);
    expect((caught as ReportExportError).message).not.toContain("Certain");
  });

  it("returns the same output when the caller explicitly skips validation", () => {
    const skipped = reportToJson(invalidReport, { skipValidation: true });
    const sources = reportToSourcesCsv(invalidReport, { skipValidation: true });
    const claims = reportToClaimsCsv(invalidReport, { skipValidation: true });
    expect(skipped.sections).toContain("Source Register");
    expect(skipped.manifest).toBeTruthy();
    expect(sources.split("\n")[0]).toContain("#");
    expect(claims.split("\n")[0]).toContain("claim");
  });

  it("is deterministic across repeated calls", () => {
    const firstJson = JSON.stringify(reportToJson(report));
    const firstSources = reportToSourcesCsv(report);
    const firstClaims = reportToClaimsCsv(report);

    // Second call on the same text, then on a fresh read of the same file: the
    // output must be byte-identical and carry no clock or path state.
    expect(JSON.stringify(reportToJson(report))).toBe(firstJson);
    expect(reportToSourcesCsv(report)).toBe(firstSources);
    expect(reportToClaimsCsv(report)).toBe(firstClaims);
    const freshReport = readFileSync(join(import.meta.dirname, "..", "..", "test-fixtures", "reports", "good-report.md"), "utf-8");
    expect(JSON.stringify(reportToJson(freshReport))).toBe(firstJson);

    const parsed = JSON.parse(firstJson) as ReturnType<typeof reportToJson>;
    const manifestClaims = (parsed.manifest as { claims: Array<{ claim: string }> }).claims;
    expect(parsed.claims.map((claim) => claim.claim)).toEqual(manifestClaims.map((claim) => claim.claim));
    expect(firstJson).not.toMatch(/\d{4}-\d{2}-\d{2}T|Date|\/home\//);
  });
});
