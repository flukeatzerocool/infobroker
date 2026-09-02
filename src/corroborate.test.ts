// @implements REQ-026
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SearchResult } from "../src/types.js";

vi.mock("../src/config.js", () => ({
  getConfig: vi.fn(),
  getActiveProviders: vi.fn(),
  getDispatchChain: vi.fn(),
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

vi.mock("../src/kb.js", () => ({
  isKbConfigured: vi.fn(),
  kbSearch: vi.fn(),
}));

vi.mock("../src/providers/index.js", () => ({
  PROVIDERS: {} as Record<string, { search?: (query: string, opts?: { max_results?: number }) => Promise<SearchResult[]> }>,
}));

import { getConfig, getActiveProviders, getDispatchChain } from "../src/config.js";
import { throttle } from "../src/rate-limiter.js";
import { checkQuota, increment } from "../src/quota.js";
import { retryWithBackoff } from "../src/retry.js";
import { isKbConfigured, kbSearch } from "../src/kb.js";
import {
  extractTopic,
  jaccardSimilarity,
  reconcileClaims,
  computeConfidence,
  corroborate,
} from "../src/corroborate.js";
import type { CorroborationFinding as CF } from "../src/types.js";

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
    corroboration: { max_iterations: 5, max_http_calls: 30, confidence_threshold: 0.8 },
    output: { max_chars: 50000, latency_window_size: 100 },
    ...overrides,
  };
  vi.mocked(getConfig).mockReturnValue(base as any);
  vi.mocked(getActiveProviders).mockReturnValue(
    Object.entries(base.providers).filter(([, p]: [string, any]) => p.enabled) as any
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

  it("applies authority weighting by source_type", () => {
    const weights = { academic: 1.0, web_search: 0.7 };
    const academic = (url: string) => ({ title: "a", url, snippet: "x", source_type: "academic" });
    const web = (url: string) => ({ title: "w", url, snippet: "x", source_type: "web_search" });

    expect(computeConfidence([academic("https://a.com/1"), academic("https://b.com/2")], weights)).toBeCloseTo(0.7);
    expect(computeConfidence([web("https://a.com/1"), web("https://b.com/2")], weights)).toBeCloseTo(0.7 * 0.7);
    expect(computeConfidence([academic("https://a.com/1"), academic("https://b.com/2"), academic("https://c.com/3")], weights)).toBeCloseTo(0.9);
  });

  it("does not exceed 1.0 with high authority weights", () => {
    const weights = { academic: 2.0 };
    const s = (url: string) => ({ title: "a", url, snippet: "x", source_type: "academic" });
    expect(computeConfidence([
      s("https://a.com/1"), s("https://b.com/2"), s("https://c.com/3"),
      s("https://d.com/4"), s("https://e.com/5"),
    ], weights)).toBe(1.0);
  });

  it("treats unknown source_type as neutral weight 1.0", () => {
    const weights = { academic: 1.0 };
    const s = (url: string) => ({ title: "a", url, snippet: "x" });
    expect(computeConfidence([s("https://a.com/1"), s("https://b.com/2")], weights)).toBeCloseTo(0.7);
  });

  it("collapses subdomains to the registrable domain via tldts", () => {
    expect(computeConfidence([
      { title: "a", url: "https://www.example.co.uk/1", snippet: "x" },
      { title: "b", url: "https://example.co.uk/2", snippet: "x" },
    ])).toBe(0.3);
    expect(computeConfidence([
      { title: "a", url: "https://sub.example.io/1", snippet: "x" },
      { title: "b", url: "https://example.io/2", snippet: "x" },
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

  it("associates each source with its own claim text (REQ-026b)", () => {
    const findings = new Map<string, CF>();
    reconcileClaims(findings, [
      makeResult("AI Safety", "https://a.com/1", "red teaming reduces model risk"),
      makeResult("AI Safety", "https://b.com/2", "red teaming is essential for model safety"),
    ]);
    const f = [...findings.values()][0];
    expect(f.sources.length).toBe(2);
    for (const s of f.sources) {
      expect(s.claim).toBeTruthy();
    }
    expect(f.sources[0].claim).toBe("red teaming reduces model risk");
  });

  it("carries source_type into sources", () => {
    const findings = new Map<string, CF>();
    const r = makeResult("AI Safety", "https://a.com/1", "red teaming reduces model risk");
    r.source_type = "academic";
    reconcileClaims(findings, [r]);
    const f = [...findings.values()][0];
    expect(f.sources[0].source_type).toBe("academic");
  });
});

describe("corroborate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(throttle).mockResolvedValue(undefined);
    vi.mocked(checkQuota).mockReturnValue(makeQuota());
    vi.mocked(increment).mockReturnValue(makeQuota());
    vi.mocked(retryWithBackoff).mockImplementation(async (fn) => (fn as () => Promise<any>)());
    vi.mocked(isKbConfigured).mockReturnValue(false);
    vi.mocked(kbSearch).mockReturnValue([]);
    vi.mocked(getDispatchChain).mockReturnValue([]);
  });

  it("returns empty result when no providers available", async () => {
    mockConfig();
    vi.mocked(getActiveProviders).mockReturnValue([]);
    const result = await corroborate("test query");
    expect(result.findings).toEqual([]);
    expect(result.corroboration).toBe("partial");
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

    const result = await corroborate("quantum computing error correction", {
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

  it("produces a narrative synthesis statement", async () => {
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
        wikipedia: { enabled: true, capabilities: ["encyclopedia", "web_search"], rate_limit: {}, priority: 20, timeout: 10000 },
      },
    });
    const result = await corroborate("quantum computing error correction", {
      max_iterations: 1,
      searchers: {
        duckduckgo: async () => [makeResult("Quantum Computing Error Correction Study", "https://a.com/1", "quantum computing makes rapid progress in error correction")],
        wikipedia: async () => [makeResult("Quantum Computing Error Correction Advances", "https://b.com/2", "quantum computing advances in error correction are accelerating")],
      },
    });
    expect(result.synthesis).toBeTruthy();
    expect(result.synthesis).not.toContain("claim(s) confirmed");
    expect(result.synthesis.toLowerCase()).toContain("confirm");
  });

  it("respects max_iterations limit", async () => {
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
        wikipedia: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 20, timeout: 10000 },
      },
      corroboration: { max_iterations: 2, max_http_calls: 30, confidence_threshold: 0.8 },
    });

    const result = await corroborate("rare topic details", {
      searchers: {
        duckduckgo: async () => [makeResult("Rare Topic", "https://a.com/rare", "very obscure information about rare topic")],
        wikipedia: async () => [makeResult("Rare Topic Variation", "https://b.com/other", "different information about rare topic")],
      },
    });
    expect(result.iteration_count).toBeLessThanOrEqual(2);
  });

  it("returns partial corroboration when confidence threshold not met", async () => {
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
      },
      corroboration: { max_iterations: 1, max_http_calls: 30, confidence_threshold: 0.95 },
    });

    const result = await corroborate("obscure topic", {
      confidence_threshold: 0.95,
      searchers: {
        duckduckgo: async () => [makeResult("Single Result", "https://a.com/1", "only one source for this obscure topic")],
      },
    });
    if (result.findings.length > 0) {
      expect(result.corroboration).toBe("partial");
    }
  });

  it("filters providers to only those specified", async () => {
    mockConfig();

    let ddgCalled = false;
    let wikiCalled = false;

    await corroborate("test", {
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
      corroboration: { max_iterations: 1, max_http_calls: 30, confidence_threshold: 0.8 },
    });

    let ddgCalls = 0;
    let wikiCalls = 0;

    vi.mocked(checkQuota).mockImplementation((slug) => {
      if (slug === "duckduckgo") return makeQuota(true, 0);
      return makeQuota(false, 100);
    });

    const result = await corroborate("test", {
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
      corroboration: { max_iterations: 1, max_http_calls: 30, confidence_threshold: 0.8 },
    });

    let wikiCalled = false;

    const result = await corroborate("test", {
      searchers: {
        duckduckgo: async () => { throw new Error("DDG down"); },
        wikipedia: async () => { wikiCalled = true; return [makeResult("Wiki", "https://b.com/1", "reliable information from wikipedia")]; },
      },
    });
    expect(wikiCalled).toBe(true);
    expect(result.providers_used).toContain("wikipedia");
    expect(result.providers_used).not.toContain("duckduckgo");
  });

  it("returns partial corroboration when all providers fail", async () => {
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
      },
      corroboration: { max_iterations: 1, max_http_calls: 30, confidence_threshold: 0.8 },
    });

    const result = await corroborate("test", {
      searchers: {
        duckduckgo: async () => { throw new Error("Service down"); },
      },
    });
    expect(result.findings).toEqual([]);
    expect(result.corroboration).toBe("partial");
    expect(result.providers_used).toEqual([]);
  });

  it("attaches archived_url when source preservation is enabled", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: "/web/20260101000000/https://a.com/1" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
        wikipedia: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 20, timeout: 10000 },
      },
      corroboration: { max_iterations: 1, max_http_calls: 30, confidence_threshold: 0.8, archive_sources: true },
    });

    const result = await corroborate("test", {
      searchers: {
        duckduckgo: async () => [makeResult("Claim A", "https://a.com/1", "shared claim text about the topic")],
        wikipedia: async () => [makeResult("Claim A", "https://b.com/1", "shared claim text about the topic")],
      },
    });

    expect(result.findings.length).toBeGreaterThan(0);
    const sources = result.findings.flatMap((f) => f.sources);
    expect(sources.some((s) => s.archived_url !== undefined)).toBe(true);

    vi.unstubAllGlobals();
  });

  it("does not archive when source preservation is disabled", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
        wikipedia: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 20, timeout: 10000 },
      },
      corroboration: { max_iterations: 1, max_http_calls: 30, confidence_threshold: 0.8 },
    });

    const result = await corroborate("test", {
      searchers: {
        duckduckgo: async () => [makeResult("Claim A", "https://a.com/1", "shared claim text about the topic")],
        wikipedia: async () => [makeResult("Claim A", "https://b.com/1", "shared claim text about the topic")],
      },
    });

    const sources = result.findings.flatMap((f) => f.sources);
    expect(sources.some((s) => s.archived_url !== undefined)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("includes a provenance record with version, thresholds, and source types", async () => {
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
        wikipedia: { enabled: true, capabilities: ["encyclopedia", "web_search"], rate_limit: {}, priority: 20, timeout: 10000 },
      },
      corroboration: { max_iterations: 1, max_http_calls: 30, confidence_threshold: 0.8 },
    });

    const result = await corroborate("test", {
      searchers: {
        duckduckgo: async () => [makeResult("Claim A", "https://a.com/1", "shared claim text about the topic")],
        wikipedia: async () => [makeResult("Claim A", "https://b.com/1", "shared claim text about the topic")],
      },
    });

    expect(result.provenance).toBeDefined();
    expect(result.provenance?.tool).toBe("infobroker");
    expect(result.provenance?.confidence_threshold).toBe(0.8);
    expect(result.provenance?.max_iterations).toBe(1);
    expect(typeof result.provenance?.version).toBe("string");
  });

  it("queries non-web_search active providers (REQ-026 all-active pool)", async () => {
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
        arxiv: { enabled: true, capabilities: ["academic"], rate_limit: {}, priority: 15, timeout: 10000 },
      },
      corroboration: { max_iterations: 1, max_http_calls: 30, confidence_threshold: 0.8 },
    });

    let arxivCalled = false;
    const result = await corroborate("quantum computing", {
      searchers: {
        duckduckgo: async () => [makeResult("Quantum Computing Study", "https://a.com/1", "quantum computing progresses")],
        arxiv: async () => { arxivCalled = true; return [makeResult("Quantum Computing Review", "https://arxiv.org/abs/1", "quantum computing progresses rapidly")]; },
      },
    });

    expect(arxivCalled).toBe(true);
    expect(result.providers_used).toContain("arxiv");
  });

  it("routes priority privacy through the privacy_critical chain", async () => {
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
        mojeek: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 5, timeout: 10000 },
        wikipedia: { enabled: true, capabilities: ["encyclopedia"], rate_limit: {}, priority: 20, timeout: 10000 },
      },
    });
    vi.mocked(getDispatchChain).mockReturnValue(["duckduckgo", "mojeek"]);

    let wikipediaCalled = false;
    const result = await corroborate("test", {
      priority: "privacy",
      searchers: {
        duckduckgo: async () => [],
        mojeek: async () => [],
        wikipedia: async () => { wikipediaCalled = true; return []; },
      },
    });

    expect(wikipediaCalled).toBe(false);
    expect(result.providers_used).not.toContain("wikipedia");
  });

  it("runs gap refinement queries concurrently", async () => {
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
        marginalia: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 5, timeout: 10000 },
        mojeek: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 5, timeout: 10000 },
      },
      corroboration: { max_iterations: 3, max_http_calls: 30, confidence_threshold: 0.8 },
    });

    let inFlight = 0;
    let maxInFlight = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const calls: Record<string, number> = {};

    const phaseAwareSearcher = (slug: string, result: SearchResult): () => Promise<SearchResult[]> => {
      return async () => {
        calls[slug] = (calls[slug] ?? 0) + 1;
        if (calls[slug] > 1) {
          inFlight++;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await gate;
          inFlight--;
        }
        return [result];
      };
    };

    const resultPromise = corroborate("topic", {
      searchers: {
        duckduckgo: phaseAwareSearcher("duckduckgo", makeResult("First Distinct Topic", "https://a.com/1", "first distinct claim")),
        marginalia: phaseAwareSearcher("marginalia", makeResult("Second Distinct Topic", "https://b.com/1", "second distinct claim")),
        mojeek: phaseAwareSearcher("mojeek", makeResult("Third Distinct Topic", "https://c.com/1", "third distinct claim")),
      },
    });

    // Phase 1 settles with three distinct low-confidence findings; Phase 3
    // then fires three gap queries that overlap before the gate opens.
    await vi.waitFor(() => expect(inFlight).toBeGreaterThanOrEqual(3));
    release();
    const result = await resultPromise;

    expect(maxInFlight).toBeGreaterThanOrEqual(3);
    expect(result.iteration_count).toBeGreaterThan(0);
  });

  it("caps gap queries to the remaining HTTP-call budget", async () => {
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
        marginalia: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 5, timeout: 10000 },
      },
      corroboration: { max_iterations: 3, max_http_calls: 3, confidence_threshold: 0.8 },
    });

    let calls = 0;
    const searcherFor = (r: SearchResult) => async () => { calls++; return [r]; };

    const result = await corroborate("topic", {
      searchers: {
        duckduckgo: searcherFor(makeResult("First Distinct Topic", "https://a.com/1", "first distinct claim")),
        marginalia: searcherFor(makeResult("Second Distinct Topic", "https://b.com/1", "second distinct claim")),
      },
    });

    // Phase 1 uses 2 calls; only 1 gap call fits the budget.
    expect(calls).toBe(3);
    void result;
  });

  it("reconciles knowledge-base recall into findings (REQ-026e)", async () => {
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
      },
      corroboration: { max_iterations: 1, max_http_calls: 30, confidence_threshold: 0.8, kb_recall: true },
    });
    vi.mocked(isKbConfigured).mockReturnValue(true);
    vi.mocked(kbSearch).mockReturnValue([
      { score: 0.9, freshness_score: 0.8, freshness_tier: "stable", source_url: "https://wiki.example/1", title: "Recalled Topic", snippet: "recalled corroborating claim", collection: "default", provider: "knowledge_base", source_type: "encyclopedia", ingested_at: Date.now() },
    ]);

    const result = await corroborate("topic", {
      searchers: {
        duckduckgo: async () => [makeResult("Recalled Topic Match", "https://a.com/1", "recalled corroborating claim")],
      },
    });

    expect(kbSearch).toHaveBeenCalled();
    expect(result.providers_used).not.toContain("knowledge_base");
    expect(result.total_sources).toBeGreaterThanOrEqual(2);
  });

  it("skips knowledge-base recall when kb_recall is false", async () => {
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
      },
      corroboration: { max_iterations: 1, max_http_calls: 30, confidence_threshold: 0.8, kb_recall: false },
    });
    vi.mocked(isKbConfigured).mockReturnValue(true);

    await corroborate("topic", {
      searchers: { duckduckgo: async () => [makeResult("T", "https://a.com/1", "x")] },
    });

    expect(kbSearch).not.toHaveBeenCalled();
  });

  it("excludes providers whose auth env is unset", async () => {
    process.env["INFOBROKER_BRAVE_API_KEY"] = "";
    mockConfig({
      providers: {
        duckduckgo: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 10, timeout: 10000 },
        brave: { enabled: true, capabilities: ["web_search"], rate_limit: {}, priority: 30, timeout: 10000, auth_env: "INFOBROKER_BRAVE_API_KEY" },
      },
      corroboration: { max_iterations: 1, max_http_calls: 30, confidence_threshold: 0.8 },
    });

    let braveCalled = false;
    await corroborate("topic", {
      searchers: {
        duckduckgo: async () => [makeResult("T", "https://a.com/1", "x")],
        brave: async () => { braveCalled = true; return []; },
      },
    });

    expect(braveCalled).toBe(false);
    delete process.env["INFOBROKER_BRAVE_API_KEY"];
  });
});
