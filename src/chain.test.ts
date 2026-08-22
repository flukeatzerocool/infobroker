// @implements REQ-020c REQ-020d
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./config.js", () => ({
  getConfig: vi.fn(),
  getDispatchChain: vi.fn(),
}));

import { getConfig, getDispatchChain } from "./config.js";
import { selectChain, ignoredParams } from "./chain.js";

function makeProvider(tier: string) {
  return { tier, enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10 };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("selectChain", () => {
  it("returns the default chain for quality or omitted priority", () => {
    const chain = ["brave", "duckduckgo", "marginalia"];
    vi.mocked(getConfig).mockReturnValue({ providers: {}, dispatch: {} } as any);
    expect(selectChain(chain, "quality", () => 0)).toEqual(chain);
    expect(selectChain(chain, undefined, () => 0)).toEqual(chain);
  });

  it("routes privacy priority to the privacy_critical chain", () => {
    vi.mocked(getConfig).mockReturnValue({ providers: {}, dispatch: {} } as any);
    vi.mocked(getDispatchChain).mockReturnValue(["duckduckgo", "searxng", "mojeek"]);
    expect(selectChain(["brave", "duckduckgo"], "privacy", () => 0)).toEqual(["duckduckgo", "searxng", "mojeek"]);
  });

  it("falls back to the given chain when privacy_critical is empty", () => {
    vi.mocked(getConfig).mockReturnValue({ providers: {}, dispatch: {} } as any);
    vi.mocked(getDispatchChain).mockReturnValue([]);
    expect(selectChain(["brave", "duckduckgo"], "privacy", () => 0)).toEqual(["brave", "duckduckgo"]);
  });

  it("free_only excludes keyed and self-hosted providers", () => {
    vi.mocked(getConfig).mockReturnValue({
      providers: {
        brave: makeProvider("keyed_http"),
        duckduckgo: makeProvider("builtin"),
        marginalia: makeProvider("builtin"),
        searxng: makeProvider("self_hosted_http"),
      },
      dispatch: { general_web: ["duckduckgo", "marginalia"] },
    } as any);
    expect(selectChain(["brave", "duckduckgo", "marginalia", "searxng"], "free_only", () => 0))
      .toEqual(["duckduckgo", "marginalia"]);
  });

  it("speed orders providers by ascending latency", () => {
    vi.mocked(getConfig).mockReturnValue({ providers: {}, dispatch: {} } as any);
    const latencies: Record<string, number> = { a: 500, b: 100, c: 300 };
    expect(selectChain(["a", "b", "c"], "speed", (s) => latencies[s] ?? 0)).toEqual(["b", "c", "a"]);
  });
});

describe("ignoredParams", () => {
  it("returns empty when the provider supports all supplied params", () => {
    expect(ignoredParams("duckduckgo", { time_range: "week", safe_search: "on" })).toEqual([]);
  });

  it("flags time_range for providers that ignore it", () => {
    expect(ignoredParams("wikipedia", { time_range: "week" })).toEqual(["time_range"]);
  });

  it("flags page > 1 for providers without pagination support", () => {
    expect(ignoredParams("wikipedia", { page: 2 })).toEqual(["page"]);
  });

  it("does not flag page 1 as ignored", () => {
    expect(ignoredParams("wikipedia", { page: 1 })).toEqual([]);
  });

  it("flags safe_search off for providers that ignore it", () => {
    expect(ignoredParams("wikipedia", { safe_search: "off" })).toEqual(["safe_search"]);
  });

  it("does not flag safe_search on", () => {
    expect(ignoredParams("wikipedia", { safe_search: "on" })).toEqual([]);
  });
});
