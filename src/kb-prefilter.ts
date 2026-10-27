// @implements REQ-108 REQ-060a
// In-memory candidate prefilter for lexical knowledge-base search. Built from
// already-stored embeddings and never persisted, so it works identically for
// plaintext and encrypted stores and requires no data migration. A fixed-size
// Bloom signature over the nonzero embedding buckets is a sound filter for the
// signed-hash model: a nonzero cosine dot product requires a shared nonzero
// bucket, so a signature miss can never hide a true match. Bloom false
// positives only cost an extra scan. The signature store is capped; above the
// cap the filter disables itself and callers fall back to a full scan.

export const PREFILTER_BITS = 2048;
export const PREFILTER_BYTES = PREFILTER_BITS / 8;
export const PREFILTER_HASHES = 3;
export const DEFAULT_PREFILTER_MAX_BYTES = 16 * 1024 * 1024;

function mix1(value: number): number {
  let h = value >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return h >>> 0;
}

function mix2(value: number): number {
  let h = Math.imul(value >>> 0, 0x27d4eb2d);
  h ^= h >>> 15;
  return h >>> 0;
}

function setBit(signature: Uint8Array, bucket: number): void {
  const h1 = mix1(bucket);
  const h2 = (mix2(bucket) | 1) >>> 0;
  for (let i = 0; i < PREFILTER_HASHES; i++) {
    const bit = ((h1 + Math.imul(i, h2)) >>> 0) % PREFILTER_BITS;
    signature[bit >>> 3]! |= 1 << (bit & 7);
  }
}

function hasBit(signature: Uint8Array, bucket: number): boolean {
  const h1 = mix1(bucket);
  const h2 = (mix2(bucket) | 1) >>> 0;
  for (let i = 0; i < PREFILTER_HASHES; i++) {
    const bit = ((h1 + Math.imul(i, h2)) >>> 0) % PREFILTER_BITS;
    if ((signature[bit >>> 3]! & (1 << (bit & 7))) === 0) return false;
  }
  return true;
}

function bucketSignatures(embedding: readonly number[]): Uint8Array | null {
  if (embedding.length === 0) return null;
  const signature = new Uint8Array(PREFILTER_BYTES);
  let nonZero = 0;
  for (let i = 0; i < embedding.length; i++) {
    if (embedding[i] !== 0) {
      setBit(signature, i);
      nonZero++;
    }
  }
  return nonZero === 0 ? null : signature;
}

export interface PrefilterChunk {
  id: string;
  embedding: readonly number[];
}

export class KbPrefilter {
  private signatures = new Map<string, Uint8Array>();
  private dims: number | null = null;
  private usedBytes = 0;
  private disabled = false;
  private readonly maxBytes: number;

  constructor(maxBytes: number = DEFAULT_PREFILTER_MAX_BYTES) {
    this.maxBytes = maxBytes;
  }

  get size(): number {
    return this.signatures.size;
  }

  get isDisabled(): boolean {
    return this.disabled;
  }

  /** Add or replace one chunk's signature. Disables the filter on overflow. */
  add(chunk: PrefilterChunk): void {
    if (this.disabled) return;
    if (!Array.isArray(chunk.embedding) || chunk.embedding.length === 0) {
      this.disable();
      return;
    }
    if (this.dims === null) this.dims = chunk.embedding.length;
    else if (this.dims !== chunk.embedding.length) {
      this.disable();
      return;
    }
    const signature = bucketSignatures(chunk.embedding);
    if (!signature) {
      this.disable();
      return;
    }
    const existing = this.signatures.get(chunk.id);
    if (existing) this.usedBytes -= existing.byteLength;
    if (this.usedBytes + signature.byteLength > this.maxBytes) {
      this.disable();
      return;
    }
    this.signatures.set(chunk.id, signature);
    this.usedBytes += signature.byteLength;
  }

  /**
   * Candidate ids whose signatures contain at least one query bucket. Returns null
   * when filtering cannot help (disabled, empty, model mismatch, or nearly
   * everything is a candidate), signalling a full scan to the caller.
   */
  candidates(queryEmbedding: readonly number[]): Set<string> | null {
    if (this.disabled || this.signatures.size === 0) return null;
    if (this.dims !== null && queryEmbedding.length !== this.dims) return null;
    const queryBuckets: number[] = [];
    for (let i = 0; i < queryEmbedding.length; i++) {
      if (queryEmbedding[i] !== 0) queryBuckets.push(i);
    }
    if (queryBuckets.length === 0) return null;

    const candidates = new Set<string>();
    for (const [id, signature] of this.signatures) {
      // A nonzero cosine dot requires a shared nonzero bucket; sharing any
      // one query bucket is enough to keep the chunk. Requiring all of them
      // would drop true matches.
      let hit = false;
      for (const bucket of queryBuckets) {
        if (hasBit(signature, bucket)) {
          hit = true;
          break;
        }
      }
      if (hit) candidates.add(id);
    }
    if (candidates.size >= this.signatures.size) return null;
    return candidates;
  }

  clear(): void {
    this.signatures.clear();
    this.dims = null;
    this.usedBytes = 0;
    this.disabled = false;
  }

  private disable(): void {
    this.disabled = true;
    this.signatures.clear();
    this.usedBytes = 0;
  }
}
