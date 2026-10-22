// @implements REQ-024c
import { describe, it, expect } from "vitest";
import { createToolMetrics } from "./tool-metrics.js";

describe("tool metrics (REQ-024c)", () => {
  it("reports calls, errors, and percentiles per tool", () => {
    const metrics = createToolMetrics();
    for (let i = 1; i <= 10; i++) metrics.record("search_web", i * 10, i !== 3);
    const snap = metrics.snapshot().search_web;
    expect(snap.calls).toBe(10);
    expect(snap.errors).toBe(1);
    expect(snap.p50_ms).toBe(50);
    expect(snap.p95_ms).toBe(100);
    expect(snap.max_ms).toBe(100);
  });

  it("keeps a bounded window", () => {
    const metrics = createToolMetrics(3);
    metrics.record("t", 100, true);
    metrics.record("t", 200, true);
    metrics.record("t", 300, true);
    metrics.record("t", 400, true);
    expect(metrics.snapshot().t.calls).toBe(4);
    expect(metrics.snapshot().t.max_ms).toBe(400);
  });
});
