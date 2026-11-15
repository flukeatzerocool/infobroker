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
// Usage: npx tsx scripts/metrics.ts [--json] [--help]

import { join } from "node:path";
import { handleHelp, parseFlag } from "./lib/args.js";
import {
  commitTimes,
  deliveryReport,
  hours,
  pipelineCommitTimes,
  pushTimestamps,
} from "./lib/delivery.js";

const USAGE = `Usage: npx tsx scripts/metrics.ts [--json]

Prints deployment frequency, commit-to-push lead time, commits per push, and
the pipeline-fix-within-48h proxy for the recorded push window.

  --json   Emit one JSON payload instead of the formatted report.
  --help   Show this message.
`;

handleHelp(process.argv, USAGE);
const asJson = parseFlag(process.argv.slice(2), "--json");
const unknown = process.argv.slice(2).filter((arg) => arg !== "--json");
if (unknown.length > 0) {
  console.error(`Unknown flag: ${unknown[0]}`);
  console.error(USAGE);
  process.exit(1);
}

const ROOT = join(import.meta.dirname, "..");

const report = deliveryReport(pushTimestamps(ROOT), commitTimes(ROOT), pipelineCommitTimes(ROOT));
if (!report) {
  if (asJson) console.log(JSON.stringify({ available: false }));
  else {
    console.log("Delivery metrics (origin reflog window)");
    console.log("  push history: unavailable (no origin/main reflog entries)");
  }
  process.exit(0);
}

if (asJson) {
  console.log(JSON.stringify({ available: true, ...report }));
  process.exit(0);
}

console.log("Delivery metrics (origin reflog window)");

console.log(`  window:              ${report.windowDays.toFixed(0)} days (${report.pushes} pushes)`);
console.log(`  deployment frequency: ${report.deploymentFrequency.toFixed(2)} pushes/day`);
console.log(
  `  lead time:            median ${hours(report.leadTimeMedian)}, p90 ${hours(report.leadTimeP90)}`,
);
console.log(
  `  commits per push:     median ${report.commitsPerPushMedian}, max ${report.commitsPerPushMax}`,
);
console.log(
  `  pipeline-fix proxy:   ${report.pipelineFollowUps}/${report.pipelineCommits} pipeline commits followed within 48h`,
);
