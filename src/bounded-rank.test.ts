// @implements REQ-075
// The bounded ranker must retain at most its capacity while returning exactly
// what a full descending sort would, including on tied scores.
import { describe, it, expect } from "vitest";
import { BoundedRank } from "./lib/bounded-rank.js";

interface Row {
  id: number;
  score: number;
}

const byScore = (a: Row, b: Row): number => a.score - b.score;

function reference(rows: Row[], capacity: number): Row[] {
  return [...rows].sort((a, b) => b.score - a.score).slice(0, capacity);
}

describe("BoundedRank", () => {
  it("never retains more than its capacity", () => {
    const ranker = new BoundedRank<Row>(5, byScore);
    for (let i = 0; i < 10_000; i++) {
      ranker.offer({ id: i, score: i % 97 });
      expect(ranker.size).toBeLessThanOrEqual(5);
    }
    expect(ranker.size).toBe(5);
  });

  it("returns the same ranking a full descending sort would", () => {
    const rows: Row[] = Array.from({ length: 250 }, (_, i) => ({
      id: i,
      score: ((i * 37) % 211) / 211,
    }));
    const ranker = new BoundedRank<Row>(10, byScore);
    for (const row of rows) ranker.offer(row);
    expect(ranker.values().map((r) => r.id)).toEqual(reference(rows, 10).map((r) => r.id));
  });

  it("breaks ties by insertion order, like a stable descending sort", () => {
    const rows: Row[] = Array.from({ length: 40 }, (_, i) => ({ id: i, score: 1 }));
    const ranker = new BoundedRank<Row>(6, byScore);
    for (const row of rows) ranker.offer(row);
    expect(ranker.values().map((r) => r.id)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("keeps everything when the capacity exceeds the input", () => {
    const rows: Row[] = [
      { id: 1, score: 0.2 },
      { id: 2, score: 0.9 },
    ];
    const ranker = new BoundedRank<Row>(8, byScore);
    for (const row of rows) ranker.offer(row);
    expect(ranker.values().map((r) => r.id)).toEqual([2, 1]);
  });

  it("retains nothing at capacity zero", () => {
    const ranker = new BoundedRank<Row>(0, byScore);
    ranker.offer({ id: 1, score: 1 });
    expect(ranker.size).toBe(0);
    expect(ranker.values()).toEqual([]);
  });

  it("replaces the worst entry as better ones arrive", () => {
    const ranker = new BoundedRank<Row>(3, byScore);
    for (const score of [1, 2, 3, 0, 4]) ranker.offer({ id: score, score });
    expect(ranker.values().map((r) => r.id)).toEqual([4, 3, 2]);
  });
});
