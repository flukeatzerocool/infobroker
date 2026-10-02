#!/usr/bin/env node
// recommend.mjs — informational: derive evidence-linked recommendations from
// a run's report.json. Each recommendation carries a severity, its evidence,
// a proposed action, and a disposition. Exit 0 always unless --gate is given,
// in which case severe (P0/P1) open recommendations exit 1.
//
// Exit codes: 0 = report produced (no gate failure); 1 = --gate and severe
// open recommendation; 2 = usage/fatal.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const gate = args.includes("--gate");
const runDir = args.find((a) => !a.startsWith("--"));
if (!runDir) {
  console.error("usage: recommend.mjs <run_dir> [--gate]");
  process.exit(2);
}
const reportPath = join(runDir, "report.json");
if (!existsSync(reportPath)) {
  console.error(`recommend: no report at ${reportPath} (run report.mjs first)`);
  process.exit(2);
}
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const recs = [];
let n = 0;
const add = (severity, subject, finding, evidence, action, disposition = "open") =>
  recs.push({ id: `R-${String(++n).padStart(2, "0")}`, severity, subject, finding, evidence, proposed_action: action, disposition });

// P0: determinism broken — a fixture-host request went unmatched.
if (report.unmatched.length > 0) {
  add("P0", "arena/determinism", "Fixture-host requests went unmatched during replay.",
    report.unmatched.slice(0, 5), "Add fixtures for the unmatched URLs or pin the provider.", "open");
}

// P1: any UNEXPECTED error envelope (declared negative-path errors are fine).
for (const [tool, s] of Object.entries(report.tools)) {
  if (s.unexpected > 0) {
    add("P1", `tool/${tool}`, `${s.unexpected} unexpected [ERROR] call(s) of ${s.calls}.`,
      { error_codes: s.error_codes }, "Inspect the failing scenario(s) and the provider chain.", "open");
  }
}
for (const [scenario, s] of Object.entries(report.scenarios)) {
  if (s.unexpected > 0) {
    add("P1", `scenario/${scenario}`, `Scenario had ${s.unexpected} unexpected error call(s).`,
      { tools: s.tools }, "Reproduce with `run.sh arena` and inspect the transcript.", "open");
  }
}

// P2: coverage and performance.
if (report.coverage.missing_tools.length) {
  add("P2", "coverage/tools", `No Arena scenario covers: ${report.coverage.missing_tools.join(", ")}.`,
    report.coverage.missing_tools, "Add a scenario for each uncovered tool.", "open");
}
for (const [tool, s] of Object.entries(report.tools)) {
  if (s.p95_ms > 2000) {
    add("P2", `latency/${tool}`, `p95 latency ${s.p95_ms}ms exceeds the degraded threshold (2000ms).`,
      { p50_ms: s.p50_ms, p95_ms: s.p95_ms }, "Investigate provider latency or the degraded_latency_ms threshold.", "open");
  }
}
for (const tool of ["infobroker_search_web", "infobroker_get_citations"]) {
  const s = report.tools[tool];
  if (s && s.ok > 0 && s.avg_results === 0) {
    add("P2", `results/${tool}`, "Successful calls returned zero results.",
      { ok: s.ok, avg_results: s.avg_results }, "Check the fixture payload and the normalizer mapping.", "open");
  }
}

const open = recs.filter((r) => r.disposition === "open" && (r.severity === "P0" || r.severity === "P1" || r.severity === "P2"));
const out = { schema: "debate-club/recommendations@1", run_id: report.run_id, open_count: open.length, recommendations: recs };
writeFileSync(join(runDir, "recommendations.json"), JSON.stringify(out, null, 2) + "\n");

console.log(`debate-club recommendations — run ${report.run_id}`);
if (!recs.length) console.log("  (none)");
for (const r of recs) {
  console.log(`  [${r.severity}] ${r.id} ${r.subject}: ${r.finding}`);
  console.log(`       action: ${r.proposed_action}`);
}
console.log(`\n  OPEN (P0–P2): ${open.length}`);
console.log(`  recommendations: ${join(runDir, "recommendations.json")}`);

if (gate && open.length > 0) process.exit(1);
