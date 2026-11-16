#!/usr/bin/env npx tsx
// benchmark-processing.ts — informational: deduplication quality over the
// committed processing corpus (REQ-136).
//
// Role: informational. Prints dedup recall, dedup precision and collapse-total
// accuracy. Deterministic and offline: the real reconciler, no network.
//
// Exit codes: 0 = report printed; 1 = corpus unreadable; 2 = fatal.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { handleHelp, parseFlag, rejectUnknown } from "./lib/args.js";
import { runProcessingBenchmark, type ProcessingCase, type ProcessingFloor } from "../src/processing-benchmark.js";

const ROOT = join(import.meta.dirname, "..");
const CORPUS = join(ROOT, "test-fixtures", "processing", "cases.json");

const USAGE = `benchmark-processing — deduplication quality (REQ-136)

Usage:
  benchmark-processing [--json] [--help]

Options:
  --json  Print the full report as JSON
  --help  Show this help (exit 0)

Exit codes: 0 = report printed; 1 = corpus error; 2 = fatal.
`;

function main(): number {
  const argv = process.argv.slice(2);
  handleHelp(argv, USAGE);
  rejectUnknown(argv, new Set(["--json", "--help", "-h"]), USAGE);
  const json = parseFlag(argv, "--json");

  const corpus = JSON.parse(readFileSync(CORPUS, "utf8")) as {
    floor?: ProcessingFloor;
    cases?: ProcessingCase[];
  };
  if (!Array.isArray(corpus.cases) || corpus.cases.length === 0) {
    console.error("benchmark-processing: corpus has no cases");
    return 1;
  }

  const floor = corpus.floor ?? { dedup_recall: 0, dedup_precision: 0, collapsed_total_accuracy: 0 };
  const report = runProcessingBenchmark(corpus.cases, floor);
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  }

  console.log("benchmark-processing — deduplication quality (REQ-136)\n");
  for (const outcome of report.cases) {
    console.log(
      `${outcome.id.padEnd(20)} collapsed ${outcome.collapsed_ok}/${outcome.collapsed_total}  survived ${outcome.survive_ok}/${outcome.survive_total}  total ${outcome.collapsed_actual}/${outcome.collapsed_expected}`,
    );
  }
  console.log(
    `\ncorpus ${report.corpus}  dedup_recall ${report.dedup_recall}  dedup_precision ${report.dedup_precision}  collapsed_total_accuracy ${report.collapsed_total_accuracy}  floor ${report.meetsFloor ? "met" : "MISSED"}`,
  );
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`benchmark-processing: fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
