// @implements REQ-020e
const STOP_WORDS = new Set([
  "the", "a", "an", "of", "and", "or", "to", "in", "for", "on", "with", "is",
  "are", "was", "were", "be", "what", "who", "how", "why", "when", "where",
  "about", "does", "do", "did", "can", "could", "should", "would", "which",
]);

// Expand a query into a set of searchable variants: the original, then
// suggestion-derived phrases and keyword phrases, deduplicated and capped.
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

  return candidates.slice(0, max);
}
