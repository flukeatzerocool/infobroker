#!/usr/bin/env npx tsx
// monitor-delta.ts — entry point: deterministic offline comparison of two
// report manifests (REQ-117). Reports new, changed, and removed claims and
// sources; no network, no clock-dependent output.
//
// Exit codes: 0 = comparison completed; 1 = invalid input; 2 = fatal.

import { readFileSync, existsSync } from "node:fs";
import { handleHelp } from "./lib/args.js";
import { readSnapshot, diffReports, type ReportDelta } from "../src/lib/report-delta.js";

const USAGE = `monitor-delta — compare two report manifests offline (REQ-117)

Usage:
  monitor-delta --baseline <report.md> --current <report.md> [--json] [--help]

Options:
  --baseline <path>  Earlier report Markdown file.
  --current <path>   Later report Markdown file.
  --json             Emit the delta as JSON on stdout.
  --help, -h         Show this help (exit 0).

Exit codes: 0 = comparison completed; 1 = invalid input; 2 = fatal.
`;

function load(path: string): string {
  if (!existsSync(path)) throw new Error(`report not found: ${path}`);
  return readFileSync(path, "utf-8");
}

function main(): void {
  handleHelp(process.argv.slice(2), USAGE);
  let baseline: string | undefined;
  let current: string | undefined;
  let json = false;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--baseline") baseline = argv[++i];
    else if (arg.startsWith("--baseline=")) baseline = arg.slice("--baseline=".length);
    else if (arg === "--current") current = argv[++i];
    else if (arg.startsWith("--current=")) current = arg.slice("--current=".length);
    else if (arg === "--json") json = true;
    else {
      console.error(`unknown flag: ${arg}`);
      console.error(USAGE);
      process.exit(2);
    }
  }
  if (baseline === undefined || current === undefined) {
    console.error("--baseline and --current are required");
    console.error(USAGE);
    process.exit(2);
  }

  try {
    const result: ReportDelta = {
      baseline,
      current,
      ...diffReports(readSnapshot(baseline, load(baseline)), readSnapshot(current, load(current))),
    };
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`new claims: ${result.new_claims.length}`);
      for (const claim of result.new_claims) console.log(`  + ${claim}`);
      console.log(`changed claims: ${result.changed_claims.length}`);
      for (const change of result.changed_claims) console.log(`  ~ ${change.claim} (${change.changed.join("; ")})`);
      console.log(`removed claims: ${result.removed_claims.length}`);
      for (const claim of result.removed_claims) console.log(`  - ${claim}`);
      console.log(`new sources: ${result.new_sources.join(", ") || "none"}`);
      console.log(`removed sources: ${result.removed_sources.join(", ") || "none"}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
