// @implements REQ-133
// processing.ts — the §1 processing function as a reportable artifact.
//
// Retrieval already records where content came from (REQ-021g cache hit,
// REQ-004 truncation) and how many duplicates reconciliation removed (REQ-020g),
// but the facts live in three unrelated response fields. This module assembles
// them into one block so a caller can tell cached from live content, whole from
// truncated, and distinct from collapsed without reading the whole envelope.
//
// Pure: no I/O, no configuration, so the shape is unit-testable.

/** Where the content a result carries came from. */
export type ProcessingServed = "cache" | "network";

export interface ProcessingEntry {
  /** The result's URL; the key a caller joins against `results`. */
  url: string;
  served: ProcessingServed;
  truncated: boolean;
  /** Number of duplicate results this entry stands in for; 0 when distinct. */
  collapsed_from: number;
  /** `live` for freshly retrieved content, otherwise the stored freshness tier. */
  freshness: string;
}

export interface ProcessingBlock {
  results: ProcessingEntry[];
  truncated_count: number;
  collapsed_count: number;
}

export interface ProcessingInput {
  url: string;
  served?: ProcessingServed;
  truncated?: boolean;
  collapsedFrom?: number;
  freshness?: string;
}

/** One entry with the defaults a live, whole, distinct result carries. */
export function processingEntry(input: ProcessingInput): ProcessingEntry {
  return {
    url: input.url,
    served: input.served ?? "network",
    truncated: input.truncated ?? false,
    collapsed_from: Math.max(0, input.collapsedFrom ?? 0),
    freshness: input.freshness ?? "live",
  };
}

/**
 * Assemble the block. `collapsed` is the number reconciliation removed for the
 * response as a whole; per-entry `collapsed_from` stays 0 because a collapse
 * folds two results into one and cannot be attributed back to a single URL.
 */
export function buildProcessing(entries: ProcessingEntry[], collapsed = 0): ProcessingBlock {
  return {
    results: entries,
    truncated_count: entries.filter((entry) => entry.truncated).length,
    collapsed_count: Math.max(0, collapsed),
  };
}

/** Entries for a list of live results that reconciliation already collapsed. */
export function processingForUrls(urls: readonly string[], collapsed = 0): ProcessingBlock {
  return buildProcessing(
    urls.map((url) => processingEntry({ url })),
    collapsed,
  );
}
