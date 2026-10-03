#!/usr/bin/env npx tsx
// check-harness-expectations.ts — gate: every `tool_audit` expectation a harness
// scenario declares is registered with the behavior it encodes and is actually
// recognized by that harness's evaluator, so a silently-ignored or unregistered
// expectation fails a gate instead of a live run. Wired into `npm run check`.
//
// Exit codes: 0 = expectations conform; 1 = drift found; 2 = fatal.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { handleHelp } from "./lib/args.js";

const ROOT = join(import.meta.dirname, "..");

handleHelp(
  process.argv.slice(2),
  `Usage: check-harness-expectations.ts

Verify that every tool_audit key used in a harness manifest is registered
below (with the behavior it encodes) and is recognized by its evaluator.

Exit codes: 0 = conform; 1 = drift found; 2 = fatal.
`
);

interface Harness {
  name: string;
  manifest: string;
  evaluator: string;
  supported: Record<string, string>;
}

// The registry is the single source of truth for what each harness may assert.
// Adding an expectation means adding it here (with the behavior it encodes) and
// implementing it in the evaluator; the gate fails otherwise.
const HARNESSES: Harness[] = [
  {
    name: "debate-club Lab",
    manifest: "debate-club/lab-scenarios.json",
    evaluator: "debate-club/scripts/evaluate-lab.mjs",
    supported: {
      verify_claims: "the run called verify_claims (advisory; topic-dependent)",
      uses_infobroker: "the run engaged at least one infobroker_* tool",
    },
  },
  {
    name: "research suite",
    manifest: "test-fixtures/research/manifest.json",
    evaluator: "scripts/test-research/evaluate-research.mjs",
    supported: {
      verify_claims: "the run called verify_claims (advisory; topic-dependent)",
      uses_infobroker: "the run engaged at least one infobroker_* tool",
    },
  },
];

const violations: string[] = [];

for (const h of HARNESSES) {
  const before = violations.length;
  const manifestPath = join(ROOT, h.manifest);
  const evaluatorPath = join(ROOT, h.evaluator);
  if (!existsSync(manifestPath)) {
    violations.push(`${h.name}: manifest not found at ${h.manifest}`);
    continue;
  }
  if (!existsSync(evaluatorPath)) {
    violations.push(`${h.name}: evaluator not found at ${h.evaluator}`);
    continue;
  }

  const scenarios = JSON.parse(readFileSync(manifestPath, "utf-8")) as Array<{
    id?: string;
    tool_audit?: Record<string, unknown>;
  }>;
  const evaluatorSource = readFileSync(evaluatorPath, "utf-8");

  const used = new Set<string>();
  for (const scenario of scenarios) {
    for (const key of Object.keys(scenario.tool_audit ?? {})) used.add(key);
  }

  // Every declared expectation must be registered.
  for (const key of used) {
    if (!(key in h.supported)) {
      violations.push(
        `${h.name}: manifest declares unregistered tool_audit key \`${key}\` (add it to the registry with the behavior it encodes)`
      );
    }
  }

  // Every registered expectation must be recognized by the evaluator — and,
  // if a scenario uses it, must not be silently ignored.
  for (const key of Object.keys(h.supported)) {
    if (!evaluatorSource.includes(`ta.${key}`)) {
      violations.push(
        `${h.name}: registered key \`${key}\` is not recognized by ${h.evaluator}`
      );
    }
  }

  console.log(
    `  ${violations.length === before ? "OK " : "FAIL"} ${h.name}: ${used.size} expectation key(s) — ${[...used].sort().join(", ") || "(none)"}`
  );
}

if (violations.length > 0) {
  console.error("\nHarness expectations drifted from their evaluators:");
  for (const v of violations) console.error(`  FAIL  ${v}`);
  console.error(
    "\nEach tool_audit key must be registered in scripts/check-harness-expectations.ts and implemented in its evaluator."
  );
  process.exit(1);
}

console.log("check-harness-expectations — all harness expectations conform.");
process.exit(0);
