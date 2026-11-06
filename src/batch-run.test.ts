// @implements REQ-020i
import { describe, it, expect } from "vitest";
import { settleBatch } from "./batch-run.js";
import { mergeItems } from "./batch.js";

const okEnvelope = (query: string, provider: string) =>
  `[OK] ${JSON.stringify({
    status: "ok",
    provider,
    results: [{ title: query, url: `https://example.com/${provider}`, snippet: query }],
    meta: { query_time_ms: 1, fallback_used: false },
  })}`;

const errorEnvelope = (code: string) =>
  `[ERROR] ${JSON.stringify({
    status: "error",
    provider: "duckduckgo",
    error: { code, message: `failure ${code}`, remediation: "Retry later" },
  })}`;

describe("settleBatch (REQ-020i)", () => {
  it("converts a thrown item into an error envelope without discarding siblings", async () => {
    const envelopes = await settleBatch(
      ["one", "two", "three"],
      async (item) => {
        if (item === "two") throw new Error("unexpected failure");
        return okEnvelope(item, item === "one" ? "duckduckgo" : "wikipedia");
      },
      (item) => errorEnvelope(`internal_error:${item}`),
    );

    expect(envelopes).toHaveLength(3);
    expect(envelopes[1]).toContain("internal_error:two");

    const merged = mergeItems([
      { query: "one", envelope: envelopes[0] },
      { query: "two", envelope: envelopes[1] },
      { query: "three", envelope: envelopes[2] },
    ]);
    expect(merged.status).toBe("ok");
    const perQuery = (merged as unknown as { meta: { per_query: Array<Record<string, unknown>> } }).meta.per_query;
    expect(perQuery).toHaveLength(3);
    expect(perQuery[0].status).toBe("ok");
    expect(perQuery[1].status).toBe("error");
    expect((perQuery[1].error as Record<string, unknown>).code).toContain("internal_error");
    expect(perQuery[2].status).toBe("ok");
  });

  it("keeps a provider error as a per-query entry and still reports the batch as ok", async () => {
    const envelopes = await settleBatch(
      ["good", "bad"],
      async (item) => (item === "good" ? okEnvelope(item, "duckduckgo") : errorEnvelope("rate_limited")),
      () => errorEnvelope("internal_error"),
    );
    const merged = mergeItems([
      { query: "good", envelope: envelopes[0] },
      { query: "bad", envelope: envelopes[1] },
    ]);
    expect(merged.status).toBe("ok");
    const perQuery = (merged as unknown as { meta: { per_query: Array<Record<string, unknown>> } }).meta.per_query;
    expect(perQuery[1].error).toMatchObject({ code: "rate_limited" });
  });

  it("returns the first error when every item fails", async () => {
    const envelopes = await settleBatch(
      ["a", "b"],
      async () => errorEnvelope("all_providers_exhausted"),
      () => errorEnvelope("internal_error"),
    );
    const merged = mergeItems([
      { query: "a", envelope: envelopes[0] },
      { query: "b", envelope: envelopes[1] },
    ]);
    expect(merged.status).toBe("error");
  });

  it("preserves input order regardless of completion order", async () => {
    const envelopes = await settleBatch(
      ["slow", "fast"],
      async (item) => {
        if (item === "slow") await new Promise((resolve) => setTimeout(resolve, 10));
        return okEnvelope(item, "duckduckgo");
      },
      () => errorEnvelope("internal_error"),
    );
    expect(envelopes[0]).toContain('"slow"');
    expect(envelopes[1]).toContain('"fast"');
  });
});
