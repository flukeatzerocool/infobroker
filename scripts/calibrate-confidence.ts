#!/usr/bin/env npx tsx
// calibrate-confidence.ts — build tool: run the deterministic calibration gold
// set through the REQ-123 correction and report Brier score and reliability.
// No network, no clock-dependent output.
//
// Exit codes: 0 = report produced; 1 = invalid input; 2 = fatal.

// @implements REQ-123

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { handleHelp } from "./lib/args.js";
import { brierScore, capConfidence, reliabilityCurve, type CalibrationSource } from "../src/calibration.js";

const USAGE = `calibrate-confidence — report calibration for the gold set (REQ-123)

Usage:
  calibrate-confidence [--gold <file>] [--json] [--help]

Options:
  --gold <path>  Gold-set JSON (default: test-fixtures/calibration/gold.json).
  --json         Emit the report as JSON.
  --help, -h     Show this help (exit 0).

Exit codes: 0 = report produced; 1 = invalid input; 2 = fatal.
`;

interface GoldEntry {
  id: string;
  confidence: number;
  correct: boolean;
  sources: string[];
}

function loadGold(path: string): GoldEntry[] {
  const raw = JSON.parse(readFileSync(path, "utf-8")) as { entries?: GoldEntry[] };
  if (!Array.isArray(raw.entries) || raw.entries.length === 0) {
    throw new Error("gold set must contain a non-empty 'entries' array");
  }
  for (const entry of raw.entries) {
    if (typeof entry.confidence !== "number" || typeof entry.correct !== "boolean" || !Array.isArray(entry.sources)) {
      throw new Error(`invalid gold entry: ${JSON.stringify(entry)}`);
    }
  }
  return raw.entries;
}

function main(): void {
  handleHelp(process.argv.slice(2), USAGE);
  const argv = process.argv.slice(2);
  let gold = join(import.meta.dirname, "..", "test-fixtures", "calibration", "gold.json");
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--gold") gold = argv[++i] ?? gold;
    else if (arg.startsWith("--gold=")) gold = arg.slice("--gold=".length);
    else if (arg === "--json") json = true;
    else {
      console.error(`unknown flag: ${arg}`);
      console.error(USAGE);
      process.exit(2);
    }
  }
  if (!existsSync(gold)) {
    console.error(`gold set not found: ${gold}`);
    process.exit(1);
  }
  try {
    const entries = loadGold(gold);
    const predictions = entries.map((entry) => ({
      confidence: capConfidence(
        entry.confidence,
        entry.sources.map((source_type): CalibrationSource => ({ source_type })),
        { enabled: true },
      ),
      correct: entry.correct,
    }));
    const report = {
      entries: entries.length,
      brier_score: Number(brierScore(predictions).toFixed(4)),
      reliability: reliabilityCurve(predictions),
    };
    if (json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`entries: ${report.entries}`);
      console.log(`brier_score: ${report.brier_score}`);
      for (const bucket of report.reliability) {
        console.log(`${bucket.band} count=${bucket.count} mean=${bucket.meanConfidence.toFixed(2)} observed=${bucket.observedRate.toFixed(2)}`);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
