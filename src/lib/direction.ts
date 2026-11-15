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

export interface DirectionRequest {
  taskType: string;
  taskTypeOverride?: string;
  audience?: string;
  language?: string;
  maxResults: number;
  deep: boolean;
  research: boolean;
  providers: string[];
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
}

export function isReportAudience(value: string): value is ReportAudience {
  return (REPORT_AUDIENCES as readonly string[]).includes(value);
}

export function buildDirection(input: DirectionRequest): Direction {
  const inferred: string[] = [];
  if (!input.taskTypeOverride) inferred.push("task_type");
  const depth: DirectionDepth = input.research ? "research" : input.deep ? "deep" : "results";
  return {
    task_type: input.taskType,
    task_type_source: input.taskTypeOverride ? "supplied" : "inferred",
    max_results: input.maxResults,
    depth,
    providers_considered: [...input.providers],
    ...(input.audience ? { audience: input.audience } : {}),
    ...(input.language ? { language: input.language } : {}),
    inferred,
  };
}
