// @implements REQ-020 REQ-021
import { describe, it, expect } from "vitest";
import { capInputs, mergeItems, parseEnvelope, MAX_BATCH_INPUTS } from "./batch.js";

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
});
