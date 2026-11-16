// @implements REQ-131 REQ-131a
// direction.ts — the §1 direction function: the requirement the server derived
// for a search request, and which of its values it chose rather than received.
// Kept pure so the shape is unit-testable without a provider or a network.

/**
 * Audience values accepted for a report-shaped request. The report quality
 * standard (`skills/infobroker/references/report-template.md`) owns this list
 * and REQ-114 rejects any other value at report time; this constant mirrors it
 * so the server can reject the value at the edge instead (REQ-131a).
 */
export const REPORT_AUDIENCES = [
  "executive",
  "analyst",
  "engineer",
  "policy",
  "legal",
  "journalist",
  "investor",
] as const;

export type ReportAudience = (typeof REPORT_AUDIENCES)[number];

/** How far the request asked the server to read. */
export type DirectionDepth = "results" | "deep" | "research";

/** A requirement the server could execute, offered when two are equally supported. */
export interface DirectionCandidate {
  task_type: string;
  providers: string[];
}

export interface DirectionRequest {
  taskType: string;
  taskTypeOverride?: string;
  audience?: string;
  language?: string;
  maxResults: number;
  deep: boolean;
  research: boolean;
  providers: string[];
  /** REQ-131: two candidate requirements, when the request was deferred. */
  ambiguousCandidates?: DirectionCandidate[];
}

export interface Direction {
  task_type: string;
  task_type_source: "supplied" | "inferred";
  max_results: number;
  depth: DirectionDepth;
  providers_considered: string[];
  audience?: string;
  language?: string;
  /** Values the server chose rather than received (REQ-131). */
  inferred: string[];
  /** Present only when the search was deferred for a choice (REQ-131). */
  ambiguous?: boolean;
  candidates?: DirectionCandidate[];
}

export function isReportAudience(value: string): value is ReportAudience {
  return (REPORT_AUDIENCES as readonly string[]).includes(value);
}

export function buildDirection(input: DirectionRequest): Direction {
  const inferred: string[] = [];
  if (!input.taskTypeOverride) inferred.push("task_type");
  const depth: DirectionDepth = input.research ? "research" : input.deep ? "deep" : "results";
  const candidates = input.ambiguousCandidates;
  const ambiguous = candidates !== undefined && candidates.length > 1;
  return {
    // A deferred request has no executed task type; naming the winner would
    // misreport a search the server did not perform (REQ-131).
    task_type: ambiguous ? "undetermined" : input.taskType,
    task_type_source: input.taskTypeOverride ? "supplied" : "inferred",
    max_results: input.maxResults,
    depth,
    providers_considered: [...input.providers],
    ...(input.audience ? { audience: input.audience } : {}),
    ...(input.language ? { language: input.language } : {}),
    inferred,
    ...(ambiguous ? { ambiguous: true, candidates } : {}),
  };
}

/**
 * REQ-131: the candidate requirements, when two classification results are
 * equally supported and would reach different sources. A single winner, a tie
 * between two types served by the same chain, or a type with no usable provider
 * is not an ambiguity a caller should be asked about.
 */
export function ambiguousRequirements(
  candidates: ReadonlyArray<{ taskType: string; score: number }>,
  resolveChain: (taskType: string) => string[],
  floor: number,
): DirectionCandidate[] | null {
  const eligible = candidates.filter((candidate) => candidate.score >= floor);
  const [first, second] = eligible;
  if (!first || !second || first.score !== second.score) return null;
  const firstChain = resolveChain(first.taskType);
  const secondChain = resolveChain(second.taskType);
  if (firstChain.length === 0 || secondChain.length === 0) return null;
  if (firstChain.join(",") === secondChain.join(",")) return null;
  return [
    { task_type: first.taskType, providers: firstChain },
    { task_type: second.taskType, providers: secondChain },
  ];
}
