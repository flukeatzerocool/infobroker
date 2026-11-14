// @implements REQ-026g batch-both-inputs
// @implements REQ-026g batch-no-input
// @implements REQ-026g batch-empty-list
// @implements REQ-026g batch-cap
// The call-shape gates of `verify_claims` live only in the handler
// (`src/index.ts:2088-2115`), so they are driven through the spawned server
// rather than through `corroborate`: both a query and a claim list, neither, an
// empty list, and a list above the configured cap each return an `[ERROR]`
// envelope naming the reason. Every case short-circuits before dispatch, so the
// suite makes no outbound request.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeIsolatedConfig, type IsolatedConfig } from "./lib/test-isolation.js";

const REPO_ROOT = join(import.meta.dirname, "..");
/** The cap written into the isolated config, so a literal in the message fails. */
const MAX_BATCH = 2;

interface RpcMessage {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

interface ToolResult {
  content: Array<{ type: string; text: string }>;
  structuredContent?: Record<string, unknown>;
}

let iso: IsolatedConfig;
let child: ChildProcessWithoutNullStreams;
let call: (method: string, params: unknown) => Promise<RpcMessage>;

beforeAll(async () => {
  iso = makeIsolatedConfig();
  const config = JSON.parse(readFileSync(iso.configPath, "utf-8")) as {
    corroboration?: Record<string, unknown>;
  };
  config.corroboration = { ...(config.corroboration ?? {}), max_batch_claims: MAX_BATCH };
  writeFileSync(iso.configPath, JSON.stringify(config, null, 2));

  child = spawn(join(REPO_ROOT, "node_modules", ".bin", "tsx"), [join(REPO_ROOT, "src", "index.ts")], {
    cwd: REPO_ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    env: iso.env,
  });

  const pending = new Map<number, (msg: RpcMessage) => void>();
  const rl = createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    let msg: RpcMessage;
    try {
      msg = JSON.parse(line) as RpcMessage;
    } catch {
      return; // non-JSON stdout line is not an RPC response
    }
    if (typeof msg.id === "number" && pending.has(msg.id)) {
      const resolve = pending.get(msg.id)!;
      pending.delete(msg.id);
      resolve(msg);
    }
  });

  let nextId = 1;
  call = (method, params) => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 20000);
      pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  };

  const init = await call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "verify-claims-bounds-test", version: "1.0.0" },
  });
  expect(init.error).toBeUndefined();
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
}, 60_000);

afterAll(() => {
  child?.kill();
  if (iso) rmSync(iso.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

/** Call `verify_claims` and return the parsed `[ERROR]` envelope body. */
async function verifyError(args: Record<string, unknown>): Promise<{ error: { code: string; message: string } }> {
  const response = await call("tools/call", { name: "infobroker_verify_claims", arguments: args });
  expect(response.error).toBeUndefined();
  const result = response.result as ToolResult;
  const text = result.content[0]?.text ?? "";
  expect(text.startsWith("[ERROR] "), `expected an error envelope, got: ${text.slice(0, 200)}`).toBe(true);
  return JSON.parse(text.slice("[ERROR] ".length)) as { error: { code: string; message: string } };
}

describe("verify_claims call-shape bounds (REQ-026g)", () => {
  test("rejects a query and a claim list together", async () => {
    const body = await verifyError({ query: "does the sky glow", claims: ["the sky glows"] });
    expect(body.error.code).toBe("invalid_input");
    expect(body.error.message).toBe("Provide either query or claims, not both");
  });

  test("rejects a call with neither input", async () => {
    const body = await verifyError({});
    expect(body.error.code).toBe("invalid_input");
    expect(body.error.message).toBe("Provide a query or a claims list");
  });

  test("rejects an empty claim list", async () => {
    const body = await verifyError({ claims: [] });
    expect(body.error.code).toBe("invalid_input");
    expect(body.error.message).toBe("claims must contain at least one claim");
  });

  test("rejects a batch above the configured cap", async () => {
    const body = await verifyError({ claims: ["one claim", "two claims", "three claims"] });
    expect(body.error.code).toBe("invalid_input");
    expect(body.error.message).toBe(`claims accepts at most ${MAX_BATCH} entries`);
  });
});
