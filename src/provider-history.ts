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
  entryFor(slug).lastSuccess = timestamp;
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
