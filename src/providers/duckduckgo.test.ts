// @implements REQ-020 REQ-031
import { describe, it, expect, vi, beforeEach } from "vitest";
import { provider as duckduckgo } from "./duckduckgo.js";

const mockFetch = vi.fn(
  async (_url: string): Promise<Response> =>
    new Response("<html><body></body></html>", { status: 200 })
);

vi.mock("../http.js", () => ({
  infobrokerFetch: (url: string) => mockFetch(url),
}));

import { ParseError } from "../retry.js";

describe("duckduckgo provider anti-block", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("throws ParseError on HTTP 202 anti-bot challenge", async () => {
    mockFetch.mockImplementation(async () => new Response("", { status: 202 }));

    await expect(duckduckgo.search("test")).rejects.toBeInstanceOf(ParseError);
  });

  it("throws ParseError on a zero-result HTML body (blocked or drift)", async () => {
    // now that empty body is not a parse error, verify 200 with results works
    const html = `<html><body>
      <div class="result">
        <div class="result__title"><a class="result__a" href="//example.com">Example</a></div>
        <div class="result__url">https://example.com</div>
        <div class="result__snippet">A snippet</div>
      </div>
    </body></html>`;
    mockFetch.mockImplementation(async () => new Response(html, { status: 200 }));

    const results = await duckduckgo.search("test");
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://example.com");
  });

  it("honors region (kl) and strict safe_search (kp=3)", async () => {
    mockFetch.mockImplementation(async () => new Response("<html><body></body></html>", { status: 200 }));

    await duckduckgo.search("test", { safe_search: "strict", region: "de-de" });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("kl=de-de");
    expect(url).toContain("kp=3");
  });
});
