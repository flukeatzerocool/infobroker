// @implements REQ-020g
import { describe, it, expect } from "vitest";
import { reconcileResults, orderByRelevance, DEFAULT_DEDUP_THRESHOLD } from "./dedup.js";
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

  it("records every contributing provider on the representative (REQ-020g)", () => {
    const results = [
      { ...r("Quantum error correction breakthrough", "https://a.com/1", "Researchers demonstrate quantum error correction at scale"), provider: "duckduckgo" },
      { ...r("Quantum error correction breakthrough", "https://b.com/2", "Researchers demonstrate quantum error correction at scale"), provider: "mojeek" },
    ];
    const out = reconcileResults(results, "quantum error correction");
    expect(out).toHaveLength(1);
    expect(out[0].providers).toEqual(["duckduckgo", "mojeek"]);
    expect(out[0].provider).toBe("duckduckgo");
  });

  it("exposes a deterministic non-semantic ranking (REQ-020g)", () => {
    const results = [
      r("Gardening tips for spring", "https://a.com/1", "planting vegetables and flowers"),
      r("Quantum computing qubits", "https://b.com/2", "quantum error correction with qubits"),
    ];
    const out = orderByRelevance(results, "quantum computing qubits");
    expect(out[0].url).toBe("https://b.com/2");
  });
});

// @implements REQ-020j snippet-basis
// @implements REQ-020j identity-sets token-floor
describe("reconcileResults snippet basis (REQ-020j)", () => {
  const SYNDICATED =
    "The central bank held its policy rate unchanged at 4.25 percent, citing persistent services inflation.";

  it("collapses a reheadlined syndication on the snippet (REQ-020j snippet-basis)", () => {
    const results = [
      { ...r("Central bank holds rates", "https://news.example.com/rates", SYNDICATED), provider: "duckduckgo" },
      { ...r("Rate decision: no change", "https://wire.example.net/story-1182", SYNDICATED), provider: "mojeek" },
      r("Analyst outlook", "https://research.example.net/outlook", "Economists expect one cut before year end."),
    ];
    const out = reconcileResults(results, "central bank rate decision");
    expect(out).toHaveLength(2);
    const pair = out.filter((x) => x.url.includes("rates") || x.url.includes("story-1182"));
    expect(pair).toHaveLength(1);
    expect(pair[0].providers).toEqual(["duckduckgo", "mojeek"]);
  });

  it("accepts a snippet of exactly eight tokens (REQ-020j token-floor)", () => {
    const body = "Officials approved the port expansion late on Tuesday";
    expect(body.split(/\s+/)).toHaveLength(8);
    const out = reconcileResults(
      [
        r("Port expansion approved", "https://a.example.com/port", body),
        r("Harbour works get go-ahead", "https://b.example.net/port", body),
      ],
      "port expansion",
    );
    expect(out).toHaveLength(1);
  });

  it("refuses a snippet below the token floor (REQ-020j token-floor)", () => {
    const body = "Approved port expansion follows four year review";
    expect(body.split(/\s+/)).toHaveLength(7);
    const out = reconcileResults(
      [
        r("Port expansion approved", "https://a.example.com/port", body),
        r("Harbour works get go-ahead", "https://b.example.net/port", body),
      ],
      "port expansion",
    );
    expect(out).toHaveLength(2);
  });

  it("refuses differing identifying values on each side (REQ-020j identity-sets)", () => {
    const out = reconcileResults(
      [
        r(
          "Northwind posts quarterly results",
          "https://finance.example.com/northwind",
          "The company reported revenue of 2026 million dollars in the third quarter review.",
        ),
        r(
          "Analyst note on Southgate figures",
          "https://markets.example.net/southgate",
          "The company reported revenue of 2026 million dollars, up from 4.2 billion, in the third quarter review.",
        ),
      ],
      "quarterly revenue",
    );
    expect(out).toHaveLength(2);
  });

  it("allows the collapse when neither snippet carries an identifying value (REQ-020j identity-sets)", () => {
    const body =
      "Protected cycle lanes were associated with a marked reduction in cyclist injuries over five years.";
    // Titles share no content word, so full-text similarity stays at 0.670 —
    // well below threshold. Only the snippet basis can collapse this pair, so a
    // refusal of the both-empty abstention fails here.
    const out = reconcileResults(
      [
        r("Study finds fewer crashes", "https://transport.example.org/lanes", body),
        r("Council briefing note", "https://policy.example.net/brief", body),
      ],
      "cycling infrastructure",
    );
    expect(out).toHaveLength(1);
  });
});

// @implements REQ-020k origin-grouping
describe("origin grouping (REQ-020k)", () => {
  function withOrigin(title: string, url: string, snippet: string, origin: string): SearchResult {
    return { ...r(title, url, snippet), original_source: origin, provider: "p" };
  }

  it("collapses two URLs that name the same document, whatever their text says", () => {
    const results = [
      withOrigin("Solar output rises", "https://a.com/news/1", "Panel efficiency improved across the board", "https://pub.example/story"),
      withOrigin("Different headline entirely", "https://b.com/syndicated", "An unrelated-looking snippet body", "https://pub.example/story/amp"),
      r("Sourdough baking", "https://c.com/3", "How to bake sourdough bread at home"),
    ];
    const out = reconcileResults(results, "solar panel efficiency");
    expect(out).toHaveLength(2);
    const kept = out.find((x) => x.original_source?.includes("pub.example"));
    expect(kept?.providers).toEqual(["p"]);
    expect(out.some((x) => x.url === "https://b.com/syndicated")).toBe(false);
  });

  it("keeps two distinct documents from one publisher apart", () => {
    const results = [
      withOrigin("Story one", "https://a.com/1", "first article body text here", "https://pub.example/one"),
      withOrigin("Story two", "https://b.com/2", "second article body text here", "https://pub.example/two"),
    ];
    expect(reconcileResults(results, "article body")).toHaveLength(2);
  });

  it("does not group by a publisher root", () => {
    const results = [
      withOrigin("Story one", "https://a.com/1", "first article body text here", "https://pub.example"),
      withOrigin("Story two", "https://b.com/2", "second article body text here", "https://pub.example/"),
    ];
    expect(reconcileResults(results, "article body")).toHaveLength(2);
  });

  it("treats a path case difference as two documents", () => {
    const results = [
      withOrigin("Story", "https://a.com/1", "first article body text here", "https://pub.example/Story"),
      withOrigin("Story", "https://b.com/2", "second article body text here", "https://pub.example/story"),
    ];
    expect(reconcileResults(results, "article body")).toHaveLength(2);
  });

  it("keeps a result with no identity in its own group", () => {
    const results = [
      withOrigin("One", "https://a.com/1", "first article body text here", "not a url"),
      withOrigin("Two", "https://b.com/2", "second article body text here", "not a url"),
    ];
    expect(reconcileResults(results, "article body")).toHaveLength(2);
  });
});
