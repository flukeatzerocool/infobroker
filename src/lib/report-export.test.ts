// @implements REQ-126
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { reportToJson, reportToSourcesCsv, reportToClaimsCsv } from "./report-export.js";

const report = readFileSync(join(import.meta.dirname, "..", "..", "test-fixtures", "reports", "good-report.md"), "utf-8");

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
});
