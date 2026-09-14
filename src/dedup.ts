// @implements REQ-020g
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
}

export function reconcileResults(
  results: SearchResult[],
  query: string,
  threshold: number = DEFAULT_DEDUP_THRESHOLD
): SearchResult[] {
  if (results.length < 2) return results;

  const texts = results.map(resultText);
  let sim: number[][];
  try {
    sim = pairwiseSimilarity(texts, "lsa");
  } catch {
    return results;
  }

  let order: number[];
  try {
    const ranked = rankDocs(query, texts, "lsa");
    order = ranked.map((r) => r.index);
  } catch {
    order = results.map((_r, i) => i);
  }
  // Append candidates the ranker scored zero so nothing is silently dropped.
  const seen = new Set(order);
  for (let i = 0; i < results.length; i++) if (!seen.has(i)) order.push(i);

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
