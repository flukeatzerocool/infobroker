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

  it("counts every tool call cumulatively, including failed ones", () => {
    const metrics = createToolMetrics();
    expect(metrics.totalCalls()).toBe(0);
    metrics.record("search_web", 10, true);
    metrics.record("fetch_page", 20, false);
    metrics.record("search_web", 30, true);
    expect(metrics.totalCalls()).toBe(3);
    // Per-tool windows are bounded; the cumulative count is not.
    const bounded = createToolMetrics(1);
    for (let i = 0; i < 5; i++) bounded.record("t", i, true);
    expect(bounded.totalCalls()).toBe(5);
  });
});
