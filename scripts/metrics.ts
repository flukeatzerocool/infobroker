#!/usr/bin/env npx tsx
// metrics.ts — informational: the four delivery numbers that make the release
// loop measurable instead of felt (deployment frequency, commit-to-push lead
// time, commits per push, and the pipeline-fix proxy). Computed from git and
// the origin remote-tracking reflog; no network, no wall-clock state beyond
// the current time used for ages.
//
// Role: informational (reports; always exits 0).
// Exit codes: 0 = report printed, including when the reflog is unavailable.
//
// Usage: npx tsx scripts/metrics.ts [--help]

import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { handleHelp } from "./lib/args.js";

const USAGE = `Usage: npx tsx scripts/metrics.ts

Prints deployment frequency, commit-to-push lead time, commits per push, and
the pipeline-fix-within-48h proxy for the recorded push window.

  --help   Show this message.
`;

handleHelp(process.argv, USAGE);
const unknown = process.argv.slice(2);
if (unknown.length > 0) {
  console.error(`Unknown flag: ${unknown[0]}`);
  console.error(USAGE);
  process.exit(1);
}

const ROOT = join(import.meta.dirname, "..");
const DAY = 86_400;

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

function median(values: number[]): number {
  return percentile(values, 0.5);
}

function hours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`;
}

function pushTimestamps(): number[] {
  let raw = "";
  try {
    raw = git(["reflog", "show", "origin/main", "--date=raw"]);
  } catch {
    // No remote-tracking reflog (fresh clone or no origin): the window cannot
    // be reconstructed, and that is reported rather than guessed.
    return [];
  }
  const stamps = new Set<number>();
  for (const line of raw.split("\n")) {
    if (!line.includes("update by push")) continue;
    const match = /@\{(\d+) [+-]\d{4}\}/.exec(line);
    if (match) stamps.add(Number(match[1]));
  }
  return [...stamps].sort((a, b) => a - b);
}

const pushes = pushTimestamps();
const commitTimes = git(["log", "--format=%ct"])
  .split("\n")
  .filter(Boolean)
  .map(Number);
const pipelineTimes = git([
  "log",
  "--format=%ct",
  "--",
  "scripts/push-pipeline.sh",
  "scripts/pipeline",
])
  .split("\n")
  .filter(Boolean)
  .map(Number);

console.log("Delivery metrics (origin reflog window)");

if (pushes.length < 2) {
  console.log("  push history: unavailable (no origin/main reflog entries)");
  process.exit(0);
}

const windowDays = (pushes[pushes.length - 1] - pushes[0]) / DAY;
console.log(`  window:              ${windowDays.toFixed(0)} days (${pushes.length} pushes)`);
console.log(`  deployment frequency: ${(pushes.length / windowDays).toFixed(2)} pushes/day`);

const leadTimes: number[] = [];
for (const t of commitTimes) {
  const next = pushes.find((p) => p >= t);
  if (next !== undefined) leadTimes.push(next - t);
}
console.log(
  `  lead time:            median ${hours(median(leadTimes))}, p90 ${hours(percentile(leadTimes, 0.9))}`,
);

const perPush: number[] = [];
let previous = 0;
for (const p of pushes) {
  perPush.push(commitTimes.filter((t) => t > previous && t <= p).length);
  previous = p;
}
console.log(
  `  commits per push:     median ${median(perPush)}, max ${Math.max(...perPush)}`,
);

let followUps = 0;
for (const t of pipelineTimes) {
  if (pipelineTimes.some((other) => other > t && other - t <= 2 * DAY)) followUps += 1;
}
console.log(
  `  pipeline-fix proxy:   ${followUps}/${pipelineTimes.length} pipeline commits followed within 48h`,
);
