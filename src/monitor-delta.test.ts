// @implements REQ-117 source-drift
// @implements REQ-117 revision-supersedes
// Offline report delta (REQ-117): new, changed, and removed claims and sources
// compared from two report manifests without network or clock dependency, plus
// same-id source drift and the revision/supersession chain.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { diffReports, readSnapshot, successionIssues, type ReportSnapshot } from "./lib/report-delta.js";

const DIR = join(import.meta.dirname, "..", "test-fixtures", "reports", "delta");

function snapshot(name: string): ReportSnapshot {
  return readSnapshot(name, readFileSync(join(DIR, name), "utf-8"));
}

describe("monitor delta (REQ-117)", () => {
  it("reports new, changed, and removed claims and sources", () => {
    const delta = diffReports(snapshot("baseline.md"), snapshot("current.md"));
    expect(delta.new_claims).toEqual(["claim three is new"]);
    expect(delta.changed_claims).toHaveLength(1);
    expect(delta.changed_claims[0]!.claim).toBe("claim two is stable");
    expect(delta.changed_claims[0]!.changed.join(" ")).toMatch(/verdict: True → False/);
    expect(delta.removed_claims).toEqual([]);
    expect(delta.new_sources).toEqual(["S3"]);
    expect(delta.removed_sources).toEqual(["S2"]);
  });

  it("returns an empty delta for identical snapshots", () => {
    const delta = diffReports(snapshot("baseline.md"), snapshot("baseline.md"));
    expect(delta.new_claims).toEqual([]);
    expect(delta.changed_claims).toEqual([]);
    expect(delta.removed_claims).toEqual([]);
    expect(delta.new_sources).toEqual([]);
    expect(delta.changed_sources).toEqual([]);
    expect(delta.removed_sources).toEqual([]);
  });

  // @implements REQ-117 source-drift
  it("reports same-id source drift instead of treating the id set as unchanged", () => {
    const delta = diffReports(snapshot("current.md"), snapshot("current-drift.md"));
    expect(delta.new_sources).toEqual([]);
    expect(delta.removed_sources).toEqual([]);
    expect(delta.changed_sources).toEqual([
      {
        id: "S1",
        changed: [
          "url: https://example.com/one → https://example.com/one-moved",
          "reliability: A → B",
        ],
      },
    ]);
  });

  // @implements REQ-117 revision-supersedes
  it("carries both revisions and the current supersession", () => {
    const delta = diffReports(snapshot("baseline.md"), snapshot("current.md"));
    expect(delta.baseline_revision).toBe(1);
    expect(delta.current_revision).toBe(2);
    expect(delta.current_supersedes).toBe("report://baseline");
    expect(successionIssues(delta, "report://baseline")).toEqual([]);
  });

  // @implements REQ-117 revision-supersedes
  it("flags a changed report whose revision did not increase", () => {
    const before: ReportSnapshot = {
      claims: [{ claim: "claim one" }],
      sources: [{ id: "S1", url: "https://example.com/one" }],
      revision: 1,
    };
    const after: ReportSnapshot = {
      claims: [{ claim: "claim one" }, { claim: "claim two" }],
      sources: [{ id: "S1", url: "https://example.com/one" }],
      revision: 1,
    };
    const issues = successionIssues(diffReports(before, after));
    expect(issues.map((issue) => issue.code)).toEqual(["revision-not-incremented"]);
  });

  // @implements REQ-117 revision-supersedes
  it("flags a supersession that does not name the baseline", () => {
    const delta = diffReports(snapshot("baseline.md"), snapshot("current.md"));
    const issues = successionIssues(delta, "report://other");
    expect(issues.map((issue) => issue.code)).toEqual(["supersedes-mismatch"]);
    expect(issues[0]!.message).toContain("report://other");
  });

  it("does not require a revision bump for an unchanged report", () => {
    const delta = diffReports(snapshot("baseline.md"), snapshot("baseline.md"));
    expect(successionIssues(delta)).toEqual([]);
  });
});
