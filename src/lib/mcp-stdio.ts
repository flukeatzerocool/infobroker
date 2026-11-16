// @implements REQ-055 REQ-079
// Shared spawned-server client for contract tests. Every suite that drives the
// real MCP server over stdio used to carry its own copy of the same block:
// spawn `src/index.ts` under tsx, read JSON-RPC replies off stdout, initialize,
// call tools, kill the child. The copies drifted (20 s vs 30 s timeouts, some
// initialized in `beforeAll`, one needed a heap flag and a SIGKILL). This module
// is the one implementation:
//
//   withServer({ env }, async (call) => { ... })   // scoped, common case
//   const srv = await startMcpServer({ env, initialize: false })  // handle
//
// `startMcpServer` is for suites that keep more than one server alive, restart
// one, or drive the handshake themselves. A check (`mcp-stdio-callers.test.ts`)
// fails when a suite reintroduces a local copy.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { join } from "node:path";

export const REPO_ROOT = join(import.meta.dirname, "..", "..");
const SERVER_ENTRY = join(REPO_ROOT, "src", "index.ts");
const TSX = join(REPO_ROOT, "node_modules", ".bin", "tsx");

const DEFAULT_TIMEOUT_MS = 20_000;
const STOP_GRACE_MS = 5_000;
const STDERR_TAIL_CHARS = 2_000;

export interface RpcMessage {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export type Call = (method: string, params: unknown) => Promise<RpcMessage>;

export interface ToolSchemaProperty {
  type?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  minimum?: number;
  maximum?: number;
}

export interface ToolDef {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, ToolSchemaProperty>;
    required?: string[];
  };
  outputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

export interface McpServerOptions {
  /** Child environment. Defaults to the current process environment. */
  env?: NodeJS.ProcessEnv;
  /** Working directory for the child. Defaults to the repository root. */
  cwd?: string;
  /** Per-call timeout in milliseconds. Defaults to 20 s. */
  timeoutMs?: number;
  /** `clientInfo.name` sent in `initialize`. */
  clientName?: string;
  /** Complete the handshake on start. Defaults to true. */
  initialize?: boolean;
  /** Extra settle time after `notifications/initialized` (KB startup). */
  initDelayMs?: number;
  /** Signal used by `stop()`. Defaults to `SIGTERM`. */
  killSignal?: NodeJS.Signals;
}

export interface McpServer {
  call: Call;
  notify(method: string): void;
  /** Advertised tools, via `tools/list`. */
  listTools(): Promise<ToolDef[]>;
  /** Everything the child wrote to stderr so far (tail-bounded). */
  stderr(): string;
  /** Send a signal to the child and wait for it to exit. */
  kill(signal?: NodeJS.Signals, timeoutMs?: number): Promise<void>;
  /** Close stdin (the client-disconnect signal) and wait for the process to exit. */
  closeAndWait(timeoutMs?: number): Promise<{ code: number | null; ms: number }>;
  stop(): Promise<void>;
}

/** Spawn `src/index.ts` and connect a JSON-RPC client to its stdio. */
export async function startMcpServer(options: McpServerOptions = {}): Promise<McpServer> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const clientName = options.clientName ?? "infobroker-test";
  const child: ChildProcessWithoutNullStreams = spawn(TSX, [SERVER_ENTRY], {
    cwd: options.cwd ?? REPO_ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    env: options.env ?? process.env,
  });

  let stderrTail = "";
  child.stderr.on("data", (chunk: Buffer | string) => {
    stderrTail = (stderrTail + String(chunk)).slice(-STDERR_TAIL_CHARS);
  });

  const exited = once(child, "exit");
  const lines = createInterface({ input: child.stdout });
  const pending = new Map<number, { resolve: (message: RpcMessage) => void; reject: (error: Error) => void }>();

  lines.on("line", (line) => {
    let message: RpcMessage;
    try {
      message = JSON.parse(line) as RpcMessage;
    } catch {
      return; // non-JSON stdout line is not an RPC reply
    }
    if (typeof message.id !== "number") return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    waiter.resolve(message);
  });

  let nextId = 1;
  const send = (message: unknown) => child.stdin.write(JSON.stringify(message) + "\n");

  const call: Call = (method, params) => {
    const id = nextId++;
    return new Promise<RpcMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        const detail = stderrTail ? `: ${stderrTail.trim().split("\n").slice(-3).join(" | ")}` : "";
        reject(new Error(`${method} timed out after ${timeoutMs} ms${detail}`));
      }, timeoutMs);
      pending.set(id, {
        resolve: (message) => {
          clearTimeout(timer);
          resolve(message);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      send({ jsonrpc: "2.0", id, method, params });
    });
  };

  const notify = (method: string) => send({ jsonrpc: "2.0", method });

  const stop = async (): Promise<void> => {
    for (const waiter of pending.values()) waiter.reject(new Error("server stopped"));
    pending.clear();
    if (child.exitCode !== null || child.signalCode !== null) {
      lines.close();
      return;
    }
    child.kill(options.killSignal ?? "SIGTERM");
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, STOP_GRACE_MS))]);
    lines.close();
  };

  /** Signal the child and wait for it, so a shutdown-path assertion is real. */
  const kill = async (signal: NodeJS.Signals = options.killSignal ?? "SIGTERM", timeoutMs = STOP_GRACE_MS): Promise<void> => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill(signal);
    await Promise.race([
      exited,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`server did not exit after ${signal} within ${timeoutMs} ms`)), timeoutMs),
      ),
    ]);
  };

  /** Close stdin and wait: the client-disconnect path must exit on its own. */
  const closeAndWait = async (timeoutMs = 3_000): Promise<{ code: number | null; ms: number }> => {
    const start = Date.now();
    child.stdin.end();
    const outcome = await Promise.race([
      exited.then(() => "exited" as const),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), timeoutMs)),
    ]);
    if (outcome === "timeout") {
      throw new Error(`server did not exit within ${timeoutMs} ms of stdin close`);
    }
    return { code: child.exitCode, ms: Date.now() - start };
  };

  const server: McpServer = {
    call,
    notify,
    stderr: () => stderrTail,
    kill,
    closeAndWait,
    stop,
    async listTools() {
      const reply = await call("tools/list", {});
      if (reply.error) throw new Error(`tools/list failed: ${reply.error.message}`);
      return ((reply.result as { tools?: ToolDef[] } | undefined)?.tools ?? []) as ToolDef[];
    },
  };

  if (options.initialize !== false) {
    const init = await call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: clientName, version: "1.0.0" },
    });
    if (init.error) {
      await stop();
      throw new Error(`initialize failed: ${init.error.message}`);
    }
    notify("notifications/initialized");
    if (options.initDelayMs) await new Promise((resolve) => setTimeout(resolve, options.initDelayMs));
  }

  return server;
}

/**
 * Run `fn` against a freshly spawned, initialized server, and stop it after.
 * The server is stopped even when `fn` throws, so a failing assertion cannot
 * leak a child process.
 */
export async function withServer<T>(options: McpServerOptions, fn: (call: Call) => Promise<T>): Promise<T> {
  const server = await startMcpServer(options);
  try {
    return await fn(server.call);
  } finally {
    await server.stop();
  }
}
