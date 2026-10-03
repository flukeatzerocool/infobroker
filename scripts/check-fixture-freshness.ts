#!/usr/bin/env npx tsx
// check-fixture-freshness.ts — informational: report how long ago each recorded
// fixture was last verified against its live source, flagging fixtures older
// than the documented cadence. Implements the fixture-refresh cadence promised
// in infobroker.md §9.2. Deliberately NOT part of `npm run check` — it depends
// on the wall clock, and the deterministic gate suite must not. The push
// pipeline runs it so a stale fixture is surfaced before a release.
//
// Exit codes: 0 = report printed (always, including stale findings); 2 = fatal
// (meta file missing or unparseable).

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { handleHelp } from "./lib/args.js";

const ROOT = join(import.meta.dirname, "..");
const META = join(ROOT, "test-fixtures", "fixtures-meta.json");

const argv = process.argv.slice(2);
handleHelp(
  argv,
  `Usage: check-fixture-freshness.ts [--max-age-days <n>] [--now=<YYYY-MM-DD>]

Report fixture age against the documented refresh cadence.

Options:
  --max-age-days <n>  Override the cadence from fixtures-meta.json
  --now=<YYYY-MM-DD>  Reference date (default: today) for reproducible reports
  --help,-h           Show this message (exit 0)

Exit codes: 0 = report printed; 2 = fatal.
`
);

function flagValue(prefix: string): string | undefined {
  const arg = argv.find((a) => a.startsWith(`${prefix}=`) || a === prefix);
  if (!arg) return undefined;
  if (arg.includes("=")) return arg.slice(arg.indexOf("=") + 1);
  return argv[argv.indexOf(arg) + 1];
}

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "--max-age-days" || arg === "--now") {
    i++; // skip the flag's value
    continue;
  }
  if (arg === "--help" || arg === "-h" || arg.startsWith("--max-age-days=") || arg.startsWith("--now=")) continue;
  console.error(`Unknown flag: ${arg}`);
  process.exit(2);
}

if (!existsSync(META)) {
  console.error(`FATAL: fixture metadata missing at ${META}`);
  process.exit(2);
}

interface FixtureMeta {
  cadence_days: number;
  fixtures: Record<string, string>;
}

let meta: FixtureMeta;
try {
  meta = JSON.parse(readFileSync(META, "utf-8")) as FixtureMeta;
} catch (err) {
  console.error(`FATAL: cannot parse ${META}: ${(err as Error).message}`);
  process.exit(2);
}

const cadence = Number(flagValue("--max-age-days") ?? meta.cadence_days ?? 90);
const nowArg = flagValue("--now");
const now = nowArg ? new Date(`${nowArg}T00:00:00Z`) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error(`FATAL: invalid --now date: ${nowArg}`);
  process.exit(2);
}

const dayMs = 86_400_000;
let stale = 0;

console.log(`\ncheck-fixture-freshness — cadence ${cadence} day(s), reference ${now.toISOString().slice(0, 10)}\n`);
for (const [path, recordedAt] of Object.entries(meta.fixtures)) {
  const recorded = new Date(`${recordedAt}T00:00:00Z`);
  const age = Math.floor((now.getTime() - recorded.getTime()) / dayMs);
  const isStale = age > cadence;
  if (isStale) stale++;
  console.log(`  ${isStale ? "STALE" : "OK   "}  ${path} — ${age} day(s) old (recorded ${recordedAt})`);
}

console.log(`\n${stale} stale fixture(s). Refresh a stale fixture against its live source and bump its date in test-fixtures/fixtures-meta.json.\n`);
process.exit(0);
