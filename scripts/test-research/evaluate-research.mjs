#!/usr/bin/env node
// evaluate-research.mjs — Evaluate one research-scenario run against its
// manifest entry. Reads the opencode JSON event stream, extracts assistant
// text and tool-use order, then runs the hard gates (tokens, absent tokens,
// sections, tool audit) plus advisory citation sampling. Writes the final
// text excerpt to <dir>/final.txt and emits one JSON result line to stdout.

import { readFileSync, writeFileSync } from "node:fs";
import { extractAllAssistantText, extractFinalAssistantText, extractMcpToolCalls, extractToolOrder } from "../lib/event-stream.mjs";
import { sampleCitations } from "../lib/citations.mjs";

const [scenarioJsonPath, transcriptPath, outDir] = process.argv.slice(2);
const scenario = JSON.parse(readFileSync(scenarioJsonPath, "utf8"));

function extractUrls(text) {
  const urls = [];
  const re = /https?:\/\/[^\s"'<>()\[\]]+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    urls.push(m[0].replace(/[.,;:!?]+$/, ""));
  }
  return [...new Set(urls)];
}

const raw = readFileSync(transcriptPath, "utf8");
// Token scope is the scenario's stated contract. "session" (default) reads
// every assistant text block in the run, in order — a phase gate for a
// multi-turn gated analysis emits its tokens across turns. "final" reads only
// the last assistant message, the sign-off contract for a single-shot shape.
// Neither scope can be satisfied by user, system, or tool text: the stream
// helpers return assistant blocks only.
const tokenScope = scenario.token_scope === "final" ? "final" : "session";
const text = tokenScope === "final" ? extractFinalAssistantText(raw) : extractAllAssistantText(raw);
const toolOrder = extractToolOrder(raw);
// Code Mode routes MCP calls through the `execute` tool, so the names live in
// the embedded `tools.infobroker.<tool>` code rather than in direct tool
// events. Both signals count as engagement.
const mcpTools = extractMcpToolCalls(raw, "infobroker");

// A scenario may ask the harness to load a skill (`invoke`). Report both what
// was asked for and what the transcript actually shows, so a forced-contract
// run (D-134) is auditable. Advisory: the contract gates are unchanged.
const skillsLoaded = (() => {
  const ids = [];
  for (const line of raw.split("\n")) {
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    const tool = ev?.tool ?? ev?.part?.tool;
    const isToolUse = ev?.type === "tool_use" || ev?.part?.type === "tool";
    if (!isToolUse || tool !== "skill") continue;
    const id = ev?.input?.id ?? ev?.part?.state?.input?.id;
    if (typeof id === "string") ids.push(id);
  }
  return ids;
})();

writeFileSync(`${outDir}/final.txt`, text.trim().slice(-4000), "utf8");

// --- tokens (in order) ---
const tokens = scenario.tokens ?? [];
let lastIdx = -1;
let orderOk = true;
const missing = [];
for (const tok of tokens) {
  const idx = text.indexOf(tok);
  if (idx === -1) missing.push(tok);
  else if (idx < lastIdx) orderOk = false;
  else lastIdx = idx;
}

// --- absent tokens ---
const absentFound = [];
for (const tok of scenario.absent ?? []) {
  if (text.indexOf(tok) !== -1) absentFound.push(tok);
}

// --- sections (case-insensitive OR-match on needles) ---
const low = text.toLowerCase();
const missingSections = [];
for (const needle of scenario.sections ?? []) {
  const alts = needle.toLowerCase().split("|");
  if (!alts.some((a) => low.includes(a))) missingSections.push(needle);
}

// --- tool audit ---
const ta = scenario.tool_audit ?? {};
const audit = {};
if (ta.verify_claims) {
  audit.verify_claims = mcpTools.includes("verify_claims") || toolOrder.some((t) => t.includes("verify_claims"));
}
if (ta.uses_infobroker) {
  // Routing signal: the run engaged Infobroker tools at all. Built-in
  // websearch/webfetch are legitimately used as fallback on error and are
  // not a routing failure.
  // Two client namings exist: `infobroker_infobroker_*` and, as current
  // headless opencode emits, `infobroker.infobroker_*`. Either engages the MCP.
  audit.uses_infobroker =
    mcpTools.length > 0 ||
    toolOrder.some((t) => t.startsWith("infobroker_infobroker_") || t.startsWith("infobroker.infobroker_"));
}
// Hard audit gates are structural (Infobroker engagement).
// verify_claims is a "when contested" guidance, not a shape requirement — advisory.
const hardAuditKeys = ["uses_infobroker"];
const auditFails = Object.entries(audit).filter(([k, v]) => v === false && hardAuditKeys.includes(k)).map(([k]) => k);

// --- hard-gate verdict ---
const hardFailures = [...missing.map((t) => `token:${t}`), ...(orderOk ? [] : ["token-order"]), ...absentFound.map((t) => `absent:${t}`), ...missingSections.map((s) => `section:${s}`), ...auditFails.map((k) => `audit:${k}`)];
const status = hardFailures.length === 0 ? "pass" : "fail";

// --- citation sampling (advisory) ---
const urls = extractUrls(text);
const sample = (scenario.citation_sample ?? 0) > 0 ? urls.slice(0, scenario.citation_sample) : [];
const citationStart = Date.now();
const citations = sample.length > 0
  ? await sampleCitations(sample, { count: scenario.citation_sample, fetchImpl: fetch })
  : [];
const citationMs = Date.now() - citationStart;

process.stdout.write(JSON.stringify({
  id: scenario.id,
  label: scenario.label,
  shape: scenario.shape,
  mode: scenario.mode,
  invoked: scenario.invoke ?? [],
  skills_loaded: skillsLoaded,
  status,
  token_scope: tokenScope,
  missing,
  absentFound,
  missingSections,
  audit,
  auditFails,
  urlsFound: urls.length,
  citations,
  citation_ms: citationMs,
}) + "\n");
