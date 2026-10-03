// @implements REQ-035 REQ-071
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("./config.js", () => ({
  getConfig: () => ({ providers: {} }),
}));

import { infobrokerFetch } from "./http.js";
import { USER_AGENT } from "./lib/html.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("outbound HTTP identification (REQ-071)", () => {
  it("sets the Infobroker User-Agent when none is supplied", async () => {
    let seen: Headers | undefined;
    globalThis.fetch = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      seen = new Headers(init?.headers);
      return new Response("ok");
    }) as unknown as typeof fetch;

    await infobrokerFetch("https://example.com");
    expect(seen?.get("User-Agent")).toBe(USER_AGENT);
  });

  it("preserves a caller-supplied User-Agent", async () => {
    let seen: Headers | undefined;
    globalThis.fetch = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      seen = new Headers(init?.headers);
      return new Response("ok");
    }) as unknown as typeof fetch;

    await infobrokerFetch("https://example.com", { headers: { "User-Agent": "custom/1.0" } });
    expect(seen?.get("User-Agent")).toBe("custom/1.0");
  });
});

describe("request timeout (REQ-035)", () => {
  it("aborts a fetch that outlives the configured timeout", async () => {
    globalThis.fetch = vi.fn(
      (_url: string | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
    ) as unknown as typeof fetch;

    await expect(infobrokerFetch("https://example.com", { timeoutMs: 10 })).rejects.toThrow("aborted");
  });
});
