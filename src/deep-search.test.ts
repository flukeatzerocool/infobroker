// @implements REQ-028
import { describe, it, expect } from "vitest";
import { deepRead, type DeepEnrichedResult } from "../src/deep-search.js";
import type { SearchResult } from "../src/types.js";

const deepConf = {
  max_pages: 3,
  max_total_pages: 8,
  concurrency: 4,
  early_exit_score: 0.3,
  max_ms: 8000,
  detect_date: false,
};

function makeResult(title: string, url: string, snippet: string): SearchResult {
  return { title, url, snippet };
}

function rank(_text: string, _q: string, _ps: number, _mp: number) {
  // Deterministic stub: return a passage whenever content contains the token.
  return [{ text: "passage text", score: 0.9, index: 0, start: 0, end: 1 }];
}

describe("deepRead (REQ-028)", () => {
  it("attaches ranked passages to fetched results", async () => {
    const results = [makeResult("A", "https://a.example/", "snippet A")];
    const fetchPage = async () => ({ content: "full body text", slug: "jina" });
    const { results: out, pages_read } = await deepRead("q", results, deepConf, 100, 1, 3, fetchPage, { rank });

    expect(pages_read).toBe(1);
    expect(out[0].passages).toHaveLength(1);
    expect(out[0].passages![0].score).toBe(0.9);
    expect(out[0].extraction_mode).toBe("passage");
    expect(out[0].url).toBe("https://a.example/");
  });

  it("reports a fetch failure with the original snippet instead of dropping", async () => {
    const results = [makeResult("A", "https://a.example/", "snippet A")];
    const fetchPage = async () => null;
    const { results: out, pages_read } = await deepRead("q", results, deepConf, 100, 1, 3, fetchPage, { rank });

    expect(pages_read).toBe(0);
    expect(out[0].read_error).toBe("page fetch failed");
    expect(out[0].snippet).toBe("snippet A");
  });

  it("ignores non-http results", async () => {
    const results = [makeResult("A", "file:///etc/passwd", "snippet A")];
    const fetchPage = async () => ({ content: "x", slug: "jina" });
    const { results: out, pages_read } = await deepRead("q", results, deepConf, 100, 1, 3, fetchPage, { rank });

    expect(pages_read).toBe(0);
    expect(out[0].read_error).toBeUndefined();
    expect(out[0].passages).toBeUndefined();
  });

  it("bounds the number of pages read to maxPages", async () => {
    const results = [
      makeResult("A", "https://a.example/", "a"),
      makeResult("B", "https://b.example/", "b"),
      makeResult("C", "https://c.example/", "c"),
      makeResult("D", "https://d.example/", "d"),
    ];
    let calls = 0;
    const fetchPage = async () => {
      calls++;
      return { content: "x", slug: "jina" };
    };
    const { pages_read } = await deepRead("q", results, deepConf, 100, 1, 2, fetchPage, { rank });

    expect(pages_read).toBe(2);
    expect(calls).toBe(2);
  });

  it("early-exits once a page clears the score threshold", async () => {
    const results = [
      makeResult("A", "https://a.example/", "a"),
      makeResult("B", "https://b.example/", "b"),
      makeResult("C", "https://c.example/", "c"),
    ];
    const calls: string[] = [];
    const fetchPage = async (url: string) => {
      calls.push(url);
      return { content: "x", slug: "jina" };
    };
    await deepRead("q", results, { ...deepConf, concurrency: 1 }, 100, 1, 3, fetchPage, {
      rank: () => [{ text: "t", score: 0.9, index: 0, start: 0, end: 1 }],
    });

    // High-scoring first page stops scheduling the second with concurrency 1.
    expect(calls.length).toBe(1);
  });

  it("preserves original result fields (source_type, original_source)", async () => {
    const results = [{ title: "A", url: "https://a.example/", snippet: "s", source_type: "news", original_source: "reseller" }];
    const fetchPage = async () => ({ content: "x", slug: "jina" });
    const { results: out } = await deepRead("q", results, deepConf, 100, 1, 3, fetchPage, { rank });

    expect(out[0].source_type).toBe("news");
    expect(out[0].original_source).toBe("reseller");
  });

  it("calls autoIndex with full content and source date", async () => {
    const results = [makeResult("A", "https://a.example/", "s")];
    const fetchPage = async () => ({ content: "full body", slug: "jina" });
    const indexed: Array<{ title: string; content: string }> = [];
    await deepRead("q", results, deepConf, 100, 1, 3, fetchPage, {
      rank,
      detectDate: async () => ({ date: "2026-01-01", source: "header", confidence: "high" }),
      autoIndex: (r: DeepEnrichedResult, content: string) => indexed.push({ title: r.title, content }),
    });

    expect(indexed).toHaveLength(1);
    expect(indexed[0].content).toBe("full body");
    expect(indexed[0].title).toBe("A");
  });
});
