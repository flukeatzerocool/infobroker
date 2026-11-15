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
import { extractAssistantText, extractMcpToolCalls, extractToolOrder } from "../../scripts/lib/event-stream.mjs";

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

// Canonical Infobroker tool calls for coverage rollup. Code Mode invokes MCP
// tools inside `execute` code (`tools.infobroker.<tool>`), so the old
// direct-tool naming match alone would report zero calls for a run that used
// the server heavily. extractMcpToolCalls reads both shapes.
const tools = extractMcpToolCalls(raw, "infobroker");
const profile = process.env.DEBATE_PROFILE || scenario.profile || null;
const rubricLens = scenario.rubric_lens ?? null;

// Tool-result envelopes carry the bounded notices and error codes. Scan the
// result text (direct tool output or an execute wrapper) for a JSON body; a
// parse failure is ignored because non-JSON tool output is not an envelope.
function toolBodies(stream) {
  const bodies = [];
  for (const line of stream.split("\n")) {
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    const part = ev?.part ?? ev;
    const out = part?.state?.output ?? part?.output ?? ev?.output;
    if (typeof out !== "string") continue;
    const text = out.startsWith("[OK] ") || out.startsWith("[ERROR] ")
      ? out.slice(out.indexOf("] ") + 2)
      : out;
    try { bodies.push(JSON.parse(text)); } catch { /* not an envelope */ }
  }
  return bodies;
}
const bodies = toolBodies(raw);
const noticeCounts = bodies
  .map((body) => (Array.isArray(body?.notices) ? body.notices.length : 0))
  .filter((n) => n > 0);
const maxNotices = noticeCounts.length ? Math.max(...noticeCounts) : 0;
const errorCodes = bodies
  .map((body) => body?.error?.code)
  .filter((code) => typeof code === "string");

// Onboarding friction: how many assistant text blocks arrived before the
// first tool call. Zero means the agent reached for a tool immediately.
let firstToolTurn = 0;
for (const line of raw.split("\n")) {
  let ev;
  try { ev = JSON.parse(line); } catch { continue; }
  const part = ev?.part;
  if (part?.type === "text" && (part.role === undefined || part.role === "assistant")) firstToolTurn++;
  else if (ev?.type === "tool_use" || part?.type === "tool") break;
}


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
if (ta.verify_claims) audit.verify_claims = tools.includes("infobroker_verify_claims") || toolOrder.some((t) => t.includes("verify_claims"));
if (ta.uses_infobroker) audit.uses_infobroker = tools.length > 0;
const hardAudit = ["uses_infobroker"];
const auditFails = Object.entries(audit).filter(([k, v]) => v === false && hardAudit.includes(k)).map(([k]) => k);

const hardFailures = [
  ...missing.map((t) => `token:${t}`),
  ...(orderOk ? [] : ["token-order"]),
  ...absentFound.map((t) => `absent:${t}`),
  ...missingSections.map((s) => `section:${s}`),
  ...auditFails.map((k) => `audit:${k}`),
];
if (typeof scenario.expect_notices_max === "number" && maxNotices > scenario.expect_notices_max) {
  hardFailures.push(`notices:${maxNotices}>${scenario.expect_notices_max}`);
}
if (typeof scenario.expect_error_code === "string" && !errorCodes.includes(scenario.expect_error_code)) {
  hardFailures.push(`error-code:${scenario.expect_error_code}`);
}
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
    profile,
    rubric_lens: rubricLens,
    status,
    missing,
    absentFound,
    missingSections,
    audit,
    auditFails,
    notices_max: maxNotices,
    error_codes: errorCodes,
    first_tool_turn: firstToolTurn,
    toolsCalled: toolOrder.length,
    tools,
    critic,
    critic_verdict: criticVerdict,
    critic_status: criticStatus,
    critic_error: criticError,
  }) + "\n"
);
