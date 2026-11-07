// loop-audit.test — unit tests for the session-loop report helpers. Role: test.

import { describe, expect, it } from "vitest";
import { driftRows, parseHeading, versionToDate } from "./loop-audit.js";

describe("version to date", () => {
  it("normalizes CalVer with and without leading zeros", () => {
    expect(versionToDate("2026.11.07")).toBe("2026-11-07");
    expect(versionToDate("2026.11.7")).toBe("2026-11-07");
    expect(versionToDate("2026.1.09")).toBe("2026-01-09");
  });

  it("rejects values that are not a three-part date", () => {
    expect(versionToDate("2026.11")).toBeNull();
    expect(versionToDate("2026.11.07-rc.1")).toBeNull();
    expect(versionToDate("2026.13.01")).toBeNull();
    expect(versionToDate("2026.11.32")).toBeNull();
  });
});

describe("changelog heading", () => {
  it("reads the first heading and its date", () => {
    const text = "# Changelog\n\n## 2026.11.07 — Scope non-goals\n\n- body\n";
    expect(parseHeading(text)).toEqual({
      version: "2026.11.07",
      date: "2026-11-07",
      title: "Scope non-goals",
    });
  });

  it("returns null without a heading", () => {
    expect(parseHeading("# Changelog\n\n- no heading\n")).toBeNull();
  });
});

describe("date drift", () => {
  it("passes when the heading matches the commit date", () => {
    const [row] = driftRows([
      { sha: "a", commitDate: "2026-11-07", changelog: "## 2026.11.07 — Same day\n" },
    ]);
    expect(row?.drift).toBe(false);
  });

  it("flags a heading dated before the commit", () => {
    const [row] = driftRows([
      { sha: "b", commitDate: "2026-11-08", changelog: "## 2026.11.07 — Late night\n" },
    ]);
    expect(row?.drift).toBe(true);
    expect(row?.headingDate).toBe("2026-11-07");
    expect(row?.commitDate).toBe("2026-11-08");
  });

  it("reports an unknown heading as not drift", () => {
    const [row] = driftRows([{ sha: "c", commitDate: "2026-11-08", changelog: "# no heading\n" }]);
    expect(row).toMatchObject({ heading: null, headingDate: null, drift: false });
  });
});
