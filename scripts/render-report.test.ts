#!/usr/bin/env npx tsx
// render-report.test.ts — regression test for the export CLI's validation
// contract (REQ-126): an invalid report is refused with exit 1 unless the
// caller explicitly passes --no-validate, which the CLI forwards to the
// library exports as `skipValidation`.
//
// Role: test (run by `npm run test`). Exit codes are vitest's.

// @implements REQ-126 explicit-skip

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

function render(args: string[]) {
  return spawnSync("npx", ["tsx", "scripts/render-report.ts", ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

describe("render-report validation contract (REQ-126)", () => {
  it("exits 1 and names the findings for an invalid report", () => {
    const result = render(["--report", "test-fixtures/reports/bad-confidence.md", "--format", "json"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("manifest-confidence");
    expect(result.stdout).toBe("");
  });

  it("exits 0 and writes data when the caller explicitly skips validation", () => {
    const result = render(["--report", "test-fixtures/reports/bad-confidence.md", "--format", "json", "--no-validate"]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as { manifest?: unknown }).toHaveProperty("manifest");
  });

  it("exits 0 for a valid report", () => {
    const result = render(["--report", "test-fixtures/reports/good-report.md", "--format", "csv"]);
    expect(result.status).toBe(0);
    expect(result.stdout.split("\n")[0]).toContain("#");
  });
});
