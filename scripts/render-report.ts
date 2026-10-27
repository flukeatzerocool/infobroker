#!/usr/bin/env npx tsx
// render-report.ts — build tool: render a validated report Markdown file to a
// self-contained HTML document. No network; deterministic output.
//
// Exit codes: 0 = rendered; 1 = validation failure; 2 = fatal.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { handleHelp } from "./lib/args.js";
import { validateReport } from "../src/lib/report-manifest.js";
import { renderReportHtml, extractTitle } from "../src/lib/report-render.js";
import { reportToJson, reportToSourcesCsv, reportToClaimsCsv } from "../src/lib/report-export.js";

const USAGE = `render-report — render a report to self-contained HTML

Usage:
  render-report --report <report.md> [--out <file>] [--format html|json|csv] [--claims-out <file>] [--no-validate] [--help]

Options:
  --report <path>       Report Markdown file to render.
  --out <path>          Output path (default: stdout).
  --format <fmt>        html (default), json, or csv (Source Register).
  --claims-out <path>   Also write a claims CSV to this path.
  --no-validate         Skip the report contract check.
  --help, -h            Show this help (exit 0).

Exit codes: 0 = rendered; 1 = validation failure; 2 = fatal.
`;

function main(): void {
  handleHelp(process.argv.slice(2), USAGE);
  let report: string | undefined;
  let out: string | undefined;
  let format: "html" | "json" | "csv" = "html";
  let claimsOut: string | undefined;
  let validate = true;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--report") report = argv[++i];
    else if (arg.startsWith("--report=")) report = arg.slice("--report=".length);
    else if (arg === "--out") out = argv[++i];
    else if (arg.startsWith("--out=")) out = arg.slice("--out=".length);
    else if (arg === "--format") {
      const value = argv[++i];
      if (value !== "html" && value !== "json" && value !== "csv") {
        console.error(`invalid format: ${value}`);
        console.error(USAGE);
        process.exit(2);
      }
      format = value;
    } else if (arg.startsWith("--format=")) {
      const value = arg.slice("--format=".length);
      if (value !== "html" && value !== "json" && value !== "csv") {
        console.error(`invalid format: ${value}`);
        console.error(USAGE);
        process.exit(2);
      }
      format = value;
    } else if (arg === "--claims-out") claimsOut = argv[++i];
    else if (arg.startsWith("--claims-out=")) claimsOut = arg.slice("--claims-out=".length);
    else if (arg === "--no-validate") validate = false;
    else {
      console.error(`unknown flag: ${arg}`);
      console.error(USAGE);
      process.exit(2);
    }
  }
  if (report === undefined) {
    console.error("--report is required");
    console.error(USAGE);
    process.exit(2);
  }

  try {
    if (!existsSync(report)) {
      console.error(`report not found: ${report}`);
      process.exit(2);
    }
    const markdown = readFileSync(report, "utf-8");
    if (validate) {
      const validation = validateReport(markdown);
      if (!validation.ok) {
        for (const finding of validation.findings.filter((item) => item.level === "error")) {
          console.error(`ERROR [${finding.code}] ${finding.message}`);
        }
        process.exit(1);
      }
    }
    if (claimsOut !== undefined) {
      writeFileSync(claimsOut, reportToClaimsCsv(markdown), { encoding: "utf-8", mode: 0o600 });
    }
    const rendered =
      format === "json"
        ? JSON.stringify(reportToJson(markdown), null, 2)
        : format === "csv"
          ? reportToSourcesCsv(markdown)
          : renderReportHtml(markdown, { title: extractTitle(markdown) });
    if (out === undefined) process.stdout.write(rendered);
    else writeFileSync(out, rendered, { encoding: "utf-8", mode: 0o600 });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}

main();
