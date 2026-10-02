#!/usr/bin/env npx tsx
// check-tdqs.ts — gate: the advertised tool surface satisfies the deterministic
// layer of TDQS 1.2 (REQ-106): context signals, hard gates (missing or
// tautological description), parameter/annotation preconditions, and
// shadow-candidate reporting. The six dimension scores are LLM-judged and are
// out of scope here (see scripts/tdqs-rubric.ts). Wired into `npm run check`.
//
// Exit codes: 0 = conformant; 1 = a structural TDQS violation; 2 = fatal.

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { handleHelp } from "./lib/args.js";
import {
  structuralViolations,
  annotationContradictionCandidates,
  shadowCandidates,
  computeContextSignals,
  type ToolDefinition,
} from "../src/tdqs.js";

const ROOT = join(import.meta.dirname, "..");

const USAGE = `check-tdqs — deterministic TDQS 1.2 conformance over the live tool surface (REQ-106)

Usage:
  check-tdqs [--report] [--help]

Options:
  --report   Print the JSON report and always exit 0 (informational)
  --help     Show this help (exit 0)

Exit codes: 0 = conformant; 1 = structural violation; 2 = fatal.
`;

handleHelp(process.argv.slice(2), USAGE);
const reportOnly = process.argv.includes("--report");

interface RpcMessage {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

interface ListToolsResult {
  tools: ToolDefinition[];
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
    const init = await call(
      "initialize",
      { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "check-tdqs", version: "1.0.0" } },
      1
    );
    if (init.error) throw new Error(`initialize failed: ${init.error.message}`);
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    const listed = await call("tools/list", {}, 2);
    if (listed.error) throw new Error(`tools/list failed: ${listed.error.message}`);
    return (listed.result as ListToolsResult).tools;
  } finally {
    child.kill();
  }
}

async function main(): Promise<void> {
  const tools = await listTools();
  if (tools.length === 0) {
    console.error("[check-tdqs] fatal: the server advertised no tools");
    process.exit(2);
  }

  const signals = tools.map((t) => ({ name: t.name, ...computeContextSignals(t) }));
  const violations = structuralViolations(tools);
  const contradictions = annotationContradictionCandidates(tools);
  const shadows = shadowCandidates(tools);

  const report = {
    standard: "TDQS 1.2 (deterministic layer)",
    toolCount: tools.length,
    tools: signals.map((s) => ({
      name: s.name,
      invocationCost: s.invocationCost,
      definitionBytes: s.definitionBytes,
      schemaDescriptionCoverage: s.schemaDescriptionCoverage,
      schemaDepth: s.schemaDepth,
      unionChoiceCount: s.unionChoiceCount,
    })),
    shadowCandidates: shadows,
    annotationContradictionCandidates: contradictions,
    violations,
  };

  console.log(JSON.stringify(report, null, 2));

  console.error(`[check-tdqs] ${tools.length} tool(s); ${shadows.length} shadow candidate(s); ${contradictions.length} contradiction candidate(s); ${violations.length} violation(s).`);
  for (const v of violations) console.error(`  ${v.tool}: ${v.rule} — ${v.detail}`);

  if (violations.length > 0 && !reportOnly) process.exit(1);
}

main().catch((e) => {
  console.error(`[check-tdqs] fatal: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(2);
});
