#!/usr/bin/env npx tsx
// benchmark-direction.ts — informational: run the committed requirement-quality
// corpus through the live classifier and ambiguity rule (REQ-135).
//
// Role: informational. Prints offer rate, false-offer rate and mean slot recall.
// Deterministic and offline: no network, no clock, no configuration load.
//
// Exit codes: 0 = report printed; 1 = corpus unreadable or malformed; 2 = fatal.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { handleHelp, parseFlag, rejectUnknown } from "./lib/args.js";
import { runDirectionBenchmark, type DirectionCase } from "../src/direction-benchmark.js";

const ROOT = join(import.meta.dirname, "..");
const CORPUS = join(ROOT, "test-fixtures", "direction", "cases.json");

const USAGE = `benchmark-direction — requirement-quality corpus (REQ-135)

Usage:
  benchmark-direction [--json] [--help]

Options:
  --json  Print the full report as JSON
  --help  Show this help (exit 0)

Exit codes: 0 = report printed; 1 = corpus error; 2 = fatal.
`;

// The dispatch map is read from config.json rather than loaded through the
// server config layer: the benchmark must not depend on user overrides.
function chains(): (taskType: string) => string[] {
  const config = JSON.parse(readFileSync(join(ROOT, "config.json"), "utf8")) as {
    dispatch?: Record<string, string[]>;
  };
  const dispatch = config.dispatch ?? {};
  return (taskType: string) => (Array.isArray(dispatch[taskType]) ? dispatch[taskType] : []);
}

function main(): number {
  const argv = process.argv.slice(2);
  handleHelp(argv, USAGE);
  rejectUnknown(argv, new Set(["--json", "--help", "-h"]), USAGE);
  const json = parseFlag(argv, "--json");

  const corpus = JSON.parse(readFileSync(CORPUS, "utf8")) as {
    floor?: number;
    cases?: DirectionCase[];
  };
  if (!Array.isArray(corpus.cases) || corpus.cases.length === 0) {
    console.error("benchmark-direction: corpus has no cases");
    return 1;
  }

  const run = runDirectionBenchmark(corpus.cases, chains(), corpus.floor ?? 2);
  if (json) {
    process.stdout.write(`${JSON.stringify(run.report, null, 2)}\n`);
    return 0;
  }

  console.log("benchmark-direction — requirement quality (REQ-135)\n");
  for (const outcome of run.report.cases) {
    console.log(
      `${outcome.id.padEnd(26)} offered ${String(outcome.offered).padEnd(5)} slots ${outcome.slot_recall.toFixed(2)}${outcome.offered_types.length > 0 ? `  ${outcome.offered_types.join("|")}` : ""}`,
    );
  }
  console.log(
    `\ncorpus ${run.report.corpus}  offer_rate ${run.report.offer_rate}  false_offer_rate ${run.report.false_offer_rate}  mean_slot_recall ${run.report.mean_slot_recall}`,
  );
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`benchmark-direction: fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
