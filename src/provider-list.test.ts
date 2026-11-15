// @implements REQ-024a
// REQ-024a: `status: "active"` selects exactly the rows reported active. The
// test spawns the real server against an isolated config and a seeded quota
// counter, so a degraded row is produced by the same code path production uses.
import { afterAll, beforeAll, expect, test } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeIsolatedConfig, type IsolatedConfig } from "./lib/test-isolation.js";
import { withServer } from "./lib/mcp-stdio.js";

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
  await withServer({ env: env() }, async (call) => {
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
  await withServer({ env: env() }, async (call) => {
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
