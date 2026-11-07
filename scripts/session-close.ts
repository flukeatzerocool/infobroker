#!/usr/bin/env npx tsx
/**
 * session-close.ts — seal a session loop: validate, gate, record, report. [entry point]
 *
 * Purpose: make the last step of the session loop one command. It validates the
 * increment's artifacts, runs the fast gate suite, records the run for this
 * tree, and prints the readiness report and the exact next commands.
 *
 * It does not commit. Infobroker's split-commit series (D-089) owns commits;
 * Holonovel derives a subject from a dated CHANGELOG heading, but this
 * repository's headings carry the CalVer version, which repeats across several
 * entries, so there is no unique subject to derive. Documented in
 * docs/workflow-cadence.md.
 *
 * Usage: npx tsx scripts/session-close.ts [--date YYYY-MM-DD]
 *        [--increment <name>] [--dry-run] [--help]
 * Exit codes: 0 = increment sealed and suite green, 1 = contract or gate
 * failure, 2 = fatal error.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { handleHelp, parseFlag, parseValueFlag, rejectUnknown } from "./lib/args.js";
import { writeGateRun } from "./lib/gate-run-manifest.js";
import {
  INCREMENTS_DIR,
  listIncrements,
  nameProblem,
  newestIncrement,
  validateIncrements,
} from "./lib/loop-artifacts.js";

const ROOT = join(import.meta.dirname, "..");

const USAGE = `Usage: npx tsx scripts/session-close.ts [--date YYYY-MM-DD]
       [--increment <name>] [--dry-run]

  --date        Require the increment directory to carry this date prefix.
  --increment   Seal this increment (default: the newest one).
  --dry-run     Validate and print the plan; run no gate, write no record.
  --help        Show this message.
`;

function runFastSuite(): number {
  const result = spawnSync("npm", ["run", "check:fast"], { cwd: ROOT, stdio: "inherit" });
  if (result.error) {
    process.stderr.write(`session-close: could not run the fast suite: ${result.error.message}\n`);
    return 2;
  }
  return result.status ?? 2;
}

function main(): number {
  const argv = process.argv.slice(2);
  handleHelp(argv, USAGE);
  rejectUnknown(argv, new Set(["--date", "--increment", "--dry-run", "--help", "-h"]), USAGE);
  const date = parseValueFlag(argv, "--date");
  const requested = parseValueFlag(argv, "--increment");
  const dryRun = parseFlag(argv, "--dry-run");

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    process.stderr.write(`session-close: --date must be YYYY-MM-DD\n`);
    return 1;
  }

  const increments = listIncrements(ROOT);
  if (increments.length === 0) {
    process.stderr.write(
      `session-close: no increment under ${INCREMENTS_DIR}. Write plan.md, tasks.md, and aar.md first.\n`,
    );
    return 1;
  }

  const target = requested
    ? increments.find((increment) => increment.name === requested)
    : newestIncrement(ROOT);
  if (!target) {
    process.stderr.write(
      `session-close: no increment named '${requested}'. Known: ${increments.map((i) => i.name).join(", ")}\n`,
    );
    return 1;
  }

  const findings = validateIncrements(ROOT).filter((finding) => finding.increment === target.name);
  const errors = findings.filter((finding) => finding.level === "error");
  const warnings = findings.filter((finding) => finding.level === "warning");
  for (const finding of findings) {
    const prefix = finding.level === "error" ? "ERROR" : "WARNING";
    process.stderr.write(`${prefix} ${finding.increment}: ${finding.message}\n`);
  }
  const naming = nameProblem(target.name);
  if (naming) {
    process.stderr.write(`ERROR ${naming}\n`);
    return 1;
  }
  if (date && !target.name.startsWith(date)) {
    process.stderr.write(`session-close: ${target.name} does not carry the --date ${date}\n`);
    return 1;
  }
  if (errors.length > 0) return 1;

  process.stdout.write(`\nIncrement: ${target.name}\n`);
  process.stdout.write(`  plan:  ${target.hasPlan ? "present" : "MISSING"}\n`);
  process.stdout.write(`  tasks: ${target.hasTasks ? "present" : "MISSING"}\n`);
  process.stdout.write(`  aar:   ${target.hasAar ? `present (${target.loopToken})` : "MISSING"}\n`);
  process.stdout.write(`  done bar: ${target.doneBar ?? "not stated"}\n`);

  if (dryRun) {
    process.stdout.write("\nsession-close: dry run — no gate run, no record, no commit.\n");
    return 0;
  }

  process.stdout.write("\nRunning the fast suite (npm run check:fast)...\n\n");
  const suite = runFastSuite();
  if (suite !== 0) {
    process.stderr.write(`\nsession-close: fast suite FAILED (exit ${suite}) — fix, then close again.\n`);
    return suite === 2 ? 2 : 1;
  }

  const record = writeGateRun(ROOT, "fast");
  process.stdout.write(
    record
      ? `\nGate record: fast run recorded for ${record.head.slice(0, 12)}.\n`
      : "\nGate record: not written (working tree is dirty); the pre-push hook will run the full suite.\n",
  );

  process.stdout.write(
    [
      "",
      "Session sealed. Commit cadence (split-commit series, D-089):",
      "  1. Stage one concern at a time and commit it.",
      `  2. When the tree is ready to publish: npm run prep (AI steps), review the diff, commit.`,
      "  3. npm run release (deterministic: gates, commit, tag, push).",
      warnings.length > 0 ? `  Note: ${warnings.length} warning(s) above.` : "",
      "",
    ].join("\n"),
  );
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  process.stderr.write(`session-close: fatal: ${(error as Error).message}\n`);
  process.exit(2);
}
