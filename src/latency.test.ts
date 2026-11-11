// @implements REQ-036
import { describe, it, expect } from "vitest";
import { createLatencyTracker, type LatencyWindow } from "./latency.js";

const countWindow = (size: number): LatencyWindow => ({ size, strategy: "count" });

describe("createLatencyTracker (REQ-036)", () => {
  it("averages the samples recorded for a provider", () => {
    const tracker = createLatencyTracker(() => countWindow(10));
    tracker.track("duckduckgo", 100);
    tracker.track("duckduckgo", 200);
    expect(tracker.avg("duckduckgo")).toBe(150);
  });

  it("computes the average over a bounded window, evicting the oldest samples", () => {
    const tracker = createLatencyTracker(() => countWindow(3));
    for (const ms of [10, 20, 30, 40, 50]) tracker.track("a", ms);
    // Only the last three (30, 40, 50) remain in the window.
    expect(tracker.avg("a")).toBe(40);
  });

  it("applies a shrunken window on the next sample", () => {
    let size = 4;
    const tracker = createLatencyTracker(() => countWindow(size));
    for (const ms of [10, 20, 30, 40]) tracker.track("a", ms);
    expect(tracker.avg("a")).toBe(25);
    size = 2;
    tracker.track("a", 60);
    // Window is now the last two samples (40, 60).
    expect(tracker.avg("a")).toBe(50);
  });

  it("returns zero for a provider with no samples", () => {
    const tracker = createLatencyTracker(() => countWindow(10));
    expect(tracker.avg("unknown")).toBe(0);
  });

  it("counts every tracked request across providers", () => {
    const tracker = createLatencyTracker(() => countWindow(10));
    tracker.track("a", 1);
    tracker.track("b", 2);
    tracker.track("a", 3);
    expect(tracker.total()).toBe(3);
  });

  it("time strategy drops a sample older than the window on the next track", () => {
    let clock = 0;
    const tracker = createLatencyTracker(() => ({ size: 100, ms: 1_000, strategy: "time" }), () => clock);
    tracker.track("a", 100);
    clock = 1_500;
    tracker.track("a", 300);
    // The 100 ms sample aged out at 1 000 ms; only the 300 ms sample remains.
    expect(tracker.avg("a")).toBe(300);
  });

  it("count strategy ignores age", () => {
    let clock = 0;
    const tracker = createLatencyTracker(() => ({ size: 10, ms: 1_000, strategy: "count" }), () => clock);
    tracker.track("a", 100);
    clock = 60_000;
    tracker.track("a", 300);
    expect(tracker.avg("a")).toBe(200);
  });

  it("both applies the tighter bound", () => {
    let clock = 0;
    const tracker = createLatencyTracker(() => ({ size: 2, ms: 1_000, strategy: "both" }), () => clock);
    tracker.track("a", 100);
    clock = 500;
    tracker.track("a", 200);
    clock = 1_200;
    // 100 aged out; 200 is still inside the 1 000 ms window.
    tracker.track("a", 300);
    expect(tracker.avg("a")).toBe(250);
    clock = 1_300;
    tracker.track("a", 400);
    // Count bound keeps only the last two (300, 400).
    expect(tracker.avg("a")).toBe(350);
  });

  it("an idle read with no new sample reports no history once the window has passed", () => {
    let clock = 0;
    const tracker = createLatencyTracker(() => ({ size: 100, ms: 1_000, strategy: "time" }), () => clock);
    tracker.track("a", 100);
    expect(tracker.avg("a")).toBe(100);
    clock = 2_000;
    // No track() in between: the read path itself must discard the stale sample.
    expect(tracker.avg("a")).toBe(0);
  });
});
