#!/usr/bin/env npx tsx
// check-non-goals.ts — gate: the scope non-goals list is intact and the roadmap
// points at it.
//
// Role: gate (wired into `npm run check`). Reads the `## Scope Non-goals` block
// from DECISIONS.md and the `## Non-goals` section from ROADMAP.md. Fails when
// the block is missing or empty, an entry cites a decision that is not a
// heading, a category is repeated, or the roadmap section stops being a short
// pointer to the block. Enforces list integrity and pointer binding, not
// capability absence.
//
// Exit codes: 0 = pass; 1 = findings; 2 = fatal (unreadable file, unknown flag).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { handleHelp } from "./lib/args.js";
import { evaluateNonGoals } from "./lib/non-goals.js";

const ROOT = join(import.meta.dirname, "..");
const DECISIONS = join(ROOT, "DECISIONS.md");
const ROADMAP = join(ROOT, "ROADMAP.md");

const USAGE = `check-non-goals — scope non-goals integrity gate

Usage:
  check-non-goals [--json] [--help]

Checks that DECISIONS.md has a \`## Scope Non-goals\` block with at least one
"- <category> — D-NNN" entry, that every cited decision is a heading in the
same file, that no category repeats, and that ROADMAP.md's \`## Non-goals\`
section is a pointer of at most two lines naming \`DECISIONS.md\` and the block.

Exit codes: 0 = pass; 1 = findings; 2 = fatal.
`;

const argv = process.argv.slice(2);
handleHelp(argv, USAGE);
for (const arg of argv) {
  if (arg !== "--json") {
    process.stderr.write(`check-non-goals: unknown flag ${arg}\n\n${USAGE}`);
    process.exit(2);
  }
}
const json = argv.includes("--json");

let decisions: string;
let roadmap: string;
try {
  decisions = readFileSync(DECISIONS, "utf8");
  roadmap = readFileSync(ROADMAP, "utf8");
} catch (err) {
  process.stderr.write(`check-non-goals: cannot read scope sources: ${(err as Error).message}\n`);
  process.exit(2);
}

const findings = evaluateNonGoals({ decisions, roadmap });

if (json) {
  process.stdout.write(
    `${JSON.stringify({ decisions: "DECISIONS.md", roadmap: "ROADMAP.md", findings }, null, 2)}\n`,
  );
} else if (findings.length > 0) {
  process.stdout.write(`scope non-goals — ${findings.length} finding(s):\n`);
  for (const finding of findings) {
    process.stdout.write(`  ${finding.line}: ${finding.rule}\n`);
  }
} else {
  process.stdout.write("  OK  scope non-goals: list intact, roadmap points at it\n");
}

process.exit(findings.length > 0 ? 1 : 0);
