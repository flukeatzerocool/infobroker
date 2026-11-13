// Evidence probe for the R9 traceability/taxonomy increment.
// Not a gate: a read-only measurement recorded so the plan's counts are auditable.
// Run: npx tsx docs/plans/2026-11-13-r9-traceability-taxonomy/evidence/measure-r9.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { detectClauseRequirements, clauseTagsFromPayload } from "../../../../src/clause-coverage.js";

const ROOT = join(import.meta.dirname, "../../../..");
const spec = readFileSync(join(ROOT, "infobroker.md"), "utf-8");

// Clause tags, same collection rule as scripts/validate-spec.ts:321-350.
const tags = new Map<string, Set<string>>();
function walk(dir: string): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith(".test.ts")) {
      const text = readFileSync(full, "utf-8");
      const re = /@implements\s+(.+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        for (const [req, set] of clauseTagsFromPayload(m[1])) {
          if (!tags.has(req)) tags.set(req, new Set());
          for (const t of set) tags.get(req)!.add(t);
        }
      }
    }
  }
}
walk(join(ROOT, "src"));

// §4 REQ bodies, same split as scripts/validate-spec.ts:147-156.
const s4 = spec.indexOf("## §4 Requirements");
const s5 = spec.indexOf("## §5 Build Process");
const body = spec.slice(s4, s5);
const reqBodyRe = /\*\*REQ-(\d{3}[a-z]?)\b[^*]*\*\*\n?/g;
const bodies: { id: string; body: string }[] = [];
{
  let m: RegExpExecArray | null;
  let lastEnd = 0;
  while ((m = reqBodyRe.exec(body)) !== null) {
    if (bodies.length) bodies[bodies.length - 1].body = body.slice(lastEnd, m.index);
    bodies.push({ id: `REQ-${m[1]}`, body: "" });
    lastEnd = m.index + m[0].length;
  }
  if (bodies.length) bodies[bodies.length - 1].body = body.slice(lastEnd);
}

// Same predicate as scripts/validate-spec.ts:62 (unanchored, whole file).
const allReqs = new Set<string>();
for (const m of spec.matchAll(/\*\*REQ-(\d{3}[a-z]?)\b[^*]*\*\*/g)) allReqs.add(`REQ-${m[1]}`);
const inS4 = new Set<string>();
for (const m of body.matchAll(/\*\*REQ-(\d{3}[a-z]?)\b[^*]*\*\*/g)) inS4.add(`REQ-${m[1]}`);
const outOfS4 = [...allReqs].filter((id) => !inS4.has(id));
console.log("== allReqs predicate ==");
console.log(`allReqs: ${allReqs.size}; §4 headings: ${inS4.size}; outside §4: ${outOfS4.length}${outOfS4.length ? ` (${outOfS4.join(", ")})` : ""}`);

const meta = new Set(["REQ-055", "REQ-077", "REQ-078", "REQ-080", "REQ-096"]);
const multi = bodies.filter((rb) => !meta.has(rb.id) && detectClauseRequirements(rb.body.trim()).orBranches >= 2);
console.log("== F-R9-A-1 clause coverage ==");
console.log(`§4 REQ bodies: ${bodies.length}; exempt meta REQs: ${meta.size}; bodies with orBranches >= 2: ${multi.length}`);
let oldFail = 0;
let newFail = 0;
for (const rb of multi) {
  const branches = detectClauseRequirements(rb.body.trim()).orBranches;
  const n = tags.get(rb.id)?.size ?? 0;
  if (n < 2) oldFail++;
  if (n < branches) newFail++;
  console.log(`  ${rb.id}: branches=${branches} tags=${n}${n < branches ? "  <-- per-branch FAIL" : ""}`);
}
console.log(`old rule (>=2) failures: ${oldFail}; per-branch rule failures: ${newFail}`);

// §9.5 gates and §D rows.
const mStart = spec.indexOf("### 9.5 REQ Manifest");
const mEnd = spec.indexOf("\n## ", mStart);
const manifest = new Map<string, string[]>();
for (const line of spec.slice(mStart, mEnd).split("\n")) {
  const m = line.match(/^\|\s*(REQ-\d{3}[a-z]?)\s*\|[^|]*\|[^|]*\|\s*([^|]+?)\s*\|/);
  if (m) manifest.set(m[1], m[2].split(",").map((s) => s.trim()).filter(Boolean));
}

const dStart = spec.indexOf("## §D Appendix: Feature Taxonomy");
const rows: { group: number; name: string; tools: string[]; reqs: string[]; gates: string[] }[] = [];
for (const line of spec.slice(dStart).split("\n")) {
  const cells = line.split("|").map((c) => c.trim());
  if (cells.length < 7 || !/^\d+$/.test(cells[1])) continue;
  rows.push({
    group: Number(cells[1]),
    name: cells[2],
    tools: [...cells[3].matchAll(/`([a-z0-9_]+)`/g)].map((m) => m[1]),
    reqs: [...cells[4].matchAll(/REQ-\d{3}[a-z]?/g)].map((m) => m[0]),
    gates: cells[5].split(",").map((s) => s.trim()).filter(Boolean),
  });
}

const homeCount = new Map<string, number[]>();
for (const r of rows) for (const t of r.tools) {
  if (!homeCount.has(t)) homeCount.set(t, []);
  homeCount.get(t)!.push(r.group);
}
const reqCount = new Map<string, number[]>();
for (const r of rows) for (const q of r.reqs) {
  if (!reqCount.has(q)) reqCount.set(q, []);
  reqCount.get(q)!.push(r.group);
}
console.log("\n== F-R9-C-1 taxonomy ==");
console.log(`§D rows: ${rows.length}; distinct tools: ${homeCount.size}; distinct REQs: ${reqCount.size}`);
const afterD = spec.slice(spec.indexOf("## §E Appendix"));
const intRows = afterD.split("\n").filter((l) => /^\|\s*\d+\s*\|/.test(l)).length;
console.log(`integer-first-cell table rows after §D: ${intRows}`);
console.log(`tools not in exactly one row: ${[...homeCount].filter(([, g]) => g.length !== 1).length}`);
console.log(`REQs not in exactly one row: ${[...reqCount].filter(([, g]) => g.length !== 1).length}`);
for (const r of rows) {
  const suppliers = new Map<string, string[]>();
  for (const q of r.reqs) for (const g of manifest.get(q) ?? []) {
    if (!suppliers.has(g)) suppliers.set(g, []);
    suppliers.get(g)!.push(q);
  }
  const union = [...suppliers.keys()].sort();
  const declared = [...new Set(r.gates)].sort();
  const same = union.length === declared.length && union.every((g, i) => g === declared[i]);
  console.log(
    `  group ${r.group} '${r.name}': declared [${declared.join(", ")}] union [${union.join(", ")}] ${same ? "MATCH" : "DRIFT"}`,
  );
  if (!same) for (const g of union) console.log(`    ${g} supplied by ${suppliers.get(g)!.join(", ")}`);
}
