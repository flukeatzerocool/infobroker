#!/usr/bin/env npx tsx
// check-gate-coverage.ts — gate: every REQ whose manifest gate includes G1 is
// exercised by at least one test file (`*.test.ts` under src/ or debate-club/),
// or is recorded as a G1 exemption with a rationale. Enforces REQ-055's
// bidirectional traceability for the G1 rung: a REQ may not advertise an
// integration gate that no test backs. Wired into `npm run check`.
//
// Exit codes: 0 = every G1 REQ is covered, exempt, or waived; 1 = uncovered
// G1 REQ(s); 2 = fatal (spec or manifest unreadable).

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { handleHelp } from "./lib/args.js";

const ROOT = join(import.meta.dirname, "..");
const SPEC = join(ROOT, "infobroker.md");
const DECISIONS = join(ROOT, "DECISIONS.md");

handleHelp(
  process.argv.slice(2),
  `Usage: check-gate-coverage.ts [--report]

Reconcile every manifest REQ whose gate includes G1 against test-file
\`@implements\` citations. A G1 REQ with no test citation must appear in the
G1_EXEMPT registry (with a rationale) or in DECISIONS.md \`## Spec Waivers\`.

Options:
  --report   Print the classification and always exit 0 (informational)
  --help,-h  Show this message (exit 0)

Exit codes: 0 = covered; 1 = uncovered G1 REQ(s); 2 = fatal.
`
);

// ── G1 exemption registry ───────────────────────────────────────────────────
//
// A REQ whose G1 rung is genuinely verified by a structural/file-presence or
// release step rather than by a unit/integration test belongs here. Every key
// must exist in the manifest and carry a rationale; a stale entry fails the
// gate so the registry cannot rot.
const G1_EXEMPT: Readonly<Record<string, string>> = {
  "REQ-091": "release step: registry publication is verified by checkRegistryArtifacts (G3), not a test",
};

// ── Manifest parse ──────────────────────────────────────────────────────────

interface ManifestRow {
  req: string;
  gates: string[];
}

function parseManifest(specText: string): ManifestRow[] {
  const idx = specText.indexOf("## 9.5 REQ Manifest");
  if (idx === -1) return [];
  const rest = specText.slice(idx + 1);
  const nextHeading = rest.search(/^##\s/m);
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);

  const rows: ManifestRow[] = [];
  const rowRe = /^\|\s*(REQ-\d{3}[a-z]?)\s*\|[^|]*\|[^|]*\|\s*([^|]+?)\s*\|/gm;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(section)) !== null) {
    rows.push({ req: m[1], gates: (m[2].match(/G[0-3]/g) ?? []) });
  }
  return rows;
}

// ── Test citation scan ──────────────────────────────────────────────────────

function collectTests(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist" || entry === ".runs") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) collectTests(full, out);
    else if (entry.endsWith(".test.ts")) out.push(full);
  }
}

function citedReqsInTests(): Set<string> {
  const files: string[] = [];
  collectTests(join(ROOT, "src"), files);
  collectTests(join(ROOT, "debate-club", "src"), files);

  const cited = new Set<string>();
  for (const file of files) {
    const text = readFileSync(file, "utf-8");
    for (const line of text.split("\n")) {
      if (!line.includes("@implements")) continue;
      for (const m of line.matchAll(/REQ-\d{3}[a-z]?/g)) cited.add(m[0]);
    }
  }
  return cited;
}

// ── Waivers ─────────────────────────────────────────────────────────────────

function waivedReqs(): Set<string> {
  const waived = new Set<string>();
  if (!existsSync(DECISIONS)) return waived;
  const text = readFileSync(DECISIONS, "utf-8");
  // Anchor on the actual `## Spec Waivers` heading at line start. A bare
  // indexOf matches a backticked cross-reference in earlier narrative text and
  // would sweep unrelated REQ IDs into the waiver set.
  const headingRe = /^## Spec Waivers\s*$/m;
  const heading = headingRe.exec(text);
  if (heading === null) return waived;
  const rest = text.slice(heading.index + heading[0].length);
  const next = rest.search(/^##\s/m);
  const section = next === -1 ? rest : rest.slice(0, next);
  for (const m of section.matchAll(/REQ-\d{3}[a-z]?/g)) waived.add(m[0]);
  return waived;
}

// ── Main ────────────────────────────────────────────────────────────────────

let specText: string;
try {
  specText = readFileSync(SPEC, "utf-8");
} catch (err) {
  console.error(`FATAL: cannot read ${SPEC}: ${(err as Error).message}`);
  process.exit(2);
}

const rows = parseManifest(specText);
if (rows.length === 0) {
  console.error("FATAL: no REQ manifest rows found in infobroker.md §9.5");
  process.exit(2);
}

const cited = citedReqsInTests();
const waived = waivedReqs();

const g1 = rows.filter((r) => r.gates.includes("G1"));

// Registry integrity: every exemption must name a real manifest REQ.
const rowIds = new Set(rows.map((r) => r.req));
for (const req of Object.keys(G1_EXEMPT)) {
  if (!rowIds.has(req)) {
    console.error(`G1_EXEMPT entry '${req}' does not appear in the §9.5 manifest — remove the stale entry`);
    process.exit(1);
  }
}

const uncovered: ManifestRow[] = [];
let satisfied = 0;
let exempt = 0;
let waivedCount = 0;

for (const row of g1) {
  if (cited.has(row.req)) {
    satisfied++;
  } else if (G1_EXEMPT[row.req] !== undefined) {
    exempt++;
  } else if (waived.has(row.req)) {
    waivedCount++;
  } else {
    uncovered.push(row);
  }
}

for (const arg of process.argv.slice(2)) {
  if (arg !== "--report" && arg !== "--help" && arg !== "-h") {
    console.error(`Unknown flag: ${arg}`);
    process.exit(1);
  }
}

if (process.argv.includes("--report")) {
  console.log(`\ncheck-gate-coverage (report) — ${g1.length} G1 REQ(s)`);
  console.log(`  satisfied by a test citation: ${satisfied}`);
  console.log(`  registry-exempt:              ${exempt}`);
  console.log(`  waived:                       ${waivedCount}`);
  console.log(`  UNCOVERED:                    ${uncovered.length}`);
  for (const row of uncovered) {
    console.log(`    ${row.req}  (${cited.has(row.req) ? "cited" : "no test citation"})`);
  }
  process.exit(0);
}

if (uncovered.length > 0) {
  console.error(`\ncheck-gate-coverage — ${uncovered.length} G1 REQ(s) with no test citation:\n`);
  for (const row of uncovered) console.error(`  ${row.req}`);
  console.error(
    "\nAdd an `@implements REQ-NNN` citation to a test that exercises the REQ, add a rationale\n" +
      "to the G1_EXEMPT registry in scripts/check-gate-coverage.ts, or record the REQ in\n" +
      "DECISIONS.md `## Spec Waivers`."
  );
  process.exit(1);
}

console.log(`\ncheck-gate-coverage — ${g1.length} G1 REQ(s): ${satisfied} cited, ${exempt} exempt, ${waivedCount} waived.\n`);
process.exit(0);
