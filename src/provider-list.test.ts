// @implements REQ-024a
// REQ-024a: `status: "active"` selects exactly the rows reported active. The
// test spawns the real server against an isolated config and a seeded quota
// counter, so a degraded row is produced by the same code path production uses.
import { afterAll, beforeAll, expect, test } from "vitest";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeIsolatedConfig, type IsolatedConfig } from "./lib/test-isolation.js";

const REPO_ROOT = join(import.meta.dirname, "..");
const TEST_PROVIDER = "stack_exchange";
// 80 % of the shipped `per_day` cap (300) is the quota-warning boundary.
const SEEDED_DAILY = 240;

interface RpcMessage {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

let cfg: IsolatedConfig;

beforeAll(() => {
  cfg = makeIsolatedConfig();
  const future = new Date(Date.now() + 3_600_000).toISOString();
  writeFileSync(
    join(cfg.root, "quota.json"),
    JSON.stringify({
      providers: {
        [TEST_PROVIDER]: {
          daily: { count: SEEDED_DAILY, resetAt: future },
          monthly: { count: 0, resetAt: future },
        },
      },
    }),
    { mode: 0o600 },
  );
});

afterAll(() => {
  // The isolated root is a temp directory; nothing to clean up in the repo.
});

function env(): NodeJS.ProcessEnv {
  return {
    ...cfg.env,
    INFOBROKER_QUOTA_STATE: join(cfg.root, "quota.json"),
    INFOBROKER_KEYPOOL_STATE: join(cfg.root, "key-pool.json"),
  };
}

async function withServer<T>(fn: (call: (method: string, params: unknown) => Promise<RpcMessage>) => Promise<T>): Promise<T> {
  const child = spawn(join(REPO_ROOT, "node_modules", ".bin", "tsx"), [join(REPO_ROOT, "src", "index.ts")], {
    cwd: REPO_ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    env: env(),
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
  let nextId = 1;
  const send = (obj: unknown) => child.stdin!.write(JSON.stringify(obj) + "\n");
  const call = (method: string, params: unknown): Promise<RpcMessage> => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 20000);
      pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      send({ jsonrpc: "2.0", id, method, params });
    });
  };
  try {
    const init = await call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "provider-list-test", version: "1.0.0" },
    });
    expect(init.error).toBeUndefined();
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    return await fn(call);
  } finally {
    child.kill();
  }
}

interface ToolPayload {
  status: string;
  results: Array<Record<string, unknown>>;
}

function toolResult(msg: RpcMessage): ToolPayload {
  const result = msg.result as { content?: Array<{ type: string; text?: string }> } | undefined;
  const text = result?.content?.find((part) => part.type === "text")?.text ?? "";
  expect(text.startsWith("[OK] ")).toBe(true);
  return JSON.parse(text.slice(5)) as ToolPayload;
}

test("status:active selects exactly the rows reported active", async () => {
  await withServer(async (call) => {
    const all = toolResult(
      await call("tools/call", { name: "infobroker_inspect_providers", arguments: { action: "list" } }),
    );
    const seeded = all.results.find((row) => row.slug === TEST_PROVIDER);
    expect(seeded).toBeTruthy();
    expect(seeded?.quota_warning).toBe(true);
    expect(seeded?.status).toBe("degraded");

    const active = toolResult(
      await call("tools/call", {
        name: "infobroker_inspect_providers",
        arguments: { action: "list", status: "active" },
      }),
    );
    expect(active.results.some((row) => row.slug === TEST_PROVIDER)).toBe(false);
    for (const row of active.results) expect(row.status).toBe("active");
    // Every active row in the unfiltered list is present in the filtered view.
    const activeSlugs = all.results.filter((row) => row.status === "active").map((row) => row.slug);
    expect(active.results.map((row) => row.slug).sort()).toEqual(activeSlugs.sort());
  });
});

test("the spec action's active count still counts assessed-active providers", async () => {
  await withServer(async (call) => {
    const all = toolResult(
      await call("tools/call", { name: "infobroker_inspect_providers", arguments: { action: "list" } }),
    );
    const spec = toolResult(
      await call("tools/call", { name: "infobroker_inspect_providers", arguments: { action: "spec" } }),
    );
    const report = spec.results[0];
    const expected = all.results.filter(
      (row) => row.slug !== "native_fetch" && row.status === "active",
    ).length;
    expect(report.active_provider_count).toBe(expected);
    expect(Number(report.active_provider_count)).toBeLessThanOrEqual(Number(report.enabled_provider_count));
  });
});
