// @implements REQ-026h
// span.ts — pure helpers locating the sentence in a source snippet that
// supports a claim (REQ-026h). Offsets index the original snippet string, so
// `text.slice(span.start, span.end) === span.text` always holds. No network,
// no clock: the same snippet and claim always produce the same span.

export interface SupportSpan {
  /** Offset of the span's first character in the source text. */
  start: number;
  /** Offset one past the span's last character in the source text. */
  end: number;
  /** The supporting text, capped at MAX_SPAN_TEXT characters. */
  text: string;
}

/** Minimum share of the claim's content words a sentence must contain. */
export const SPAN_MIN_OVERLAP = 0.34;

/** Cap on the returned span text; offsets still index the original string. */
export const MAX_SPAN_TEXT = 200;

function contentTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((token) => token.length > 2)
  );
}

interface SentenceSlice {
  start: number;
  end: number;
  text: string;
}

/**
 * Split text into sentence slices while keeping offsets into the original
 * string. Trailing punctuation and closing quotes stay in the sentence;
 * surrounding whitespace does not.
 */
export function splitSentences(text: string): SentenceSlice[] {
  const slices: SentenceSlice[] = [];
  const pattern = /[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    const offset = match.index ?? 0;
    const leading = raw.length - raw.trimStart().length;
    const start = offset + leading;
    const end = offset + raw.trimEnd().length;
    if (end > start) {
      slices.push({ start, end, text: text.slice(start, end) });
    }
  }
  if (slices.length === 0 && text.trim().length > 0) {
    const start = text.length - text.trimStart().length;
    const end = start + text.trim().length;
    slices.push({ start, end, text: text.slice(start, end) });
  }
  return slices;
}

/**
 * Locate the sentence that best supports `claim`. Returns null when no
 * sentence clears the overlap floor — callers omit the span rather than
 * inventing one.
 */
export function locateSupport(
  text: string,
  claim: string,
  minOverlap = SPAN_MIN_OVERLAP
): SupportSpan | null {
  const source = text ?? "";
  const target = claim ?? "";
  if (source.trim().length === 0 || target.trim().length === 0) return null;

  const claimTokens = contentTokens(target);
  if (claimTokens.size === 0) return null;

  let best: { start: number; end: number; score: number } | null = null;
  for (const slice of splitSentences(source)) {
    const tokens = contentTokens(slice.text);
    if (tokens.size === 0) continue;
    let overlap = 0;
    for (const token of tokens) {
      if (claimTokens.has(token)) overlap++;
    }
    // Coverage of the claim by the sentence (not the reverse): a long source
    // sentence still counts when it carries the claim's content words.
    const score = overlap / claimTokens.size;
    if (best === null || score > best.score) {
      best = { start: slice.start, end: slice.end, score };
    }
  }

  if (best === null || best.score < minOverlap) return null;

  const raw = source.slice(best.start, best.end);
  const clipped = raw.length > MAX_SPAN_TEXT ? raw.slice(0, MAX_SPAN_TEXT) : raw;
  return { start: best.start, end: best.start + clipped.length, text: clipped };
}
