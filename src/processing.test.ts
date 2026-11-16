// @implements REQ-133 cache-vs-network truncation dedup freshness
// processing.test.ts — the processing block is assembled from the facts
// retrieval already records, and an empty case reports zero rather than
// omitting the field.

import { describe, expect, it } from "vitest";
import { buildProcessing, processingEntry, processingForUrls } from "./processing.js";

describe("processing block", () => {
  it("reports cached content differently from live content", () => {
    const block = buildProcessing([
      processingEntry({ url: "https://a.test", served: "cache", freshness: "warm" }),
      processingEntry({ url: "https://b.test" }),
    ]);
    expect(block.results[0]).toEqual({
      url: "https://a.test",
      served: "cache",
      truncated: false,
      collapsed_from: 0,
      freshness: "warm",
    });
    expect(block.results[1]?.served).toBe("network");
    expect(block.results[1]?.freshness).toBe("live");
  });

  it("counts truncated results and reports zero when none were", () => {
    expect(
      buildProcessing([processingEntry({ url: "https://a.test", truncated: true })]).truncated_count,
    ).toBe(1);
    expect(buildProcessing([processingEntry({ url: "https://a.test" })]).truncated_count).toBe(0);
  });

  it("reports the collapsed count reconciliation removed", () => {
    const block = buildProcessing([processingEntry({ url: "https://a.test" })], 2);
    expect(block.collapsed_count).toBe(2);
    expect(block.results).toHaveLength(1);
    expect(buildProcessing([], 0).collapsed_count).toBe(0);
  });

  it("rejects a negative collapse or collapsed_from instead of reporting one", () => {
    expect(processingEntry({ url: "https://a.test", collapsedFrom: -3 }).collapsed_from).toBe(0);
    expect(buildProcessing([], -1).collapsed_count).toBe(0);
  });

  it("builds one live entry per result for a reconciled search", () => {
    const block = processingForUrls(["https://a.test", "https://b.test"], 1);
    expect(block.results.map((entry) => entry.url)).toEqual(["https://a.test", "https://b.test"]);
    expect(block.collapsed_count).toBe(1);
    expect(block.results.every((entry) => entry.served === "network")).toBe(true);
  });
});
