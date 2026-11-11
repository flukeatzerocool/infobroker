// @implements REQ-020 REQ-095 REQ-128
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RetryableError } from "../retry.js";
import { provider as openalex } from "./openalex.js";
import { provider as europe_pmc } from "./europe_pmc.js";
import { provider as crossref } from "./crossref.js";
import { provider as arxiv } from "./arxiv.js";
import { provider as semantic_scholar } from "./semantic_scholar.js";
import { provider as hacker_news } from "./hacker_news.js";
import { provider as gdelt } from "./gdelt.js";
import { provider as sec_edgar } from "./sec_edgar.js";
import { provider as world_bank } from "./world_bank.js";

const mockFetch = vi.fn(async (_url: string): Promise<Response> => new Response("{}", { status: 200 }));

vi.mock("../http.js", () => ({
  infobrokerFetch: (url: string) => mockFetch(url),
}));

describe("zero-config financial/academic/news providers", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

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

  it("gdelt forwards a requested source language (REQ-128)", async () => {
    mockFetch.mockImplementation(async () => new Response(JSON.stringify({ articles: [] }), { status: 200 }));
    await gdelt.search("q", { language: "de" });
    expect(String(mockFetch.mock.calls[0][0])).toContain("sourcelang=german");
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

  describe("world_bank indicator path (REQ-095)", () => {
    const COUNTRIES = [
      { id: "USA", iso2Code: "US", name: "United States" },
      { id: "DEU", iso2Code: "DE", name: "Germany" },
      { id: "WLD", iso2Code: "1W", name: "World" },
    ];
    const countryEnvelope = () => [{ page: 1, pages: 1, per_page: "400", total: 3 }, COUNTRIES];
    const indicatorEnvelope = (id: string, rows: Array<{ date: string; value: number | null; iso3?: string; name?: string }>) => [
      { page: 1, pages: 1, per_page: "10" },
      rows.map((row) => ({
        indicator: { id, value: id === "NY.GDP.MKTP.CD" ? "GDP (current US$)" : "GDP growth (annual %)" },
        country: { id: "US", value: row.name ?? "United States" },
        countryiso3code: row.iso3 ?? "USA",
        date: row.date,
        value: row.value,
      })),
    ];

    function route(documents: unknown, indicator: unknown) {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes("/v2/country?")) return new Response(JSON.stringify(countryEnvelope()), { status: 200 });
        if (url.includes("/indicator/")) return new Response(JSON.stringify(indicator), { status: 200 });
        return new Response(JSON.stringify(documents), { status: 200 });
      });
    }

    it("parses a country indicator series into structured facts", async () => {
      route(
        { documents: { documents: [] } },
        indicatorEnvelope("NY.GDP.MKTP.CD", [
          { date: "2025", value: 30769700000000 },
          { date: "2024", value: 29298013000000 },
        ])
      );
      const results = await world_bank.search("US GDP");
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("United States — GDP (current US$) (2025)");
      expect(results[0].url).toBe("https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=USA");
      expect(results[0].snippet).toBe("30,769,700,000,000 · 2025 · World Bank indicator");
      expect(results[0].source_type).toBe("structured_fact");
      expect(results[0].published_date).toBeUndefined();
      const urls = mockFetch.mock.calls.map((call) => String(call[0]));
      expect(urls.some((url) => url.includes("/v2/country/USA/indicator/NY.GDP.MKTP.CD"))).toBe(true);
    });

    it("defaults to the World aggregate when the query names no country", async () => {
      route({ documents: { documents: [] } }, indicatorEnvelope("FP.CPI.TOTL.ZG", [{ date: "2025", value: 3.04, iso3: "WLD", name: "World" }]));
      await world_bank.search("world inflation");
      const urls = mockFetch.mock.calls.map((call) => String(call[0]));
      expect(urls.some((url) => url.includes("/v2/country/WLD/indicator/"))).toBe(true);
    });

    it("prefers the longest indicator alias", async () => {
      route({ documents: { documents: [] } }, indicatorEnvelope("NY.GDP.MKTP.KD.ZG", [{ date: "2025", value: 2.5 }]));
      await world_bank.search("gdp growth");
      const urls = mockFetch.mock.calls.map((call) => String(call[0]));
      expect(urls.some((url) => url.includes("/indicator/NY.GDP.MKTP.KD.ZG"))).toBe(true);
      expect(urls.some((url) => url.includes("/indicator/NY.GDP.MKTP.CD"))).toBe(false);
    });

    it("drops observations with no value", async () => {
      route(
        { documents: { documents: [] } },
        indicatorEnvelope("NY.GDP.MKTP.CD", [
          { date: "2025", value: 1 },
          { date: "2024", value: null },
        ])
      );
      const results = await world_bank.search("US GDP");
      expect(results).toHaveLength(1);
    });

    it("throws a retryable error for a failing indicator response", async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes("/v2/country?")) return new Response(JSON.stringify(countryEnvelope()), { status: 200 });
        return new Response("", { status: 503 });
      });
      await expect(world_bank.search("US GDP")).rejects.toBeInstanceOf(RetryableError);
    });

    it("falls back to documents when the country list cannot be fetched", async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes("/v2/country?")) return new Response("", { status: 500 });
        return new Response(
          JSON.stringify({ documents: { documents: [{ title: "Fallback", url: "https://wb.example/fallback" }] } }),
          { status: 200 }
        );
      });
      const results = await world_bank.search("US GDP");
      expect(results[0].url).toBe("https://wb.example/fallback");
      const urls = mockFetch.mock.calls.map((call) => String(call[0]));
      expect(urls.some((url) => url.includes("/indicator/"))).toBe(false);
    });

    it("keeps uppercase ISO codes distinct from ordinary words", async () => {
      route({ documents: { documents: [] } }, indicatorEnvelope("FP.CPI.TOTL.ZG", [{ date: "2025", value: 2, iso3: "DEU", name: "Germany" }]));
      await world_bank.search("inflation in Germany");
      let urls = mockFetch.mock.calls.map((call) => String(call[0]));
      expect(urls.some((url) => url.includes("/v2/country/DEU/indicator/"))).toBe(true);

      mockFetch.mockClear();
      route({ documents: { documents: [] } }, indicatorEnvelope("FP.CPI.TOTL.ZG", [{ date: "2025", value: 3, iso3: "WLD", name: "World" }]));
      await world_bank.search("tell us about inflation");
      urls = mockFetch.mock.calls.map((call) => String(call[0]));
      expect(urls.some((url) => url.includes("/v2/country/WLD/indicator/"))).toBe(true);
    });
  });

  it("openalex exposes scholarly metadata and rebuilds the abstract (REQ-003)", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              display_name: "A Paper",
              id: "https://openalex.org/W1",
              publication_year: 2024,
              doi: "https://doi.org/10.1234/abc",
              cited_by_count: 17,
              authorships: [{ author: { display_name: "Ada Lovelace" } }, { author: { display_name: "Alan Turing" } }],
              primary_location: { source: { display_name: "Journal of Things" } },
              abstract_inverted_index: { Retrieval: [0], augmented: [1], generation: [2] },
            },
          ],
        }),
        { status: 200 }
      )
    );
    const results = await openalex.search("q", { max_results: 3 });
    expect(results[0].authors).toEqual(["Ada Lovelace", "Alan Turing"]);
    expect(results[0].venue).toBe("Journal of Things");
    expect(results[0].doi).toBe("https://doi.org/10.1234/abc");
    expect(results[0].abstract).toBe("Retrieval augmented generation");
    expect(results[0].citation_count).toBe(17);
    expect(results[0].snippet).toBe("Retrieval augmented generation");
    expect(String(mockFetch.mock.calls[0][0])).toContain("per-page=3");
  });

  it("europe_pmc exposes authors, venue, and DOI (REQ-003)", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          resultList: {
            result: [
              {
                title: "Biomedical RAG",
                pmid: "123",
                source: "MED",
                id: "123",
                authorString: "Doe J, Roe R.",
                pubYear: "2023",
                journalTitle: "BMJ",
                doi: "10.1234/bio",
              },
            ],
          },
        }),
        { status: 200 }
      )
    );
    const results = await europe_pmc.search("q", { max_results: 4 });
    expect(results[0].authors).toEqual(["Doe J", "Roe R."]);
    expect(results[0].venue).toBe("BMJ");
    expect(results[0].doi).toBe("10.1234/bio");
    expect(String(mockFetch.mock.calls[0][0])).toContain("pageSize=4");
  });

  it("arxiv exposes authors and honors max_results", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(
        `<feed><entry><title>Paper</title><id>http://arxiv.org/abs/2401.00001v1</id><published>2024-01-01T00:00:00Z</published><summary>Summary</summary><author><name>Ada Lovelace</name></author><arxiv:doi>10.1234/arxiv</arxiv:doi></entry></feed>`,
        { status: 200 }
      )
    );
    const results = await arxiv.search("q", { max_results: 7 });
    expect(results[0].authors).toEqual(["Ada Lovelace"]);
    expect(results[0].doi).toBe("10.1234/arxiv");
    expect(String(mockFetch.mock.calls[0][0])).toContain("max_results=7");
  });

  it("semantic_scholar requests and maps scholarly fields", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              title: "Paper",
              paperId: "p1",
              year: 2022,
              venue: "Venue",
              url: "https://www.semanticscholar.org/paper/p1",
              abstract: "Abstract",
              citationCount: 9,
              authors: [{ name: "Ada Lovelace" }],
              externalIds: { DOI: "10.1234/ss" },
            },
          ],
        }),
        { status: 200 }
      )
    );
    const results = await semantic_scholar.search("q", { max_results: 6 });
    expect(results[0].authors).toEqual(["Ada Lovelace"]);
    expect(results[0].venue).toBe("Venue");
    expect(results[0].doi).toBe("10.1234/ss");
    expect(results[0].citation_count).toBe(9);
    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain("fields=");
    expect(url).toContain("limit=6");
  });

  it("crossref parses DOI metadata into academic results (REQ-003)", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          message: {
            items: [
              {
                DOI: "10.1234/cr",
                title: ["A Crossref Paper"],
                author: [{ given: "Ada", family: "Lovelace" }, { name: "The Consortium" }],
                issued: { "date-parts": [[2021]] },
                "container-title": ["Journal of Crossref"],
                abstract: "<jats:p>An abstract &amp; more.</jats:p>",
                "is-referenced-by-count": 5,
                URL: "https://doi.org/10.1234/cr",
              },
            ],
          },
        }),
        { status: 200 }
      )
    );
    const results = await crossref.search("q", { max_results: 2 });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("A Crossref Paper");
    expect(results[0].authors).toEqual(["Ada Lovelace", "The Consortium"]);
    expect(results[0].published_date).toBe("2021");
    expect(results[0].venue).toBe("Journal of Crossref");
    expect(results[0].doi).toBe("10.1234/cr");
    expect(results[0].abstract).toBe("An abstract & more.");
    expect(results[0].citation_count).toBe(5);
    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain("rows=2");
    expect(url).toContain("select=");
  });

  it("crossref resolves a DOI to a bibliographic record (REQ-021h)", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          message: {
            DOI: "10.1162/dram_c_00764",
            title: ["Working Loose"],
            "container-title": ["TDR/The Drama Review"],
            issued: { "date-parts": [[2018, 6]] },
            URL: "https://doi.org/10.1162/dram_c_00764",
          },
        }),
        { status: 200 }
      )
    );
    const record = await crossref.lookupDoi!("10.1162/dram_c_00764");
    expect(record).toMatchObject({
      doi: "10.1162/dram_c_00764",
      title: "Working Loose",
      venue: "TDR/The Drama Review",
      year: "2018",
    });
    expect(String(mockFetch.mock.calls[0][0])).toContain("/works/10.1162%2Fdram_c_00764");
  });

  it("openalex resolves a DOI and exposes its open-access copy (REQ-021h)", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          display_name: "Working Loose",
          id: "https://openalex.org/W1",
          publication_year: 2018,
          open_access: {
            is_oa: true,
            oa_status: "bronze",
            oa_url: "https://www.mitpressjournals.org/doi/pdf/10.1162/DRAM_c_00764",
          },
          best_oa_location: { pdf_url: "https://www.mitpressjournals.org/doi/pdf/10.1162/DRAM_c_00764" },
          abstract_inverted_index: { Working: [0], Loose: [1] },
        }),
        { status: 200 }
      )
    );
    const record = await openalex.lookupDoi!("10.1162/dram_c_00764");
    expect(record).toMatchObject({
      title: "Working Loose",
      year: "2018",
      oa_status: "bronze",
      abstract: "Working Loose",
    });
    expect(record?.oa_url).toContain("mitpressjournals.org");
  });
});
