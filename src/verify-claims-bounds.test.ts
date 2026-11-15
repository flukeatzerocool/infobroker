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
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { makeIsolatedConfig, type IsolatedConfig } from "./lib/test-isolation.js";
import { startMcpServer, type McpServer } from "./lib/mcp-stdio.js";
/** The cap written into the isolated config, so a literal in the message fails. */
const MAX_BATCH = 2;

interface ToolResult {
  content: Array<{ type: string; text: string }>;
  structuredContent?: Record<string, unknown>;
}

let iso: IsolatedConfig;
let server: McpServer;

beforeAll(async () => {
  iso = makeIsolatedConfig();
  const config = JSON.parse(readFileSync(iso.configPath, "utf-8")) as {
    corroboration?: Record<string, unknown>;
  };
  config.corroboration = { ...(config.corroboration ?? {}), max_batch_claims: MAX_BATCH };
  writeFileSync(iso.configPath, JSON.stringify(config, null, 2));

  server = await startMcpServer({ env: iso.env, clientName: "verify-claims-bounds-test", timeoutMs: 20_000 });
}, 60_000);

afterAll(async () => {
  await server?.stop();
  if (iso) rmSync(iso.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

/** Call `verify_claims` and return the parsed `[ERROR]` envelope body. */
async function verifyError(args: Record<string, unknown>): Promise<{ error: { code: string; message: string } }> {
  const response = await server.call("tools/call", { name: "infobroker_verify_claims", arguments: args });
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
