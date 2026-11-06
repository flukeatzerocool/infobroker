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

const CLOSERS = new Set(['"', "'", ")", "]", "\u2019", "\u201d"]);

/**
 * A `.` between two digits is a decimal separator ("2.5"), never a sentence
 * end; `!` and `?` always terminate.
 */
function isTerminator(text: string, index: number): boolean {
  const char = text[index];
  if (char === "!" || char === "?") return true;
  if (char !== ".") return false;
  const prev = text[index - 1] ?? "";
  const next = text[index + 1] ?? "";
  return !(/\d/.test(prev) && /\d/.test(next));
}

/**
 * Split text into sentence slices while keeping offsets into the original
 * string. Trailing punctuation and closing quotes stay in the sentence;
 * surrounding whitespace does not. A `.` between two digits is a decimal
 * separator, not a sentence end, so "2.5 million" stays inside one slice.
 */
export function splitSentences(text: string): SentenceSlice[] {
  const slices: SentenceSlice[] = [];
  const push = (from: number, to: number): void => {
    const raw = text.slice(from, to);
    const trimmed = raw.trim();
    // A slice with no letters or digits is punctuation run-off ("..."), not a
    // sentence; the old terminator regex never produced one because it required
    // a non-terminator character before the punctuation.
    if (!/[\p{L}\p{N}]/u.test(trimmed)) return;
    const start = from + (raw.length - raw.trimStart().length);
    slices.push({ start, end: start + trimmed.length, text: trimmed });
  };

  let start = 0;
  let index = 0;
  while (index < text.length) {
    if (!isTerminator(text, index)) {
      index++;
      continue;
    }
    let end = index;
    while (end < text.length && isTerminator(text, end)) end++;
    while (end < text.length && CLOSERS.has(text[end]!)) end++;
    while (end < text.length && /\s/.test(text[end]!)) end++;
    push(start, end);
    start = end;
    index = end;
  }
  push(start, text.length);
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
