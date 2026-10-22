// @implements REQ-020 REQ-095
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn(async (_url: string): Promise<Response> => new Response("{}", { status: 200 }));

vi.mock("../http.js", () => ({
  infobrokerFetch: (url: string) => mockFetch(url),
}));

async function loadGithub() {
  vi.resetModules();
  return (await import("./github.js")).provider;
}

describe("github keyless fallback", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    delete process.env.INFOBROKER_GITHUB_API_KEY;
    delete process.env.INFOBROKER_GITHUB_API_KEYS;
  });
  afterEach(() => {
    delete process.env.INFOBROKER_GITHUB_API_KEY;
    delete process.env.INFOBROKER_GITHUB_API_KEYS;
  });

  it("uses repository search when no token is configured", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ items: [{ full_name: "acme/widget", html_url: "https://github.com/acme/widget", description: "A widget" }] }), { status: 200 }),
    );
    const provider = await loadGithub();
    const results = await provider.search!("widget");
    expect(mockFetch.mock.calls[0][0]).toContain("/search/repositories");
    expect(results[0].url).toBe("https://github.com/acme/widget");
    expect(results[0].snippet).toBe("A widget");
  });

  it("uses code search when a token is configured", async () => {
    process.env.INFOBROKER_GITHUB_API_KEY = "token";
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ items: [{ name: "w.ts", path: "src/w.ts", html_url: "https://github.com/acme/widget/blob/main/src/w.ts", repository: { full_name: "acme/widget", html_url: "https://github.com/acme/widget" } }] }), { status: 200 }),
    );
    const provider = await loadGithub();
    const results = await provider.search!("widget");
    expect(mockFetch.mock.calls[0][0]).toContain("/search/code");
    expect(results[0].url).toContain("/blob/main/src/w.ts");
  });
});
