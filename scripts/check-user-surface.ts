#!/usr/bin/env npx tsx
// check-user-surface.ts — gate: the user-facing evidence surface agrees with
// the spec and the shipped configuration. Checks persona↔§D group coverage,
// persona↔scenario coverage, the defaults register↔config.json agreement, and
// the §1 goal↔goal-matrix agreement (REQ-055, REQ-078).
//
// Exit codes: 0 = pass (or --report); 1 = findings; 2 = fatal unexpected error.
// Usage: npx tsx scripts/check-user-surface.ts [--report] [--help]

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { handleHelp } from "./lib/args.js";
import { checkUserSurface, type Persona, type Scenario } from "../src/lib/user-surface.js";

const ROOT = join(import.meta.dirname, "..");

const USAGE = `check-user-surface — audience, scenario, and defaults-register coverage

Usage:
  npx tsx scripts/check-user-surface.ts [--report]

Options:
  --report   Print findings and always exit 0 (informational)
  --help     Show this help (exit 0)

Exit codes: 0 = pass (or report); 1 = findings; 2 = fatal.
`;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8")) as T;
}

function readText(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function main(): void {
  const argv = process.argv.slice(2);
  handleHelp(argv, USAGE);
  const report = argv.includes("--report");
  const unknown = argv.filter((arg) => arg !== "--report" && arg !== "--help" && arg !== "-h");
  if (unknown.length > 0) {
    console.error(`check-user-surface: unknown argument(s): ${unknown.join(" ")}`);
    process.exit(2);
  }

  const findings = checkUserSurface({
    specText: readText("infobroker.md"),
    config: readJson<Record<string, unknown>>("config.json"),
    personas: readJson<Persona[]>("debate-club/personas.json"),
    labScenarios: readJson<Scenario[]>("debate-club/lab-scenarios.json"),
    researchScenarios: readJson<Scenario[]>("test-fixtures/research/manifest.json"),
    defaultsRegister: readText("docs/defaults-register.md"),
    goalMatrix: readText("docs/goal-evidence-matrix.md"),
  });

  if (findings.length === 0) {
    console.log("check-user-surface: 0 finding(s).");
    return;
  }
  for (const finding of findings) {
    console.log(`${finding.code}: ${finding.message}`);
  }
  console.log(`check-user-surface: ${findings.length} finding(s).`);
  if (!report) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(`check-user-surface: fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
