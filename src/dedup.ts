// @implements REQ-020g REQ-020j REQ-121
// Cross-provider result reconciliation: collapse results that express the same
// content into one representative and order the survivors by semantic
// relevance to the query. Provenance (source type and original source) is
// preserved on the representative. Zero new dependencies: similarity comes from
// the shared in-process embedding models (REQ-103); the lexical model is the
// automatic fallback on small result sets.
import type { SearchResult } from "./types.js";
import { identityTokens, pairwiseSimilarity, rankDocs, tokenize } from "./embed.js";
import { originIdentity } from "./origin-identity.js";

export const DEFAULT_DEDUP_THRESHOLD = 0.85;

/** REQ-020j: a snippet shorter than this cannot establish a collapse alone. */
export const SNIPPET_MIN_TOKENS = 8;

function resultText(r: SearchResult): string {
  return `${r.title ?? ""} ${r.snippet ?? ""}`.trim();
}

function snippetText(r: SearchResult): string {
  return r.snippet?.trim() ?? "";
}

// REQ-020j: identical sets — not disjointness and not containment. Two snippets
// that carry different identifying values describe different content even when
// their wording matches, which is the rule REQ-072 already applies to ingest.
function sameIdentity(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) return false;
  for (const term of left) if (!right.has(term)) return false;
  return true;
}

function mergeProvenance(keep: SearchResult, dup: SearchResult): void {
  if (!keep.original_source && dup.original_source) keep.original_source = dup.original_source;
  if (!keep.source_type && dup.source_type) keep.source_type = dup.source_type;
  if (!keep.source_family && dup.source_family) keep.source_family = dup.source_family;
  // REQ-020g: the representative preserves every contributing provider.
  const contributing = new Set<string>(keep.providers ?? []);
  if (keep.provider) contributing.add(keep.provider);
  if (dup.provider) contributing.add(dup.provider);
  for (const slug of dup.providers ?? []) contributing.add(slug);
  if (contributing.size > 0) keep.providers = [...contributing].sort();
}

export interface ReconcileOptions {
  /** REQ-020h: weight of the source-quality term in the ordering. */
  qualityWeight?: number;
  /** REQ-020h: source-quality score for one result (typically -1..1). */
  qualityScore?: (result: SearchResult) => number;
}

// REQ-020g: the non-semantic ranking used when no embedding capability is
// available. Shares of the query's content words present in the result text,
// so ordering is deterministic and still relevance-shaped.
function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}'-]+/u)
    .filter((word) => word.length >= 3);
}

export function lexicalRelevance(query: string, text: string): number {
  const wanted = new Set(contentTokens(query));
  if (wanted.size === 0) return 0;
  const present = new Set(contentTokens(text));
  let overlap = 0;
  for (const word of wanted) if (present.has(word)) overlap++;
  return overlap / wanted.size;
}

function orderedIndexes(
  results: SearchResult[],
  query: string,
  qualityOf: (result: SearchResult) => number,
  qualityWeight: number,
): number[] {
  const texts = results.map(resultText);
  let scores: number[];
  try {
    const ranked = rankDocs(query, texts, "lsa");
    scores = new Array<number>(results.length).fill(0);
    for (const row of ranked) scores[row.index] = row.score;
  } catch {
    // REQ-020g: without embeddings the non-semantic ranking still applies.
    scores = texts.map((text) => lexicalRelevance(query, text));
  }
  return results
    .map((result, index) => ({ index, score: scores[index] + qualityWeight * qualityOf(result) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.index);
}

// REQ-020g/REQ-020h: order a result set without collapsing it. Used where a
// collapse across tiers would be wrong (the KB blend, which keeps both sets).
export function orderByRelevance(
  results: SearchResult[],
  query: string,
  options: ReconcileOptions = {},
): SearchResult[] {
  const qualityScore = options.qualityScore;
  const qualityWeight = qualityScore ? (options.qualityWeight ?? 0) : 0;
  const qualityOf = (result: SearchResult): number => (qualityScore ? qualityScore(result) : 0);
  const order = orderedIndexes(results, query, qualityOf, qualityWeight);
  return order.map((index) => results[index]);
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
    // REQ-020g: no similarity model, so nothing can collapse; the results are
    // still ranked by the non-semantic ordering rather than returned as-is.
    return orderByRelevance(results, query, options);
  }

  const order = orderedIndexes(results, query, qualityOf, qualityWeight);

  // REQ-020k: a shared document identity collapses before any content
  // comparison. Two URLs that name the same document — a feed or section
  // variant, a tracking parameter, a case-folded host — are the same result
  // even when their titles and snippets differ, and similarity across them is
  // defeated by exactly the boilerplate that made the suffix rule necessary.
  // A value that yields no identity (a site root, a malformed string) groups
  // with nothing.
  const originIds = results.map((result) => originIdentity(result.original_source));

  // REQ-020j: a second acceptance path. A reheadlined syndication of the same
  // body falls below threshold on title-plus-snippet alone, so the snippets are
  // compared as a basis in their own right — guarded by an identifying-value
  // agreement and a substance floor, because shared boilerplate is not content.
  const bodies = results.map(snippetText);
  const substantive = bodies.map((body) => tokenize(body).length >= SNIPPET_MIN_TOKENS);
  const identities = bodies.map((body) => identityTokens(body));
  let snippetSim: number[][] | undefined;
  const snippetMatches = (i: number, j: number): boolean => {
    if (!substantive[i] || !substantive[j]) return false;
    if (!snippetSim) {
      try {
        snippetSim = pairwiseSimilarity(bodies, "lsa");
      } catch {
        // REQ-020j: a degenerate snippet vocabulary yields no snippet evidence;
        // it cannot turn a full-text match into a miss.
        snippetSim = [];
      }
    }
    if (snippetSim.length === 0) return false;
    // Both-empty abstains: with no identifying value on either side, the
    // similarity decides, which is how REQ-072 treats the same situation.
    const agree =
      (identities[i].size === 0 && identities[j].size === 0) || sameIdentity(identities[i], identities[j]);
    return snippetSim[i][j] >= threshold && agree;
  };

  const drop = new Set<number>();
  const kept: SearchResult[] = [];
  for (const i of order) {
    if (drop.has(i)) continue;
    const keep = { ...results[i] };
    const identity = originIds[i];
    if (identity) {
      for (let j = 0; j < results.length; j++) {
        if (j === i || drop.has(j) || originIds[j] !== identity) continue;
        mergeProvenance(keep, results[j]);
        drop.add(j);
      }
    }
    for (let j = 0; j < results.length; j++) {
      if (j === i || drop.has(j)) continue;
      if (sim[i][j] >= threshold || snippetMatches(i, j)) {
        mergeProvenance(keep, results[j]);
        drop.add(j);
      }
    }
    kept.push(keep);
  }
  return kept;
}
