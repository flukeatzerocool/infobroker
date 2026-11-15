#!/usr/bin/env npx tsx
// clean-test-tmp.test.ts — unit tests for the temp-root selection predicate and
// the tree-size walk (REQ-055 lifecycle).
//
// Exit codes: 0 = assertions pass (the test runner owns the failure signal).
// @implements REQ-055
import { describe, it, expect } from "vitest";
import { isHarnessName, isInside, selectTempRoots, treeBytes, type Entry } from "./clean-test-tmp.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { testTmpDir } from "../src/lib/test-tmp.js";

const HOUR = 3_600_000;

function entry(name: string, ageHours: number, now: number): Entry {
  return { name, mtimeMs: now - ageHours * HOUR };
}

describe("temp-root selection", () => {
  const now = 1_700_000_000_000; // fixed clock: no wall-clock dependence
  const root = "/tmp/example";

  it("matches only harness prefixes", () => {
    expect(isHarnessName("infobroker-run-abc")).toBe(true);
    expect(isHarnessName("ib-cfg-xyz")).toBe(true);
    expect(isHarnessName("debate-club-abc")).toBe(true);
    expect(isHarnessName("config.json")).toBe(false);
    expect(isHarnessName("some-other-tool")).toBe(false);
  });

  it("containment rejects a path outside the root", () => {
    expect(isInside("/tmp/example", "/tmp/example/ib-cfg-x")).toBe(true);
    expect(isInside("/tmp/example", "/tmp/example2/ib-cfg-x")).toBe(false);
    expect(isInside("/tmp/example", "/tmp/ib-cfg-x")).toBe(false);
    expect(isInside("/tmp/example", "/tmp/example/../ib-cfg-x")).toBe(false);
  });

  it("applies the age bound by default", () => {
    const entries = [entry("ib-cfg-old", 2, now), entry("ib-cfg-new", 0.1, now)];
    const selected = selectTempRoots(entries, { root, ageMinutes: 60, ignoreAge: false, now });
    expect(selected.map((e) => e.name)).toEqual(["ib-cfg-old"]);
  });

  it("--all ignores the age bound", () => {
    const entries = [entry("ib-cfg-old", 2, now), entry("ib-cfg-new", 0.1, now)];
    const selected = selectTempRoots(entries, { root, ageMinutes: 60, ignoreAge: true, now });
    expect(selected.map((e) => e.name)).toEqual(["ib-cfg-old", "ib-cfg-new"]);
  });

  it("never selects non-harness names", () => {
    const entries = [entry("cache", 5, now), entry("npm-1234", 5, now)];
    expect(selectTempRoots(entries, { root, ageMinutes: 60, ignoreAge: true, now })).toEqual([]);
  });

  it("sums a tree's bytes", () => {
    const dir = testTmpDir("bytes-");
    mkdirSync(`${dir}/nested`, { recursive: true });
    writeFileSync(`${dir}/a.txt`, "12345");
    writeFileSync(`${dir}/nested/b.txt`, "678");
    expect(treeBytes(dir)).toBe(8);
  });
});
