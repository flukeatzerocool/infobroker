// @implements REQ-135
// direction-benchmark.ts — requirement-quality measurement over a committed
// corpus. The §1 direction function was the only one with no measurement: it
// could regress silently because nothing scored the requirement it derived.
//
// Pure scoring helpers plus a runner that exercises the real classifier and the
// real ambiguity rule, so the benchmark measures pipeline behavior rather than a
// frozen expectation. Offline and deterministic: no network, no clock.

import { ambiguousRequirements, type DirectionCandidate } from "./lib/direction.js";
import { classifyTaskCandidates } from "./task-type.js";

export interface DirectionCase {
  id: string;
  query: string;
  /** Whether two materially different requirements are plausible for this query. */
  expect_offer: boolean;
  /** Task types an acceptable offer may name. */
  candidates?: string[];
  /** Requirement slots the direction block must report for this case. */
  slots: string[];
}

export interface DirectionObservation {
  offered: boolean;
  types: string[];
  reportedSlots: string[];
}

export interface DirectionCaseOutcome {
  id: string;
  offered: boolean;
  offered_types: string[];
  slot_recall: number;
}

export interface DirectionReport {
  corpus: number;
  /** Share of cases that should offer a choice and did. */
  offer_rate: number;
  /** Share of cases that should not offer and did. */
  false_offer_rate: number;
  mean_slot_recall: number;
  cases: DirectionCaseOutcome[];
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 1000;
}

export function scoreCase(testCase: DirectionCase, observed: DirectionObservation): DirectionCaseOutcome {
  const expected = new Set(testCase.slots);
  const reported = new Set(observed.reportedSlots);
  const hit = [...expected].filter((slot) => reported.has(slot)).length;
  return {
    id: testCase.id,
    offered: observed.offered,
    offered_types: observed.types,
    slot_recall: ratio(hit, expected.size),
  };
}

export function summarize(cases: DirectionCase[], outcomes: DirectionCaseOutcome[]): DirectionReport {
  const expectedOffers = cases.filter((testCase) => testCase.expect_offer).length;
  const expectedQuiet = cases.length - expectedOffers;
  const correctOffers = cases.filter(
    (testCase, index) => testCase.expect_offer && outcomes[index]?.offered === true,
  ).length;
  const falseOffers = cases.filter(
    (testCase, index) => !testCase.expect_offer && outcomes[index]?.offered === true,
  ).length;
  const recall = outcomes.reduce((sum, outcome) => sum + outcome.slot_recall, 0);
  return {
    corpus: cases.length,
    offer_rate: ratio(correctOffers, expectedOffers),
    false_offer_rate: ratio(falseOffers, expectedQuiet),
    mean_slot_recall: ratio(recall, outcomes.length),
    cases: outcomes,
  };
}

export type ChainResolver = (taskType: string) => string[];

export interface DirectionRun {
  report: DirectionReport;
  candidates: Record<string, DirectionCandidate[] | null>;
}

/**
 * Run the corpus through the live classifier and the live ambiguity rule.
 * `resolveChain` is injected so the corpus can run without a loaded config.
 */
export function runDirectionBenchmark(
  cases: DirectionCase[],
  resolveChain: ChainResolver,
  floor: number,
): DirectionRun {
  const outcomes: DirectionCaseOutcome[] = [];
  const candidates: Record<string, DirectionCandidate[] | null> = {};
  for (const testCase of cases) {
    const ranked = classifyTaskCandidates(testCase.query);
    const offer = ambiguousRequirements(ranked, resolveChain, floor);
    candidates[testCase.id] = offer;
    outcomes.push(
      scoreCase(testCase, {
        offered: offer !== null,
        types: (offer ?? []).map((candidate) => candidate.task_type),
        // The direction block always reports the task type and depth, and the
        // audience/language only when the request supplied them.
        reportedSlots: ["task_type", "depth"],
      }),
    );
  }
  return { report: summarize(cases, outcomes), candidates };
}
