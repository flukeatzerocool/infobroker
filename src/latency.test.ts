// @implements REQ-036
import { describe, it, expect } from "vitest";
import { createLatencyTracker } from "./latency.js";

describe("createLatencyTracker (REQ-036)", () => {
  it("averages the samples recorded for a provider", () => {
    const tracker = createLatencyTracker(() => 10);
    tracker.track("duckduckgo", 100);
    tracker.track("duckduckgo", 200);
    expect(tracker.avg("duckduckgo")).toBe(150);
  });

  it("computes the average over a bounded window, evicting the oldest samples", () => {
    const tracker = createLatencyTracker(() => 3);
    for (const ms of [10, 20, 30, 40, 50]) tracker.track("a", ms);
    // Only the last three (30, 40, 50) remain in the window.
    expect(tracker.avg("a")).toBe(40);
  });

  it("applies a shrunken window on the next sample", () => {
    let windowSize = 4;
    const tracker = createLatencyTracker(() => windowSize);
    for (const ms of [10, 20, 30, 40]) tracker.track("a", ms);
    expect(tracker.avg("a")).toBe(25);
    windowSize = 2;
    tracker.track("a", 60);
    // Window is now the last two samples (40, 60).
    expect(tracker.avg("a")).toBe(50);
  });

  it("returns zero for a provider with no samples", () => {
    const tracker = createLatencyTracker(() => 10);
    expect(tracker.avg("unknown")).toBe(0);
  });

  it("counts every tracked request across providers", () => {
    const tracker = createLatencyTracker(() => 10);
    tracker.track("a", 1);
    tracker.track("b", 2);
    tracker.track("a", 3);
    expect(tracker.total()).toBe(3);
  });
});
