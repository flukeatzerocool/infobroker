// @implements REQ-020 REQ-095
import { describe, it, expect, vi, beforeEach } from "vitest";
import { provider as openalex } from "./openalex.js";
import { provider as europe_pmc } from "./europe_pmc.js";
import { provider as hacker_news } from "./hacker_news.js";
import { provider as gdelt } from "./gdelt.js";
import { provider as sec_edgar } from "./sec_edgar.js";
import { provider as world_bank } from "./world_bank.js";

const mockFetch = vi.fn(async (_url: string): Promise<Response> => new Response("{}", { status: 200 }));

vi.mock("../http.js", () => ({
  infobrokerFetch: (url: string) => mockFetch(url),
}));

describe("zero-config financial/academic/news providers", () => {
  beforeEach(() => mockFetch.mockReset());

  it("openalex parses works into academic results", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(JSON.stringify({ results: [{ display_name: "A Paper", id: "https://openalex.org/W1", publication_year: 2025 }] }), { status: 200 })
    );
    const results = await openalex.search("q");
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://openalex.org/W1");
    expect(results[0].source_type).toBe("academic");
  });

  it("europe_pmc parses results into academic results", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(JSON.stringify({ resultList: { result: [{ title: "B", pmid: "123", authorString: "A. Author", pubYear: "2024" }] } }), { status: 200 })
    );
    const results = await europe_pmc.search("q");
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://europepmc.org/article/MED/123");
    expect(results[0].source_type).toBe("academic");
  });

  it("hacker_news falls back to item URL when no story URL", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(JSON.stringify({ hits: [{ title: "Ask HN", objectID: "99", points: 3, author: "x" }] }), { status: 200 })
    );
    const results = await hacker_news.search("q");
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://news.ycombinator.com/item?id=99");
    expect(results[0].source_type).toBe("news");
  });

  it("gdelt parses articles into news results", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(JSON.stringify({ articles: [{ title: "N", url: "https://news.example/", seendate: "20260904" }] }), { status: 200 })
    );
    const results = await gdelt.search("q");
    expect(results).toHaveLength(1);
    expect(results[0].source_type).toBe("news");
  });

  it("sec_edgar parses filings into financial results", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(JSON.stringify({ hits: { hits: [{ _source: { display_names: ["Apple Inc."], ciks: ["0000320193"], file_date: "2026-01-01", forms: ["10-K"] } }] } }), { status: 200 })
    );
    const results = await sec_edgar.search("q");
    expect(results).toHaveLength(1);
    expect(results[0].url).toContain("browse-edgar");
    expect(results[0].source_type).toBe("structured_fact");
  });

  it("world_bank parses documents into financial results", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(JSON.stringify({ documents: { documents: [{ title: "W", url: "https://wb.example/", docdt: "2025-01-01T00:00:00Z" }] } }), { status: 200 })
    );
    const results = await world_bank.search("q");
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://wb.example/");
  });
});
