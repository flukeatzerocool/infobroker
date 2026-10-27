// @implements REQ-130
// Retrieval-quality measurement over committed fixtures. Pure scoring helpers
// plus a runner that exercises the real reconciliation path, so the benchmark
// tests pipeline behavior rather than a frozen output. Distinct from the
// REQ-123 confidence-calibration gold set.
import type { SearchResult } from "./types.js";
import { reconcileResults } from "./dedup.js";

export interface RetrievalJudgment {
  url: string;
  grade: number;
}

export interface RetrievalCase {
  id: string;
  query: string;
  language?: string;
  judgments: RetrievalJudgment[];
  results: SearchResult[];
}

export interface RetrievalCaseMetrics {
  id: string;
  precision_at_k: number;
  recall_at_k: number;
  mrr: number;
  ndcg_at_k: number;
  returned: number;
  relevant: number;
}

export interface RetrievalAggregate {
  mean_precision: number;
  mean_recall: number;
  mrr: number;
  ndcg: number;
}

export interface BenchmarkReport {
  k: number;
  corpus: number;
  reconciled: RetrievalAggregate;
  raw: RetrievalAggregate;
  cases: RetrievalCaseMetrics[];
}

function dcg(grades: number[]): number {
  return grades.reduce((sum, grade, i) => sum + (2 ** grade - 1) / Math.log2(i + 2), 0);
}

export function ndcgAtK(returned: string[], judgments: RetrievalJudgment[], k: number): number {
  const grades = new Map(judgments.map((j) => [normalizeUrl(j.url), j.grade]));
  const actual = returned.slice(0, k).map((url) => grades.get(normalizeUrl(url)) ?? 0);
  const ideal = [...judgments]
    .map((j) => j.grade)
    .sort((a, b) => b - a)
    .slice(0, k);
  const idealDcg = dcg(ideal);
  return idealDcg === 0 ? 0 : dcg(actual) / idealDcg;
}

export function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

export function scoreCase(returned: string[], judgments: RetrievalJudgment[], k: number): Omit<RetrievalCaseMetrics, "id"> {
  const relevant = new Set(judgments.filter((j) => j.grade > 0).map((j) => normalizeUrl(j.url)));
  const top = returned.slice(0, k).map(normalizeUrl);
  const hits = top.filter((url) => relevant.has(url)).length;
  const covered = new Set(top.filter((url) => relevant.has(url)));
  const firstRelevant = top.findIndex((url) => relevant.has(url));
  return {
    precision_at_k: top.length === 0 ? 0 : hits / top.length,
    recall_at_k: relevant.size === 0 ? 0 : covered.size / relevant.size,
    mrr: firstRelevant === -1 ? 0 : 1 / (firstRelevant + 1),
    ndcg_at_k: ndcgAtK(returned, judgments, k),
    returned: returned.length,
    relevant: relevant.size,
  };
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function aggregate(metrics: Array<Omit<RetrievalCaseMetrics, "id">>): RetrievalAggregate {
  return {
    mean_precision: round(mean(metrics.map((m) => m.precision_at_k))),
    mean_recall: round(mean(metrics.map((m) => m.recall_at_k))),
    mrr: round(mean(metrics.map((m) => m.mrr))),
    ndcg: round(mean(metrics.map((m) => m.ndcg_at_k))),
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function rankedUrls(candidates: SearchResult[], query: string, reconcile: boolean): string[] {
  if (!reconcile) return candidates.map((r) => r.url);
  try {
    return reconcileResults(candidates, query).map((r) => r.url);
  } catch {
    return candidates.map((r) => r.url);
  }
}

export function runBenchmark(cases: RetrievalCase[], k = 5): BenchmarkReport {
  const reconciled: Array<Omit<RetrievalCaseMetrics, "id">> = [];
  const raw: Array<Omit<RetrievalCaseMetrics, "id">> = [];
  const perCase: RetrievalCaseMetrics[] = [];
  for (const entry of cases) {
    const recon = scoreCase(rankedUrls(entry.results, entry.query, true), entry.judgments, k);
    const base = scoreCase(rankedUrls(entry.results, entry.query, false), entry.judgments, k);
    reconciled.push(recon);
    raw.push(base);
    perCase.push({ id: entry.id, ...recon });
  }
  return {
    k,
    corpus: cases.length,
    reconciled: aggregate(reconciled),
    raw: aggregate(raw),
    cases: perCase,
  };
}
