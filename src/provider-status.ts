// @implements REQ-013 REQ-024a
// Pure provider-state assessment shared by `inspect_providers`' list and spec
// actions. One derivation answers three questions that used to drift apart:
// is the provider operational (the same truth table as `config.providerUsable`),
// what is its assessed REQ-013 status, and — when it is not active — why.
import type { CredentialClass } from "./config.js";
import { isOperational } from "./config.js";
import { resolveHealthStatus, type HealthStatus } from "./health-status.js";

/** REQ-024a: the distinguishing cause reported for a non-active provider. */
export type InactiveReason =
  | "disabled"
  | "no_url"
  | "no_api_key"
  | "credentials_unavailable"
  | "exhausted";

export interface ProviderStatusInput {
  enabled: boolean;
  /** False only when a declared `url_env` is absent from the environment. */
  urlPresent: boolean;
  credential: CredentialClass;
  /** Result of a live probe, when the caller has one (health action). */
  probeStatus?: "active" | "degraded" | "inactive";
  quotaExhausted: boolean;
  quotaWarning: boolean;
  avgLatencyMs?: number;
  degradedLatencyMs?: number;
}

export interface ProviderAssessment {
  status: HealthStatus;
  inactive_reason?: InactiveReason;
}

export function assessProvider(input: ProviderStatusInput): ProviderAssessment {
  // REQ-013/REQ-024b: the same truth table `providerUsable` and the health
  // action use, so a row cannot report operational while dispatch refuses it.
  const operational = isOperational(input);
  const baseStatus: "active" | "inactive" | "degraded" = operational
    ? (input.probeStatus ?? "active")
    : "inactive";

  const status = resolveHealthStatus({
    baseStatus,
    quotaExhausted: input.quotaExhausted,
    quotaWarning: input.quotaWarning,
    avgLatencyMs: input.avgLatencyMs,
    degradedLatencyMs: input.degradedLatencyMs,
  });

  if (status === "exhausted") return { status, inactive_reason: "exhausted" };
  if (status === "degraded") return { status };
  if (status === "active") return { status };

  // Inactive: a probe result is its own explanation; otherwise the
  // configuration decides.
  if (operational) return { status };
  return { status, inactive_reason: describeInactive(input) };
}

function describeInactive(input: ProviderStatusInput): InactiveReason {
  if (!input.enabled) return "disabled";
  if (!input.urlPresent) return "no_url";
  // REQ-024a: a declared pool with no usable credential (rejected or cooling)
  // is a credential fault, not an absent key — the distinction F-R2-9 is about.
  if (input.credential === "unusable") return "credentials_unavailable";
  return "no_api_key";
}

/** REQ-024a: the list's active filter selects exactly the rows it reports active. */
export function selectActiveRows<T extends { status: string }>(rows: T[]): T[] {
  return rows.filter((row) => row.status === "active");
}

export interface KeyPoolEntry {
  index: number;
  available: boolean;
  reason?: string;
}

/**
 * REQ-104: the per-credential availability row. Emitted when there is more
 * than one key, or when any single key is unavailable — a lone rejected or
 * cooling key would otherwise be invisible on the provider row.
 */
export function keyPoolRow(pool: KeyPoolEntry[]): KeyPoolEntry[] | undefined {
  return pool.length > 1 || pool.some((entry) => !entry.available) ? pool : undefined;
}
