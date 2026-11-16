// @implements REQ-024b last-history
// REQ-024b: the health action reports the timestamps of the most recent error
// and success from operational history. The history is process-scoped and the
// probe never records a success.
import { beforeEach, describe, expect, it } from "vitest";
import {
  providerHistory,
  recordProviderError,
  recordProviderSuccess,
  recordSearchYield,
  resetProviderHistoryForTests,
  bumpFailureStreak,
} from "./provider-history.js";

describe("provider operational history (REQ-024b)", () => {
  beforeEach(() => {
    resetProviderHistoryForTests();
  });

  it("starts empty", () => {
    expect(providerHistory("wikipedia")).toBeUndefined();
  });

  it("records a success timestamp", () => {
    recordProviderSuccess("wikipedia", 1_700_000_000_000);
    expect(providerHistory("wikipedia")?.lastSuccess).toBe(1_700_000_000_000);
    expect(providerHistory("wikipedia")?.lastError).toBeUndefined();
  });

  it("records an error message and timestamp", () => {
    recordProviderError("arxiv", "arXiv returned HTTP 503", 1_700_000_000_500);
    expect(providerHistory("arxiv")).toEqual({
      lastError: { message: "arXiv returned HTTP 503", timestamp: 1_700_000_000_500 },
    });
  });

  it("keeps success and error independently per provider", () => {
    recordProviderSuccess("wikipedia", 1);
    recordProviderError("wikipedia", "boom", 2);
    recordProviderSuccess("arxiv", 3);
    expect(providerHistory("wikipedia")?.lastSuccess).toBe(1);
    expect(providerHistory("wikipedia")?.lastError?.message).toBe("boom");
    expect(providerHistory("arxiv")?.lastSuccess).toBe(3);
    expect(providerHistory("arxiv")?.lastError).toBeUndefined();
  });

  it("overwrites the previous error with the newest one", () => {
    recordProviderError("wikipedia", "first", 1);
    recordProviderError("wikipedia", "second", 2);
    expect(providerHistory("wikipedia")?.lastError).toEqual({ message: "second", timestamp: 2 });
  });

  it("clears on the test seam", () => {
    recordProviderSuccess("wikipedia", 1);
    resetProviderHistoryForTests();
    expect(providerHistory("wikipedia")).toBeUndefined();
  });

  it("records search yield and counts consecutive zero-result attempts", () => {
    recordSearchYield("wiby", 3, 10);
    expect(providerHistory("wiby")).toMatchObject({ lastResultCount: 3, zeroResultStreak: 0, lastSuccess: 10 });

    recordSearchYield("wiby", 0, 20);
    expect(providerHistory("wiby")).toMatchObject({ lastResultCount: 0, zeroResultStreak: 1 });

    recordSearchYield("wiby", 0, 30);
    expect(providerHistory("wiby")?.zeroResultStreak).toBe(2);

    recordSearchYield("wiby", 1, 40);
    expect(providerHistory("wiby")).toMatchObject({ lastResultCount: 1, zeroResultStreak: 0 });
  });
});

// REQ-038: a persistent-failure streak is reset by any success.
describe("failure streak (REQ-038)", () => {
  it("counts consecutive failures and resets on success", () => {
    expect(bumpFailureStreak("wiby")).toBe(1);
    expect(bumpFailureStreak("wiby")).toBe(2);
    expect(bumpFailureStreak("wiby")).toBe(3);
    recordProviderSuccess("wiby", 1);
    expect(bumpFailureStreak("wiby")).toBe(1);
  });
});
