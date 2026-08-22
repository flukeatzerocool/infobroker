// @implements REQ-014
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGenericProvider } from "./generic-http.js";
import type { ProviderConfig } from "../types.js";

type FetchResponse = { ok: boolean; status: number; json: () => Promise<unknown> };
const mockFetch = vi.fn(async (_url: string): Promise<FetchResponse> => ({ ok: true, status: 200, json: async () => ({}) }));

vi.mock("../http.js", () => ({
  infobrokerFetch: (url: string) => mockFetch(url),
}));

function cfg(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    tier: "generic_http",
    capabilities: ["web_search"],
    rate_limit: {},
    enabled: true,
    priority: 20,
    endpoint: "https://api.example.com/search",
    query_param: "q",
    results_path: "data.items",
    field_map: { title: "name", url: "link", snippet: "summary" },
    ...overrides,
  };
}

function jsonResponse(data: unknown): FetchResponse {
  return { ok: true, status: 200, json: async () => data };
}

describe("generic-http provider", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("maps a nested results_path and field_map to the normalized shape", async () => {
    mockFetch.mockImplementation(async () =>
      jsonResponse({
        data: {
          items: [
            { name: "Alpha", link: "https://a.example.com", summary: "summary A" },
            { name: "Beta", link: "https://b.example.com", summary: "summary B" },
          ],
        },
      })
    );

    const p = createGenericProvider("my_search", cfg());
    const results = await p.search("test");

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      title: "Alpha",
      url: "https://a.example.com",
      snippet: "summary A",
    });
    expect(results[1].title).toBe("Beta");
  });

  it("builds the request URL from endpoint and query_param", async () => {
    mockFetch.mockImplementation(async () => jsonResponse([]));

    const p = createGenericProvider("my_search", cfg({ results_path: undefined }));
    await p.search("hello world");

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("https://api.example.com/search");
    expect(url).toContain("q=hello%20world");
  });

  it("discards results with a missing URL via the normalizer", async () => {
    mockFetch.mockImplementation(async () =>
      jsonResponse([
        { name: "NoLink", link: "", summary: "no url" },
        { name: "HasLink", link: "https://ok.example.com", summary: "yes" },
      ])
    );

    const p = createGenericProvider("my_search", cfg({ results_path: undefined }));
    const results = await p.search("test");

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://ok.example.com");
  });

  it("throws a retryable error when results_path is not an array", async () => {
    mockFetch.mockImplementation(async () => jsonResponse({ data: { not_an_array: true } }));

    const p = createGenericProvider("my_search", cfg({ results_path: "data.items" }));
    await expect(p.search("test")).rejects.toThrow(/did not resolve to an array/);
  });

  it("reports active health on a successful endpoint probe", async () => {
    mockFetch.mockImplementation(async () => jsonResponse({ items: [] }));

    const p = createGenericProvider("my_search", cfg());
    const h = await p.health();

    expect(h.status).toBe("active");
  });

  it("surfaces original_source when the field_map declares it", async () => {
    mockFetch.mockImplementation(async () =>
      jsonResponse({
        items: [
          {
            name: "Resold",
            link: "https://aggregator.example.com/x",
            summary: "aggregated",
            origin: "https://primary.example.com/source",
          },
        ],
      })
    );

    const p = createGenericProvider(
      "my_search",
      cfg({ results_path: "items", field_map: { title: "name", url: "link", snippet: "summary", original_source: "origin" } })
    );
    const results = await p.search("test");

    expect(results).toHaveLength(1);
    expect(results[0].original_source).toBe("https://primary.example.com/source");
  });
});
