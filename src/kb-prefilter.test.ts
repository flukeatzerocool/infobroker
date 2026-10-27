// @implements REQ-108 REQ-060a prefilter-soundness
import { describe, it, expect } from "vitest";
import { KbPrefilter, PREFILTER_BYTES } from "./kb-prefilter.js";

const DIMS = 4096;

function embedding(indices: number[], dims = DIMS): number[] {
  const vec = new Array<number>(dims).fill(0);
  for (const index of indices) vec[index] = 1;
  return vec;
}

function dot(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) sum += a[i]! * b[i]!;
  return sum;
}

describe("KB lexical prefilter (REQ-108, REQ-060a)", () => {
  it("never drops a chunk with a nonzero dot product (soundness)", () => {
    const prefilter = new KbPrefilter();
    const chunks: Array<{ id: string; vec: number[] }> = [];
    for (let i = 0; i < 300; i++) {
      // Deterministic sparse vectors: broadly spread bucket indices.
      const indices: number[] = [];
      for (let j = 0; j < 12; j++) indices.push((i * 37 + j * 211) % DIMS);
      const vec = embedding(indices);
      chunks.push({ id: `chunk-${i}`, vec });
      prefilter.add({ id: `chunk-${i}`, embedding: vec });
    }

    for (let q = 0; q < 25; q++) {
      const query = embedding([(q * 53) % DIMS, (q * 97 + 3) % DIMS, (q * 17 + 11) % DIMS]);
      const candidates = prefilter.candidates(query);
      if (candidates === null) continue;
      for (const chunk of chunks) {
        if (dot(query, chunk.vec) !== 0) expect(candidates.has(chunk.id)).toBe(true);
      }
    }
  });

  it("prunes non-overlapping chunks", () => {
    const prefilter = new KbPrefilter();
    prefilter.add({ id: "match", embedding: embedding([1, 2, 3]) });
    prefilter.add({ id: "disjoint", embedding: embedding([1000, 1001, 1002]) });
    const candidates = prefilter.candidates(embedding([1]));
    expect(candidates?.has("match")).toBe(true);
    expect(candidates?.has("disjoint")).toBe(false);
    expect(candidates?.size).toBe(1);
  });

  it("disables itself above the memory cap and signals a full scan", () => {
    const prefilter = new KbPrefilter(2 * PREFILTER_BYTES);
    prefilter.add({ id: "a", embedding: embedding([1]) });
    prefilter.add({ id: "b", embedding: embedding([2]) });
    expect(prefilter.isDisabled).toBe(false);
    prefilter.add({ id: "c", embedding: embedding([3]) });
    expect(prefilter.isDisabled).toBe(true);
    expect(prefilter.size).toBe(0);
    expect(prefilter.candidates(embedding([1]))).toBeNull();
  });

  it("falls back when the query and stored vectors use different dimensions", () => {
    const prefilter = new KbPrefilter();
    prefilter.add({ id: "a", embedding: embedding([1], 8) });
    expect(prefilter.candidates(embedding([1], 16))).toBeNull();
  });

  it("falls back when any stored embedding is empty or malformed", () => {
    const prefilter = new KbPrefilter();
    prefilter.add({ id: "a", embedding: [] });
    expect(prefilter.isDisabled).toBe(true);
    expect(prefilter.candidates(embedding([1]))).toBeNull();
  });
});
