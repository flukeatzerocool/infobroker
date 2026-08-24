// @implements REQ-013 REQ-036
// Pure decision function for the `providers` health status. Extracted from
// doProviderHealth so the REQ-013 degraded definition (latency threshold OR
// partial results) is unit-testable without an MCP round-trip.
export type HealthStatus = "active" | "inactive" | "degraded" | "exhausted";

export interface HealthStatusInput {
  // Status reached so far: "active" or "inactive" from auth, optionally
  // overridden by the provider's own live health() result.
  baseStatus: "active" | "inactive" | "degraded";
  quotaExhausted: boolean;
  quotaWarning: boolean;
  avgLatencyMs?: number;
  // Effective degraded threshold: per-provider `degraded_latency_ms`, else
  // the output-level fallback. Undefined disables the latency leg.
  degradedLatencyMs?: number;
}

export function resolveHealthStatus(input: HealthStatusInput): HealthStatus {
  let status: HealthStatus = input.baseStatus;

  if (input.quotaExhausted) {
    status = "exhausted";
  } else if (input.quotaWarning && status === "active") {
    status = "degraded";
  }

  // REQ-013: a provider whose recent latency exceeds its threshold is
  // degraded even when reachable (the latency leg, independent of the
  // partial-results leg).
  if (
    status === "active" &&
    input.degradedLatencyMs !== undefined &&
    input.avgLatencyMs !== undefined &&
    input.avgLatencyMs > input.degradedLatencyMs
  ) {
    status = "degraded";
  }

  return status;
}
