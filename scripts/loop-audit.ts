#!/usr/bin/env npx tsx
/**
 * loop-audit.ts — informational: report the session loop's own record. [informational]
 *
 * Purpose: the delivery metrics answer "how fast are we shipping"; this answers
 * "is the loop's memory intact". It reports the increment artifacts under
 * docs/plans/ (count, terminal token, done bar) and compares each commit that
 * rewrote a CHANGELOG heading with the date it was committed. Delivery numbers
 * are not recomputed here — `npm run metrics` owns them.
 *
 * Usage: npx tsx scripts/loop-audit.ts [--json] [--help]
 * Exit codes: 0 = report printed (findings included), 1 = a source was
 * unreadable, 2 = fatal.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { handleHelp, parseFlag, rejectUnknown } from "./lib/args.js";
import {
  commitTimes,
  deliveryReport,
  hours,
  percentile,
  pipelineCommitTimes,
  pushTimestamps,
} from "./lib/delivery.js";
import { timingPath } from "./lib/gate-run-manifest.js";
import { readHookEvents, summarizeHooks } from "./lib/hook-events.js";
import { driftRows, type DriftRow } from "./lib/loop-audit.js";
import { INCREMENTS_DIR, listIncrements, validateIncrements } from "./lib/loop-artifacts.js";

const ROOT = join(import.meta.dirname, "..");
const MAX_HEADING_COMMITS = 20;

const USAGE = `Usage: npx tsx scripts/loop-audit.ts [--json]

Reports increment artifact health and CHANGELOG-vs-commit date drift.
Delivery metrics live in \`npm run metrics\`.

  --json  Emit the report as JSON.
  --help  Show this message.
`;

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf-8" }).trim();
}

function headingCommits(): Array<{ sha: string; commitDate: string; changelog: string }> {
  let log: string;
  try {
    log = git([
      "log",
      "-G",
      "^## [0-9]",
      "--format=%H|%ad",
      "--date=short",
      `-n`,
      String(MAX_HEADING_COMMITS),
      "--",
      "CHANGELOG.md",
    ]);
  } catch {
    // No git history (a tarball checkout): the audit reports increments only.
    return [];
  }
  if (!log) return [];
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

interface TimingRow {
  at: string;
  gate: string;
  ms: number;
  status: "pass" | "fail";
}

interface GateRow {
  runs: number;
  failures: number;
  medianMs: number;
  p95Ms: number;
}

/** gateRows — per-gate cost from the local timing record (missing = empty). */
function gateRows(): Record<string, GateRow> {
  const path = timingPath(ROOT);
  if (!existsSync(path)) return {};
  let rows: TimingRow[];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as TimingRow[];
    if (!Array.isArray(parsed)) return {};
    rows = parsed;
  } catch {
    // A corrupt timing file is disposable local state; the audit reports no rows.
    return {};
  }
  const byGate = new Map<string, TimingRow[]>();
  for (const row of rows) {
    if (!row.gate || typeof row.ms !== "number") continue;
    const list = byGate.get(row.gate) ?? [];
    list.push(row);
    byGate.set(row.gate, list);
  }
  const report: Record<string, GateRow> = {};
  for (const [gate, list] of byGate) {
    const durations = list.map((row) => row.ms);
    report[gate] = {
      runs: list.length,
      failures: list.filter((row) => row.status === "fail").length,
      medianMs: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
    };
  }
  return report;
}

function main(): number {
  const argv = process.argv.slice(2);
  handleHelp(argv, USAGE);
  rejectUnknown(argv, new Set(["--json", "--help", "-h"]), USAGE);
  const json = parseFlag(argv, "--json");

  const increments = listIncrements(ROOT);
  const findings = validateIncrements(ROOT);
  const drifts: DriftRow[] = driftRows(headingCommits());
  const drifted = drifts.filter((row) => row.drift);
  const delivery = deliveryReport(pushTimestamps(ROOT), commitTimes(ROOT), pipelineCommitTimes(ROOT));
  const hooks = summarizeHooks(readHookEvents(ROOT));
  const gates = gateRows();

  const report = {
    increments_dir: INCREMENTS_DIR,
    increments: increments.map((increment) => ({
      name: increment.name,
      token: increment.loopToken,
      done_bar: increment.doneBar !== null,
    })),
    artifact_errors: findings.filter((finding) => finding.level === "error").length,
    artifact_warnings: findings.filter((finding) => finding.level === "warning").length,
    heading_commits: drifts.length,
    date_drift: drifted,
    delivery,
    hooks,
    gates,
  };

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return 0;
  }

  console.log("\nSession loop audit\n");
  console.log(`Increments under ${INCREMENTS_DIR}: ${increments.length}`);
  for (const increment of increments) {
    const doneBar = increment.doneBar !== null ? "done bar" : "NO done bar";
    console.log(`  ${increment.name} — ${increment.loopToken ?? "no token"}, ${doneBar}`);
  }
  if (findings.length > 0) {
    console.log(
      `  artifact findings: ${report.artifact_errors} error(s), ${report.artifact_warnings} warning(s)`,
    );
  }
  console.log(`\nCHANGELOG heading commits inspected: ${drifts.length}`);
  if (drifted.length === 0) {
    console.log("  date drift: none");
  } else {
    for (const row of drifted) {
      console.log(
        `  DRIFT ${row.sha.slice(0, 12)} — heading ${row.headingDate ?? "?"} vs commit ${row.commitDate}`,
      );
    }
  }
  console.log("\nDelivery (origin reflog window)");
  if (!delivery) {
    console.log("  unavailable: fewer than two recorded pushes");
  } else {
    console.log(
      `  window: ${delivery.windowDays.toFixed(0)} days, ${delivery.pushes} pushes, ${delivery.deploymentFrequency.toFixed(2)}/day`,
    );
    console.log(
      `  lead time: median ${hours(delivery.leadTimeMedian)}, p90 ${hours(delivery.leadTimeP90)}`,
    );
    console.log(
      `  commits per push: median ${delivery.commitsPerPushMedian}, max ${delivery.commitsPerPushMax}`,
    );
    console.log(
      `  pipeline-fix proxy: ${delivery.pipelineFollowUps}/${delivery.pipelineCommits} within 48h`,
    );
  }

  console.log(
    `\nHook invocations: ran ${hooks.ran}, skipped ${hooks.skipped}, failed ${hooks.failed}`,
  );

  const gateNames = Object.keys(gates);
  if (gateNames.length === 0) {
    console.log("\nGate timing: no record (run `npm run check` with --timing)");
  } else {
    console.log("\nGate timing (local record)");
    for (const name of gateNames.sort()) {
      const row = gates[name];
      console.log(
        `  ${name}: ${row.runs} run(s), ${row.failures} failure(s), median ${(row.medianMs / 1000).toFixed(1)}s, p95 ${(row.p95Ms / 1000).toFixed(1)}s`,
      );
    }
  }

  console.log("\nDelivery numbers: npm run metrics\n");
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`loop-audit: fatal: ${(error as Error).message}`);
  process.exit(2);
}
