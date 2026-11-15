// tmp-inode.test.ts — unit tests for the temp-filesystem inode pressure
// helper used by the gate runner's advisory warning.
import { describe, it, expect } from "vitest";
import { DEFAULT_THRESHOLD_PERCENT, inodeUsedPercent, inodeWarningLine, warningForPercent } from "./tmp-inode.js";

describe("temp filesystem inode pressure", () => {
  it("computes the used share from inode counts", () => {
    expect(inodeUsedPercent({ files: 1000, ffree: 210 })).toBe(79);
    expect(inodeUsedPercent({ files: 1000, ffree: 190 })).toBe(81);
  });

  it("returns null when the filesystem reports no totals", () => {
    expect(inodeUsedPercent({ files: 0, ffree: 0 })).toBeNull();
    expect(inodeUsedPercent({ files: Number.NaN, ffree: 0 })).toBeNull();
  });

  it("stays silent at or below the threshold and warns above it", () => {
    expect(warningForPercent(79, "/tmp", DEFAULT_THRESHOLD_PERCENT)).toBeNull();
    expect(warningForPercent(80, "/tmp", DEFAULT_THRESHOLD_PERCENT)).toBeNull();
    const line = warningForPercent(81, "/tmp", DEFAULT_THRESHOLD_PERCENT);
    expect(line).toContain("81% of /tmp inodes used");
    expect(line?.startsWith("gates: warn:")).toBe(true);
  });

  it("reports no warning when statfs is unavailable", () => {
    expect(inodeWarningLine("/nonexistent-tmp-path", DEFAULT_THRESHOLD_PERCENT)).toBeNull();
  });
});
