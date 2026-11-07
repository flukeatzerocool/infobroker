#!/usr/bin/env npx tsx
/**
 * check-loop-artifacts.ts — gate the increment artifact contract. [gate]
 *
 * Purpose: an increment under docs/plans/ must carry plan.md, tasks.md, and an
 * aar.md ending in a LOOP PAUSED / LOOP OPEN token. Without this the plan and
 * the AAR are voluntary, and the loop cannot tell whether it completed. A
 * missing Done bar is a warning, not an error: the bar is a planning quality
 * signal, not a completion gate.
 *
 * Usage: npx tsx scripts/check-loop-artifacts.ts [--json] [--help]
 * Exit codes: 0 = contract satisfied (warnings allowed), 1 = errors found,
 * 2 = fatal error.
 */
import { join } from "node:path";
import { handleHelp, parseFlag, rejectUnknown } from "./lib/args.js";
import { INCREMENTS_DIR, listIncrements, nameProblem, validateIncrements } from "./lib/loop-artifacts.js";

const ROOT = join(import.meta.dirname, "..");

const USAGE = `Usage: npx tsx scripts/check-loop-artifacts.ts [--json]

  --json  Emit findings as JSON.
  --help  Show this message.
`;

function main(): number {
  const argv = process.argv.slice(2);
  handleHelp(argv, USAGE);
  rejectUnknown(argv, new Set(["--json", "--help", "-h"]), USAGE);
  const json = parseFlag(argv, "--json");

  const findings = validateIncrements(ROOT);
  const errors = findings.filter((finding) => finding.level === "error");
  const warnings = findings.filter((finding) => finding.level === "warning");
  const naming = listIncrements(ROOT)
    .map((increment) => nameProblem(increment.name))
    .filter((problem): problem is string => problem !== null);

  if (json) {
    console.log(JSON.stringify({ directory: INCREMENTS_DIR, findings, naming }, null, 2));
  } else {
    for (const finding of findings) {
      const prefix = finding.level === "error" ? "ERROR" : "WARNING";
      console.error(`${prefix} ${finding.increment}: ${finding.message}`);
    }
    for (const problem of naming) console.error(`ERROR ${problem}`);
    if (errors.length === 0 && warnings.length === 0 && naming.length === 0) {
      const count = listIncrements(ROOT).length;
      console.log(`PASS: ${count} increment(s) under ${INCREMENTS_DIR} satisfy the contract`);
    } else {
      console.log(`loop artifacts: ${errors.length} error(s), ${warnings.length} warning(s)`);
    }
  }

  return errors.length > 0 || naming.length > 0 ? 1 : 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`check-loop-artifacts: fatal: ${(error as Error).message}`);
  process.exit(2);
}
