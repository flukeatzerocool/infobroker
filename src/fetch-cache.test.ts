// @implements REQ-021g
import { describe, it, expect } from "vitest";
import { shouldUseKbCache } from "./fetch-cache.js";

describe("fetch cache freshness (REQ-021g)", () => {
  const now = 1_000_000_000;

  it("uses a fresh entry", () => {
    expect(shouldUseKbCache({ ingested_at: now - 1000 }, 60_000, now)).toBe(true);
  });

  it("falls through when the entry is stale", () => {
    expect(shouldUseKbCache({ ingested_at: now - 120_000 }, 60_000, now)).toBe(false);
  });

  it("does not cache when no entry exists", () => {
    expect(shouldUseKbCache(null, 60_000, now)).toBe(false);
    expect(shouldUseKbCache(undefined, 60_000, now)).toBe(false);
  });

  it("rejects a malformed timestamp", () => {
    expect(shouldUseKbCache({ ingested_at: Number.NaN }, 60_000, now)).toBe(false);
  });
});
