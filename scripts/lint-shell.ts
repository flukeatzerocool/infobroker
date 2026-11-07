#!/usr/bin/env npx tsx
// lint-shell.ts — informational: run shellcheck over the shell entry points
// the release pipeline and git hooks execute (scripts/**/*.sh,
// scripts/pipeline/*.sh, .githooks/*). shellcheck is not a declared
// devDependency, so an absent binary is reported and skipped rather than
// treated as a failure — the script stays portable and is never wired into
// `npm run check`.
//
// Role: informational (reports findings; not part of the gate suite).
// Exit codes: 0 = clean, or shellcheck absent; 1 = findings under --strict,
// or an unknown flag; 2 = fatal unexpected error.
//
// Usage: npx tsx scripts/lint-shell.ts [--strict] [--help]

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { handleHelp } from "./lib/args.js";

const USAGE = `Usage: npx tsx scripts/lint-shell.ts [--strict]

  --strict   Exit 1 when shellcheck reports findings (default: report only).
  --help     Show this message.
`;

const ROOT = join(import.meta.dirname, "..");
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".runs", "coverage"]);

handleHelp(process.argv, USAGE);

const args = process.argv.slice(2);
const unknown = args.filter((arg) => arg !== "--strict");
if (unknown.length > 0) {
  console.error(`Unknown flag: ${unknown[0]}`);
  console.error(USAGE);
  process.exit(1);
}
const strict = args.includes("--strict");

function collectShell(dir: string, out: string[], recurse: boolean): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (recurse) collectShell(full, out, true);
    } else if (entry.endsWith(".sh")) {
      out.push(full);
    }
  }
}

const files: string[] = [];
collectShell(join(ROOT, "scripts"), files, true);
const hooksDir = join(ROOT, ".githooks");
if (existsSync(hooksDir)) {
  for (const entry of readdirSync(hooksDir)) {
    const full = join(hooksDir, entry);
    if (statSync(full).isFile()) files.push(full);
  }
}
files.sort();

const probe = spawnSync("shellcheck", ["--version"], { encoding: "utf8" });
if (probe.error || probe.status !== 0) {
  console.log(
    `shellcheck not installed — skipping ${files.length} shell file(s).`,
  );
  console.log(
    "Install it to lint the pipeline before changing it: https://www.shellcheck.net/",
  );
  process.exit(0);
}

let findings = 0;
for (const file of files) {
  const rel = file.slice(ROOT.length + 1);
  try {
    execFileSync("shellcheck", ["-f", "gcc", "-S", "warning", file], {
      encoding: "utf8",
      stdio: "pipe",
    });
    console.log(`  OK    ${rel}`);
  } catch (err) {
    const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? "";
    const lines = stdout.trim().split("\n").filter(Boolean);
    findings += lines.length;
    console.log(`  WARN  ${rel} (${lines.length} finding(s))`);
    for (const line of lines.slice(0, 10)) console.log(`        ${line}`);
    if (lines.length > 10) console.log(`        ... ${lines.length - 10} more`);
  }
}

console.log(
  `\nshellcheck: ${findings} finding(s) across ${files.length} file(s).`,
);
if (strict && findings > 0) process.exit(1);
