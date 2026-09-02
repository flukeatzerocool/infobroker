#!/usr/bin/env node
// evaluate-research.mjs — Evaluate one research-scenario run against its
// manifest entry. Reads the opencode JSON event stream, extracts assistant
// text and tool-use order, then runs the hard gates (tokens, absent tokens,
// sections, tool audit) plus advisory citation sampling. Writes the final
// text excerpt to <dir>/final.txt and emits one JSON result line to stdout.

import { readFileSync, writeFileSync } from "node:fs";
import { extractAssistantText, extractToolOrder } from "../lib/event-stream.mjs";

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
const text = extractAssistantText(raw);
const toolOrder = extractToolOrder(raw);

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
if (ta.kb_before_search) {
  const kb = toolOrder.findIndex((t) => t.includes("_kb"));
  const ws = toolOrder.findIndex((t) => t.includes("web_search"));
  audit.kb_before_search = kb !== -1 && (ws === -1 || kb < ws);
}
if (ta.verify_claims) {
  audit.verify_claims = toolOrder.some((t) => t.includes("verify_claims"));
}
if (ta.uses_infobroker) {
  // Routing signal: the run engaged Infobroker tools at all. Built-in
  // websearch/webfetch are legitimately used as fallback on error and are
  // not a routing failure.
  audit.uses_infobroker = toolOrder.some((t) => t.startsWith("infobroker_infobroker_"));
}
// Hard audit gates are structural (kb-before-search, Infobroker engagement).
// verify_claims is a "when contested" guidance, not a shape requirement — advisory.
const hardAuditKeys = ["kb_before_search", "uses_infobroker"];
const auditFails = Object.entries(audit).filter(([k, v]) => v === false && hardAuditKeys.includes(k)).map(([k]) => k);

// --- hard-gate verdict ---
const hardFailures = [...missing.map((t) => `token:${t}`), ...(orderOk ? [] : ["token-order"]), ...absentFound.map((t) => `absent:${t}`), ...missingSections.map((s) => `section:${s}`), ...auditFails.map((k) => `audit:${k}`)];
const status = hardFailures.length === 0 ? "pass" : "fail";

// --- citation sampling (advisory) ---
const urls = extractUrls(text);
const sample = (scenario.citation_sample ?? 0) > 0 ? urls.slice(0, scenario.citation_sample) : [];
const citations = [];
for (const u of sample) {
  let kind = "error";
  try {
    const resp = await (async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      try { return await fetch(u, { method: "HEAD", redirect: "follow", signal: ctrl.signal }); }
      catch { return await fetch(u, { method: "GET", redirect: "follow", signal: ctrl.signal }); }
      finally { clearTimeout(t); }
    })();
    if (resp.status >= 200 && resp.status < 400) kind = "reachable";
    else if (resp.status === 403 || resp.status === 429) kind = "blocked";
    else if (resp.status === 404 || resp.status === 410) kind = "invalid";
    else kind = `status-${resp.status}`;
  } catch {
    kind = "error";
  }
  citations.push({ url: u, status: kind });
}

process.stdout.write(JSON.stringify({
  id: scenario.id,
  label: scenario.label,
  shape: scenario.shape,
  mode: scenario.mode,
  status,
  missing,
  absentFound,
  missingSections,
  audit,
  auditFails,
  urlsFound: urls.length,
  citations,
}) + "\n");
