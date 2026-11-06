// @implements REQ-020 REQ-021 REQ-021b content-mode full-content-mode match-strong match-moderate match-weak match-none REQ-021k REQ-076a blend
import { describe, it, expect } from "vitest";
import { capInputs, coerceStringArray, mergeItems, mergeKnowledgeBaseResults, parseEnvelope, MAX_BATCH_INPUTS } from "./batch.js";

describe("capInputs", () => {
  it("caps input arrays at the batch limit", () => {
    const inputs = ["a", "b", "c", "d", "e", "f", "g"];
    expect(capInputs(inputs).length).toBe(MAX_BATCH_INPUTS);
    expect(capInputs(inputs)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("leaves short arrays unchanged", () => {
    expect(capInputs(["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("coerceStringArray (union input transport)", () => {
  it("passes a single string through", () => {
    expect(coerceStringArray("one query").values).toEqual(["one query"]);
  });

  it("passes a real array through and caps it", () => {
    expect(coerceStringArray(["a", "b", "c", "d", "e", "f"]).values).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("expands a JSON-encoded array string", () => {
    expect(coerceStringArray('["one", "two"]').values).toEqual(["one", "two"]);
  });

  it("keeps a bracketed free-text query as one string when it is not JSON", () => {
    expect(coerceStringArray("[RFC 9114] status").values).toEqual(["[RFC 9114] status"]);
  });

  it("rejects a malformed URL batch in strict mode", () => {
    const out = coerceStringArray('["https://a.example",]', { strictArraySyntax: true });
    expect(out.error?.message).toBeTruthy();
    expect(out.values).toBeUndefined();
  });

  it("rejects empty arrays, non-strings, and empty strings", () => {
    expect(coerceStringArray([]).error).toBeTruthy();
    expect(coerceStringArray(["a", 2]).error).toBeTruthy();
    expect(coerceStringArray("   ").error).toBeTruthy();
  });
});

describe("parseEnvelope", () => {
  it("parses [OK] and [ERROR] prefixed envelopes", () => {
    expect(parseEnvelope('[OK] {"status":"ok","provider":"p","results":[]}').status).toBe("ok");
    expect(parseEnvelope('[ERROR] {"status":"error","provider":"p"}').status).toBe("error");
  });
});

describe("mergeItems (REQ-020/REQ-021 array inputs)", () => {
  const okEnv = (url: string, provider: string) =>
    `[OK] ${JSON.stringify({ status: "ok", provider, results: [{ title: "t", url, snippet: "s" }] })}`;
  const errEnv = (provider: string) =>
    `[ERROR] ${JSON.stringify({ status: "error", provider, error: { code: "provider_unavailable", message: "x" } })}`;

  it("flattens and dedupes results, recording per-query provenance", () => {
    const merged = mergeItems([
      { query: "q1", envelope: okEnv("https://a.com", "duckduckgo") },
      { query: "q2", envelope: okEnv("https://a.com", "mojeek") },
      { query: "q3", envelope: okEnv("https://b.com", "duckduckgo") },
    ]) as { status: string; provider: string; results: Array<{ url: string }>; meta: { per_query: Array<{ query: string; result_count: number }> } };

    expect(merged.status).toBe("ok");
    expect(merged.results.map((r) => r.url)).toEqual(["https://a.com", "https://b.com"]);
    expect(merged.meta.per_query).toEqual([
      { query: "q1", provider: "duckduckgo", status: "ok", result_count: 1 },
      { query: "q2", provider: "mojeek", status: "ok", result_count: 1 },
      { query: "q3", provider: "duckduckgo", status: "ok", result_count: 1 },
    ]);
  });

  it("returns the first error envelope when every item failed", () => {
    const merged = mergeItems([
      { query: "q1", envelope: errEnv("duckduckgo") },
      { query: "q2", envelope: errEnv("mojeek") },
    ]) as { status: string; provider: string };

    expect(merged.status).toBe("error");
    expect(merged.provider).toBe("duckduckgo");
  });

  it("carries truncation flags through per-query metadata", () => {
    const truncated = `[OK] ${JSON.stringify({ status: "ok", provider: "jina", results: [{ title: "t", url: "https://a.com", snippet: "s" }], truncated: true, output_path: "/tmp/x" })}`;
    const merged = mergeItems([{ query: "q1", envelope: truncated }]) as unknown as { meta: { per_query: Array<{ truncated?: boolean; output_path?: string }> } };
    expect(merged.meta.per_query[0].truncated).toBe(true);
    expect(merged.meta.per_query[0].output_path).toBe("/tmp/x");
  });

  it("aggregates blocked_count across queries (REQ-020h)", () => {
    const blockedEnv = (url: string, blocked: number) =>
      `[OK] ${JSON.stringify({ status: "ok", provider: "duckduckgo", results: [{ title: "t", url, snippet: "s" }], meta: { blocked_count: blocked } })}`;
    const merged = mergeItems([
      { query: "q1", envelope: blockedEnv("https://a.com", 2) },
      { query: "q2", envelope: blockedEnv("https://b.com", 1) },
    ]) as unknown as {
      meta: { blocked_count: number; per_query: Array<{ blocked_count?: number }> };
    };
    expect(merged.meta.blocked_count).toBe(3);
    expect(merged.meta.per_query.map((q) => q.blocked_count)).toEqual([2, 1]);
  });

  it("emits a remediation field on the internal_error envelope when an item fails to parse (REQ-002)", () => {
    const merged = mergeItems([
      { query: "q1", envelope: "not an envelope" },
    ]) as { status: string; provider: string; error: { code: string; message: string; remediation: string } };

    expect(merged.status).toBe("error");
    expect(merged.error.code).toBe("internal_error");
    expect(merged.error.remediation).toBeTruthy();
  });

  it("emits a remediation field on the internal_error envelope when there are no items (REQ-002)", () => {
    const merged = mergeItems([]) as { status: string; provider: string; error: { code: string; message: string; remediation: string } };

    expect(merged.status).toBe("error");
    expect(merged.error.code).toBe("internal_error");
    expect(merged.error.remediation).toBeTruthy();
  });

  const questionEnv = (url: string, provider: string, text: string, score: number) =>
    `[OK] ${JSON.stringify({
      status: "ok",
      provider,
      question: "When did Trump enter the WWE Hall of Fame?",
      extraction_mode: "content",
      results: [{ title: new URL(url).hostname, url, snippet: text }],
      snippets: [{ text, score, index: 0 }],
      top_score: score,
      meta: { query_time_ms: 1, fallback_used: false },
    })}`;

  it("preserves per-item question-mode fields in array mode (REQ-021b)", () => {
    const merged = mergeItems([
      { query: "u1", envelope: questionEnv("https://a.example/1", "wikipedia", "passage one", 0.82) },
      { query: "u2", envelope: questionEnv("https://b.example/2", "native_fetch", "passage two", 0.41) },
    ]) as unknown as {
      question?: string;
      results: Array<{
        url: string;
        provider?: string;
        snippets?: unknown[];
        top_score?: number;
        extraction_mode?: string;
      }>;
      meta: {
        per_query: Array<{ passages_returned?: number; top_score?: number; extraction_mode?: string }>;
      };
    };

    expect(merged.question).toBe("When did Trump enter the WWE Hall of Fame?");
    expect(merged.results.map((r) => r.provider)).toEqual(["wikipedia", "native_fetch"]);
    expect(merged.results[0].snippets).toHaveLength(1);
    expect(merged.results[0].top_score).toBe(0.82);
    expect(merged.results[0].extraction_mode).toBe("content");
    expect(merged.meta.per_query[0]).toMatchObject({
      top_score: 0.82,
      passages_returned: 1,
      extraction_mode: "content",
    });
  });

  it("keeps the no-passage note on its own item", () => {
    const fullContent = `[OK] ${JSON.stringify({
      status: "ok",
      provider: "jina",
      question: "When did Trump enter the WWE Hall of Fame?",
      extraction_mode: "full_content",
      results: [{ title: "b.example", url: "https://b.example/2", snippet: "full text" }],
      note: "No passage addressed the question; returning the full content instead.",
    })}`;
    const merged = mergeItems([
      { query: "u1", envelope: questionEnv("https://a.example/1", "wikipedia", "passage one", 0.82) },
      { query: "u2", envelope: fullContent },
    ]) as unknown as {
      extraction_mode?: string;
      note?: string;
      results: Array<{ extraction_mode?: string; note?: string }>;
    };

    expect(merged.extraction_mode).toBeUndefined();
    expect(merged.note).toBeUndefined();
    expect(merged.results[0].note).toBeUndefined();
    expect(merged.results[0].extraction_mode).toBe("content");
    expect(merged.results[1].note).toContain("No passage addressed");
    expect(merged.results[1].extraction_mode).toBe("full_content");
  });

  it("returns the ok subset with per-query error detail", () => {
    const failed = `[ERROR] ${JSON.stringify({
      status: "error",
      provider: "mojeek",
      error: {
        code: "provider_unavailable",
        message: "timeout",
        remediation: "Retry or use inspect_providers action=health",
      },
    })}`;
    const merged = mergeItems([
      { query: "https://a.example/1", envelope: questionEnv("https://a.example/1", "wikipedia", "p", 0.5) },
      { query: "https://b.example/2", envelope: failed },
    ]) as unknown as {
      status: string;
      results: Array<{ url: string }>;
      meta: {
        per_query: Array<{ status: string; error?: { code: string; message: string; remediation?: string } }>;
      };
    };

    expect(merged.status).toBe("ok");
    expect(merged.results.map((r) => r.url)).toEqual(["https://a.example/1"]);
    expect(merged.meta.per_query[1]).toMatchObject({
      status: "error",
      error: {
        code: "provider_unavailable",
        message: "timeout",
        remediation: "Retry or use inspect_providers action=health",
      },
    });
  });

  it("keeps truncation per item when only one URL is truncated", () => {
    const truncated = `[OK] ${JSON.stringify({ status: "ok", provider: "jina", results: [{ title: "t", url: "https://a.example/1", snippet: "s" }], truncated: true, output_path: "/tmp/x" })}`;
    const full = `[OK] ${JSON.stringify({ status: "ok", provider: "wikipedia", results: [{ title: "t", url: "https://b.example/2", snippet: "s" }] })}`;
    const merged = mergeItems([
      { query: "u1", envelope: truncated },
      { query: "u2", envelope: full },
    ]) as unknown as {
      results: Array<{ url: string }>;
      meta: { per_query: Array<{ truncated?: boolean; output_path?: string }> };
    };

    expect(merged.results).toHaveLength(2);
    expect(merged.meta.per_query[0]).toMatchObject({ truncated: true, output_path: "/tmp/x" });
    expect(merged.meta.per_query[1].truncated).toBeUndefined();
  });

  it("does not overwrite an existing per-result provider (search_web path)", () => {
    const env = `[OK] ${JSON.stringify({
      status: "ok",
      provider: "duckduckgo",
      results: [{ title: "t", url: "https://a.example/1", snippet: "s", provider: "mojeek" }],
    })}`;
    const merged = mergeItems([{ query: "q1", envelope: env }]) as unknown as {
      results: Array<{ provider?: string }>;
    };

    expect(merged.results[0].provider).toBe("mojeek");
  });
});

describe("self-describing batch items (REQ-021k)", () => {
  // @implements REQ-021k
  it("names url, provider, status, passages, and truncation per input", () => {
    const ok = `[OK] ${JSON.stringify({
      status: "ok",
      provider: "jina",
      url: "https://a.example/one",
      question: "what happened",
      extraction_mode: "content",
      results: [{ title: "a.example", url: "https://a.example/one", snippet: "passage one" }],
      snippets: [{ text: "passage one", score: 0.6, index: 0, start: 0, end: 12 }],
      top_score: 0.6,
      truncated: true,
      output_path: "/tmp/full.txt",
      meta: { query_time_ms: 1, fallback_used: false },
    })}`;
    const failed = `[ERROR] ${JSON.stringify({
      status: "error",
      provider: "none",
      error: { code: "network_error", message: "unreachable", remediation: "retry" },
    })}`;
    const merged = mergeItems([
      { query: "https://a.example/one", envelope: ok },
      { query: "https://b.example/two", envelope: failed },
    ]) as unknown as {
      meta: {
        per_query: Array<{
          url?: string;
          provider: string;
          status: string;
          passages?: unknown[];
          passages_returned?: number;
          truncated?: boolean;
          match_quality?: string;
        }>;
      };
    };

    expect(merged.meta.per_query[0]).toMatchObject({
      url: "https://a.example/one",
      provider: "jina",
      status: "ok",
      passages_returned: 1,
      truncated: true,
      match_quality: "strong",
    });
    expect(merged.meta.per_query[0].passages).toHaveLength(1);
    expect(merged.meta.per_query[1]).toMatchObject({
      url: "https://b.example/two",
      provider: "none",
      status: "error",
    });
  });
});

// @implements REQ-076a blend
describe("mergeKnowledgeBaseResults (REQ-076a)", () => {
  const external = [
    { title: "fresh copy", url: "https://example.com/a?utm_source=x", snippet: "fresh", provider: "duckduckgo" },
  ];
  const cached = [
    { title: "cached copy", url: "https://example.com/a", snippet: "cached", provider: "knowledge_base" },
    { title: "cached only", url: "https://example.com/b", snippet: "only cached", provider: "knowledge_base" },
  ];

  it("keeps the fresh external row and appends only the cached row the external tier missed", () => {
    const merged = mergeKnowledgeBaseResults(external, cached);
    expect(merged.results).toHaveLength(2);
    expect(merged.results[0]?.title).toBe("fresh copy");
    expect(merged.results[1]?.title).toBe("cached only");
    expect(merged.duplicates).toBe(1);
  });

  it("returns the external rows unchanged when there is no cached work", () => {
    const merged = mergeKnowledgeBaseResults(external, []);
    expect(merged.results).toEqual(external);
    expect(merged.duplicates).toBe(0);
  });
});
