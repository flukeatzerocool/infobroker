#!/usr/bin/env npx tsx
// benchmark-kb-sufficiency.ts — informational: measure KB-first sufficiency
// admission (REQ-076b). Seeds a temp store from the committed retrieval corpus
// and reports, at snippet and page chunk scale, whether a low-relevance or
// cross-topic chunk satisfies the admission thresholds.
//
// Role: informational (exits 0 on a completed report).
// Exit codes: 0 = report printed; 1 = setup/read error; 2 = fatal (bad args).

import { runSufficiencyBenchmark, type SufficiencyReport } from "../src/kb-sufficiency-benchmark.js";

const USAGE = `benchmark-kb-sufficiency — KB-first admission measurement (REQ-076b)

Usage:
  npx tsx scripts/benchmark-kb-sufficiency.ts [--scale snippet|page] [--json]

Options:
  --scale <name>  Run one chunk scale only (default: both).
  --json          Print the full report as JSON.
  --help, -h      Show this message (exit 0).

Exit codes: 0 = report printed; 1 = setup/read error; 2 = fatal.`;

function fail(code: number, message: string): never {
  console.error(`benchmark-kb-sufficiency: ${message}`);
  process.exit(code);
}

function summary(report: SufficiencyReport): string {
  const lines = [
    `scale=${report.scale} chunks=${report.stored_chunks}/${report.documents} chunk_size=${report.chunk_size}`,
    `  admitted_irrelevant_rate=${report.admitted_irrelevant_rate}`,
    `  admitted_unjudged_rate=${report.admitted_unjudged_rate}`,
    `  sufficiency_recall=${report.sufficiency_recall}`,
    `  binary_hit_admitted=${report.binary_hit_admitted}`,
    `  cases_with_irrelevant_top=${report.cases_with_irrelevant_top}`,
  ];
  const flagged = report.cases.filter((entry) => entry.top_label === "irrelevant");
  for (const entry of flagged) {
    lines.push(
      `    top=irrelevant case=${entry.id} score=${entry.top_score} tokens=${entry.top_matched_tokens} url=${entry.top_url}`,
    );
  }
  return lines.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  let json = false;
  let scale: "snippet" | "page" | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--help" || arg === "-h") {
      console.log(USAGE);
      return;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--scale") {
      const value = args[++i];
      if (value !== "snippet" && value !== "page") fail(2, `--scale expects snippet or page`);
      scale = value;
      continue;
    }
    fail(2, `unknown argument: ${arg}`);
  }

  let reports: SufficiencyReport[];
  try {
    reports = runSufficiencyBenchmark({ scales: scale ? [scale] : ["snippet", "page"] });
  } catch (error) {
    fail(1, error instanceof Error ? error.message : String(error));
  }

  if (json) {
    console.log(JSON.stringify({ reports }, null, 2));
    return;
  }
  for (const report of reports) console.log(summary(report));
}

main();
