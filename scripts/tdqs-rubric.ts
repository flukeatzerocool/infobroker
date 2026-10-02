#!/usr/bin/env npx tsx
// tdqs-rubric.ts — informational: run the TDQS 1.2 LLM rubric (Appendix A) and
// server-coherence rubric (Appendix B) against the live tool surface, then
// compute per-tool TDQS, tiers, smells, and the server rollups. This is the
// stage-3 complement to scripts/check-tdqs.ts and is NOT part of `npm run check`
// (it needs network access and a model endpoint).
//
// Configuration (env):
//   INFOBROKER_TDQS_ENDPOINT   OpenAI-compatible chat-completions URL
//                              (falls back to OPENAI_BASE_URL + /chat/completions)
//   INFOBROKER_TDQS_API_KEY    bearer token (falls back to OPENAI_API_KEY)
//   INFOBROKER_TDQS_MODEL      model id (default: gpt-4o-mini)
//
// Exit codes: 0 = report produced; 1 = rubric output failed validation;
//             2 = fatal (missing endpoint, transport error).

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { handleHelp } from "./lib/args.js";
import {
  computeContextSignals,
  computeTdqs,
  computeQualityTier,
  computeDescriptionQualityScore,
  computeCoherenceScore,
  computeOverallScore,
  shadowCandidates,
  DIMENSION_WEIGHTS,
  type ToolDefinition,
  type ShadowCandidate,
} from "../src/tdqs.js";

const ROOT = join(import.meta.dirname, "..");

const USAGE = `tdqs-rubric — run the TDQS 1.2 LLM rubric over the live tool surface (REQ-106, informational)

Usage:
  tdqs-rubric [--help]

Env:
  INFOBROKER_TDQS_ENDPOINT   OpenAI-compatible chat-completions URL
  INFOBROKER_TDQS_API_KEY    bearer token
  INFOBROKER_TDQS_MODEL      model id (default gpt-4o-mini)

Exit codes: 0 = report; 1 = invalid rubric output; 2 = fatal.
`;

handleHelp(process.argv.slice(2), USAGE);

const SYSTEM_PROMPT = `You evaluate MCP tool definitions. Score how well the definition helps an AI agent select and invoke the tool correctly.

You receive: the tool's name, title, description, input schema, annotations, context signals, and sibling tool names.

## Dimensions (1-5 each)

### 1. Purpose Clarity (25%)
Does the description state what the tool does?
5=specific verb+resource, distinguishes from siblings. 4=clear but no sibling differentiation. 3=vague purpose. 2=tautology (restates name/title). 1=missing/misleading.

### 2. Usage Guidelines (20%)
Does it say when to use this tool vs alternatives?
5=explicit when/when-not/alternatives. 4=clear context, no exclusions. 3=implied usage. 2=no guidance. 1=misleading.

### 3. Behavioral Transparency (20%)
Does the description disclose behavioral traits BEYOND what annotations already provide?
With annotations: bar is lower, credit for adding context (what gets destroyed, auth needs, rate limits). Without annotations: description carries full burden.
Score 1 if description CONTRADICTS annotations. Flag as "Annotation Contradiction".

### 4. Parameter Semantics (15%)
Does description add meaning beyond what the input schema provides?
If schema_description_coverage is high (>80%), baseline is 3 even with no param info in description.
If low (<50%), description must compensate. 0 params = baseline 4.

### 5. Conciseness & Structure (10%)
Is it appropriately sized and front-loaded? Every sentence should earn its place.

### 6. Contextual Completeness (10%)
Given complexity + schema/annotations/output_schema richness, is the description complete enough?
If output schema exists, description needn't explain return values.

## Rules
- Use the FULL 1-5 range. Most descriptions are mediocre. 4-5 is reserved for genuinely helpful ones.
- Score 3 = minimum viable. Adequate but with clear gaps.
- Score each dimension INDEPENDENTLY.
- Base scores on SPECIFIC EVIDENCE in the description text.
- The description's job is to add VALUE BEYOND structured fields (annotations, schema). No credit for repeating what's already in structured data.

Respond with JSON only:

{
  "scores": {
    "purpose_clarity": {"score": <1-5>, "justification": "<2-3 sentences citing evidence>"},
    "usage_guidelines": {"score": <1-5>, "justification": "<2-3 sentences citing evidence>"},
    "behavioral_transparency": {"score": <1-5>, "justification": "<2-3 sentences citing evidence>"},
    "parameter_semantics": {"score": <1-5>, "justification": "<2-3 sentences citing evidence>"},
    "conciseness_structure": {"score": <1-5>, "justification": "<2-3 sentences citing evidence>"},
    "contextual_completeness": {"score": <1-5>, "justification": "<2-3 sentences citing evidence>"}
  },
  "annotation_contradiction": <true if description contradicts annotations, false otherwise>,
  "summary": "<2-3 sentence assessment>"
}`;

const COHERENCE_SYSTEM_PROMPT = `You evaluate whether an MCP server's tools work well together as a set. Individual tools may have good descriptions, but the set can still be confusing, inconsistent, or incomplete.

You receive: the server name, the tool count, all tool names with their descriptions and invocation costs, and a list of shadow candidate pairs.

## Dimensions (1-5 each, equally weighted)

### 1. Disambiguation
Can an agent tell the tools apart? Tools with overlapping purposes cause misselection.
5=every tool has a clearly distinct purpose, no ambiguity. 4=mostly distinct, one or two could be confused. 3=some overlap exists but descriptions help. 2=multiple tools have unclear boundaries. 1=several tools appear to do the same thing.

### 2. Naming Consistency
Do tool names follow a predictable pattern?
5=consistent verb_noun pattern throughout. 4=mostly consistent with minor deviations. 3=mixed conventions but still readable. 2=inconsistent. 1=chaotic naming with no discernible pattern.

### 3. Tool Count Appropriateness
Is the number of tools appropriate for the server's purpose?
5=well-scoped, each tool earns its place (typically 3-15 tools). 4=slightly over or under but reasonable. 3=borderline. 2=too many or too few. 1=extreme mismatch.

### 4. Completeness
Are there obvious gaps in the tool surface?
5=complete CRUD/lifecycle coverage for the domain, no dead ends. 4=minor gaps that agents can work around. 3=notable missing operations. 2=significant gaps. 1=severely incomplete.

## Shadowing Risk

Beyond the four dimensions, identify SHADOWING RISK: a tool whose purpose is substantially covered by a sibling that is much cheaper to invoke. Judge ONLY the pairs you are given; do not invent pairs. Asymmetry alone is NOT a defect. Report a pair only when overlap and asymmetry are both real, at most once per tool.

This is reported ALONGSIDE the four dimensions, not inside them.

Respond with JSON only:

{
  "scores": {
    "disambiguation": {"score": <1-5>, "justification": "<2-3 sentences>"},
    "naming_consistency": {"score": <1-5>, "justification": "<2-3 sentences>"},
    "tool_count_appropriateness": {"score": <1-5>, "justification": "<2-3 sentences>"},
    "completeness": {"score": <1-5>, "justification": "<2-3 sentences>"}
  },
  "shadowing_risks": [
    {"tool": "<name>", "cheaper_sibling": "<name>", "justification": "<1-2 sentences>"}
  ],
  "summary": "<2-3 sentence overall assessment>"
}`;

interface RpcMessage {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

async function listTools(): Promise<ToolDefinition[]> {
  const child = spawn(join(ROOT, "node_modules", ".bin", "tsx"), [join(ROOT, "src", "index.ts")], {
    cwd: ROOT,
    stdio: ["pipe", "pipe", "ignore"],
    env: { ...process.env },
  });
  const pending = new Map<number, (msg: RpcMessage) => void>();
  const rl = createInterface({ input: child.stdout! });
  rl.on("line", (line) => {
    let msg: RpcMessage;
    try {
      msg = JSON.parse(line) as RpcMessage;
    } catch {
      return; // non-JSON stdout line — not an RPC response
    }
    if (typeof msg.id === "number" && pending.has(msg.id)) {
      const resolve = pending.get(msg.id)!;
      pending.delete(msg.id);
      resolve(msg);
    }
  });
  const send = (obj: unknown) => child.stdin!.write(JSON.stringify(obj) + "\n");
  const call = (method: string, params: unknown, id: number): Promise<RpcMessage> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 20000);
      pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      send({ jsonrpc: "2.0", id, method, params });
    });
  try {
    const init = await call("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "tdqs-rubric", version: "1.0.0" } }, 1);
    if (init.error) throw new Error(`initialize failed: ${init.error.message}`);
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    const listed = await call("tools/list", {}, 2);
    if (listed.error) throw new Error(`tools/list failed: ${listed.error.message}`);
    return (listed.result as { tools: ToolDefinition[] }).tools;
  } finally {
    child.kill();
  }
}

function endpoint(): string {
  const direct = process.env["INFOBROKER_TDQS_ENDPOINT"];
  if (direct) return direct;
  const base = process.env["OPENAI_BASE_URL"];
  if (base) return `${base.replace(/\/$/, "")}/chat/completions`;
  return "";
}

async function chat(system: string, user: string): Promise<string> {
  const url = endpoint();
  if (!url) {
    throw new Error("No model endpoint configured — set INFOBROKER_TDQS_ENDPOINT or OPENAI_BASE_URL");
  }
  const key = process.env["INFOBROKER_TDQS_API_KEY"] ?? process.env["OPENAI_API_KEY"] ?? "";
  const model = process.env["INFOBROKER_TDQS_MODEL"] ?? "gpt-4o-mini";
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`model endpoint returned HTTP ${res.status}`);
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("model response carried no content");
  return content;
}

function parseJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1] : content;
  return JSON.parse(text.trim());
}

const DIMENSIONS = Object.keys(DIMENSION_WEIGHTS);

function validateToolOutput(raw: unknown): Record<string, number> {
  const obj = raw as { scores?: Record<string, { score?: unknown }> };
  const scores: Record<string, number> = {};
  for (const dim of DIMENSIONS) {
    const entry = obj.scores?.[dim]?.score;
    if (typeof entry !== "number" || !Number.isInteger(entry) || entry < 1 || entry > 5) {
      throw new Error(`dimension "${dim}" missing or out of range [1,5]`);
    }
    scores[dim] = entry;
  }
  return scores;
}

async function main(): Promise<void> {
  const tools = await listTools();
  const candidates: ShadowCandidate[] = shadowCandidates(tools);
  const signals = new Map(tools.map((t) => [t.name, computeContextSignals(t)]));

  const perTool: Array<Record<string, unknown>> = [];
  const tdqsTenths: number[] = [];

  for (const tool of tools) {
    const s = signals.get(tool.name)!;
    const siblings = tools.filter((t) => t.name !== tool.name).map((t) => t.name);
    const user = [
      `TOOL NAME: ${tool.name}`,
      `TITLE: ${tool.title ?? "null"}`,
      "",
      "DESCRIPTION:",
      `"${tool.description ?? ""}"`,
      "",
      "<input-schema>",
      JSON.stringify(tool.inputSchema ?? {}, null, 2),
      "</input-schema>",
      "",
      "<annotations>",
      tool.annotations ? JSON.stringify(tool.annotations) : "None provided",
      "</annotations>",
      "",
      "CONTEXT SIGNALS:",
      `- Parameter count: ${s.paramCount}`,
      `- Required parameters: ${s.requiredParamCount}`,
      `- Schema description coverage: ${s.schemaDescriptionCoverage}%`,
      `- Parameters with enums: ${s.paramsWithEnums}`,
      `- Has output schema: ${s.hasOutputSchema}`,
      `- Has nested objects: ${s.hasNestedObjects}`,
      "",
      "<sibling-tools>",
      siblings.join("\n") || "None",
      "</sibling-tools>",
      "",
      "Respond with JSON only.",
    ].join("\n");

    const raw = parseJson(await chat(SYSTEM_PROMPT, user));
    const scores = validateToolOutput(raw);
    const tdqs = computeTdqs(scores);
    tdqsTenths.push(Math.round(tdqs * 10));
    perTool.push({
      tool: tool.name,
      scores,
      tdqs,
      tier: computeQualityTier(tdqs),
      smells: DIMENSIONS.filter((d) => scores[d] < 3),
    });
    console.error(`[tdqs-rubric] ${tool.name}: ${tdqs} (${computeQualityTier(tdqs)})`);
  }

  const toolList = tools
    .map((t) => `- ${t.name} [cost ${signals.get(t.name)!.invocationCost}: ${signals.get(t.name)!.requiredFieldCount} required, depth ${signals.get(t.name)!.schemaDepth}, ${signals.get(t.name)!.unionChoiceCount} union choices]: ${t.description ?? "(no description)"}`)
    .join("\n");
  const candidateList = candidates.length
    ? candidates.map((c) => `"${c.tool} (cost ${c.invocationCost}) may be shadowed by ${c.cheaperSibling} (cost ${c.cheaperSiblingInvocationCost})"`).join("\n")
    : "None";
  const coherenceUser = [`SERVER NAME: infobroker`, `TOOL COUNT: ${tools.length}`, "", "<tools>", toolList, "</tools>", "", "<shadow-candidates>", candidateList, "</shadow-candidates>", "", "Respond with JSON only."].join("\n");

  const coherenceRaw = parseJson(await chat(COHERENCE_SYSTEM_PROMPT, coherenceUser)) as {
    scores?: Record<string, { score?: number }>;
  };
  const dim = (key: string): number => {
    const v = coherenceRaw.scores?.[key]?.score;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 5) throw new Error(`coherence dimension "${key}" missing or out of range`);
    return v;
  };
  const coherenceDims = {
    disambiguation: dim("disambiguation"),
    namingConsistency: dim("naming_consistency"),
    toolCountAppropriateness: dim("tool_count_appropriateness"),
    completeness: dim("completeness"),
  };
  const descriptionQualityScore = computeDescriptionQualityScore(tdqsTenths);
  const coherenceScore = computeCoherenceScore(coherenceDims);
  const overallScore = computeOverallScore(descriptionQualityScore, coherenceScore);

  console.log(
    JSON.stringify(
      {
        standard: "TDQS 1.2",
        model: process.env["INFOBROKER_TDQS_MODEL"] ?? "gpt-4o-mini",
        tools: perTool,
        server: {
          toolCount: tools.length,
          meanTdqs: Math.round((tdqsTenths.reduce((a, b) => a + b, 0) / tdqsTenths.length) * 10) / 10,
          minTdqs: Math.min(...tdqsTenths) / 10,
          descriptionQualityScore,
          descriptionQualityTier: computeQualityTier(descriptionQualityScore),
          ...coherenceDims,
          coherenceScore,
          coherenceTier: computeQualityTier(coherenceScore),
          overallScore,
          overallTier: computeQualityTier(overallScore),
          shadowingRisks: candidates,
        },
      },
      null,
      2
    )
  );
  console.error(`[tdqs-rubric] overall ${overallScore} (${computeQualityTier(overallScore)})`);
}

main().catch((e) => {
  console.error(`[tdqs-rubric] fatal: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(2);
});
