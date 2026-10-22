// @implements REQ-030
import { describe, it, expect, vi, afterEach } from "vitest";
import { throttle, configureProviderRateLimit } from "./rate-limiter.js";

describe("throttle (REQ-030)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("records the post-sleep timestamp so consecutive calls each enforce the interval", async () => {
    const now = Date.now();
    vi.useFakeTimers({ now });
    configureProviderRateLimit("p1", { per_second: 1 }); // 1000ms interval

    const first = throttle("p1"); // no sleep: lastCall was 0, elapsed large
    await vi.advanceTimersByTimeAsync(0);
    await first;

    const second = throttle("p1"); // sleeps 1000ms
    await vi.advanceTimersByTimeAsync(1000);
    await second;

    // The third call must sleep a full interval. A pre-sleep timestamp would
    // let it return immediately, under-throttling the next request.
    let thirdSettled = false;
    const third = throttle("p1").then(() => {
      thirdSettled = true;
    });
    await vi.advanceTimersByTimeAsync(1);
    expect(thirdSettled).toBe(false);

    await vi.advanceTimersByTimeAsync(999);
    await third;
    expect(thirdSettled).toBe(true);
  });

  it("serializes a concurrent burst instead of firing together", async () => {
    vi.useFakeTimers({ now: Date.now() });
    configureProviderRateLimit("burst", { per_second: 1 });

    const settled: number[] = [];
    const calls = [0, 1, 2].map((i) => throttle("burst").then(() => settled.push(i)));

    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toEqual([0]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(settled).toEqual([0, 1]);
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all(calls);
    expect(settled).toEqual([0, 1, 2]);
  });
});
