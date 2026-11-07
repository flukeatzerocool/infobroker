#!/usr/bin/env npx tsx
/**
 * weekly.ts — one weekly report: gate cost, loop health, and delivery.
 * [informational]
 *
 * Purpose: replace the manual weekly sequence (`check`, `loop-audit`,
 * `metrics`) with one command that reads the sources those commands already
 * produce. It does not run the gate suite; the documented routine is
 * `npm run check` once, then `npm run weekly`. The report is written to
 * `$TMPDIR/infobroker/weekly-<repoKey>-<YYYY-MM-DD>.json` (local, never
 * committed) and printed as text. Missing sources are reported, not fatal.
 *
 * Usage: npx tsx scripts/weekly.ts [--json] [--help]
 * Exit codes: 0 = report printed and written, 1 = a source is unreadable,
 * 2 = fatal.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { handleHelp, parseFlag, rejectUnknown } from "./lib/args.js";
import {
  commitTimes,
  deliveryReport,
  pipelineCommitTimes,
  pushTimestamps,
} from "./lib/delivery.js";
import { repoKey, stateDir } from "./lib/gate-run-manifest.js";
import {
  advisoryGates,
  readLedger,
  readTiming,
  summarizeGateCost,
} from "./lib/gate-retirement.js";
import { readHookEvents, summarizeHooks } from "./lib/hook-events.js";
import { driftRows } from "./lib/loop-audit.js";
import { listIncrements, validateIncrements } from "./lib/loop-artifacts.js";
import { NON_GOALS_TITLE } from "./lib/non-goals.js";
import { buildWeeklyReport, renderWeekly, type WeeklyReport } from "./lib/weekly.js";

const ROOT = join(import.meta.dirname, "..");
const MAX_HEADING_COMMITS = 20;

const USAGE = `Usage: npx tsx scripts/weekly.ts [--json]

Combines the gate-cost, loop, and delivery reports for the weekly review.
Writes the report under $TMPDIR/infobroker/weekly-<repoKey>-<YYYY-MM-DD>.json.

  --json  Print the report as JSON (the artifact is still written).
  --help  Show this message.
`;

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf-8" }).trim();
}

// The git reader stays local to each report script; the date comparison is
// shared through `driftRows`. `loop-audit.ts` owns the same reader.
function headingCommits(): Array<{ sha: string; commitDate: string; changelog: string }> {
  let log: string;
  try {
    log = git([
      "log",
      "-G",
      "^## [0-9]",
      "--format=%H|%ad",
      "--date=short",
      "-n",
      String(MAX_HEADING_COMMITS),
      "--",
      "CHANGELOG.md",
    ]);
  } catch {
    // No git history (a tarball checkout): the report shows no heading rows.
    return [];
  }
  const entries: Array<{ sha: string; commitDate: string; changelog: string }> = [];
  for (const line of log.split("\n")) {
    const [sha, commitDate] = line.split("|");
    if (!sha || !commitDate) continue;
    try {
      entries.push({ sha, commitDate, changelog: git(["show", `${sha}:CHANGELOG.md`]) });
    } catch {
      // A commit that cannot be read (shallow clone) is skipped, not guessed.
    }
  }
  return entries;
}

function roadmapItems(): number {
  const path = join(ROOT, "ROADMAP.md");
  if (!existsSync(path)) return 0;
  const sections = readFileSync(path, "utf-8").match(/^## .+$/gm) ?? [];
  return sections.filter((line) => line !== `## ${NON_GOALS_TITLE}`).length;
}

function writeReport(report: WeeklyReport): string {
  const directory = stateDir();
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, `weekly-${repoKey(ROOT)}-${report.generated_at.slice(0, 10)}.json`);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  return path;
}

function main(): number {
  const argv = process.argv.slice(2);
  handleHelp(argv, USAGE);
  rejectUnknown(argv, new Set(["--json", "--help", "-h"]), USAGE);

  const { rows, warning } = readTiming(ROOT);
  if (warning) process.stderr.write(`weekly: ${warning}\n`);
  const { ledger, warnings } = readLedger(ROOT);
  for (const entry of warnings) process.stderr.write(`weekly: ${entry}\n`);

  const report = buildWeeklyReport({
    timing: rows,
    costs: summarizeGateCost(rows),
    advisory: [...advisoryGates(ledger)],
    increments: listIncrements(ROOT),
    findings: validateIncrements(ROOT),
    drifts: driftRows(headingCommits()),
    delivery: deliveryReport(pushTimestamps(ROOT), commitTimes(ROOT), pipelineCommitTimes(ROOT)),
    hooks: summarizeHooks(readHookEvents(ROOT)),
    roadmapItems: roadmapItems(),
  });
  const path = writeReport(report);

  if (parseFlag(argv, "--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.stderr.write(`weekly: report written to ${path}\n`);
  } else {
    process.stdout.write(renderWeekly(report));
    process.stdout.write(`Report: ${path}\n`);
  }
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  process.stderr.write(`weekly: fatal: ${(error as Error).message}\n`);
  process.exit(2);
}
