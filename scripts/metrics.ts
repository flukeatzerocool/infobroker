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

import { join } from "node:path";
import { handleHelp } from "./lib/args.js";
import {
  commitTimes,
  deliveryReport,
  hours,
  pipelineCommitTimes,
  pushTimestamps,
} from "./lib/delivery.js";

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

console.log("Delivery metrics (origin reflog window)");

const report = deliveryReport(pushTimestamps(ROOT), commitTimes(ROOT), pipelineCommitTimes(ROOT));
if (!report) {
  console.log("  push history: unavailable (no origin/main reflog entries)");
  process.exit(0);
}

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
