// @implements REQ-114
// @implements REQ-116
// @implements REQ-118
// @implements REQ-119
// @implements REQ-120
// Report contract validation (REQ-116): the shared skeleton, report manifest,
// citation resolution, and Source Register. Fixtures are the committed corpus
// used by `npm run check-report-fixtures`.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateReport } from "./lib/report-manifest.js";

const FIXTURES = join(import.meta.dirname, "..", "test-fixtures", "reports");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf-8");
}

describe("report contract (REQ-116)", () => {
  it("accepts the good fixture with all required sections and resolved citations", () => {
    const result = validateReport(fixture("good-report.md"));
    expect(result.ok).toBe(true);
    expect(result.manifest?.shape).toBe("Fact-Check");
    expect(result.sources.get("S1")).toBe("https://example.com/bridge-inspection");
    expect(result.findings.filter((finding) => finding.level === "error")).toEqual([]);
  });

  it("rejects a Key Findings item without a citation", () => {
    const result = validateReport(fixture("missing-citation.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "finding-uncited")).toBe(true);
  });

  it("rejects a citation that does not resolve to the Source Register", () => {
    const result = validateReport(fixture("unresolved-source.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "citation-unresolved")).toBe(true);
  });

  it("rejects an invalid confidence value", () => {
    const result = validateReport(fixture("bad-confidence.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "manifest-confidence")).toBe(true);
  });

  it("rejects a report with no Source Register", () => {
    const result = validateReport(fixture("no-register.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "section-missing")).toBe(true);
    expect(result.findings.some((finding) => finding.code === "register-empty")).toBe(true);
  });

  it("rejects a missing manifest block", () => {
    const without = fixture("good-report.md").replace(/```report-manifest[\s\S]*?```/i, "");
    const result = validateReport(without);
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "manifest-missing")).toBe(true);
  });

  it("rejects an empty manifest", () => {
    const result = validateReport(fixture("bad-empty-manifest.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "manifest-shape-required")).toBe(true);
    expect(result.findings.some((finding) => finding.code === "manifest-claims-required")).toBe(true);
  });

  it("rejects a shape or audience outside the report quality standard", () => {
    const result = validateReport(fixture("bad-shape-audience.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "manifest-shape")).toBe(true);
    expect(result.findings.some((finding) => finding.code === "manifest-audience")).toBe(true);
  });

  it("rejects a Source Register without grades", () => {
    const result = validateReport(fixture("bad-register-grades.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "register-reliability")).toBe(true);
    expect(result.findings.some((finding) => finding.code === "register-credibility")).toBe(true);
    expect(result.findings.some((finding) => finding.code === "register-primacy")).toBe(true);
  });

  it("rejects a Source Register without provenance dates", () => {
    const result = validateReport(fixture("bad-register-dates.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "register-published")).toBe(true);
    expect(result.findings.some((finding) => finding.code === "register-accessed")).toBe(true);
  });

  // @implements REQ-116 register-url
  it("rejects a Source Register row without an http(s) URL", () => {
    const result = validateReport(fixture("bad-register-url.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "register-url")).toBe(true);
    expect(result.findings.some((finding) => finding.code === "register-empty")).toBe(false);
  });

  // @implements REQ-118 register-identity
  it("rejects a Source Register row without a source name, type, or relevant interests", () => {
    const result = validateReport(fixture("bad-register-identity.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "register-source")).toBe(true);
    expect(result.findings.some((finding) => finding.code === "register-type")).toBe(true);
    expect(result.findings.some((finding) => finding.code === "register-interests")).toBe(true);
  });

  // @implements REQ-118 undeterminable-publication-date
  it("rejects a publication date that is neither ISO nor undeterminable", () => {
    const result = validateReport(fixture("bad-register-published.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "register-published")).toBe(true);
  });

  // @implements REQ-118 undeterminable-publication-date
  it("accepts an undeterminable publication date", () => {
    const result = validateReport(fixture("good-undeterminable-published.md"));
    expect(result.ok).toBe(true);
    expect(result.findings.some((finding) => finding.code === "register-published")).toBe(false);
  });

  // @implements REQ-114 likelihood-vocabulary
  // @implements REQ-114 verdict-vocabulary
  it("rejects manifest values outside the likelihood and verdict lexicons", () => {
    const result = validateReport(fixture("bad-manifest-vocabulary.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "manifest-likelihood")).toBe(true);
    expect(result.findings.some((finding) => finding.code === "manifest-verdict")).toBe(true);
  });

  it("requires an as-of date", () => {
    const result = validateReport(fixture("missing-as-of.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "manifest-as-of")).toBe(true);
  });

  it("requires the declared shape's output block", () => {
    const result = validateReport(fixture("missing-shape-block.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.filter((finding) => finding.code === "shape-block").length).toBeGreaterThan(0);
  });

  // @implements REQ-119 shape-table
  it("rejects a Fact-Check report whose Claim Verdicts block has no table", () => {
    const result = validateReport(fixture("missing-shape-table.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "shape-table")).toBe(true);
  });

  it("accepts a Fact-Check report whose Claim Verdicts block carries the required columns", () => {
    const result = validateReport(fixture("good-report.md"));
    expect(result.ok).toBe(true);
    expect(result.findings.some((finding) => finding.code === "shape-table")).toBe(false);
  });

  it("requires a confidence label on each finding", () => {
    const result = validateReport(fixture("bad-finding-unlabeled.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "finding-unlabeled")).toBe(true);
  });

  it("rejects a malformed durable citation identifier", () => {
    const result = validateReport(fixture("bad-doi.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "register-citation-id")).toBe(true);
  });

  it("requires supersedes on a later revision", () => {
    const result = validateReport(fixture("bad-supersedes.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "manifest-supersedes")).toBe(true);
  });

  it("rejects an unknown handling classification", () => {
    const result = validateReport(fixture("bad-handling.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "manifest-handling")).toBe(true);
  });

  it("rejects a manifest block after the first report section", () => {
    const result = validateReport(fixture("bad-manifest-placement.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "manifest-placement")).toBe(true);
  });

  it("reports readability as an advisory warning only", () => {
    const denseSentence =
      "The interdisciplinary epistemological operationalization necessitates comprehensive institutionalization. [S1] ";
    const dense = fixture("good-report.md").replace(
      "The bridge inspection found the structure sound. [S1]",
      denseSentence.repeat(20)
    );
    const result = validateReport(dense);
    expect(result.ok).toBe(true);
    expect(result.findings.some((finding) => finding.code === "readability-high" && finding.level === "warning")).toBe(true);
  });

  it("requires a handling classification", () => {
    const result = validateReport(fixture("missing-handling.md"));
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === "manifest-handling-required")).toBe(true);
  });
});
