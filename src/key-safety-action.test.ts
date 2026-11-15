// @implements REQ-011 missing-key REQ-011 optional-key REQ-011 no-leak REQ-104 pool-state
// REQ-011: a required credential that is absent marks the provider inactive
// with reason "no_api_key"; an optional credential that is absent leaves the
// provider operable; key material never reaches config values, tool output,
// error messages, logs, or provider reports. REQ-104: persisted pool state
// carries non-reversible ids, never key material.
//
// Every case runs against an isolated config and a loopback generic_http
// provider, so no external request is possible (src/lib/stub-provider.ts).
import { afterAll, afterEach, expect, test } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { startStubProvider, writeHermeticConfig, type HermeticConfig, type StubProvider } from "./lib/stub-provider.js";
import { withServer, type RpcMessage } from "./lib/mcp-stdio.js";

const SENTINEL_ONE = "sk-r2biii-SENTINEL-7f3a9c1d";
const SENTINEL_TWO = "sk-r2biii-SENTINEL-2b8e4f60";

interface ToolPayload {
  status: string;
  results: Array<Record<string, unknown>>;
}

function toolText(msg: RpcMessage): string {
  const result = msg.result as { content?: Array<{ type: string; text?: string }> } | undefined;
  return result?.content?.find((part) => part.type === "text")?.text ?? "";
}

function parseOk(msg: RpcMessage): ToolPayload {
  const text = toolText(msg);
  expect(text.startsWith("[OK] ")).toBe(true);
  return JSON.parse(text.slice(5)) as ToolPayload;
}

const callTool = (call: (m: string, p: unknown) => Promise<RpcMessage>, name: string, args: unknown) =>
  call("tools/call", { name, arguments: args });

async function providerRow(
  call: (m: string, p: unknown) => Promise<RpcMessage>,
  slug: string,
  action: "list" | "health",
): Promise<Record<string, unknown>> {
  const args = action === "list" ? { action } : { action, provider: slug };
  const payload = parseOk(await callTool(call, "infobroker_inspect_providers", args));
  const row = action === "list"
    ? payload.results.find((entry) => entry.slug === slug)
    : payload.results[0];
  expect(row).toBeDefined();
  return row as Record<string, unknown>;
}

function readIfPresent(path: string | undefined): string {
  if (!path || !existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

/** Every state file the spawned server could write, as one sweepable corpus. */
function stateCorpus(config: HermeticConfig): string {
  return [
    config.callLogPath,
    config.auditLogPath,
    join(config.root, "config.json"),
    join(config.root, "config.local.json"),
    join(config.root, "key-pool.json"),
  ]
    .map(readIfPresent)
    .join("\n");
}

function expectNoSentinel(corpus: string): void {
  expect(corpus).not.toContain(SENTINEL_ONE);
  expect(corpus).not.toContain(SENTINEL_TWO);
}

let stub: StubProvider | undefined;

afterEach(async () => {
  await stub?.close();
  stub = undefined;
});

afterAll(async () => {
  await stub?.close();
  stub = undefined;
});

test("REQ-011 missing-key: a required credential absent marks the provider inactive", async () => {
  stub = await startStubProvider("ok");
  const config = writeHermeticConfig(stub.url, {
    providers: [
      { slug: "keyreq", authEnv: "INFOBROKER_KEYREQ_API_KEY" },
      { slug: "keyopt", authEnv: "INFOBROKER_KEYOPT_API_KEY", authOptional: true },
    ],
  });
  // The child must not inherit a real credential from the parent environment.
  expect(config.env["INFOBROKER_KEYREQ_API_KEY"]).toBeUndefined();
  expect(config.env["INFOBROKER_KEYOPT_API_KEY"]).toBeUndefined();
  expect(config.env["INFOBROKER_CORE_API_KEY"]).toBeUndefined();

  await withServer({ env: config.env }, async (call) => {
    const required = await providerRow(call, "keyreq", "list");
    expect(required.status).toBe("inactive");
    expect(required.inactive_reason).toBe("no_api_key");

    const health = await providerRow(call, "keyreq", "health");
    expect(health.status).toBe("inactive");
    expect(health.inactive_reason).toBe("no_api_key");
    expect(health.auth_ok).toBe(false);
  });
});

test("REQ-011 optional-key: an optional credential absent leaves the provider operable", async () => {
  stub = await startStubProvider("ok");
  const config = writeHermeticConfig(stub.url, {
    providers: [{ slug: "keyopt", authEnv: "INFOBROKER_KEYOPT_API_KEY", authOptional: true }],
  });
  expect(config.env["INFOBROKER_KEYOPT_API_KEY"]).toBeUndefined();

  await withServer({ env: config.env }, async (call) => {
    const row = await providerRow(call, "keyopt", "list");
    expect(row.status).toBe("active");
    expect(row.inactive_reason).toBeUndefined();
  });
});

test("REQ-104 pool-state: a rejected pool is reported without key material", async () => {
  stub = await startStubProvider("echo401");
  const config = writeHermeticConfig(stub.url, {
    providers: [{ slug: "keystub", authEnv: "INFOBROKER_KEYSTUB_API_KEY" }],
  });
  config.env["INFOBROKER_KEYSTUB_API_KEYS"] = `${SENTINEL_ONE},${SENTINEL_TWO}`;

  await withServer({ env: config.env }, async (call) => {
    // One call per key: each 401 rejects the presented credential for the session.
    const first = await callTool(call, "infobroker_search_web", {
      query: "stub query",
      provider: "keystub",
      task_type: "general_web",
    });
    expect(toolText(first).startsWith("[ERROR] ")).toBe(true);
    const second = await callTool(call, "infobroker_search_web", {
      query: "stub query",
      provider: "keystub",
      task_type: "general_web",
    });
    expect(toolText(second).startsWith("[ERROR] ")).toBe(true);

    const row = await providerRow(call, "keystub", "list");
    expect(row.status).toBe("inactive");
    expect(row.inactive_reason).toBe("credentials_unavailable");
    const pool = row.key_pool as Array<Record<string, unknown>>;
    expect(Array.isArray(pool)).toBe(true);
    expect(pool).toHaveLength(2);
    for (const entry of pool) {
      expect(entry.available).toBe(false);
      expect(entry.reason).toBe("rejected");
    }
    expectNoSentinel(toolText(first) + toolText(second) + JSON.stringify(pool));
  });
});

test("REQ-011 no-leak: credentials never reach output, logs, config, or state", async () => {
  // Successful path: a real key is spent on a 200 response.
  stub = await startStubProvider("ok");
  const okConfig = writeHermeticConfig(stub.url, {
    providers: [{ slug: "keystub", authEnv: "INFOBROKER_KEYSTUB_API_KEY" }],
    fileLogs: true,
  });
  okConfig.env["INFOBROKER_KEYSTUB_API_KEY"] = SENTINEL_ONE;

  const output: string[] = [];
  await withServer({ env: okConfig.env }, async (call) => {
    output.push(toolText(await callTool(call, "infobroker_search_web", {
      query: "stub query",
      provider: "keystub",
      task_type: "general_web",
    })));
    output.push(toolText(await callTool(call, "infobroker_inspect_providers", { action: "list" })));
    output.push(toolText(await callTool(call, "infobroker_inspect_providers", { action: "health", provider: "keystub" })));
    output.push(toolText(await callTool(call, "infobroker_inspect_providers", { action: "spec" })));
    output.push(toolText(await callTool(call, "infobroker_reload_config", {})));
  });
  expectNoSentinel(output.join("\n"));
  expectNoSentinel(stateCorpus(okConfig));
  // The persisted pool state exists and carries no key material.
  expect(existsSync(join(okConfig.root, "key-pool.json"))).toBe(true);
  expect(okConfig.callLogPath && existsSync(okConfig.callLogPath)).toBe(true);
  expect(okConfig.auditLogPath && existsSync(okConfig.auditLogPath)).toBe(true);

  // Failure path: the stub echoes the presented credential in its 401 body.
  await stub.close();
  stub = await startStubProvider("echo401");
  const failConfig = writeHermeticConfig(stub.url, {
    providers: [{ slug: "keystub", authEnv: "INFOBROKER_KEYSTUB_API_KEY" }],
    fileLogs: true,
  });
  failConfig.env["INFOBROKER_KEYSTUB_API_KEY"] = SENTINEL_TWO;

  const failOutput: string[] = [];
  await withServer({ env: failConfig.env }, async (call) => {
    failOutput.push(toolText(await callTool(call, "infobroker_search_web", {
      query: "stub query",
      provider: "keystub",
      task_type: "general_web",
    })));
    failOutput.push(toolText(await callTool(call, "infobroker_inspect_providers", { action: "list" })));
    failOutput.push(toolText(await callTool(call, "infobroker_reload_config", {})));
  });
  expectNoSentinel(failOutput.join("\n"));
  expectNoSentinel(stateCorpus(failConfig));
  expect(failConfig.auditLogPath && existsSync(failConfig.auditLogPath)).toBe(true);
  // A rejected credential persists as a non-reversible id, never as the key.
  const poolState = readFileSync(join(failConfig.root, "key-pool.json"), "utf-8");
  expect(poolState).toMatch(/"keys":\{"[0-9a-f]{6,8}"/);
});
