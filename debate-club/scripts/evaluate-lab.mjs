#!/usr/bin/env node
// evaluate-lab.mjs — informational: evaluate one Lab scenario transcript
// against its manifest entry. Mechanical hard gates (tokens in order, absent
// tokens, sections, Infobroker tool usage) plus an advisory critic note if a
// critic.txt is present in the work directory (produced with critic.md).
//
// Reuses the shared event-stream helpers. Emits one JSON result line to stdout.

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
const criticPath = join(outDir, "critic.txt");
const critic = existsSync(criticPath) ? readFileSync(criticPath, "utf8").trim().slice(0, 2000) : null;

process.stdout.write(
  JSON.stringify({ id: scenario.id, persona: scenario.persona, shape: scenario.shape, status, missing, absentFound, missingSections, audit, auditFails, toolsCalled: toolOrder.length, critic }) + "\n"
);
