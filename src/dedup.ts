// @implements REQ-020g REQ-121
// Cross-provider result reconciliation: collapse results that express the same
// content into one representative and order the survivors by semantic
// relevance to the query. Provenance (source type and original source) is
// preserved on the representative. Zero new dependencies: similarity comes from
// the shared in-process embedding models (REQ-103); the lexical model is the
// automatic fallback on small result sets.
import type { SearchResult } from "./types.js";
import { pairwiseSimilarity, rankDocs } from "./embed.js";

export const DEFAULT_DEDUP_THRESHOLD = 0.85;

function resultText(r: SearchResult): string {
  return `${r.title ?? ""} ${r.snippet ?? ""}`.trim();
}

function mergeProvenance(keep: SearchResult, dup: SearchResult): void {
  if (!keep.original_source && dup.original_source) keep.original_source = dup.original_source;
  if (!keep.source_type && dup.source_type) keep.source_type = dup.source_type;
  if (!keep.source_family && dup.source_family) keep.source_family = dup.source_family;
}

export interface ReconcileOptions {
  /** REQ-020h: weight of the source-quality term in the ordering. */
  qualityWeight?: number;
  /** REQ-020h: source-quality score for one result (typically -1..1). */
  qualityScore?: (result: SearchResult) => number;
}

export function reconcileResults(
  results: SearchResult[],
  query: string,
  threshold: number = DEFAULT_DEDUP_THRESHOLD,
  options: ReconcileOptions = {}
): SearchResult[] {
  if (results.length < 2) return results;

  const qualityScore = options.qualityScore;
  const qualityWeight = qualityScore ? (options.qualityWeight ?? 0) : 0;
  const qualityOf = (result: SearchResult): number => (qualityScore ? qualityScore(result) : 0);

  const texts = results.map(resultText);
  let sim: number[][];
  try {
    sim = pairwiseSimilarity(texts, "lsa");
  } catch {
    if (qualityWeight === 0) return results;
    return [...results].sort((a, b) => qualityWeight * (qualityOf(b) - qualityOf(a)));
  }

  let order: number[];
  try {
    const ranked = rankDocs(query, texts, "lsa");
    const relevance = new Map(ranked.map((r) => [r.index, r.score]));
    // One ordering pass: relevance stays dominant; the quality term only
    // breaks ties or promotes a clearly better source.
    order = results
      .map((result, index) => ({
        index,
        score: (relevance.get(index) ?? 0) + qualityWeight * qualityOf(result),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((entry) => entry.index);
  } catch {
    order = results.map((_r, i) => i);
    if (qualityWeight !== 0) {
      order.sort((a, b) => qualityWeight * (qualityOf(results[b]) - qualityOf(results[a])) || a - b);
    }
  }

  const drop = new Set<number>();
  const kept: SearchResult[] = [];
  for (const i of order) {
    if (drop.has(i)) continue;
    const keep = { ...results[i] };
    for (let j = 0; j < results.length; j++) {
      if (j === i || drop.has(j)) continue;
      if (sim[i][j] >= threshold) {
        mergeProvenance(keep, results[j]);
        drop.add(j);
      }
    }
    kept.push(keep);
  }
  return kept;
}
