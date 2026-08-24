// @implements REQ-021b
const HASH_DIMS = 1024;

export interface RankedPassage {
  text: string;
  score: number;
  index: number;
  start: number;
  end: number;
}

function hashIndex(token: string): number {
  let h = 5381;
  for (let i = 0; i < token.length; i++) {
    h = ((h << 5) + h) ^ token.charCodeAt(i);
  }
  return h >>> 0;
}

function hashSign(token: string): number {
  return (hashIndex(token) & 1) === 0 ? 1 : -1;
}

function tokenizeLoose(text: string): string[] {
  const ascii = text.toLowerCase().match(/[a-z0-9_'-]{2,}/g) ?? [];
  const words = text.split(/[^\p{L}\p{N}_'-]+/u).filter((w) => w.length >= 2);
  return Array.from(new Set([...ascii, ...words]));
}

function computeTf(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;
  return tf;
}

function vectorize(tokens: string[], idf: Record<string, number>, docCount: number): number[] {
  const tf = computeTf(tokens);
  const nDocs = docCount || 1;
  const vec: number[] = new Array(HASH_DIMS).fill(0);
  for (const term of Object.keys(tf)) {
    const idfVal = Math.log((nDocs + 1) / ((idf[term] || 0) + 1)) + 1;
    const weight = tf[term] * idfVal;
    const idx = hashIndex(term) % HASH_DIMS;
    const sign = hashSign(term);
    vec[idx] += sign * weight;
  }
  return vec;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
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

// Rank passages against a question using local hashed TF-IDF cosine. A low top
// score means the passage does not address the question, not that ranking
// failed.
export function scorePassages(passages: string[], question: string): RankedPassage[] {
  const idf: Record<string, number> = {};
  const tokenized = passages.map((p) => tokenizeLoose(p));
  for (const toks of tokenized) {
    for (const t of new Set(toks)) idf[t] = (idf[t] ?? 0) + 1;
  }
  const docCount = passages.length;
  const qVec = vectorize(tokenizeLoose(question), idf, docCount);
  const ranked = passages.map((text, index) => {
    const vec = vectorize(tokenized[index], idf, docCount);
    const score = cosineSimilarity(qVec, vec);
    return { text, score, index, start: 0, end: text.length };
  });
  return ranked.filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
}

export function rankPassages(text: string, question: string, passageSize = 100, topk = 1): RankedPassage[] {
  const passages = splitPassages(text, passageSize);
  return scorePassages(passages, question).slice(0, topk);
}
