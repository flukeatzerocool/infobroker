// @implements REQ-089 REQ-090
// Tool-surface contract test: starts the real server over stdio and verifies
// the advertised tool surface against REQ-089 (three-clause definitions, full
// parameter descriptions, annotations) and REQ-090 (verb_noun naming).

import { test, expect } from "vitest";
import { spawn } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

interface ToolDef {
  name: string;
  description?: string;
  inputSchema?: { type?: string; properties?: Record<string, { description?: string }> };
  annotations?: ToolAnnotations;
}

interface ListToolsResult {
  tools: ToolDef[];
}

interface RpcMessage {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

async function listTools(): Promise<ListToolsResult> {
  const child = spawn(
    join(REPO_ROOT, "node_modules", ".bin", "tsx"),
    [join(REPO_ROOT, "src", "index.ts")],
    { cwd: REPO_ROOT, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env } }
  );

  const pending = new Map<number, (msg: RpcMessage) => void>();
  const rl: Interface = createInterface({ input: child.stdout! });
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
      {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "tool-surface-test", version: "1.0.0" },
      },
      1
    );
    expect(init.error).toBeUndefined();

    send({ jsonrpc: "2.0", method: "notifications/initialized" });

    const listed = await call("tools/list", {}, 2);
    expect(listed.error).toBeUndefined();
    return listed.result as ListToolsResult;
  } finally {
    child.kill();
  }
}

test("tool surface satisfies REQ-089 and REQ-090", async () => {
  const { tools } = await listTools();

  // REQ-089: multi-action tools document which parameter each action needs.
  const couplingNotes: Record<string, RegExp> = {
    infobroker_inspect_providers: /required for the `health` action/,
    infobroker_manage_kb: /`query` for search/,
    infobroker_verify_claims: /`max_iterations` bounds/,
  };

  // REQ-090: the exact seven-tool surface, one tool per feature area.
  expect(tools.map((t) => t.name).sort()).toEqual([
    "infobroker_fetch_page",
    "infobroker_get_citations",
    "infobroker_inspect_providers",
    "infobroker_manage_kb",
    "infobroker_reload_config",
    "infobroker_verify_claims",
    "infobroker_web_search",
  ]);

  for (const tool of tools) {
    const slug = tool.name.replace(/^infobroker_/, "");

    // REQ-090: verb_noun pattern — verb, underscore, noun, all lowercase.
    expect(slug, `${tool.name} violates verb_noun naming`).toMatch(/^[a-z]+_[a-z]+$/);

    // REQ-089: description states purpose, when to use, and when not to use.
    expect(tool.description, `${tool.name} missing description`).toBeTruthy();
    expect(tool.description!, `${tool.name} missing 'Use when'`).toMatch(/Use when/i);
    expect(tool.description!, `${tool.name} missing 'Do NOT use'`).toMatch(/Do NOT use/i);

    // REQ-089: description states the response contract ([OK]/[ERROR] envelope).
    expect(tool.description!, `${tool.name} missing [OK] return contract`).toMatch(/\[OK\]/);
    expect(tool.description!, `${tool.name} missing [ERROR] return contract`).toMatch(/\[ERROR\]/);

    // REQ-089: multi-action tools document parameter couplings.
    const coupling = couplingNotes[tool.name];
    if (coupling) {
      expect(tool.description!, `${tool.name} missing parameter-coupling note`).toMatch(coupling);
    }

    // REQ-089: annotations declared.
    expect(tool.annotations, `${tool.name} missing annotations`).toBeDefined();
    const a = tool.annotations!;
    expect(
      a.readOnlyHint !== undefined || a.destructiveHint !== undefined || a.idempotentHint !== undefined,
      `${tool.name} missing a behavioral hint`
    ).toBe(true);

    // REQ-089: every parameter carries a description.
    const props = tool.inputSchema?.properties ?? {};
    for (const [param, def] of Object.entries(props)) {
      expect(def?.description, `${tool.name}.${param} missing description`).toBeTruthy();
    }
  }
}, 30000);
