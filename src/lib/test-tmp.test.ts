// @implements REQ-055
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  RUN_ROOT_ENV,
  createdTestTmpDirs,
  removeTestTmp,
  runRoot,
  testTmpDir,
} from "./test-tmp.js";

describe("test temp-root lifecycle", () => {
  it("resolves the run root the global setup exported", () => {
    const exported = process.env[RUN_ROOT_ENV];
    expect(exported).toBeTruthy();
    expect(runRoot()).toBe(exported);
  });

  it("creates unique, registered directories directly under the run root", () => {
    const a = testTmpDir("a-");
    const b = testTmpDir("b-");
    expect(a).not.toBe(b);
    for (const dir of [a, b]) {
      expect(dir.startsWith(runRoot())).toBe(true);
      expect(dir.slice(runRoot().length + 1)).not.toContain("/");
      expect(existsSync(dir)).toBe(true);
    }
    expect(createdTestTmpDirs()).toEqual(expect.arrayContaining([a, b]));
  });

  it("fails loudly when a vitest worker did not inherit the run root", () => {
    const saved = process.env[RUN_ROOT_ENV];
    delete process.env[RUN_ROOT_ENV];
    try {
      expect(() => runRoot()).toThrow(/INFOBROKER_TEST_TMP is unset under vitest/);
    } finally {
      process.env[RUN_ROOT_ENV] = saved;
    }
  });

  it("uses the system temp dir outside vitest", () => {
    const saved = process.env["VITEST"];
    process.env["VITEST"] = "false";
    try {
      expect(runRoot()).toBe(tmpdir());
    } finally {
      process.env["VITEST"] = saved;
    }
  });

  it("removes one root, or all of them, idempotently", () => {
    const one = testTmpDir("one-");
    removeTestTmp(one);
    expect(existsSync(one)).toBe(false);
    expect(() => removeTestTmp(one)).not.toThrow();

    const a = testTmpDir("all-a-");
    const b = testTmpDir("all-b-");
    removeTestTmp();
    expect(existsSync(a)).toBe(false);
    expect(existsSync(b)).toBe(false);
    expect(createdTestTmpDirs()).toEqual([]);
  });
});
