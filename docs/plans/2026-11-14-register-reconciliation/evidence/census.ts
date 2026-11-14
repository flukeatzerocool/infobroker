// Evidence probe for the register-reconciliation increment.
// Not a gate: a read-only measurement recorded so the plan's counts are auditable.
// Run: npx tsx docs/plans/2026-11-14-register-reconciliation/evidence/census.ts
//
// The self-check pins only what the work itself cannot change: the number of
// finding rows and the number of distinct IDs. The Scheduled-roadmap set is
// printed, never asserted, because step 6 re-dispositions those rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../../../..");
const WORKLIST = join(ROOT, "docs/plans/2026-11-09-full-review-sweep/worklist.md");
const ROADMAP = join(ROOT, "ROADMAP.md");

const EXPECTED_ROWS = 276;
const EXPECTED_DISTINCT = 276;

const DISPOSITIONS = ["Resolved", "Closed-P3", "Scheduled-roadmap", "Deferred-"] as const;

function dispositionOf(cell: string): string {
  const plain = cell.replace(/[*`]/g, "").trim();
  for (const d of DISPOSITIONS) {
    if (plain.startsWith(d)) return d === "Deferred-" ? plain.split(/[\s—(]/)[0] : d;
  }
  return `UNCLASSIFIED:${plain.slice(0, 40)}`;
}

const lines = readFileSync(WORKLIST, "utf-8").split("\n");
const roadmap = readFileSync(ROADMAP, "utf-8");
const rows: Array<{ id: string; disposition: string }> = [];
for (const line of lines) {
  if (!line.startsWith("| F-")) continue;
  const cells = line.replace(/^\|/, "").replace(/\|$/, "").split("|");
  const id = cells[0]?.trim() ?? "";
  const disposition = dispositionOf(cells[cells.length - 1] ?? "");
  rows.push({ id, disposition });
}

const distinct = new Set(rows.map((r) => r.id));
const counts = new Map<string, number>();
for (const r of rows) counts.set(r.disposition, (counts.get(r.disposition) ?? 0) + 1);
const scheduled = rows.filter((r) => r.disposition === "Scheduled-roadmap").map((r) => r.id);
const homeless = scheduled.filter((id) => !roadmap.includes(id));

console.log(`rows: ${rows.length}`);
console.log(`distinct ids: ${distinct.size}`);
for (const [k, v] of [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
  console.log(`  ${k}: ${v}`);
}
console.log(`scheduled-roadmap (${scheduled.length}): ${scheduled.join(", ")}`);
console.log(`scheduled without a ROADMAP.md mention (${homeless.length}): ${homeless.join(", ") || "none"}`);

const problems: string[] = [];
if (rows.length !== EXPECTED_ROWS) problems.push(`rows ${rows.length} != ${EXPECTED_ROWS}`);
if (distinct.size !== EXPECTED_DISTINCT) problems.push(`distinct ${distinct.size} != ${EXPECTED_DISTINCT}`);
if (rows.length !== distinct.size) problems.push("duplicate finding IDs");

if (problems.length > 0) {
  console.error(`census self-check FAILED: ${problems.join("; ")}`);
  process.exit(1);
}
console.log("census self-check OK");
