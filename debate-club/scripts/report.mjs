#!/usr/bin/env node
// report.mjs — informational: roll up a run's telemetry.ndjson into a report
// (pass/error counts, per-tool latency percentiles, result counts, coverage)
// and write report.json next to the telemetry.
//
// Exit codes: 0 = report written; 2 = usage/fatal (no telemetry).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const runDir = process.argv[2];
if (!runDir) {
  console.error("usage: report.mjs <run_dir>");
  process.exit(2);
}
const telemetryPath = join(runDir, "telemetry.ndjson");
if (!existsSync(telemetryPath)) {
  console.error(`report: no telemetry at ${telemetryPath}`);
  process.exit(2);
}
const unmatchedPath = join(runDir, "unmatched.log");

const records = readFileSync(telemetryPath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const EXPECTED_TOOLS = [
  "infobroker_search_web",
  "infobroker_fetch_page",
  "infobroker_verify_claims",
  "infobroker_get_citations",
  "infobroker_inspect_providers",
  "infobroker_manage_kb",
  "infobroker_reload_config",
];

function pct(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

const tools = {};
const scenarios = {};
const errorCodes = {};
for (const r of records) {
  // An error is "unexpected" unless the scenario declared it (negative tests).
  const unexpected = r.status === "error" && r.error_code !== r.expected_error_code;
  const t = (tools[r.tool] ??= { calls: 0, ok: 0, error: 0, unexpected: 0, latencies: [], results: [], error_codes: [] });
  t.calls++;
  t[r.status]++;
  if (unexpected) t.unexpected++;
  t.latencies.push(r.latency_ms);
  t.results.push(r.results_count);
  if (r.error_code) {
    t.error_codes.push(r.error_code);
    errorCodes[r.error_code] = (errorCodes[r.error_code] || 0) + 1;
  }
  const s = (scenarios[r.scenario_id] ??= { calls: 0, error: 0, unexpected: 0, tools: new Set() });
  s.calls++;
  if (r.status === "error") s.error++;
  if (unexpected) s.unexpected++;
  s.tools.add(r.tool);
}

const toolSummary = {};
for (const [name, t] of Object.entries(tools)) {
  toolSummary[name] = {
    calls: t.calls,
    ok: t.ok,
    error: t.error,
    unexpected: t.unexpected,
    error_codes: t.error_codes,
    p50_ms: pct(t.latencies, 50),
    p95_ms: pct(t.latencies, 95),
    avg_results: Number((t.results.reduce((a, b) => a + b, 0) / Math.max(1, t.results.length)).toFixed(2)),
  };
}
const scenarioSummary = {};
for (const [name, s] of Object.entries(scenarios)) {
  scenarioSummary[name] = { calls: s.calls, error: s.error, unexpected: s.unexpected, tools: [...s.tools].sort() };
}

const covered = Object.keys(tools).sort();
const report = {
  schema: "debate-club/report@1",
  run_id: records[0]?.run_id ?? "unknown",
  fingerprint: records[0]?.fingerprint ?? {},
  totals: {
    calls: records.length,
    ok: records.filter((r) => r.status === "ok").length,
    error: records.filter((r) => r.status === "error").length,
    unexpected_error: records.filter((r) => r.status === "error" && r.error_code !== r.expected_error_code).length,
  },
  error_codes: errorCodes,
  tools: toolSummary,
  scenarios: scenarioSummary,
  coverage: {
    expected_tools: EXPECTED_TOOLS,
    covered_tools: covered,
    missing_tools: EXPECTED_TOOLS.filter((t) => !covered.includes(t)),
  },
  unmatched: existsSync(unmatchedPath)
    ? readFileSync(unmatchedPath, "utf8").split("\n").filter(Boolean)
    : [],
};

writeFileSync(join(runDir, "report.json"), JSON.stringify(report, null, 2) + "\n");

console.log(`debate-club report — run ${report.run_id}`);
console.log(`  calls: ${report.totals.calls}  ok: ${report.totals.ok}  error: ${report.totals.error}`);
for (const [name, s] of Object.entries(toolSummary)) {
  console.log(`  ${name.padEnd(28)} calls=${s.calls} err=${s.error} p50=${s.p50_ms}ms p95=${s.p95_ms}ms avg_results=${s.avg_results}`);
}
if (report.coverage.missing_tools.length) {
  console.log(`  missing tool coverage: ${report.coverage.missing_tools.join(", ")}`);
}
console.log(`  report: ${join(runDir, "report.json")}`);
