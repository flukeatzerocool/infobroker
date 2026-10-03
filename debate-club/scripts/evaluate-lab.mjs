#!/usr/bin/env node
// evaluate-lab.mjs — informational: evaluate one Lab scenario transcript
// against its manifest entry. Mechanical hard gates (tokens in order, absent
// tokens, sections, Infobroker tool usage) plus an advisory critic result if a
// critic.txt is present in the work directory (produced with critic.md).
//
// Emits one JSON result line to stdout: the mechanical gates, the normalized
// Infobroker tool names the run called (for coverage rollup), and the critic
// artifact as an explicit status (ok|empty|malformed|not-run) with the parsed
// verdict — never a bare null, so missing feedback cannot vanish silently.
// Exit codes: 0 = evaluated; 2 = usage error.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractAssistantText, extractToolOrder } from "../../scripts/lib/event-stream.mjs";

const [scenarioPath, transcriptPath, outDir] = process.argv.slice(2);
if (!scenarioPath || !transcriptPath || !outDir) {
  console.error("usage: evaluate-lab.mjs <scenario.json> <transcript> <outDir>");
  process.exit(2);
}
const scenario = JSON.parse(readFileSync(scenarioPath, "utf8"));
const raw = readFileSync(transcriptPath, "utf8");
const text = extractAssistantText(raw);
const toolOrder = extractToolOrder(raw);
writeFileSync(join(outDir, "final.txt"), text.trim().slice(-4000), "utf8");

// Canonical Infobroker tool names for coverage rollup: the MCP server is keyed
// `infobroker`, so its calls surface as `infobroker_infobroker_<tool>`.
const INFOBROKER_CALL = /^infobroker_infobroker_/;
const tools = [
  ...new Set(toolOrder.filter((t) => INFOBROKER_CALL.test(t)).map((t) => t.replace(INFOBROKER_CALL, "infobroker_"))),
].sort();

const missing = [];
let lastIdx = -1;
let orderOk = true;
for (const tok of scenario.tokens ?? []) {
  const idx = text.indexOf(tok);
  if (idx === -1) missing.push(tok);
  else if (idx < lastIdx) orderOk = false;
  else lastIdx = idx;
}
const absentFound = (scenario.absent ?? []).filter((t) => text.includes(t));
const low = text.toLowerCase();
const missingSections = (scenario.sections ?? []).filter(
  (needle) => !needle.toLowerCase().split("|").some((alt) => low.includes(alt))
);

const ta = scenario.tool_audit ?? {};
const audit = {};
if (ta.verify_claims) audit.verify_claims = toolOrder.some((t) => t.includes("verify_claims"));
if (ta.uses_infobroker) audit.uses_infobroker = toolOrder.some((t) => t.startsWith("infobroker_infobroker_"));
const hardAudit = ["uses_infobroker"];
const auditFails = Object.entries(audit).filter(([k, v]) => v === false && hardAudit.includes(k)).map(([k]) => k);

const hardFailures = [
  ...missing.map((t) => `token:${t}`),
  ...(orderOk ? [] : ["token-order"]),
  ...absentFound.map((t) => `absent:${t}`),
  ...missingSections.map((s) => `section:${s}`),
  ...auditFails.map((k) => `audit:${k}`),
];
const status = hardFailures.length === 0 ? "pass" : "fail";

// Advisory critic. The machine-scorable verdict block is the LAST part of a
// critic.md reply, so parse it from the full text even when the stored body is
// capped — a head-only slice would drop it.
function parseVerdict(t) {
  const v = t.match(/CRITIC VERDICT:\s*([a-z]+)/i);
  if (!v) return null;
  const num = (re) => {
    const m = t.match(re);
    return m ? Number(m[1]) : null;
  };
  const weak = t.match(/WEAKEST LINK:\s*(.+)/i);
  return {
    verdict: v[1].toLowerCase(),
    unsourced: num(/UNSOURCED CLAIMS:\s*(\d+)/i),
    overstated: num(/OVERSTATED CLAIMS:\s*(\d+)/i),
    weakest_link: weak ? weak[1].trim().slice(0, 300) : null,
  };
}
const criticPath = join(outDir, "critic.txt");
const criticErrPath = join(outDir, "critic.err");
let critic = null;
let criticVerdict = null;
let criticStatus = "not-run";
const criticError = existsSync(criticErrPath)
  ? readFileSync(criticErrPath, "utf8").trim().slice(0, 500) || null
  : null;
if (existsSync(criticPath)) {
  const full = readFileSync(criticPath, "utf8").trim();
  if (!full) {
    criticStatus = "empty";
  } else {
    critic = full.slice(0, 8000);
    criticVerdict = parseVerdict(full);
    criticStatus = criticVerdict ? "ok" : "malformed";
  }
}

process.stdout.write(
  JSON.stringify({
    id: scenario.id,
    persona: scenario.persona,
    shape: scenario.shape,
    status,
    missing,
    absentFound,
    missingSections,
    audit,
    auditFails,
    toolsCalled: toolOrder.length,
    tools,
    critic,
    critic_verdict: criticVerdict,
    critic_status: criticStatus,
    critic_error: criticError,
  }) + "\n"
);
