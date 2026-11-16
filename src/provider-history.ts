// @implements REQ-024b
// Provider operational history: the most recent success and the most recent
// error per provider, recorded by search/fetch traffic and read by the
// `inspect_providers` health action. Extracted from src/index.ts so the read
// side is unit-testable and a test can start from a known-empty history.
//
// Scope is the running process: REQ-024b reports the timestamps recorded since
// server start. Nothing is persisted, and the health probe itself never records
// a success — `last_success` reflects real provider traffic, not a probe.

export interface ProviderHistoryEntry {
  lastError?: { message: string; timestamp: number };
  lastSuccess?: number;
  /** REQ-024b: result count of the most recent successful search attempt. */
  lastResultCount?: number;
  /** REQ-024b: consecutive successful attempts that returned zero results. */
  zeroResultStreak?: number;
  /** REQ-038: consecutive 5xx/timeout failures, reset by a success. */
  consecutiveFailures?: number;
}

const history = new Map<string, ProviderHistoryEntry>();

function entryFor(slug: string): ProviderHistoryEntry {
  let entry = history.get(slug);
  if (!entry) {
    entry = {};
    history.set(slug, entry);
  }
  return entry;
}

/** Record a provider request that returned usable results. */
export function recordProviderSuccess(slug: string, timestamp: number = Date.now()): void {
  const entry = entryFor(slug);
  entry.lastSuccess = timestamp;
  entry.consecutiveFailures = 0;
}

/** REQ-038: count a persistent failure; returns the new consecutive count. */
export function bumpFailureStreak(slug: string): number {
  const entry = entryFor(slug);
  entry.consecutiveFailures = (entry.consecutiveFailures ?? 0) + 1;
  return entry.consecutiveFailures;
}

/**
 * REQ-024b: record the result count of a successful search attempt, including
 * zero. A zero-result attempt is still a success for history purposes — the
 * yield fields are how a silently drifting parser becomes visible.
 */
export function recordSearchYield(slug: string, resultCount: number, timestamp: number = Date.now()): void {
  const entry = entryFor(slug);
  entry.lastResultCount = resultCount;
  entry.lastSuccess = timestamp;
  entry.zeroResultStreak = resultCount === 0 ? (entry.zeroResultStreak ?? 0) + 1 : 0;
}

/** Record a provider request that failed, with its message (never key material). */
export function recordProviderError(slug: string, message: string, timestamp: number = Date.now()): void {
  entryFor(slug).lastError = { message, timestamp };
}

/** Read the recorded history for one provider, if any. */
export function providerHistory(slug: string): ProviderHistoryEntry | undefined {
  return history.get(slug);
}

/** Test seam: start from an empty history. */
export function resetProviderHistoryForTests(): void {
  history.clear();
}
