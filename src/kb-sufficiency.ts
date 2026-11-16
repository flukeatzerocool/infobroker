// @implements REQ-076 REQ-076b
// KB-first admission decision, in one place. The server (src/index.ts) and the
// sufficiency benchmark both call this module, so the measurement scores the
// predicate the server actually runs rather than a copy of it.
import type { KbSearchResult } from "./types.js";

export interface SufficiencyThresholds {
  relevance: number;
  confidence: number;
}

export interface SufficiencyPartition {
  sufficient: KbSearchResult[];
  rejected: KbSearchResult[];
}

/**
 * REQ-076: the configured relevance and freshness-confidence floors. The
 * fallbacks match the shipped defaults so a caller that constructs a partial
 * configuration still gets the documented gate.
 */
export function sufficiencyThresholds(config?: {
  kb?: { kb_first_relevance_threshold?: number; kb_first_confidence_threshold?: number };
}): SufficiencyThresholds {
  return {
    relevance: config?.kb?.kb_first_relevance_threshold ?? 0.3,
    confidence: config?.kb?.kb_first_confidence_threshold ?? 0.5,
  };
}

/** REQ-076: a cached row satisfies KB-first sufficiency only when it clears both floors. */
export function partitionBySufficiency(
  results: KbSearchResult[],
  thresholds: SufficiencyThresholds,
): SufficiencyPartition {
  const sufficient: KbSearchResult[] = [];
  const rejected: KbSearchResult[] = [];
  for (const result of results) {
    const admitted =
      result.freshness_score >= thresholds.confidence && (result.score ?? 0) >= thresholds.relevance;
    (admitted ? sufficient : rejected).push(result);
  }
  return { sufficient, rejected };
}
