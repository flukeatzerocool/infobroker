// @implements REQ-024b
// The `inspect_providers` health report, assembled from the shared provider
// assessment plus this action's own inputs (live probe result, quota counters,
// operational history, cooldown). Extracted from doProviderHealth so the report
// shape — including when `inactive_reason` is present — is unit-testable.
//
// REQ-024b: a report states a cause only when configuration or quota supplies
// one. A probe result is its own explanation, so an inactive or degraded row
// produced by a probe carries no `inactive_reason`.
import type { HealthReport } from "./types.js";
import type { ProviderAssessment } from "./provider-status.js";
import type { ProviderHistoryEntry } from "./provider-history.js";

export interface HealthReportInput {
  slug: string;
  tier: string;
  capabilities: string[];
  assessment: ProviderAssessment;
  quota: {
    exhausted: boolean;
    warning: boolean;
    daily: { used: number; remaining: number; resetAt: string };
  };
  /** Effective latency: REQ-036 history first, the probe measurement second. */
  avgLatencyMs?: number;
  /** REQ-024b: credential usability, independent of `enabled`. */
  authOk: boolean;
  history?: ProviderHistoryEntry;
  cooldownRemainingMs?: number;
}

export function assembleHealthReport(input: HealthReportInput): HealthReport {
  const report: HealthReport = {
    status: input.assessment.status as HealthReport["status"],
    slug: input.slug,
    tier: input.tier,
    capabilities: input.capabilities,
    quota_used: input.quota.daily.used,
    quota_remaining: input.quota.daily.remaining,
    quota_reset_at: input.quota.daily.resetAt,
    quota_warning: input.quota.warning,
    avg_latency_ms: input.avgLatencyMs,
    auth_ok: input.authOk,
  };

  // A stated cause only: `disabled`, a configuration reason, or `exhausted`.
  if (input.assessment.inactive_reason) report.inactive_reason = input.assessment.inactive_reason;

  if (input.history?.lastError) {
    report.last_error = new Date(input.history.lastError.timestamp).toISOString();
  }
  if (input.history?.lastSuccess) {
    report.last_success = new Date(input.history.lastSuccess).toISOString();
  }
  if (input.cooldownRemainingMs !== undefined) {
    report.cooldown_remaining_ms = input.cooldownRemainingMs;
  }

  return report;
}
