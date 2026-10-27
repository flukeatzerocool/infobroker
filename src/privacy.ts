// @implements REQ-129
// Provider privacy-posture derivation. A posture is derived from the
// configuration tier and result-resale flag, with an explicit per-provider
// override taking precedence. Fields that cannot be established from
// configuration are reported as "unknown" rather than assumed private.
import type { ProviderConfig } from "./types.js";

export type QueryForwarding = "none" | "origin" | "third_party";
export type Retention = boolean | "unknown";

export interface PrivacyPosture {
  query_forwarding: QueryForwarding;
  retains_query: Retention;
  requires_account: boolean;
  resells: boolean;
  notes?: string;
}

export interface PrivacyOverride {
  query_forwarding?: QueryForwarding;
  retains_query?: Retention;
  requires_account?: boolean;
  resells?: boolean;
  notes?: string;
}

export function derivePrivacy(provider: ProviderConfig): PrivacyPosture {
  const override: PrivacyOverride = provider.privacy ?? {};
  const resells = override.resells ?? provider.resells === true;

  let forwarding: QueryForwarding;
  switch (provider.tier) {
    case "self_hosted_http":
      forwarding = "none";
      break;
    case "keyed_http":
      forwarding = "third_party";
      break;
    default:
      forwarding = "origin";
      break;
  }

  return {
    query_forwarding: override.query_forwarding ?? forwarding,
    retains_query: override.retains_query ?? "unknown",
    requires_account: override.requires_account ?? provider.tier === "keyed_http",
    resells,
    ...(override.notes ? { notes: override.notes } : {}),
  };
}
