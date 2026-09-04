// @implements REQ-038
// Per-provider rate-limit / anti-bot cooldown. Pure state + predicates so the
// cooldown contract (REQ-038) is unit-testable without network access. The
// dispatch layer consults these predicates to skip a provider without a new
// outbound call while it is cooling down, and to decide whether a failure
// should place the provider in cooldown.
import { RetryableError, BotChallengeError } from "./retry.js";

const cooldowns = new Map<string, number>();

export function cooldownDurationMs(duration: number | undefined): number {
  return typeof duration === "number" && duration >= 0 ? duration : 0;
}

export function markCooldown(slug: string, durationMs: number): void {
  if (durationMs <= 0) return;
  cooldowns.set(slug, Date.now() + durationMs);
}

export function inCooldown(slug: string): boolean {
  const until = cooldowns.get(slug);
  if (until === undefined) return false;
  if (Date.now() >= until) {
    cooldowns.delete(slug);
    return false;
  }
  return true;
}

export function cooldownRemainingMs(slug: string): number {
  const until = cooldowns.get(slug);
  if (until === undefined) return 0;
  return Math.max(0, until - Date.now());
}

// A failure that should put the provider in cooldown: a rate-limit response
// (HTTP 429) or a provider-declared bot challenge. Transient 503s are left to
// the retry policy and do not cool the provider down.
export function shouldCooldown(e: unknown): boolean {
  return e instanceof BotChallengeError || (e instanceof RetryableError && e.status === 429);
}
