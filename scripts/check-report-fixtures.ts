#!/usr/bin/env npx tsx
// check-report-fixtures.ts — gate: prove the report contract validator accepts
// the good fixture and rejects each defect fixture (REQ-116). Wired into
// `npm run check`; the fixture corpus lives under `test-fixtures/reports/`.
//
// Exit codes: 0 = every fixture matches its expected verdict; 1 = expectation
// violation; 2 = fatal (unreadable corpus, unknown flag).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { handleHelp } from "./lib/args.js";
import { validateReport } from "../src/lib/report-manifest.js";

const ROOT = join(import.meta.dirname, "..");
const FIXTURES = join(ROOT, "test-fixtures", "reports");

const USAGE = `check-report-fixtures — report contract fixture gate (REQ-116)

Usage:
  check-report-fixtures [--json] [--help]

Reads every *.md under test-fixtures/reports/. A file named good-*.md must pass;
a file named bad-*.md, missing-*.md, unresolved-*.md, or no-*.md must fail.

Exit codes: 0 = all expectations met; 1 = expectation violation; 2 = fatal.
`;

const json = process.argv.includes("--json");
handleHelp(process.argv.slice(2), USAGE);
for (const arg of process.argv.slice(2)) {
  if (!["--json", "--help", "-h"].includes(arg)) {
    console.error(`unknown flag: ${arg}`);
    console.error(USAGE);
    process.exit(2);
  }
}

function expectedToFail(name: string): boolean {
  return /^(bad|missing|unresolved|no)-/.test(name);
}

interface FixtureResult {
  file: string;
  expected: "pass" | "fail";
  actual: "pass" | "fail";
  ok: boolean;
  errors: string[];
}

function main(): void {
  if (!existsSync(FIXTURES)) {
    console.error(`fixture directory missing: ${FIXTURES}`);
    process.exit(2);
  }
  const files = readdirSync(FIXTURES).filter((file) => file.endsWith(".md")).sort();
  if (files.length === 0) {
    console.error("no report fixtures found");
    process.exit(2);
  }
  const results: FixtureResult[] = files.map((file) => {
    const text = readFileSync(join(FIXTURES, file), "utf-8");
    const validation = validateReport(text);
    const expected: "pass" | "fail" = expectedToFail(file) ? "fail" : "pass";
    const actual: "pass" | "fail" = validation.ok ? "pass" : "fail";
    return {
      file,
      expected,
      actual,
      ok: expected === actual,
      errors: validation.findings.filter((finding) => finding.level === "error").map((finding) => finding.code),
    };
  });

  const failed = results.filter((result) => !result.ok);
  if (json) {
    console.log(JSON.stringify({ results, failed: failed.length }, null, 2));
  } else {
    for (const result of results) {
      const status = result.ok ? "PASS" : "FAIL";
      console.log(`${status}: ${result.file} (expected ${result.expected}, got ${result.actual})`);
    }
    console.log(`\n${results.length} fixture(s), ${failed.length} expectation violation(s)`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
