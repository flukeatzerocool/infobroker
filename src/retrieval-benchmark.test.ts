// @implements REQ-130
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  runBenchmark,
  scoreCase,
  ndcgAtK,
  normalizeUrl,
  type RetrievalCase,
} from "./retrieval-benchmark.js";

const ROOT = join(import.meta.dirname, "..");
const fixture = JSON.parse(
  readFileSync(join(ROOT, "test-fixtures", "retrieval", "queries.json"), "utf-8"),
) as { k: number; queries: RetrievalCase[] };
const baseline = JSON.parse(
  readFileSync(join(ROOT, "test-fixtures", "retrieval", "baseline.json"), "utf-8"),
) as ReturnType<typeof runBenchmark> & { version: number; corpus: number };

describe("retrieval metric math (REQ-130)", () => {
  const judgments = [
    { url: "https://a.example/1", grade: 2 },
    { url: "https://b.example/2", grade: 1 },
    { url: "https://c.example/3", grade: 0 },
  ];

  it("normalizes trailing slashes and case", () => {
    expect(normalizeUrl("HTTPS://A.example/1/")).toBe("https://a.example/1");
  });

  it("scores precision, recall, MRR, and nDCG for a ranked list", () => {
    const m = scoreCase(["https://b.example/2", "https://c.example/3", "https://a.example/1"], judgments, 3);
    expect(m.precision_at_k).toBeCloseTo(2 / 3, 5);
    expect(m.recall_at_k).toBe(1);
    expect(m.mrr).toBeCloseTo(1, 5);
    expect(m.ndcg_at_k).toBeLessThan(1);
    expect(m.ndcg_at_k).toBeGreaterThan(0);
  });

  it("rewards an ideal ordering with an nDCG of 1", () => {
    expect(ndcgAtK(["https://a.example/1", "https://b.example/2"], judgments, 2)).toBeCloseTo(1, 5);
  });

  it("returns zero for an empty judgment set", () => {
    const m = scoreCase(["https://a.example/1"], [], 5);
    expect(m.recall_at_k).toBe(0);
    expect(m.mrr).toBe(0);
    expect(m.ndcg_at_k).toBe(0);
  });
});

describe("retrieval benchmark floor (REQ-130)", () => {
  const report = runBenchmark(fixture.queries, fixture.k);

  it("runs deterministically over the committed corpus", () => {
    expect(report.corpus).toBe(baseline.corpus);
    expect(runBenchmark(fixture.queries, fixture.k)).toEqual(report);
  });

  it("does not regress below the recorded baseline", () => {
    expect(report.reconciled.mean_precision).toBeGreaterThanOrEqual(baseline.reconciled.mean_precision - 0.001);
    expect(report.reconciled.mean_recall).toBeGreaterThanOrEqual(baseline.reconciled.mean_recall - 0.001);
    expect(report.reconciled.mrr).toBeGreaterThanOrEqual(baseline.reconciled.mrr - 0.001);
    expect(report.reconciled.ndcg).toBeGreaterThanOrEqual(baseline.reconciled.ndcg - 0.001);
  });
});
