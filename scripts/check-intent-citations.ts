#!/usr/bin/env npx tsx
// check-intent-citations.ts — gate: the client routing surface cites only
// tools, operations, and parameters declared by the live tool schema, and
// every declared operation is cited at least once (REQ-107). Wired into
// `npm run check`.
//
// Exit codes: 0 = pass; 1 = citation findings; 2 = fatal.

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { handleHelp } from "./lib/args.js";
import {
  FILE_PREFIX_POLICY,
  validateRoutingFiles,
  type Finding,
  type ToolProperty,
  type ToolSchema,
} from "../src/intent-citations.js";

const ROOT = join(import.meta.dirname, "..");

const USAGE = `check-intent-citations — routing citation integrity (REQ-107)

Usage:
  check-intent-citations [--report] [--help]

Options:
  --report   Print findings and always exit 0 (informational)
  --help     Show this help (exit 0)

Exit codes: 0 = pass; 1 = citation findings; 2 = fatal.
`;

handleHelp(process.argv.slice(2), USAGE);
const reportOnly = process.argv.includes("--report");

interface RpcMessage {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

interface ToolDef {
  name: string;
  inputSchema?: {
    properties?: Record<string, { enum?: unknown[]; type?: string | string[] }>;
  };
}

async function listTools(): Promise<ToolDef[]> {
  const child = spawn(
    join(ROOT, "node_modules", ".bin", "tsx"),
    [join(ROOT, "src", "index.ts")],
    { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env } }
  );

  const pending = new Map<number, (msg: RpcMessage) => void>();
  const rl = createInterface({ input: child.stdout! });
  rl.on("line", (line) => {
    let msg: RpcMessage;
    try {
      msg = JSON.parse(line) as RpcMessage;
    } catch {
      return;
    }
    if (typeof msg.id === "number" && pending.has(msg.id)) {
      const resolve = pending.get(msg.id)!;
      pending.delete(msg.id);
      resolve(msg);
    }
  });

  const send = (obj: unknown) => child.stdin!.write(JSON.stringify(obj) + "\n");
  const call = (method: string, params: unknown): Promise<RpcMessage> =>
    new Promise((resolve, reject) => {
      const id = Math.floor(Math.random() * 1_000_000);
      const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 20000);
      pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      send({ jsonrpc: "2.0", id, method, params });
    });

  try {
    const init = await call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "check-intent-citations", version: "1.0.0" },
    });
    if (init.error) throw new Error(init.error.message);

    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    const listed = await call("tools/list", {});
    if (listed.error) throw new Error(listed.error.message);
    return (listed.result as { tools: ToolDef[] }).tools;
  } finally {
    child.kill();
  }
}

function toSchema(tool: ToolDef): ToolSchema {
  const properties: Record<string, ToolProperty> = {};
  for (const [name, prop] of Object.entries(tool.inputSchema?.properties ?? {})) {
    const type = Array.isArray(prop.type)
      ? prop.type.find((t) => t !== "null")
      : prop.type;
    properties[name] = {
      type,
      enum: Array.isArray(prop.enum) ? prop.enum.map(String) : undefined,
    };
  }
  return { slug: tool.name.replace(/^infobroker_/, ""), properties };
}

function printFindings(findings: Finding[]): void {
  const payload = {
    status: findings.length === 0 ? "ok" : "findings",
    findings: findings.map((f) => ({
      code: f.code,
      file: f.file,
      line: f.line,
      message: f.message,
    })),
  };
  console.log(JSON.stringify(payload, null, 2));
}

async function main(): Promise<void> {
  let tools: ToolDef[];
  try {
    tools = await listTools();
  } catch (error) {
    console.error(`check-intent-citations: unable to load tools/list: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }

  const schemas = new Map<string, ToolSchema>();
  for (const tool of tools) {
    const schema = toSchema(tool);
    schemas.set(schema.slug, schema);
  }
  const files: Record<string, string> = {};
  for (const file of Object.keys(FILE_PREFIX_POLICY)) {
    try {
      files[file] = readFileSync(join(ROOT, file), "utf-8");
    } catch (error) {
      console.error(`check-intent-citations: cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(2);
    }
  }

  const { citations, findings } = validateRoutingFiles(files, schemas);
  printFindings(findings);

  const prefix = `check-intent-citations: ${citations.length} citation(s), ${findings.length} finding(s)`;
  if (findings.length === 0) {
    console.error(`${prefix}.`);
    process.exit(0);
  }
  console.error(`${prefix}.`);
  process.exit(reportOnly ? 0 : 1);
}

void main();
