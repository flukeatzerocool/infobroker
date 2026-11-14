#!/usr/bin/env npx tsx
// calibrate-confidence.ts — build tool: run the deterministic calibration gold
// set through the REQ-123 cap and the REQ-026a authority adjustment, and report
// Brier score, reliability, and one row per entry.
//
// Determinism: the only inputs are the gold file and the shipped `config.json`
// beside this script's parent. No network, no clock-dependent output, and no
// environment or user config layer — a user-layer run is out of scope by
// design, so the report measures the shipped ladder.
//
// Exit codes: 0 = report produced; 1 = invalid input; 2 = fatal.

// @implements REQ-123 REQ-026a

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { handleHelp } from "./lib/args.js";
import {
  buildCalibrationReport,
  type CalibrationEntry,
  type CalibrationOptions,
} from "../src/calibration.js";

const USAGE = `calibrate-confidence — report calibration for the gold set (REQ-123)

Usage:
  calibrate-confidence [--gold <file>] [--json] [--help]

Options:
  --gold <path>  Gold-set JSON (default: test-fixtures/calibration/gold.json).
  --json         Emit the report as JSON.
  --help, -h     Show this help (exit 0).

Exit codes: 0 = report produced; 1 = invalid input; 2 = fatal.
`;

interface ShippedConfig {
  corroboration?: {
    authority_weights?: Record<string, number>;
    calibration?: { enabled?: boolean; secondary_only_cap?: number };
  };
}

function loadShippedSettings(): { weights: Record<string, number>; options: CalibrationOptions } {
  const path = join(import.meta.dirname, "..", "config.json");
  const config = JSON.parse(readFileSync(path, "utf-8")) as ShippedConfig;
  const corroboration = config.corroboration ?? {};
  return {
    weights: corroboration.authority_weights ?? {},
    options: {
      enabled: corroboration.calibration?.enabled !== false,
      secondaryOnlyCap: corroboration.calibration?.secondary_only_cap ?? 0.7,
    },
  };
}

function loadGold(path: string): CalibrationEntry[] {
  const raw = JSON.parse(readFileSync(path, "utf-8")) as { entries?: CalibrationEntry[] };
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
    const { weights, options } = loadShippedSettings();
    const built = buildCalibrationReport(entries, weights, options);
    const report = {
      entries: built.entries,
      brier_score: Number(built.brier_score.toFixed(4)),
      reliability: built.reliability,
      rows: built.rows,
    };
    if (json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`entries: ${report.entries}`);
      console.log(`brier_score: ${report.brier_score}`);
      for (const bucket of report.reliability) {
        console.log(`${bucket.band} count=${bucket.count} mean=${bucket.meanConfidence.toFixed(2)} observed=${bucket.observedRate.toFixed(2)}`);
      }
      for (const row of report.rows) {
        console.log(`${row.id} raw=${row.raw} adjusted=${Number(row.adjusted.toFixed(4))}`);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
