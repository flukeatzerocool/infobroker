// @implements REQ-136
// processing-benchmark.ts — deduplication quality, measured.
//
// §1's processing function collapses duplicates (REQ-020g) and reports how many
// it removed (REQ-133). Both facts were unmeasured: `dedup.test.ts` asserts unit
// behaviour on synthetic shapes, and `processing.test.ts` asserts the block is a
// faithful projection of its inputs. Neither can fail if the reconciler starts
// collapsing real pairs or stops collapsing duplicates.
//
// The corpus states, per case, which URL pairs must end up as one and which must
// both survive; the scorer runs the real reconciler and derives the collapse
// total from its input and output lengths. Offline and deterministic.

import { reconcileResults } from "./dedup.js";
import type { SearchResult } from "./types.js";

export interface ProcessingCase {
  id: string;
  query: string;
  results: SearchResult[];
  /** URL pairs that express the same content and must end up as one result. */
  must_collapse: Array<[string, string]>;
  /** URL pairs that express different content and must both survive. */
  must_survive: Array<[string, string]>;
  /** Total results the reconciler is expected to remove for this case. */
  collapsed_count: number;
}

export interface ProcessingFloor {
  dedup_recall: number;
  dedup_precision: number;
  collapsed_total_accuracy: number;
}

export interface ProcessingCaseOutcome {
  id: string;
  collapsed_ok: number;
  collapsed_total: number;
  survive_ok: number;
  survive_total: number;
  /** Input length minus output length, derived from the reconciler, not the block. */
  collapsed_actual: number;
  collapsed_expected: number;
}

export interface ProcessingReport {
  corpus: number;
  /** Share of duplicate pairs that collapsed to exactly one representative. */
  dedup_recall: number;
  /** Share of distinct pairs that both survived. */
  dedup_precision: number;
  /** Share of cases whose derived collapse total matched the expectation. */
  collapsed_total_accuracy: number;
  floor: ProcessingFloor;
  meetsFloor: boolean;
  cases: ProcessingCaseOutcome[];
}

export type Reconciler = (results: SearchResult[], query: string) => SearchResult[];

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : Math.round((numerator / denominator) * 1000) / 1000;
}

/** One case: run the reconciler, then read the four facts the contract names. */
export function scoreProcessingCase(
  testCase: ProcessingCase,
  reconciler: Reconciler = reconcileResults,
): { outcome: ProcessingCaseOutcome; kept: SearchResult[] } {
  const kept = reconciler(testCase.results, testCase.query);
  const urls = new Set(kept.map((result) => result.url));
  // A collapsed pair keeps exactly one representative: both present means no
  // collapse happened, neither present means the pair was lost, not merged.
  const collapsedOk = testCase.must_collapse.filter(([a, b]) => urls.has(a) !== urls.has(b)).length;
  const surviveOk = testCase.must_survive.filter(([a, b]) => urls.has(a) && urls.has(b)).length;
  return {
    kept,
    outcome: {
      id: testCase.id,
      collapsed_ok: collapsedOk,
      collapsed_total: testCase.must_collapse.length,
      survive_ok: surviveOk,
      survive_total: testCase.must_survive.length,
      collapsed_actual: Math.max(0, testCase.results.length - kept.length),
      collapsed_expected: testCase.collapsed_count,
    },
  };
}

export function runProcessingBenchmark(
  cases: ProcessingCase[],
  floor: ProcessingFloor,
  reconciler: Reconciler = reconcileResults,
): ProcessingReport {
  const casesOut = cases.map((testCase) => scoreProcessingCase(testCase, reconciler).outcome);
  const sum = (pick: (outcome: ProcessingCaseOutcome) => number): number =>
    casesOut.reduce((total, outcome) => total + pick(outcome), 0);
  const report = {
    corpus: cases.length,
    dedup_recall: ratio(sum((outcome) => outcome.collapsed_ok), sum((outcome) => outcome.collapsed_total)),
    dedup_precision: ratio(sum((outcome) => outcome.survive_ok), sum((outcome) => outcome.survive_total)),
    collapsed_total_accuracy: ratio(
      casesOut.filter((outcome) => outcome.collapsed_actual === outcome.collapsed_expected).length,
      casesOut.length,
    ),
  };
  return {
    ...report,
    floor,
    meetsFloor:
      report.dedup_recall >= floor.dedup_recall &&
      report.dedup_precision >= floor.dedup_precision &&
      report.collapsed_total_accuracy >= floor.collapsed_total_accuracy,
    cases: casesOut,
  };
}
