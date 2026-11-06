// @implements REQ-014 REQ-003 original-source
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createGenericProvider } from "./generic-http.js";
import { ParseError } from "../retry.js";
import type { ProviderConfig } from "../types.js";

type FetchResponse = { ok: boolean; status: number; headers: { get: (name: string) => string | null }; json: () => Promise<unknown> };
const mockFetch = vi.fn(
  async (_url: string, _init?: unknown): Promise<FetchResponse> => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({}),
  })
);

vi.mock("../http.js", () => ({
  infobrokerFetch: (url: string, init?: unknown) => mockFetch(url, init),
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
  return { ok: true, status: 200, headers: new Headers({ "content-type": "application/json" }), json: async () => data };
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

  it("omits original_source when the field_map does not declare it", async () => {
    mockFetch.mockImplementation(async () =>
      jsonResponse({
        items: [
          { name: "First-party", link: "https://primary.example.com/x", summary: "origin is the page" },
        ],
      })
    );

    const p = createGenericProvider(
      "my_search",
      cfg({ results_path: "items", field_map: { title: "name", url: "link", snippet: "summary" } })
    );
    const results = await p.search("test");

    expect(results).toHaveLength(1);
    expect(results[0].original_source).toBeUndefined();
  });

  afterEach(() => {
    delete process.env["INFOBROKER_MYSEARCH_API_KEY"];
  });

  it("sends env-backed bearer auth when auth_env is set", async () => {
    process.env["INFOBROKER_MYSEARCH_API_KEY"] = "secret";
    mockFetch.mockImplementation(async () => jsonResponse({ data: { items: [] } }));

    const p = createGenericProvider("my_search", cfg({ auth_env: "INFOBROKER_MYSEARCH_API_KEY" }));
    await p.search("test");

    const init = mockFetch.mock.calls[0][1] as { headers?: Record<string, string> };
    expect(init.headers).toEqual({ Authorization: "Bearer secret" });
  });

  it("sends no auth header when auth_optional and the key is unset", async () => {
    mockFetch.mockImplementation(async () => jsonResponse({ data: { items: [] } }));

    const p = createGenericProvider(
      "my_search",
      cfg({ auth_env: "INFOBROKER_MYSEARCH_API_KEY", auth_optional: true })
    );
    await p.search("test");

    const init = mockFetch.mock.calls[0][1] as { headers?: Record<string, string> };
    expect(init.headers).toEqual({});
  });

  it("fails clearly when a required auth key is unset", async () => {
    mockFetch.mockImplementation(async () => jsonResponse({ data: { items: [] } }));

    const p = createGenericProvider("my_search", cfg({ auth_env: "INFOBROKER_MYSEARCH_API_KEY" }));
    await expect(p.search("test")).rejects.toThrow(/requires INFOBROKER_MYSEARCH_API_KEY/);
  });

  it("resolves root-relative result URLs against the endpoint", async () => {
    mockFetch.mockImplementation(async () =>
      jsonResponse({ items: [{ name: "Relative", link: "/item/1", summary: "s" }] })
    );

    const p = createGenericProvider("my_search", cfg({ results_path: "items" }));
    const results = await p.search("test");

    expect(results[0].url).toBe("https://api.example.com/item/1");
  });

  it("throws ParseError for a non-JSON response", async () => {
    mockFetch.mockImplementation(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    }));

    const p = createGenericProvider("my_search", cfg());
    await expect(p.search("test")).rejects.toBeInstanceOf(ParseError);
  });

  it("probes health_endpoint without a search query", async () => {
    mockFetch.mockImplementation(async () => jsonResponse({ ok: true }));

    const p = createGenericProvider(
      "my_search",
      cfg({ health_endpoint: "https://api.example.com/health" })
    );
    const h = await p.health();

    expect(h.status).toBe("active");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe("https://api.example.com/health");
  });

  it("applies max_results after discarding unmappable rows", async () => {
    mockFetch.mockImplementation(async () =>
      jsonResponse({
        items: [
          { name: "NoLink1", link: "", summary: "a" },
          { name: "NoLink2", link: "", summary: "b" },
          { name: "HasLink", link: "https://ok.example.com", summary: "c" },
        ],
      })
    );

    const p = createGenericProvider("my_search", cfg({ results_path: "items" }));
    const results = await p.search("test", { max_results: 1 });

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://ok.example.com");
  });

  it("maps scholarly field_map keys and array/number leaves", async () => {
    mockFetch.mockImplementation(async () =>
      jsonResponse({
        items: [
          {
            name: "Paper",
            link: "https://paper.example.com/x",
            summary: "abstract text",
            names: ["Ada", "Grace"],
            doi: "10.1/x",
            journal: "Journal",
            citations: 42,
          },
        ],
      })
    );

    const p = createGenericProvider(
      "my_search",
      cfg({
        results_path: "items",
        field_map: {
          title: "name",
          url: "link",
          snippet: "summary",
          authors: "names",
          doi: "doi",
          venue: "journal",
          abstract: "summary",
          citation_count: "citations",
        },
      })
    );
    const results = await p.search("test");

    expect(results[0]).toMatchObject({
      authors: ["Ada", "Grace"],
      doi: "10.1/x",
      venue: "Journal",
      abstract: "abstract text",
      citation_count: 42,
    });
  });
});
