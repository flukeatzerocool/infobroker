// @implements REQ-024b last-history
// REQ-024b: the health report carries the most recent error and success
// timestamps and names a cause only when configuration or quota supplies one.
import { describe, expect, it } from "vitest";
import { assembleHealthReport, type HealthReportInput } from "./provider-health.js";

function input(overrides: Partial<HealthReportInput> = {}): HealthReportInput {
  return {
    slug: "wikipedia",
    tier: "free_http",
    capabilities: ["encyclopedia"],
    assessment: { status: "active" },
    quota: {
      exhausted: false,
      warning: false,
      daily: { used: 3, remaining: 97, resetAt: "2026-11-12T00:00:00.000Z" },
    },
    avgLatencyMs: 42,
    authOk: true,
    ...overrides,
  };
}

describe("assembleHealthReport (REQ-024b)", () => {
  it("builds the base report from the assessment and quota counters", () => {
    expect(assembleHealthReport(input())).toEqual({
      status: "active",
      slug: "wikipedia",
      tier: "free_http",
      capabilities: ["encyclopedia"],
      quota_used: 3,
      quota_remaining: 97,
      quota_reset_at: "2026-11-12T00:00:00.000Z",
      quota_warning: false,
      avg_latency_ms: 42,
      auth_ok: true,
    });
  });

  it("reports a stated cause", () => {
    const report = assembleHealthReport(
      input({ assessment: { status: "inactive", inactive_reason: "disabled" } })
    );
    expect(report.status).toBe("inactive");
    expect(report.inactive_reason).toBe("disabled");
  });

  it("reports the exhausted cause", () => {
    const report = assembleHealthReport(
      input({ assessment: { status: "exhausted", inactive_reason: "exhausted" } })
    );
    expect(report.inactive_reason).toBe("exhausted");
  });

  it("omits the reason when a probe result is the explanation", () => {
    expect(
      assembleHealthReport(input({ assessment: { status: "inactive" } })).inactive_reason
    ).toBeUndefined();
    expect(
      assembleHealthReport(input({ assessment: { status: "degraded" } })).inactive_reason
    ).toBeUndefined();
  });

  it("maps operational history to ISO timestamps", () => {
    const report = assembleHealthReport(
      input({
        history: {
          lastError: { message: "boom", timestamp: 1_700_000_000_500 },
          lastSuccess: 1_700_000_000_000,
        },
      })
    );
    expect(report.last_error).toBe(new Date(1_700_000_000_500).toISOString());
    expect(report.last_success).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it("omits timestamps the history does not hold", () => {
    const report = assembleHealthReport(input({ history: {} }));
    expect(report.last_error).toBeUndefined();
    expect(report.last_success).toBeUndefined();
    expect(assembleHealthReport(input()).last_error).toBeUndefined();
  });

  it("reports yield from search traffic and omits it before any attempt", () => {
    const withTraffic = assembleHealthReport(
      input({ history: { lastSuccess: 1, lastResultCount: 0, zeroResultStreak: 2 } })
    );
    expect(withTraffic.last_result_count).toBe(0);
    expect(withTraffic.result_yield).toBe("zero");
    expect(withTraffic.zero_result_streak).toBe(2);

    const served = assembleHealthReport(
      input({ history: { lastSuccess: 1, lastResultCount: 4, zeroResultStreak: 0 } })
    );
    expect(served.result_yield).toBe("ok");

    expect(assembleHealthReport(input({ history: {} })).result_yield).toBeUndefined();
    expect(assembleHealthReport(input()).last_result_count).toBeUndefined();
  });

  it("carries the cooldown remaining only when present", () => {
    expect(assembleHealthReport(input({ cooldownRemainingMs: 900 })).cooldown_remaining_ms).toBe(900);
    expect(assembleHealthReport(input()).cooldown_remaining_ms).toBeUndefined();
  });
});
