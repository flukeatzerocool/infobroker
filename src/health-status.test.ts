// @implements REQ-013 REQ-013 latency-threshold REQ-013 partial-results
import { describe, it, expect } from "vitest";
import { resolveHealthStatus } from "./health-status.js";

describe("resolveHealthStatus (REQ-013)", () => {
  it("keeps a reachable, fast provider active", () => {
    const status = resolveHealthStatus({
      baseStatus: "active",
      quotaExhausted: false,
      quotaWarning: false,
      avgLatencyMs: 50,
      degradedLatencyMs: 2000,
    });
    expect(status).toBe("active");
  });

  it("flips active to degraded when latency exceeds the threshold", () => {
    const status = resolveHealthStatus({
      baseStatus: "active",
      quotaExhausted: false,
      quotaWarning: false,
      avgLatencyMs: 2500,
      degradedLatencyMs: 2000,
    });
    expect(status).toBe("degraded");
  });

  it("respects the partial-results leg (base already degraded)", () => {
    const status = resolveHealthStatus({
      baseStatus: "degraded",
      quotaExhausted: false,
      quotaWarning: false,
      avgLatencyMs: 50,
      degradedLatencyMs: 2000,
    });
    expect(status).toBe("degraded");
  });

  it("leaves the latency leg inert when no threshold is configured", () => {
    const status = resolveHealthStatus({
      baseStatus: "active",
      quotaExhausted: false,
      quotaWarning: false,
      avgLatencyMs: 2500,
    });
    expect(status).toBe("active");
  });

  it("marks an exhausted quota as exhausted regardless of latency", () => {
    const status = resolveHealthStatus({
      baseStatus: "active",
      quotaExhausted: true,
      quotaWarning: false,
      avgLatencyMs: 50,
      degradedLatencyMs: 2000,
    });
    expect(status).toBe("exhausted");
  });

  it("demotes an active provider to degraded at quota warning", () => {
    const status = resolveHealthStatus({
      baseStatus: "active",
      quotaExhausted: false,
      quotaWarning: true,
      avgLatencyMs: 50,
      degradedLatencyMs: 2000,
    });
    expect(status).toBe("degraded");
  });
});
