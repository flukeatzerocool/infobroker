// @implements REQ-024b last-history
// REQ-024b: the health action reports the timestamps of the most recent error
// and success from operational history. The history is process-scoped and the
// probe never records a success.
import { beforeEach, describe, expect, it } from "vitest";
import {
  providerHistory,
  recordProviderError,
  recordProviderSuccess,
  resetProviderHistoryForTests,
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
});
