// @implements REQ-020e REQ-020b
import { rankDocs, pairwiseSimilarity } from "./embed.js";

const STOP_WORDS = new Set([
  "the", "a", "an", "of", "and", "or", "to", "in", "for", "on", "with", "is",
  "are", "was", "were", "be", "what", "who", "how", "why", "when", "where",
  "about", "does", "do", "did", "can", "could", "should", "would", "which",
]);

// Expand a query into a set of searchable variants: the original, then
// suggestion-derived phrases and keyword phrases. Candidates are deduplicated
// by meaning and ordered by semantic relatedness to the query (REQ-020e); when
// the embedding model cannot separate them, the lexical order is preserved.
export function deriveExpansions(query: string, suggestions: string[], max = 5): string[] {
  const candidates: string[] = [];
  const q = query.trim();
  if (q) candidates.push(q);

  for (const s of suggestions) {
    const t = s.trim();
    if (t && !candidates.includes(t)) candidates.push(t);
  }

  const keywords = q
    .split(/[^a-zA-Z0-9'-]+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  if (keywords.length >= 2) {
    const phrase = keywords.join(" ");
    if (phrase && !candidates.some((c) => c.toLowerCase() === phrase) && phrase !== q.toLowerCase()) {
      candidates.push(phrase);
    }
  }

  if (candidates.length <= 2) return candidates.slice(0, max);

  const [original, ...rest] = candidates;
  let ordered = rest;
  try {
    const sim = pairwiseSimilarity(rest, "lsa");
    const duplicate = new Set<number>();
    for (let i = 0; i < rest.length; i++) {
      if (duplicate.has(i)) continue;
      for (let j = i + 1; j < rest.length; j++) {
        if (!duplicate.has(j) && sim[i][j] >= 0.9) duplicate.add(j);
      }
    }
    const survivors = rest.map((text, index) => ({ text, index })).filter((x) => !duplicate.has(x.index));
    const ranked = rankDocs(original, survivors.map((s) => s.text), "lsa");
    const seen = new Set(ranked.map((r) => r.index));
    ordered = [
      ...ranked.map((r) => survivors[r.index].text),
      ...survivors.filter((_s, i) => !seen.has(i)).map((s) => s.text),
    ];
  } catch {
    // Model unavailable — keep the lexical candidate order.
  }

  return [original, ...ordered].slice(0, max);
}
