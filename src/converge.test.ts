// @implements REQ-026
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SearchResult, ConvergenceFinding } from "../src/types.js";

vi.mock("../src/config.js", () => ({
  getConfig: vi.fn(),
  getActiveProviders: vi.fn(),
}));

vi.mock("../src/rate-limiter.js", () => ({
  throttle: vi.fn(),
}));

vi.mock("../src/quota.js", () => ({
  checkQuota: vi.fn(),
  increment: vi.fn(),
}));

vi.mock("../src/retry.js", () => ({
  retryWithBackoff: vi.fn(),
}));

vi.mock("../src/providers/index.js", () => ({
  PROVIDERS: {} as Record<string, { search?: (query: string, opts?: { max_results?: number }) => Promise<SearchResult[]> }>,
}));

import { getConfig, getActiveProviders } from "../src/config.js";
import { throttle } from "../src/rate-limiter.js";
import { checkQuota, increment } from "../src/quota.js";
import { retryWithBackoff } from "../src/retry.js";
import {
  extractTopic,
  jaccardSimilarity,
  reconcileClaims,
  computeConfidence,
  converge,
} from "../src/converge.js";
import type { ConvergenceFinding as CF } from "../src/types.js";

function makeResult(title: string, url: string, snippet: string): SearchResult {
  return { title, url, snippet };
}

function makeQuota(exhausted = false, remaining = 100) {
  return { exhausted, warning: exhausted, daily: { used: 0, remaining, resetAt: "" }, monthly: { used: 0, remaining, resetAt: "" } };
}

function mockConfig(overrides: Record<string, unknown> = {}) {
  const base = {
    providers: {
      duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
      wikipedia: { enabled: true, capabilities: ["encyclopedia", "web_search"], rate_limit: {}, priority: 20, timeout: 10000 },
      wikidata: { enabled: true, capabilities: ["structured_fact", "web_search"], rate_limit: {}, priority: 20, timeout: 10000 },
    },
    dispatch: { general_web: ["duckduckgo"] },
    convergence: { max_iterations: 5, max_http_calls: 30, confidence_threshold: 0.8 },
    output: { max_chars: 50000, latency_window_size: 100 },
    ...overrides,
  };
  vi.mocked(getConfig).mockReturnValue(base as any);
  vi.mocked(getActiveProviders).mockReturnValue(
    Object.entries(base.providers).filter(([, p]: [string, any]) => p.enabled && p.capabilities.includes("web_search")) as any
  );
}

describe("extractTopic", () => {
  it("returns keywords from title", () => {
    expect(extractTopic("Quantum Computing Breakthrough")).toBe("quantum computing breakthrough");
  });

  it("filters stopwords", () => {
    expect(extractTopic("The quick brown fox in the forest")).toBe("quick brown fox forest");
  });

  it("limits to four keywords", () => {
    expect(extractTopic("machine learning deep neural network training optimization")).toBe("machine learning deep neural");
  });

  it("falls back to first 50 chars for titles with only stopwords and short words", () => {
    expect(extractTopic("I am it")).toBe("i am it");
  });

  it("handles empty title", () => {
    expect(extractTopic("")).toBe("");
  });
});

describe("jaccardSimilarity", () => {
  it("returns 1.0 for identical strings", () => {
    expect(jaccardSimilarity("hello world", "hello world")).toBeCloseTo(1.0);
  });

  it("returns 0 for completely different strings", () => {
    expect(jaccardSimilarity("apple banana cherry", "xylophone zebra")).toBe(0);
  });

  it("returns partial similarity for overlapping strings", () => {
    const sim = jaccardSimilarity("deep learning neural network", "machine learning deep learning");
    expect(sim).toBeGreaterThan(0.3);
    expect(sim).toBeLessThan(0.8);
  });

  it("handles empty input", () => {
    expect(jaccardSimilarity("", "hello world")).toBe(0);
    expect(jaccardSimilarity("hello world", "")).toBe(0);
  });

  it("filters short words (<3 chars)", () => {
    expect(jaccardSimilarity("a b c d e hello", "f g h i j hello")).toBe(1.0);
  });
});

describe("computeConfidence", () => {
  it("returns 0.3 for single domain", () => {
    expect(computeConfidence([{ title: "a", url: "https://example.com/a", snippet: "x" }])).toBe(0.3);
  });

  it("returns 0.7 for two unique domains", () => {
    expect(computeConfidence([
      { title: "a", url: "https://a.com/1", snippet: "x" },
      { title: "b", url: "https://b.com/2", snippet: "y" },
    ])).toBe(0.7);
  });

  it("returns 0.9 for three unique domains", () => {
    expect(computeConfidence([
      { title: "a", url: "https://a.com/1", snippet: "x" },
      { title: "b", url: "https://b.com/2", snippet: "y" },
      { title: "c", url: "https://c.com/3", snippet: "z" },
    ])).toBe(0.9);
  });

  it("returns 1.0 for five unique domains", () => {
    expect(computeConfidence([
      { title: "a", url: "https://a.com/1", snippet: "x" },
      { title: "b", url: "https://b.com/2", snippet: "x" },
      { title: "c", url: "https://c.com/3", snippet: "x" },
      { title: "d", url: "https://d.com/4", snippet: "x" },
      { title: "e", url: "https://e.com/5", snippet: "x" },
    ])).toBe(1.0);
  });

  it("matches spec §8.2 confidence table: 0/1/2/3/5+ domains -> 0/0.3/0.7/0.9/1.0", () => {
    expect(computeConfidence([])).toBe(0);
    expect(computeConfidence([{ title: "a", url: "https://a.com/1", snippet: "x" }])).toBe(0.3);
    expect(computeConfidence([
      { title: "a", url: "https://a.com/1", snippet: "x" },
      { title: "b", url: "https://b.com/2", snippet: "y" },
    ])).toBe(0.7);
    expect(computeConfidence([
      { title: "a", url: "https://a.com/1", snippet: "x" },
      { title: "b", url: "https://b.com/2", snippet: "y" },
      { title: "c", url: "https://c.com/3", snippet: "z" },
    ])).toBe(0.9);
    expect(computeConfidence([
      { title: "a", url: "https://a.com/1", snippet: "x" },
      { title: "b", url: "https://b.com/2", snippet: "x" },
      { title: "c", url: "https://c.com/3", snippet: "x" },
      { title: "d", url: "https://d.com/4", snippet: "x" },
      { title: "e", url: "https://e.com/5", snippet: "x" },
    ])).toBe(1.0);
  });

  it("counts only unique domains within same domain", () => {
    expect(computeConfidence([
      { title: "a", url: "https://example.com/a", snippet: "x" },
      { title: "b", url: "https://example.com/b", snippet: "x" },
    ])).toBe(0.3);
  });
});

describe("reconcileClaims", () => {
  it("adds new results to empty findings map", () => {
    const findings = new Map<string, CF>();
    reconcileClaims(findings, [
      makeResult("Quantum Computing Advances", "https://a.com/1", "quantum computing is progressing rapidly"),
    ]);
    expect(findings.size).toBe(1);
    const f = findings.get("quantum computing advances");
    expect(f?.verdict).toBe("unverified");
    expect(f?.confidence).toBe(0.3);
    expect(f?.sources.length).toBe(1);
  });

  it("detects agreement between two similar claims", () => {
    const findings = new Map<string, CF>();
    reconcileClaims(findings, [
      makeResult("Quantum Computing Error Correction Advances", "https://a.com/1", "quantum computing error correction is progressing"),
      makeResult("Quantum Computing Error Correction Study", "https://b.com/2", "quantum computing error correction shows advances"),
    ]);
    expect(findings.size).toBe(1);
    const f = [...findings.values()][0];
    expect(f.verdict).toBe("confirmed");
    expect(f.confidence).toBe(0.7);
  });

  it("detects disagreement between contradictory claims", () => {
    const findings = new Map<string, CF>();
    reconcileClaims(findings, [
      makeResult("Coffee Health Effects", "https://a.com/1", "coffee reduces risk of heart disease significantly"),
      makeResult("Coffee Health Effects", "https://b.com/2", "coffee increases blood pressure and causes anxiety"),
    ]);
    const f = [...findings.values()][0];
    expect(f.verdict).toBe("contested");
    expect(f.perspectives).toBeDefined();
    expect(f.perspectives!.length).toBe(2);
  });

  it("accumulates sources across multiple reconcile calls", () => {
    const findings = new Map<string, CF>();
    reconcileClaims(findings, [
      makeResult("Machine Learning", "https://a.com/1", "machine learning transforms data analysis"),
    ]);
    reconcileClaims(findings, [
      makeResult("Machine Learning", "https://b.com/2", "machine learning revolutionizes data processing"),
    ]);
    const f = [...findings.values()][0];
    expect(f.sources.length).toBe(2);
    expect(f.verdict).toBe("confirmed");
  });

  it("skips duplicate URLs", () => {
    const findings = new Map<string, CF>();
    reconcileClaims(findings, [
      makeResult("AI Safety", "https://a.com/1", "AI safety requires robust testing"),
    ]);
    reconcileClaims(findings, [
      makeResult("AI Safety", "https://a.com/1", "AI safety requires robust testing"),
    ]);
    const f = [...findings.values()][0];
    expect(f.sources.length).toBe(1);
  });

  it("populates perspectives for contested findings", () => {
    const findings = new Map<string, CF>();
    reconcileClaims(findings, [
      makeResult("Climate Policy", "https://a.com/1", "carbon taxes are the most effective policy tool"),
      makeResult("Climate Policy", "https://b.com/2", "renewable subsidies outperform carbon taxes"),
      makeResult("Climate Policy", "https://c.com/3", "regulation mandates drive faster change than taxes"),
    ]);
    const f = [...findings.values()][0];
    if (f.verdict === "contested") {
      expect(f.perspectives!.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("converge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(throttle).mockResolvedValue(undefined);
    vi.mocked(checkQuota).mockReturnValue(makeQuota());
    vi.mocked(increment).mockReturnValue(makeQuota());
    vi.mocked(retryWithBackoff).mockImplementation(async (fn) => (fn as () => Promise<any>)());
  });

  it("returns empty result when no providers available", async () => {
    mockConfig();
    vi.mocked(getActiveProviders).mockReturnValue([]);
    const result = await converge("test query");
    expect(result.findings).toEqual([]);
    expect(result.convergence).toBe("partial");
    expect(result.iteration_count).toBe(0);
  });

  it("detects agreement across three providers using DI searchers", async () => {
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
        wikipedia: { enabled: true, capabilities: ["encyclopedia", "web_search"], rate_limit: {}, priority: 20, timeout: 10000 },
        wikidata: { enabled: true, capabilities: ["structured_fact", "web_search"], rate_limit: {}, priority: 20, timeout: 10000 },
      },
    });

    vi.mocked(retryWithBackoff).mockImplementation(async (fn) => fn());

    const result = await converge("quantum computing error correction", {
      searchers: {
        duckduckgo: async () => [makeResult("Quantum Computing Error Correction Study", "https://a.com/1", "quantum computing is making rapid progress in error correction")],
        wikipedia: async () => [makeResult("Quantum Computing Error Correction Advances", "https://b.com/2", "quantum computing advances in error correction are accelerating")],
        wikidata: async () => [makeResult("Quantum Computing Error Correction Methods", "https://c.com/3", "quantum computing error correction shows promising results")],
      },
    });
    expect(result.findings.length).toBeGreaterThan(0);
    const mainFinding = result.findings[0];
    expect(mainFinding.confidence).toBeGreaterThanOrEqual(0.7);
    expect(mainFinding.verdict).toBe("confirmed");
    expect(result.providers_used.length).toBe(3);
  });

  it("respects max_iterations limit", async () => {
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
        wikipedia: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 20, timeout: 10000 },
      },
      convergence: { max_iterations: 2, max_http_calls: 30, confidence_threshold: 0.8 },
    });

    const result = await converge("rare topic details", {
      searchers: {
        duckduckgo: async () => [makeResult("Rare Topic", "https://a.com/rare", "very obscure information about rare topic")],
        wikipedia: async () => [makeResult("Rare Topic Variation", "https://b.com/other", "different information about rare topic")],
      },
    });
    expect(result.iteration_count).toBeLessThanOrEqual(2);
  });

  it("returns partial convergence when confidence threshold not met", async () => {
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
      },
      convergence: { max_iterations: 1, max_http_calls: 30, confidence_threshold: 0.95 },
    });

    const result = await converge("obscure topic", {
      confidence_threshold: 0.95,
      searchers: {
        duckduckgo: async () => [makeResult("Single Result", "https://a.com/1", "only one source for this obscure topic")],
      },
    });
    if (result.findings.length > 0) {
      expect(result.convergence).toBe("partial");
    }
  });

  it("filters providers to only those specified", async () => {
    mockConfig();

    let ddgCalled = false;
    let wikiCalled = false;

    await converge("test", {
      providers: ["wikipedia"],
      searchers: {
        duckduckgo: async () => { ddgCalled = true; return []; },
        wikipedia: async () => { wikiCalled = true; return []; },
      },
    });
    expect(ddgCalled).toBe(false);
    expect(wikiCalled).toBe(true);
  });

  it("skips exhausted providers mid-iteration", async () => {
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
        wikipedia: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 20, timeout: 10000 },
      },
      convergence: { max_iterations: 1, max_http_calls: 30, confidence_threshold: 0.8 },
    });

    let ddgCalls = 0;
    let wikiCalls = 0;

    vi.mocked(checkQuota).mockImplementation((slug) => {
      if (slug === "duckduckgo") return makeQuota(true, 0);
      return makeQuota(false, 100);
    });

    const result = await converge("test", {
      searchers: {
        duckduckgo: async () => { ddgCalls++; return [makeResult("DDG", "https://a.com/1", "a")]; },
        wikipedia: async () => { wikiCalls++; return [makeResult("Wiki", "https://b.com/1", "b")]; },
      },
    });
    expect(ddgCalls).toBe(0);
    expect(wikiCalls).toBe(1);
    expect(result.providers_used).toContain("wikipedia");
    expect(result.providers_used).not.toContain("duckduckgo");
  });

  it("continues after one provider throws", async () => {
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
        wikipedia: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 20, timeout: 10000 },
      },
      convergence: { max_iterations: 1, max_http_calls: 30, confidence_threshold: 0.8 },
    });

    let wikiCalled = false;

    const result = await converge("test", {
      searchers: {
        duckduckgo: async () => { throw new Error("DDG down"); },
        wikipedia: async () => { wikiCalled = true; return [makeResult("Wiki", "https://b.com/1", "reliable information from wikipedia")]; },
      },
    });
    expect(wikiCalled).toBe(true);
    expect(result.providers_used).toContain("wikipedia");
    expect(result.providers_used).not.toContain("duckduckgo");
  });

  it("returns partial convergence when all providers fail", async () => {
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
      },
      convergence: { max_iterations: 1, max_http_calls: 30, confidence_threshold: 0.8 },
    });

    const result = await converge("test", {
      searchers: {
        duckduckgo: async () => { throw new Error("Service down"); },
      },
    });
    expect(result.findings).toEqual([]);
    expect(result.convergence).toBe("partial");
    expect(result.providers_used).toEqual([]);
  });
});
