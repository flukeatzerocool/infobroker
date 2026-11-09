// @implements REQ-021g REQ-004
import { maybeTruncate } from "./truncate.js";

export interface KbCacheEntry {
  ingested_at: number;
}

export interface CacheHitPayload {
  snippet: string;
  truncated: boolean;
  outputPath?: string;
}

/**
 * REQ-004: a cached page longer than the caller's limit goes through the same
 * truncation path as a fresh fetch, so the full text is written and the
 * envelope can report output_path. A raw slice would hide the rest silently.
 */
export function cacheHitPayload(text: string, maxChars: number): CacheHitPayload {
  if (text.length <= maxChars) return { snippet: text, truncated: false };
  const result = maybeTruncate(text, maxChars);
  return { snippet: result.text, truncated: result.truncated, outputPath: result.outputPath };
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
