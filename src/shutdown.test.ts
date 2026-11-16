// @implements REQ-066
// A client disconnect (stdin close) must end the process. The KB maintenance
// interval and the quota debounce are the timers that used to keep it alive.
import { test, expect } from "vitest";
import { startMcpServer } from "./lib/mcp-stdio.js";
import { writeHermeticConfig } from "./lib/stub-provider.js";

test("the server exits within 3s of stdin closing", async () => {
  const cfg = writeHermeticConfig("http://127.0.0.1:1");
  const server = await startMcpServer({ env: cfg.env });
  const { code, ms } = await server.closeAndWait(3_000);

  expect(code).toBe(0);
  expect(ms).toBeLessThan(3_000);
});
