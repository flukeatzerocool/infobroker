// @implements REQ-117
// Offline report delta (REQ-117): new, changed, and removed claims and sources
// compared from two report manifests without network or clock dependency.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { diffReports, readSnapshot } from "./lib/report-delta.js";

const DIR = join(import.meta.dirname, "..", "test-fixtures", "reports", "delta");

function snapshot(name: string) {
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
    expect(delta.removed_sources).toEqual([]);
  });
});
