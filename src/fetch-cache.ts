// @implements REQ-021g

export interface KbCacheEntry {
  ingested_at: number;
}

// A knowledge-base copy is usable only while it is within the configured age.
export function shouldUseKbCache(
  entry: KbCacheEntry | null | undefined,
  maxAgeMs: number,
  now: number = Date.now(),
): boolean {
  if (!entry) return false;
  if (!Number.isFinite(entry.ingested_at)) return false;
  return now - entry.ingested_at <= maxAgeMs;
}
