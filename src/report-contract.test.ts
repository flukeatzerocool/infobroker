// @implements REQ-116
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
});
