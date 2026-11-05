// @implements REQ-027 REQ-027a REQ-003
import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchCitations, type Searcher } from "./cite.js";
import type { SearchResult } from "./types.js";

const h = vi.hoisted(() => ({
  config: {
    output: { fallback_depth: 5, rate_limit_cooldown_ms: 60000 },
    providers: {} as Record<string, { enabled: boolean; rate_limit: Record<string, number>; timeout: number }>,
  },
  quotaExhausted: false,
  cooldown: false,
}));

vi.mock("./config.js", () => ({
  getConfig: () => h.config,
  getDispatchChain: () => ["a", "b"],
}));
vi.mock("./quota.js", () => ({
  checkQuota: () => ({
    exhausted: h.quotaExhausted,
    warning: false,
    daily: { used: 0, remaining: 100 },
  }),
  increment: vi.fn(),
}));
vi.mock("./cooldown.js", () => ({
  inCooldown: () => h.cooldown,
  markCooldown: vi.fn(),
  shouldCooldown: () => false,
  cooldownDurationMs: () => 0,
}));
vi.mock("./rate-limiter.js", () => ({ throttle: async () => {} }));
vi.mock("./corroborate.js", () => ({ providerOperational: () => true }));

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    title: "Untitled",
    url: "https://example.com/1",
    snippet: "snippet",
    ...overrides,
  };
}

function searchers(map: Record<string, Searcher>): Record<string, Searcher> {
  return map;
}

beforeEach(() => {
  h.quotaExhausted = false;
  h.cooldown = false;
  h.config.providers = {
    a: { enabled: true, rate_limit: {}, timeout: 1000 },
    b: { enabled: true, rate_limit: {}, timeout: 1000 },
    c: { enabled: true, rate_limit: {}, timeout: 1000 },
    d: { enabled: true, rate_limit: {}, timeout: 1000 },
    e: { enabled: true, rate_limit: {}, timeout: 1000 },
  };
});

describe("searchCitations aggregation (REQ-027a)", () => {
  it("aggregates in chain order and reports ok/empty per provider", async () => {
    const report = await searchCitations("q", 8, {
      chain: ["a", "b", "c"],
      searchers: searchers({
        a: async () => [result({ title: "A", url: "https://example.com/a", doi: "10.1/a" })],
        b: async () => [],
        c: async () => [result({ title: "C", url: "https://example.com/c", doi: "10.1/c" })],
      }),
    });

    expect(report.providers.map((p) => [p.slug, p.status])).toEqual([
      ["a", "ok"],
      ["b", "empty"],
      ["c", "ok"],
    ]);
    expect(report.citations.map((c) => c.title)).toEqual(["A", "C"]);
    expect(report.allFailed).toBe(false);
  });

  it("records a provider error without aborting the rest of the chain", async () => {
    const report = await searchCitations("q", 8, {
      chain: ["a", "b"],
      searchers: searchers({
        a: async () => {
          throw new Error("boom");
        },
        b: async () => [result({ title: "B", url: "https://example.com/b" })],
      }),
    });

    expect(report.providers[0]).toMatchObject({ slug: "a", status: "error", references: 0 });
    expect(report.providers[0].reason).toContain("boom");
    expect(report.providers[1]).toMatchObject({ slug: "b", status: "ok", references: 1 });
    expect(report.citations).toHaveLength(1);
    expect(report.allFailed).toBe(false);
  });

  it("dedupes by DOI across resolver-prefix and case variants, merging fields", async () => {
    const report = await searchCitations("q", 8, {
      chain: ["a", "b"],
      searchers: searchers({
        a: async () =>
          [result({
            title: "Paper A",
            url: "https://example.com/a",
            doi: "https://doi.org/10.1/X",
            authors: ["Ada Lovelace"],
            published_date: "2020",
          })],
        b: async () =>
          [result({
            title: "Paper A (preprint)",
            url: "https://example.com/b",
            doi: "10.1/x",
            authors: ["Ada Lovelace", "Alan Turing"],
            venue: "Journal of Things",
            published_date: "2020",
          })],
      }),
    });

    expect(report.citations).toHaveLength(1);
    expect(report.deduped).toBe(1);
    expect(report.citations[0].authors).toEqual(["Ada Lovelace", "Alan Turing"]);
    expect(report.citations[0].venue).toBe("Journal of Things");
    expect(report.citations[0].bibtex).toContain("@article{");
  });

  it("falls back to title identity when no DOI is supplied", async () => {
    const report = await searchCitations("q", 8, {
      chain: ["a", "b"],
      searchers: searchers({
        a: async () => [result({ title: "Same Title", url: "https://example.com/a", published_date: "2021-03-01" })],
        b: async () => [result({ title: "same title!", url: "https://example.com/b", published_date: "2021" })],
      }),
    });

    expect(report.citations).toHaveLength(1);
    expect(report.deduped).toBe(1);
  });

  it("keeps distinct works separate", async () => {
    const report = await searchCitations("q", 8, {
      chain: ["a", "b"],
      searchers: searchers({
        a: async () => [result({ title: "One", url: "https://example.com/a", doi: "10.1/one" })],
        b: async () => [result({ title: "Two", url: "https://example.com/b", doi: "10.1/two" })],
      }),
    });

    expect(report.citations).toHaveLength(2);
    expect(report.deduped).toBe(0);
  });

  it("slices to max_results while counting dedupe before truncation", async () => {
    const report = await searchCitations("q", 2, {
      chain: ["a"],
      searchers: searchers({
        a: async () => [
          result({ title: "One", url: "https://example.com/1", doi: "10.1/one" }),
          result({ title: "Two", url: "https://example.com/2", doi: "10.1/two" }),
          result({ title: "Three", url: "https://example.com/3", doi: "10.1/three" }),
        ],
      }),
    });

    expect(report.citations).toHaveLength(2);
    expect(report.deduped).toBe(0);
  });

  it("reports an all-empty chain as a non-failing zero-result answer", async () => {
    const report = await searchCitations("q", 8, {
      chain: ["a", "b"],
      searchers: searchers({ a: async () => [], b: async () => [] }),
    });

    expect(report.citations).toEqual([]);
    expect(report.allFailed).toBe(false);
    expect(report.providers.map((p) => p.status)).toEqual(["empty", "empty"]);
  });

  it("sets allFailed when every provider errors", async () => {
    const report = await searchCitations("q", 8, {
      chain: ["a", "b"],
      searchers: searchers({
        a: async () => {
          throw new Error("down");
        },
        b: async () => {
          throw new Error("also down");
        },
      }),
    });

    expect(report.citations).toEqual([]);
    expect(report.allFailed).toBe(true);
  });

  it("sets allFailed when every provider is skipped", async () => {
    const report = await searchCitations("q", 8, {
      chain: ["a", "b"],
      eligibility: () => "quota_exhausted",
      searchers: searchers({ a: async () => [result()], b: async () => [result()] }),
    });

    expect(report.citations).toEqual([]);
    expect(report.allFailed).toBe(true);
    expect(report.providers.map((p) => [p.status, p.reason])).toEqual([
      ["skipped", "quota_exhausted"],
      ["skipped", "quota_exhausted"],
    ]);
  });

  it("skips providers through default eligibility when quota is exhausted", async () => {
    h.quotaExhausted = true;
    const report = await searchCitations("q", 8, {
      searchers: searchers({ a: async () => [result()], b: async () => [result()] }),
    });

    expect(report.providers.map((p) => p.reason)).toEqual(["quota_exhausted", "quota_exhausted"]);
    expect(report.allFailed).toBe(true);
  });

  it("formats a reference without authors as a misc entry (REQ-027)", async () => {
    const report = await searchCitations("q", 8, {
      chain: ["a"],
      searchers: searchers({
        a: async () => [result({ title: "Anonymous", url: "https://example.com/an", published_date: "2024-01-01T00:00:00Z" })],
      }),
    });

    expect(report.citations[0].year).toBe("2024");
    expect(report.citations[0].bibtex).toContain("@misc{");
  });
});
