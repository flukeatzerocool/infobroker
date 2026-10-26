#!/usr/bin/env npx tsx
// validate-report.ts — entry point: validate one report's structure, manifest,
// citation coverage, and Source Register (REQ-116). Not wired into `npm run
// check`; `check-report-fixtures.ts` is the gate over the committed corpus.
//
// Exit codes: 0 = valid (or --report-only); 1 = validation errors; 2 = fatal.

import { readFileSync, existsSync } from "node:fs";
import { handleHelp } from "./lib/args.js";
import { validateReport, type ReportValidation } from "../src/lib/report-manifest.js";

const USAGE = `validate-report — report contract validation (REQ-116)

Usage:
  validate-report --report <path> [--report-only] [--json] [--help]

Options:
  --report <path>   Report Markdown file to validate.
  --report-only     Print findings and always exit 0 (informational).
  --json            Emit the validation result as JSON on stdout.
  --help, -h        Show this help (exit 0).

Exit codes: 0 = valid or report-only; 1 = validation errors; 2 = fatal.
`;

interface ParsedArgs {
  report?: string;
  reportOnly: boolean;
  json: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { reportOnly: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--report") {
      const next = argv[++i];
      if (next === undefined) throw new Error("--report requires a path");
      parsed.report = next;
    } else if (arg.startsWith("--report=")) {
      parsed.report = arg.slice("--report=".length);
    } else if (arg === "--report-only") {
      parsed.reportOnly = true;
    } else if (arg === "--json") {
      parsed.json = true;
    } else {
      throw new Error(`unknown flag: ${arg}`);
    }
  }
  return parsed;
}

function printHuman(validation: ReportValidation): void {
  for (const finding of validation.findings) {
    const location = finding.line !== undefined ? `:${finding.line}` : "";
    console.log(`${finding.level.toUpperCase()}${location} [${finding.code}] ${finding.message}`);
  }
  const errors = validation.findings.filter((finding) => finding.level === "error").length;
  const warnings = validation.findings.length - errors;
  console.log(`\n${errors} error(s), ${warnings} warning(s)`);
}

function main(): void {
  handleHelp(process.argv.slice(2), USAGE);
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(USAGE);
    process.exit(2);
  }
  if (parsed.report === undefined) {
    console.error("--report is required");
    console.error(USAGE);
    process.exit(2);
  }

  try {
    if (!existsSync(parsed.report)) {
      console.error(`report not found: ${parsed.report}`);
      process.exit(2);
    }
    const text = readFileSync(parsed.report, "utf-8");
    const validation = validateReport(text);
    if (parsed.json) {
      console.log(JSON.stringify(validation, null, 2));
    } else {
      printHuman(validation);
    }
    if (parsed.reportOnly) process.exit(0);
    process.exit(validation.ok ? 0 : 1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}

main();
