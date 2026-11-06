// @implements REQ-002 REQ-038
// Error-envelope construction: the shared [ERROR] body, the provider-status
// remediation suffix, and the fallback-chain exhaustion error with its real
// cooldown-derived retry_after_ms. Extracted from src/index.ts so the contract
// is unit-testable without a live provider chain.
import { cooldownRemainingMs } from "./cooldown.js";
import { sanitizeErrorMessage } from "./lib/sanitize-error.js";
import type { ToolErrorResponse } from "./types.js";

/** REQ-002: the shared error envelope; never leaks paths or stack markers. */
export function err(
  provider: string,
  code: string,
  message: string,
  remediation: string,
  details?: Record<string, unknown>,
): ToolErrorResponse {
  return {
    status: "error",
    provider,
    // REQ-102: centralize exceptional-condition hygiene so no call site can
    // leak an absolute path or stack-frame marker in an error message.
    error: { code, message: sanitizeErrorMessage(message), remediation, ...(details ? { details } : {}) },
  };
}

const STATUS_HINT = "Use infobroker_inspect_providers action=health to see provider status";

/**
 * REQ-038: every provider-attributable error names the provider-status surface.
 * Idempotent so a caller that already names it is not given a doubled sentence.
 */
export function providerRemediation(hint: string): string {
  const trimmed = hint.trim().replace(/[.;\s]+$/, "");
  if (/inspect_providers/i.test(trimmed)) return trimmed;
  return `${trimmed}. ${STATUS_HINT}.`;
}

export interface ChainExhaustionOptions {
  /** REQ-002: a rate-limited failure outranks the generic exhaustion code. */
  rateLimited: boolean;
  /** Providers whose daily quota was exhausted, with their remaining count. */
  quotaExhausted?: Record<string, number>;
  /** Every provider tried, including the cross-task fallback chain. */
  attempted?: string[];
  /** Cooldown remaining resolver; defaults to the live cooldown registry. */
  remainingMs?: (slug: string) => number;
}

/**
 * REQ-031 / REQ-038: the chain-exhaustion error. The cooldown is reported from
 * active state rather than the rateLimited flag, so a bot-challenge cooldown
 * still yields a non-zero retry_after_ms.
 */
export function chainExhaustion(chain: string[], opts: ChainExhaustionOptions): ToolErrorResponse {
  const attempted = opts.attempted ?? chain;
  const remainingMs = opts.remainingMs ?? cooldownRemainingMs;
  const coolingDown = attempted
    .map((slug) => ({ provider: slug, remaining_ms: remainingMs(slug) }))
    .filter((entry) => entry.remaining_ms > 0);
  const maxRemaining = coolingDown.reduce((max, entry) => Math.max(max, entry.remaining_ms), 0);
  const quotaExhausted = Object.entries(opts.quotaExhausted ?? {}).map(([slug, remaining]) => ({
    slug,
    remaining_daily: remaining,
  }));
  const code = opts.rateLimited ? "rate_limited" : "all_providers_exhausted";
  const hint = opts.rateLimited ? "Retry after the cooldown window" : "Retry later or check provider configuration";
  return err("none", code, `Fallback chain exhausted: ${chain.join(", ")}`, providerRemediation(hint), {
    exhausted_chain: attempted,
    quota_exhausted: quotaExhausted,
    ...(maxRemaining > 0 ? { retry_after_ms: maxRemaining } : {}),
    ...(coolingDown.length > 0 ? { cooling_down: coolingDown } : {}),
  });
}
