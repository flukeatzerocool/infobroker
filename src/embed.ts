// @implements REQ-103 REQ-021b REQ-026f REQ-020g REQ-020b REQ-020e
// In-process embedding models. Every model runs inside the server process and
// transmits no content to a third party (REQ-103). Two zero-dependency models
// are shipped: `signed-hash-tfidf` (the historical lexical vectorizer, stable
// across vocabulary growth) and `lsa` (latent semantic analysis via a
// deterministic randomized SVD, which captures synonymy/paraphrase through
// co-occurrence). A model reference selects between them; an unknown reference
// is unavailable and callers degrade per REQ-103.
//
// All helpers are synchronous and pure: no network, no filesystem, no hidden
// state, so callers can rank passages, cluster claims, and collapse duplicate
// results without a dependency on the knowledge base.

export const DEFAULT_MODEL = "signed-hash-tfidf";
export const KNOWN_MODELS = ["signed-hash-tfidf", "lsa"] as const;
export type ModelName = (typeof KNOWN_MODELS)[number];

export function isKnownModel(name: string): name is ModelName {
  return (KNOWN_MODELS as readonly string[]).includes(name);
}

export function tokenize(text: string): string[] {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
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

function l2Normalize(vec: number[]): number[] {
  let norm = 0;
  for (const v of vec) norm += v * v;
  if (norm === 0) return vec;
  const inv = 1 / Math.sqrt(norm);
  return vec.map((v) => v * inv);
}

export interface EmbeddingModel {
  readonly name: ModelName;
  readonly dims: number;
  readonly requiresFit: boolean;
  fit(corpus: string[]): void;
  embed(text: string): number[];
  serialize(): Record<string, unknown>;
  load(state: Record<string, unknown>): boolean;
}

// ---------------------------------------------------------------------------
// signed-hash-tfidf: fixed-dimension signed feature hashing over tf-idf. The
// dimension is constant regardless of vocabulary growth so cosine similarity
// stays well-defined as content accumulates (D-031).
// ---------------------------------------------------------------------------

const HASH_DIMS = 4096;

function fnv1a(token: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function djb2(token: string): number {
  let h = 5381;
  for (let i = 0; i < token.length; i++) {
    h = ((h << 5) + h) ^ token.charCodeAt(i);
  }
  return h >>> 0;
}

class HashTfidfModel implements EmbeddingModel {
  readonly name = "signed-hash-tfidf" as const;
  readonly dims = HASH_DIMS;
  readonly requiresFit = false;
  private idf: Record<string, number> = {};
  private docCount = 0;

  fit(corpus: string[]): void {
    const df: Record<string, number> = {};
    for (const doc of corpus) {
      for (const term of new Set(tokenize(doc))) df[term] = (df[term] ?? 0) + 1;
    }
    this.docCount = corpus.length;
    this.idf = df;
  }

  embed(text: string): number[] {
    const tokens = tokenize(text);
    const tf: Record<string, number> = {};
    for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;
    const total = tokens.length || 1;
    const nDocs = this.docCount || 1;
    const vec = new Array<number>(HASH_DIMS).fill(0);
    for (const term of Object.keys(tf)) {
      const idfVal = Math.log((nDocs + 1) / ((this.idf[term] || 0) + 1)) + 1;
      const idx = fnv1a(term) % HASH_DIMS;
      const sign = (djb2(term) & 1) === 0 ? 1 : -1;
      vec[idx] += sign * (tf[term] / total) * idfVal;
    }
    return vec;
  }

  serialize(): Record<string, unknown> {
    return { idf: this.idf, docCount: this.docCount };
  }

  load(state: Record<string, unknown>): boolean {
    if (!state || typeof state !== "object") return false;
    this.idf = (state.idf as Record<string, number>) ?? {};
    this.docCount = typeof state.docCount === "number" ? state.docCount : 0;
    return true;
  }
}

// ---------------------------------------------------------------------------
// lsa: latent semantic analysis. A tf-idf term-document matrix is reduced to a
// dense k-dimensional space by a deterministic randomized SVD; cosine in that
// space groups paraphrases and synonyms that share no literal tokens. The right
// singular vectors (vocab x k) are persisted so new queries can be projected
// into the same basis.
// ---------------------------------------------------------------------------

const LSA_MAX_VOCAB = 4000;
const LSA_DEFAULT_DIMS = 64;
const LSA_JACOBI_SWEEPS = 24;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Symmetric eigendecomposition of a small k x k matrix via cyclic Jacobi
// rotations. Returns eigenvalues descending with matching eigenvector columns.
function jacobiEigen(input: number[][], sweeps = LSA_JACOBI_SWEEPS): { values: number[]; vectors: number[][] } {
  const k = input.length;
  const a = input.map((row) => [...row]);
  const v: number[][] = Array.from({ length: k }, (_, i) =>
    Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))
  );

  for (let sweep = 0; sweep < sweeps; sweep++) {
    let off = 0;
    for (let p = 0; p < k; p++) for (let q = p + 1; q < k; q++) off += a[p][q] * a[p][q];
    if (off < 1e-12) break;
    for (let p = 0; p < k; p++) {
      for (let q = p + 1; q < k; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let i = 0; i < k; i++) {
          const aip = a[i][p];
          const aiq = a[i][q];
          a[i][p] = c * aip - s * aiq;
          a[i][q] = s * aip + c * aiq;
        }
        for (let i = 0; i < k; i++) {
          const api = a[p][i];
          const aqi = a[q][i];
          a[p][i] = c * api - s * aqi;
          a[q][i] = s * api + c * aqi;
        }
        for (let i = 0; i < k; i++) {
          const vip = v[i][p];
          const viq = v[i][q];
          v[i][p] = c * vip - s * viq;
          v[i][q] = s * vip + c * viq;
        }
      }
    }
  }

  const order = Array.from({ length: k }, (_, i) => i).sort((i, j) => a[j][j] - a[i][i]);
  return {
    values: order.map((i) => a[i][i]),
    vectors: Array.from({ length: k }, (_, r) => order.map((c) => v[r][c])),
  };
}

function gramSchmidt(Y: number[][], k: number): number[][] {
  const n = Y.length;
  const q: number[][] = Array.from({ length: k }, () => new Array<number>(n).fill(0));
  for (let j = 0; j < k; j++) {
    const col = new Array<number>(n);
    for (let i = 0; i < n; i++) col[i] = Y[i][j];
    for (let p = 0; p < j; p++) {
      let dot = 0;
      for (let i = 0; i < n; i++) dot += col[i] * q[p][i];
      for (let i = 0; i < n; i++) col[i] -= dot * q[p][i];
    }
    let norm = 0;
    for (let i = 0; i < n; i++) norm += col[i] * col[i];
    norm = Math.sqrt(norm);
    for (let i = 0; i < n; i++) q[j][i] = norm > 1e-12 ? col[i] / norm : 0;
  }
  return q;
}

class LsaModel implements EmbeddingModel {
  readonly name = "lsa" as const;
  readonly requiresFit = true;
  private k = 0;
  private vocab: string[] = [];
  private vocabIndex: Map<string, number> = new Map();
  private idf: number[] = [];
  private basis: number[][] = []; // vocab x k

  get dims(): number {
    return this.k || LSA_DEFAULT_DIMS;
  }

  fit(corpus: string[]): void {
    const docs = corpus.map((d) => tokenize(d)).filter((t) => t.length > 0);
    const n = docs.length;

    // Vocabulary: highest document-frequency terms, capped for bounded cost.
    const df = new Map<string, number>();
    for (const tokens of docs) {
      for (const term of new Set(tokens)) df.set(term, (df.get(term) ?? 0) + 1);
    }
    const vocab = [...df.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, LSA_MAX_VOCAB)
      .map(([t]) => t);
    this.vocab = vocab;
    this.vocabIndex = new Map(vocab.map((t, i) => [t, i]));
    this.idf = vocab.map((t) => Math.log((n + 1) / ((df.get(t) ?? 0) + 1)) + 1);

    const k = Math.max(1, Math.min(LSA_DEFAULT_DIMS, n - 1, vocab.length));
    this.k = k;

    if (n < 2 || vocab.length < 2 || k < 1) {
      this.basis = [];
      return;
    }

    // Row-normalized tf-idf document matrix A (n x v).
    const A: number[][] = docs.map((tokens) => {
      const tf = new Map<number, number>();
      for (const t of tokens) {
        const idx = this.vocabIndex.get(t);
        if (idx === undefined) continue;
        tf.set(idx, (tf.get(idx) ?? 0) + 1);
      }
      const row = new Array<number>(vocab.length).fill(0);
      const total = tokens.length || 1;
      for (const [idx, count] of tf) row[idx] = (count / total) * this.idf[idx];
      return l2Normalize(row);
    });

    // Randomized SVD of A (n x v): Y = A Omega, orthonormalize to Q (n x k),
    // then B = Q^T A (k x v); the right singular vectors of B give the basis.
    const rand = mulberry32(20260914);
    const omega: number[][] = Array.from({ length: vocab.length }, () =>
      Array.from({ length: k }, () => gaussian(rand))
    );
    const Y: number[][] = A.map((row) => {
      const out = new Array<number>(k).fill(0);
      for (let j = 0; j < k; j++) {
        let sum = 0;
        for (let i = 0; i < row.length; i++) if (row[i] !== 0) sum += row[i] * omega[i][j];
        out[j] = sum;
      }
      return out;
    });
    const Q = gramSchmidt(Y, k); // column-major: Q[j] has length n.

    // B = Q^T A is k x v.
    const B: number[][] = Array.from({ length: k }, (_v, j) => {
      const out = new Array<number>(vocab.length).fill(0);
      for (let d = 0; d < n; d++) {
        const qd = Q[j][d];
        if (qd === 0) continue;
        for (let i = 0; i < vocab.length; i++) out[i] += qd * A[d][i];
      }
      return out;
    });

    // Small symmetric eigenproblem C = B B^T (k x k) -> singular vectors.
    const C: number[][] = Array.from({ length: k }, (_r, i) => {
      const row = new Array<number>(k).fill(0);
      for (let j = 0; j < k; j++) {
        let sum = 0;
        for (let t = 0; t < vocab.length; t++) sum += B[i][t] * B[j][t];
        row[j] = sum;
      }
      return row;
    });
    const { values, vectors } = jacobiEigen(C);
    const singular = values.map((v) => Math.sqrt(Math.max(0, v)));

    // V = B^T U S^-1, a vocab x k basis.
    const basis: number[][] = Array.from({ length: vocab.length }, () => new Array<number>(k).fill(0));
    for (let t = 0; t < vocab.length; t++) {
      for (let j = 0; j < k; j++) {
        let sum = 0;
        for (let i = 0; i < k; i++) sum += B[i][t] * vectors[i][j];
        basis[t][j] = singular[j] > 1e-9 ? sum / singular[j] : 0;
      }
    }
    this.basis = basis;
  }

  embed(text: string): number[] {
    const k = this.k;
    if (k === 0 || this.basis.length === 0) return [];
    const tokens = tokenize(text);
    const tf = new Map<number, number>();
    for (const t of tokens) {
      const idx = this.vocabIndex.get(t);
      if (idx === undefined) continue;
      tf.set(idx, (tf.get(idx) ?? 0) + 1);
    }
    const q = new Array<number>(this.vocab.length).fill(0);
    const total = tokens.length || 1;
    for (const [idx, count] of tf) q[idx] = (count / total) * this.idf[idx];
    const qn = l2Normalize(q);
    const out = new Array<number>(k).fill(0);
    for (let i = 0; i < this.vocab.length; i++) {
      const qi = qn[i];
      if (qi === 0) continue;
      const row = this.basis[i];
      for (let j = 0; j < k; j++) out[j] += qi * row[j];
    }
    return l2Normalize(out);
  }

  serialize(): Record<string, unknown> {
    return { k: this.k, vocab: this.vocab, idf: this.idf, basis: this.basis };
  }

  load(state: Record<string, unknown>): boolean {
    if (!state || typeof state !== "object") return false;
    const vocab = state.vocab as string[] | undefined;
    const basis = state.basis as number[][] | undefined;
    const idf = state.idf as number[] | undefined;
    const k = state.k;
    if (!Array.isArray(vocab) || !Array.isArray(basis) || !Array.isArray(idf) || typeof k !== "number") {
      return false;
    }
    this.vocab = vocab;
    this.vocabIndex = new Map(vocab.map((t, i) => [t, i]));
    this.idf = idf;
    this.basis = basis;
    this.k = k;
    return true;
  }
}

export function createModel(name: string): EmbeddingModel | null {
  if (name === "signed-hash-tfidf") return new HashTfidfModel();
  if (name === "lsa") return new LsaModel();
  return null;
}

// ---------------------------------------------------------------------------
// Stateless helpers for callers that do not persist embeddings (passage
// ranking, claim reconciliation, cross-provider collapse, query expansion).
// A model is fit over the candidate documents in one call and the query is
// projected into the same space.
// ---------------------------------------------------------------------------

export interface RankedDoc {
  index: number;
  score: number;
}

// LSA learns similarity from co-occurrence, so it needs a corpus to be
// meaningful; below this size the lexical model is more reliable.
const LSA_MIN_DOCS = 8;

function effectiveModel(modelName: string, docs: string[]): string {
  if (modelName === "lsa" && docs.length < LSA_MIN_DOCS) return DEFAULT_MODEL;
  return modelName;
}

export function embedQueryInto(query: string, docs: string[], modelName: string): { queryVec: number[]; docVecs: number[][] } {
  modelName = effectiveModel(modelName, docs);
  let model = createModel(modelName) ?? createModel(DEFAULT_MODEL)!;
  model.fit(docs);
  let docVecs = docs.map((d) => model.embed(d));
  let queryVec = model.embed(query);
  // A fitted model can be degenerate on a tiny corpus (no latent basis). Fall
  // back to the lexical model so ranking still produces scores.
  if (queryVec.length === 0 && modelName !== DEFAULT_MODEL) {
    model = createModel(DEFAULT_MODEL)!;
    model.fit(docs);
    docVecs = docs.map((d) => model.embed(d));
    queryVec = model.embed(query);
  }
  return { queryVec, docVecs };
}

export function rankDocs(query: string, docs: string[], modelName: string = DEFAULT_MODEL): RankedDoc[] {
  if (docs.length === 0) return [];
  const { queryVec, docVecs } = embedQueryInto(query, docs, modelName);
  return docs
    .map((_d, index) => ({ index, score: cosineSimilarity(queryVec, docVecs[index]) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

export function pairwiseSimilarity(docs: string[], modelName: string = DEFAULT_MODEL): number[][] {
  modelName = effectiveModel(modelName, docs);
  let model = createModel(modelName) ?? createModel(DEFAULT_MODEL)!;
  model.fit(docs);
  let vecs = docs.map((d) => model.embed(d));
  if (modelName !== DEFAULT_MODEL && (docs.length === 0 || vecs[0]?.length === 0)) {
    model = createModel(DEFAULT_MODEL)!;
    model.fit(docs);
    vecs = docs.map((d) => model.embed(d));
  }
  return vecs.map((a) => vecs.map((b) => cosineSimilarity(a, b)));
}
