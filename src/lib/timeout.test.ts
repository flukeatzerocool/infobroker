// @implements REQ-035
// timeout.test.ts — the per-provider timeout race clears its timer (REQ-035,
// CR-13). Deterministic: fake timers only, no network.
import { describe, it, expect, vi, afterEach } from "vitest";
import { withTimeout } from "./timeout.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("withTimeout", () => {
  it("resolves a fast result and clears the pending timer", async () => {
    vi.useFakeTimers();
    await expect(withTimeout(Promise.resolve("ok"), 5000, () => "late")).resolves.toBe("ok");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects with the supplied message when the work outlives the timeout", async () => {
    vi.useFakeTimers();
    const work = new Promise<string>(() => {
      // Never settles: the timeout must decide the race.
    });
    const pending = withTimeout(work, 100, () => "Provider timed out after 100ms");
    const assertion = expect(pending).rejects.toThrow("Provider timed out after 100ms");
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("passes the work through when no timeout is configured", async () => {
    await expect(withTimeout(Promise.resolve(7), undefined, () => "x")).resolves.toBe(7);
    await expect(withTimeout(Promise.resolve(7), 0, () => "x")).resolves.toBe(7);
    await expect(withTimeout(Promise.resolve(7), -1, () => "x")).resolves.toBe(7);
  });
});
