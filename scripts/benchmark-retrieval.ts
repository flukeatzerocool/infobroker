#!/usr/bin/env npx tsx
// benchmark-retrieval.ts — informational: measure retrieval quality over the
// committed retrieval fixtures (REQ-130). Runs the real reconciliation path
// over committed raw results, so it exercises pipeline code, not a frozen
// output. Report-only: exits 0 unless the fixtures are unreadable.
//
// Exit codes: 0 = report printed; 1 = fixture read/parse error; 2 = fatal.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { handleHelp } from "./lib/args.js";
import { runBenchmark, type RetrievalCase } from "../src/retrieval-benchmark.js";

const ROOT = join(import.meta.dirname, "..");
const FIXTURE_DIR = join(ROOT, "test-fixtures", "retrieval");
const QUERIES = join(FIXTURE_DIR, "queries.json");
const BASELINE = join(FIXTURE_DIR, "baseline.json");

const USAGE = `benchmark-retrieval — retrieval-quality benchmark (REQ-130)

Usage:
  benchmark-retrieval [--json] [--update-baseline] [--dry-run]

Options:
  --json             Print the full report as JSON.
  --update-baseline  Write test-fixtures/retrieval/baseline.json.
  --dry-run          Do not write any file (default).
  --help, -h         Show this message (exit 0).

Exit codes: 0 = report printed; 1 = fixture error; 2 = fatal.
`;

const argv = process.argv.slice(2);
handleHelp(argv, USAGE);
const json = argv.includes("--json");
const updateBaseline = argv.includes("--update-baseline");
const known = new Set(["--json", "--update-baseline", "--dry-run"]);
for (const arg of argv) {
  if (!known.has(arg)) {
    console.error(`Unknown flag: ${arg}`);
    process.exit(2);
  }
}

interface FixtureFile {
  version: number;
  k: number;
  queries: RetrievalCase[];
}

let fixture: FixtureFile;
try {
  fixture = JSON.parse(readFileSync(QUERIES, "utf-8")) as FixtureFile;
} catch (error) {
  console.error(`benchmark-retrieval: cannot read ${QUERIES}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const report = runBenchmark(fixture.queries, fixture.k);

if (json) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  console.log(`retrieval benchmark — ${report.corpus} queries, k=${report.k}`);
  console.log(`reconciled: precision ${report.reconciled.mean_precision} | recall ${report.reconciled.mean_recall} | MRR ${report.reconciled.mrr} | nDCG ${report.reconciled.ndcg}`);
  console.log(`raw order:  precision ${report.raw.mean_precision} | recall ${report.raw.mean_recall} | MRR ${report.raw.mrr} | nDCG ${report.raw.ndcg}`);
  console.log("");
  for (const c of report.cases) {
    console.log(`${c.id.padEnd(20)} P@k ${c.precision_at_k.toFixed(3)}  R@k ${c.recall_at_k.toFixed(3)}  MRR ${c.mrr.toFixed(3)}  nDCG ${c.ndcg_at_k.toFixed(3)}`);
  }
}

if (updateBaseline && !argv.includes("--dry-run")) {
  const baseline = {
    version: 1,
    k: report.k,
    corpus: report.corpus,
    reconciled: report.reconciled,
    raw: report.raw,
    cases: report.cases,
  };
  writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + "\n");
  console.log(`\nbaseline written to ${BASELINE}`);
}
