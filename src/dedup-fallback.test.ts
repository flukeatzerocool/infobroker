// @implements REQ-020g no-embedding-ordering
// F-R3-17: without an embedding capability the reconciler must still return a
// deterministic non-semantic ranking instead of input order. The embedding
// module is mocked to throw, which is the only way to reach that branch.
import { describe, expect, it, vi } from "vitest";

vi.mock("./embed.js", () => ({
  pairwiseSimilarity: () => {
    throw new Error("no embedding model");
  },
  rankDocs: () => {
    throw new Error("no embedding model");
  },
}));

import { reconcileResults, orderByRelevance } from "./dedup.js";
import type { SearchResult } from "./types.js";

function r(title: string, url: string, snippet: string): SearchResult {
  return { title, url, snippet };
}

describe("no-embedding reconciliation (REQ-020g)", () => {
  it("ranks by non-semantic term overlap instead of input order", () => {
    const results = [
      r("Gardening tips for spring", "https://a.com/1", "planting vegetables and flowers"),
      r("Quantum computing qubits", "https://b.com/2", "quantum error correction with qubits"),
    ];
    expect(orderByRelevance(results, "quantum computing qubits")[0].url).toBe("https://b.com/2");
    expect(reconcileResults(results, "quantum computing qubits")[0].url).toBe("https://b.com/2");
  });

  it("is deterministic for equal scores", () => {
    const results = [
      r("Same", "https://a.com/1", "same text"),
      r("Same", "https://b.com/2", "same text"),
    ];
    expect(orderByRelevance(results, "unrelated").map((x) => x.url)).toEqual([
      "https://a.com/1",
      "https://b.com/2",
    ]);
  });
});
