// @implements REQ-024b disabled-refusal REQ-024b last-history REQ-024c request-count REQ-013 provider-probe-active REQ-013 provider-probe-degraded REQ-013 provider-probe-inactive
// REQ-024b: a disabled provider is not probed and reports its reason; the
// report carries the recorded history. REQ-024c: the spec count is server tool
// requests, not provider samples. REQ-013: the health action drives a real
// probe into the shared assessment for all three observable legs.
//
// Every case runs against a hermetic config and a loopback SearXNG stub, so no
// external request is possible (src/lib/stub-provider.ts).
import { afterAll, afterEach, expect, test } from "vitest";
import { closedPortUrl, startStubProvider, writeHermeticConfig, type StubProvider } from "./lib/stub-provider.js";
import { withServer, type RpcMessage } from "./lib/mcp-stdio.js";

interface ToolPayload {
  status: string;
  results: Array<Record<string, unknown>>;
}

function parseOk(msg: RpcMessage): ToolPayload {
  const result = msg.result as { content?: Array<{ type: string; text?: string }> } | undefined;
  const text = result?.content?.find((part) => part.type === "text")?.text ?? "";
  expect(text.startsWith("[OK] ")).toBe(true);
  return JSON.parse(text.slice(5)) as ToolPayload;
}

function toolText(msg: RpcMessage): string {
  const result = msg.result as { content?: Array<{ type: string; text?: string }> } | undefined;
  return result?.content?.find((part) => part.type === "text")?.text ?? "";
}

async function health(call: (m: string, p: unknown) => Promise<RpcMessage>, provider: string) {
  return parseOk(await call("tools/call", { name: "infobroker_inspect_providers", arguments: { action: "health", provider } }))
    .results[0] as Record<string, unknown>;
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

test("REQ-024b: a config-disabled provider is reported inactive with its reason and is not probed", async () => {
  stub = await startStubProvider("ok");
  const { env } = writeHermeticConfig(stub.url);

  await withServer({ env: env }, async (call) => {
    // wikipedia is disabled by the hermetic config.
    const row = await health(call, "wikipedia");
    expect(row.status).toBe("inactive");
    expect(row.inactive_reason).toBe("disabled");
    expect(row.auth_ok).toBe(false);

    // The inline fallback has no probe target and no credential; it keeps its
    // pre-existing active row (planned DB-1 pin).
    const inline = await health(call, "native_fetch");
    expect(inline.status).toBe("active");
    expect(inline.auth_ok).toBe(true);
    expect(inline.inactive_reason).toBeUndefined();
  });
});

test("REQ-024b: recorded success and failure timestamps appear on the health report", async () => {
  stub = await startStubProvider("ok");
  const okConfig = writeHermeticConfig(stub.url);
  await withServer({ env: okConfig.env }, async (call) => {
    const search = await call("tools/call", {
      name: "infobroker_search_web",
      arguments: { query: "stub query", provider: "searxng", task_type: "general_web" },
    });
    expect(toolText(search).startsWith("[OK] ")).toBe(true);
    const row = await health(call, "searxng");
    expect(typeof row.last_success).toBe("string");
    expect(row.last_error).toBeUndefined();
    // The health probe must not itself record a success.
    const before = row.last_success;
    const again = await health(call, "searxng");
    expect(again.last_success).toBe(before);
  });

  await stub.close();
  stub = await startStubProvider("missing");
  const missingConfig = writeHermeticConfig(stub.url);
  await withServer({ env: missingConfig.env }, async (call) => {
    const search = await call("tools/call", {
      name: "infobroker_search_web",
      arguments: { query: "stub query", provider: "searxng", task_type: "general_web" },
    });
    expect(toolText(search).startsWith("[ERROR] ")).toBe(true);
    const row = await health(call, "searxng");
    expect(typeof row.last_error).toBe("string");
    expect(row.last_success).toBeUndefined();
    expect(row.status).toBe("degraded");
  });
});

test("REQ-024c: total_requests_served counts tool requests, not provider samples", async () => {
  stub = await startStubProvider("ok");
  const { env } = writeHermeticConfig(stub.url);

  await withServer({ env: env }, async (call) => {
    await call("tools/call", { name: "infobroker_inspect_providers", arguments: { action: "list" } });
    await call("tools/call", { name: "infobroker_inspect_providers", arguments: { action: "list" } });
    const phaseA = parseOk(await call("tools/call", { name: "infobroker_inspect_providers", arguments: { action: "spec" } }))
      .results[0] as Record<string, unknown>;
    // Two completed tool calls; the in-flight spec call excludes itself.
    expect(phaseA.total_requests_served).toBe(2);

    // One search makes exactly one provider sample; the served count must move
    // only by tool requests. Phase A's spec call was itself the third tool
    // request, so the search is the fourth and the second spec sees 4
    // (plan DB-3 said 3 and omitted phase A's spec call; deviation recorded).
    await call("tools/call", {
      name: "infobroker_search_web",
      arguments: { query: "stub query", provider: "searxng", task_type: "general_web" },
    });
    const phaseB = parseOk(await call("tools/call", { name: "infobroker_inspect_providers", arguments: { action: "spec" } }))
      .results[0] as Record<string, unknown>;
    expect(phaseB.total_requests_served).toBe(4);
    expect(stub!.requests).toBeGreaterThan(0);
  });
});

test("REQ-013: the health action drives the probe into the shared assessment", async () => {
  stub = await startStubProvider("ok");
  const healthy = writeHermeticConfig(stub.url);
  await withServer({ env: healthy.env }, async (call) => {
    const row = await health(call, "searxng");
    expect(row.status).toBe("active");
    expect(row.inactive_reason).toBeUndefined();
  });
  await stub.close();

  stub = await startStubProvider("missing");
  const degraded = writeHermeticConfig(stub.url);
  await withServer({ env: degraded.env }, async (call) => {
    const row = await health(call, "searxng");
    expect(row.status).toBe("degraded");
    expect(row.inactive_reason).toBeUndefined();
  });
  await stub.close();

  const closed = await closedPortUrl();
  const unreachable = writeHermeticConfig(closed);
  await withServer({ env: unreachable.env }, async (call) => {
    const row = await health(call, "searxng");
    expect(row.status).toBe("inactive");
    expect(row.inactive_reason).toBeUndefined();
  });
});
