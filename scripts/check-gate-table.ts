#!/usr/bin/env npx tsx
/**
 * check-gate-table.ts — verify the AGENTS.md gates table against the manifest. [gate]
 *
 * Purpose: the AGENTS.md table is what a maintainer reads before running
 * `npm run check`. If it drifts from `scripts/lib/gate-manifest.ts`, the docs
 * promise gates that do not run or omit gates that do. The table is generated
 * deterministically (`run-gates --list --format md`) and compared byte for
 * byte between the `gates:begin` / `gates:end` markers.
 *
 * Usage: npx tsx scripts/check-gate-table.ts [--help]
 * Exit codes: 0 = table matches the manifest, 1 = drift, 2 = fatal.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { handleHelp, rejectUnknown } from "./lib/args.js";
import { renderGatesTable } from "./lib/gate-manifest.js";

const ROOT = join(import.meta.dirname, "..");
const AGENTS = join(ROOT, "AGENTS.md");
const BEGIN = "<!-- gates:begin -->";
const END = "<!-- gates:end -->";

const USAGE = `Usage: npx tsx scripts/check-gate-table.ts [--help]

Compares the AGENTS.md gates table (between the gates:begin / gates:end
markers) with scripts/lib/gate-manifest.ts. Regenerate with:

  npx tsx scripts/run-gates.ts --list --format md

  --help   Show this message.
`;

function normalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function main(): number {
  const argv = process.argv.slice(2);
  handleHelp(argv, USAGE);
  rejectUnknown(argv, new Set(["--help", "-h"]), USAGE);

  if (!existsSync(AGENTS)) {
    process.stderr.write("check-gate-table: AGENTS.md not found\n");
    return 2;
  }
  const text = readFileSync(AGENTS, "utf-8");
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    process.stderr.write(
      `check-gate-table: ${BEGIN} / ${END} markers not found in AGENTS.md\n`,
    );
    return 1;
  }
  const actual = normalize(text.slice(start + BEGIN.length, end));
  const expected = normalize(renderGatesTable());

  if (actual !== expected) {
    process.stderr.write("check-gate-table: AGENTS.md gates table is stale.\n");
    process.stderr.write("Regenerate it with: npx tsx scripts/run-gates.ts --list --format md\n\n");
    process.stderr.write(`${BEGIN}\n${renderGatesTable()}\n${END}\n`);
    return 1;
  }

  process.stdout.write(`check-gate-table: OK (${renderGatesTable().split("\n").length - 2} gates)\n`);
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  process.stderr.write(`check-gate-table: fatal: ${(error as Error).message}\n`);
  process.exit(2);
}
