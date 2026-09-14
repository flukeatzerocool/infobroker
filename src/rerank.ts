// @implements REQ-021b REQ-028 REQ-103
import { rankDocs } from "./embed.js";

export interface RankedPassage {
  text: string;
  score: number;
  index: number;
  start: number;
  end: number;
}

function isBoundarySentence(p: string): boolean {
  return /[.!?。！？]["')\]]*\s+/.test(p);
}

const BLOCK_START = /^```|^<pre|^\s*\||^\s*#|^\s*[-*]\s/;

// Split text into ~passageSize-word passages at sentence boundaries, skipping
// code blocks, tables, and headings that would pollute ranking.
export function splitPassages(text: string, passageSize = 100): string[] {
  const raw = (text ?? "").replace(/```[\s\S]*?```/g, " ").replace(/\|\s.*/g, "");
  const sentences = raw
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !BLOCK_START.test(s));

  const passages: string[] = [];
  let current: string[] = [];
  let words = 0;
  for (const sentence of sentences) {
    const w = sentence.split(/\s+/).filter(Boolean).length;
    if (words + w > passageSize && current.length > 0) {
      passages.push(current.join(" "));
      current = [];
      words = 0;
    }
    current.push(sentence);
    words += w;
    if (words >= passageSize && isBoundarySentence(sentence)) {
      passages.push(current.join(" "));
      current = [];
      words = 0;
    }
  }
  if (current.length > 0) passages.push(current.join(" "));
  return passages;
}

// Rank passages against a question using the in-process embedding model
// (REQ-103). LSA groups passages that match intent without shared words; the
// lexical model is the automatic fallback on tiny corpora. A low top score
// means the page does not address the question, not that ranking failed.
//
// REQ-028: each ranked passage carries a span anchor locating it in the source
// page. Passages are cleaned before ranking, so the offsets are recovered by
// matching each passage back into the source text.
function sourceOffsets(source: string, passages: string[]): Array<{ start: number; end: number }> {
  let cursor = 0;
  return passages.map((p) => {
    const needle = p.slice(0, Math.min(80, p.length));
    let idx = needle ? source.indexOf(needle, cursor) : -1;
    if (idx === -1 && needle) idx = source.indexOf(needle);
    if (idx === -1) return { start: 0, end: p.length };
    cursor = idx + p.length;
    return { start: idx, end: idx + p.length };
  });
}

export function scorePassages(
  passages: string[],
  question: string,
  offsets?: Array<{ start: number; end: number }>,
): RankedPassage[] {
  const ranked = rankDocs(question, passages, "lsa");
  return ranked.map((r) => {
    const text = passages[r.index];
    const span = offsets?.[r.index] ?? { start: 0, end: text.length };
    return { text, score: r.score, index: r.index, start: span.start, end: span.end };
  });
}

export function rankPassages(text: string, question: string, passageSize = 100, topk = 1): RankedPassage[] {
  const passages = splitPassages(text, passageSize);
  return scorePassages(passages, question, sourceOffsets(text, passages)).slice(0, topk);
}
