// @implements REQ-031 REQ-137
// The fan-out tools carry a wall-clock budget, so a hung provider cannot keep
// a call open indefinitely. The budget is injected small here; the shipped
// default is 300s.
import { test, expect } from "vitest";
import { startStubProvider, writeHermeticConfig } from "./lib/stub-provider.js";
import { withServer } from "./lib/mcp-stdio.js";

function parse(text: string) {
  const prefix = text.startsWith("[ERROR] ") ? "[ERROR] " : "[OK] ";
  return JSON.parse(text.slice(prefix.length)) as {
    status: string;
    error?: { code: string; message: string };
  };
}

test("a hanging provider is cut off by the request budget", async () => {
  const slow = await startStubProvider({ mode: "ok", delayMs: 5_000 });
  const cfg = writeHermeticConfig(slow.url, {
    providers: [
      {
        slug: "stub_slow",
        url: slow.url,
        authEnv: "INFOBROKER_STUB_SLOW_API_KEY",
        authOptional: true,
        retryCount: 0,
      },
    ],
    output: { request_budget_ms: 700 },
  });

  try {
    await withServer({ env: cfg.env }, async (call) => {
      const started = Date.now();
      const msg = await call("tools/call", {
        name: "infobroker_search_web",
        arguments: { query: "budget probe", fresh: true, task_type: "general_web" },
      });
      const text = (msg.result as { content?: Array<{ text?: string }> } | undefined)?.content?.[0]?.text ?? "";
      const payload = parse(text);
      expect(payload.status).toBe("error");
      expect(payload.error?.code).toBe("internal_error");
      expect(payload.error?.message).toMatch(/request budget/);
      expect(Date.now() - started).toBeLessThan(4_000);
    });
  } finally {
    await slow.close();
  }
});
