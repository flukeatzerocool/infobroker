// @implements REQ-032
import { describe, it, expect, vi } from "vitest";
import { retryWithBackoff, RetryableError } from "./retry.js";

describe("retryWithBackoff per-provider config (REQ-032)", () => {
  it("honors the configured retry count", async () => {
    const fn = vi.fn(async () => {
      throw new RetryableError("rate limited", 429);
    });
    await expect(retryWithBackoff(fn, { retry_count: 1, retry_backoff_ms: 1 })).rejects.toThrow(/rate limited/);
    // 1 retry after the first attempt
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("honors a zero retry count (no retry)", async () => {
    const fn = vi.fn(async () => {
      throw new RetryableError("rate limited", 429);
    });
    await expect(retryWithBackoff(fn, { retry_count: 0, retry_backoff_ms: 1 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry a non-retryable error", async () => {
    const fn = vi.fn(async () => {
      throw new Error("selector drift");
    });
    await expect(retryWithBackoff(fn, { retry_count: 3, retry_backoff_ms: 1 })).rejects.toThrow(/selector drift/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("returns the value without invoking the retry path on success", async () => {
    const fn = vi.fn(async () => "ok");
    await expect(retryWithBackoff(fn, { retry_count: 3, retry_backoff_ms: 1 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
