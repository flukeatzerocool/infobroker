// @implements REQ-001 REQ-002 REQ-089
// Debate-club stdio client: spawns the REAL Infobroker MCP server under the
// replay preload, performs the MCP handshake, and exposes tools/call. Isolates
// all mutable state (TMPDIR quota, KB storage, audit log, user config layer)
// into a per-run temp directory so runs are deterministic and repeatable.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEBATE_ROOT = join(import.meta.dirname, "..");
export const REPO_ROOT = join(DEBATE_ROOT, "..");

interface RpcMessage {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface ToolCall {
  text: string;
  latencyMs: number;
}

export interface DebateServer {
  call(name: string, args: Record<string, unknown>): Promise<ToolCall>;
  listTools(): Promise<string[]>;
  unmatched(): string[];
  tmpDir: string;
  stop(): void;
}

function rpcContentText(result: unknown): string {
  const r = result as { content?: Array<{ type?: string; text?: string }> } | undefined;
  const first = r?.content?.[0];
  return first?.text ?? "";
}

export async function startServer(): Promise<DebateServer> {
  const tmpDir = mkdtempSync(join(tmpdir(), "debate-club-"));
  const cfgLocal = join(tmpDir, "config.local.json");
  const unmatchedPath = join(tmpDir, "unmatched.log");
  writeFileSync(unmatchedPath, "");
  writeFileSync(
    cfgLocal,
    JSON.stringify(
      {
        output: { verbose: true, audit_log_path: join(tmpDir, "audit.log") },
        kb: {
          storage_path: join(tmpDir, "kb"),
          keys_path: join(tmpDir, "keys"),
          reports_path: join(tmpDir, "reports"),
          auto_index: false,
        },
      },
      null,
      2
    )
  );

  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "--import",
      join(DEBATE_ROOT, "scripts", "preload.mjs"),
      join(REPO_ROOT, "src", "index.ts"),
    ],
    {
      cwd: REPO_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        TMPDIR: tmpDir,
        DEBATE_CLUB_MODE: "replay",
        DEBATE_CLUB_FIXTURES: join(DEBATE_ROOT, "fixtures", "index.json"),
        DEBATE_CLUB_UNMATCHED: unmatchedPath,
        INFOBROKER_CONFIG_LOCAL: cfgLocal,
      },
    }
  );

  const stderrChunks: string[] = [];
  child.stderr.on("data", (d: Buffer) => stderrChunks.push(d.toString()));
  child.on("exit", () => {
    /* server exit is observed via stop(); stream teardown is best-effort */
  });

  const pending = new Map<number, (m: RpcMessage) => void>();
  const rl: Interface = createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    let msg: RpcMessage;
    try {
      msg = JSON.parse(line) as RpcMessage;
    } catch {
      return;
    }
    if (typeof msg.id === "number" && pending.has(msg.id)) {
      const resolve = pending.get(msg.id);
      pending.delete(msg.id);
      resolve?.(msg);
    }
  });

  let nextId = 1;
  const send = (obj: unknown) => child.stdin.write(JSON.stringify(obj) + "\n");
  const rpc = (method: string, params: unknown): Promise<RpcMessage> =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out; stderr tail: ${stderrChunks.join("").slice(-400)}`));
      }, 30000);
      pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      send({ jsonrpc: "2.0", id, method, params });
    });

  const init = await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "debate-club", version: "1.0.0" },
  });
  if (init.error) throw new Error(`initialize failed: ${init.error.message}`);
  send({ jsonrpc: "2.0", method: "notifications/initialized" });

  return {
    tmpDir,
    async call(name, args) {
      const start = performance.now();
      const resp = await rpc("tools/call", { name, arguments: args });
      const latencyMs = performance.now() - start;
      if (resp.error) throw new Error(`tools/call ${name} failed: ${resp.error.message}`);
      return { text: rpcContentText(resp.result), latencyMs };
    },
    async listTools() {
      const resp = await rpc("tools/list", {});
      if (resp.error) throw new Error(`tools/list failed: ${resp.error.message}`);
      const result = resp.result as { tools?: Array<{ name: string }> } | undefined;
      return (result?.tools ?? []).map((t) => t.name);
    },
    unmatched() {
      if (!existsSync(unmatchedPath)) return [];
      return readFileSync(unmatchedPath, "utf8").split("\n").filter(Boolean);
    },
    stop() {
      try {
        rl.close();
        child.kill();
      } catch {
        // best-effort teardown; the process is killed regardless
      }
    },
  };
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 12);
}

export function fingerprint(): Record<string, string> {
  let gitSha = "unknown";
  try {
    gitSha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO_ROOT }).toString().trim();
  } catch {
    // not a git checkout — fingerprint the config/fixtures only
  }
  return {
    git_sha: gitSha,
    config_hash: sha256File(join(REPO_ROOT, "config.json")),
    fixture_hash: sha256File(join(DEBATE_ROOT, "fixtures", "index.json")),
    node: process.version,
  };
}
