// @implements REQ-020g
import { describe, it, expect } from "vitest";
import { reconcileResults, DEFAULT_DEDUP_THRESHOLD } from "./dedup.js";
import type { SearchResult } from "./types.js";

function r(title: string, url: string, snippet: string): SearchResult {
  return { title, url, snippet };
}

describe("reconcileResults (REQ-020g)", () => {
  it("returns a single result unchanged", () => {
    const one = [r("Solo", "https://a.com/1", "only result")];
    expect(reconcileResults(one, "solo")).toEqual(one);
  });

  it("collapses near-duplicate results and preserves provenance", () => {
    const results = [
      r("Quantum error correction breakthrough", "https://a.com/1", "Researchers demonstrate quantum error correction at scale"),
      r("Quantum error correction breakthrough", "https://b.com/2", "Researchers demonstrate quantum error correction at scale"),
      r("Sourdough baking guide", "https://c.com/3", "How to bake sourdough bread at home"),
    ];
    results[1].original_source = "https://origin.example/story";
    const out = reconcileResults(results, "quantum error correction");
    expect(out.length).toBe(2);
    const quantum = out.find((x) => x.url === "https://a.com/1");
    expect(quantum?.original_source).toBe("https://origin.example/story");
    expect(out.some((x) => x.url === "https://b.com/2")).toBe(false);
  });

  it("orders the representative by semantic relevance to the query", () => {
    const results = [
      r("Gardening tips for spring", "https://a.com/1", "planting vegetables and flowers"),
      r("Quantum computing qubits", "https://b.com/2", "quantum error correction with qubits"),
    ];
    const out = reconcileResults(results, "quantum computing qubits");
    expect(out[0].url).toBe("https://b.com/2");
  });

  it("exposes a conservative default threshold", () => {
    expect(DEFAULT_DEDUP_THRESHOLD).toBeGreaterThanOrEqual(0.8);
  });

  it("promotes a primary source when relevance is comparable (REQ-020h)", () => {
    const results = [
      r("Quantum error correction", "https://blog.example/1", "quantum error correction with logical qubits"),
      r("Quantum error correction", "https://agency.gov/2", "quantum error correction with logical qubits"),
    ];
    const score = (url?: string) => (url?.endsWith(".gov/2") ? 1 : 0);
    const out = reconcileResults(results, "quantum error correction", undefined, {
      qualityWeight: 0.15,
      qualityScore: (result) => score(result.url),
    });
    expect(out[0]?.url).toBe("https://agency.gov/2");
  });

  it("keeps relevance dominant under a small quality weight (REQ-020h)", () => {
    const results = [
      r("Gardening tips", "https://agency.gov/1", "planting vegetables and flowers in spring"),
      r("Quantum computing", "https://blog.example/2", "quantum error correction with logical qubits"),
    ];
    const out = reconcileResults(results, "quantum computing qubits", undefined, {
      qualityWeight: 0.15,
      qualityScore: (result) => (result.url?.endsWith(".gov/1") ? 1 : 0),
    });
    expect(out[0]?.url).toBe("https://blog.example/2");
  });

  it("leaves ordering unchanged at weight zero (REQ-020h)", () => {
    const results = [
      r("Gardening tips", "https://a.com/1", "planting vegetables and flowers"),
      r("Quantum computing qubits", "https://b.com/2", "quantum error correction with qubits"),
    ];
    const out = reconcileResults(results, "quantum computing qubits", undefined, {
      qualityWeight: 0,
      qualityScore: () => 1,
    });
    expect(out[0]?.url).toBe("https://b.com/2");
  });
});
