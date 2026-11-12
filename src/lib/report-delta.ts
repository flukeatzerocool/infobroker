// @implements REQ-117
// report-delta.ts — deterministic, offline comparison of two report manifests
// (REQ-117). Pure functions; no filesystem or network access.
//
// Exit-code contract is owned by `scripts/monitor-delta.ts`.

import { extractManifest, parseSourceRegister, validateReport, type ManifestClaim } from "./report-manifest.js";

export interface SourceRow {
  id: string;
  url: string;
  reliability?: string;
  credibility?: string;
}

export interface ReportDelta {
  baseline: string;
  current: string;
  new_claims: string[];
  changed_claims: Array<{ claim: string; changed: string[] }>;
  removed_claims: string[];
  new_sources: string[];
  /** Same source id, different URL or grade (REQ-117 source drift). */
  changed_sources: Array<{ id: string; changed: string[] }>;
  removed_sources: string[];
  baseline_revision: number | null;
  current_revision: number | null;
  current_supersedes: string | null;
}

export interface ReportSnapshot {
  claims: ManifestClaim[];
  sources: SourceRow[];
  revision?: number;
  supersedes?: string;
}

export interface SuccessionIssue {
  code: "revision-not-incremented" | "supersedes-mismatch";
  message: string;
}

export function readSnapshot(path: string, text: string): ReportSnapshot {
  const validation = validateReport(text);
  if (!validation.ok) {
    const first = validation.findings.find((finding) => finding.level === "error");
    throw new Error(`${path}: ${first?.message ?? "invalid report"}`);
  }
  const manifest = extractManifest(text);
  if (!manifest.ok) throw new Error(`${path}: ${manifest.message}`);
  const register = parseSourceRegister(text);
  return {
    claims: manifest.value.claims ?? [],
    sources: [...register.rows.entries()]
      .map(([id, row]) => ({ id, ...row }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    ...(manifest.value.revision !== undefined ? { revision: manifest.value.revision } : {}),
    ...(manifest.value.supersedes !== undefined ? { supersedes: manifest.value.supersedes } : {}),
  };
}

function claimKey(claim: ManifestClaim): string {
  return claim.claim.trim().toLowerCase();
}

function changedFields(before: ManifestClaim, after: ManifestClaim): string[] {
  const fields: string[] = [];
  for (const key of ["verdict", "confidence", "likelihood"] as const) {
    if ((before[key] ?? "") !== (after[key] ?? "")) {
      fields.push(`${key}: ${before[key] ?? "none"} → ${after[key] ?? "none"}`);
    }
  }
  const beforeSources = [...(before.sources ?? [])].sort().join(",");
  const afterSources = [...(after.sources ?? [])].sort().join(",");
  if (beforeSources !== afterSources) {
    fields.push(`sources: ${beforeSources || "none"} → ${afterSources || "none"}`);
  }
  return fields;
}

/** A stable field order keeps the output byte-identical across runs. */
function changedSourceFields(before: SourceRow, after: SourceRow): string[] {
  const fields: string[] = [];
  if (before.url !== after.url) fields.push(`url: ${before.url} → ${after.url}`);
  for (const key of ["reliability", "credibility"] as const) {
    if ((before[key] ?? "") !== (after[key] ?? "")) {
      fields.push(`${key}: ${before[key] ?? "none"} → ${after[key] ?? "none"}`);
    }
  }
  return fields;
}

export function diffReports(
  baseline: ReportSnapshot,
  current: ReportSnapshot
): Omit<ReportDelta, "baseline" | "current"> {
  const beforeMap = new Map(baseline.claims.map((claim) => [claimKey(claim), claim]));
  const afterMap = new Map(current.claims.map((claim) => [claimKey(claim), claim]));

  const newClaims: string[] = [];
  const changed: ReportDelta["changed_claims"] = [];
  for (const [key, claim] of afterMap) {
    const prior = beforeMap.get(key);
    if (prior === undefined) {
      newClaims.push(claim.claim);
      continue;
    }
    const fields = changedFields(prior, claim);
    if (fields.length > 0) changed.push({ claim: claim.claim, changed: fields });
  }
  const removedClaims = [...beforeMap.entries()]
    .filter(([key]) => !afterMap.has(key))
    .map(([, claim]) => claim.claim);

  const beforeSources = new Map(baseline.sources.map((source) => [source.id, source]));
  const afterSources = new Map(current.sources.map((source) => [source.id, source]));
  const changedSources: ReportDelta["changed_sources"] = [];
  for (const [id, source] of afterSources) {
    const prior = beforeSources.get(id);
    if (prior === undefined) continue;
    const fields = changedSourceFields(prior, source);
    if (fields.length > 0) changedSources.push({ id, changed: fields });
  }
  return {
    new_claims: newClaims.sort(),
    changed_claims: changed.sort((a, b) => a.claim.localeCompare(b.claim)),
    removed_claims: removedClaims.sort(),
    new_sources: [...afterSources.keys()].filter((id) => !beforeSources.has(id)).sort(),
    changed_sources: changedSources.sort((a, b) => a.id.localeCompare(b.id)),
    removed_sources: [...beforeSources.keys()].filter((id) => !afterSources.has(id)).sort(),
    baseline_revision: baseline.revision ?? null,
    current_revision: current.revision ?? null,
    current_supersedes: current.supersedes ?? null,
  };
}

/**
 * REQ-117 revision/supersession contract: a changed report must increment its
 * revision, and a report that names a superseded baseline must name this one.
 */
export function successionIssues(
  delta: Omit<ReportDelta, "baseline" | "current">,
  baselineId?: string
): SuccessionIssue[] {
  const issues: SuccessionIssue[] = [];
  const changed =
    delta.new_claims.length > 0 ||
    delta.changed_claims.length > 0 ||
    delta.removed_claims.length > 0 ||
    delta.new_sources.length > 0 ||
    delta.changed_sources.length > 0 ||
    delta.removed_sources.length > 0;
  const bumped =
    delta.current_revision !== null &&
    delta.baseline_revision !== null &&
    delta.current_revision > delta.baseline_revision;
  if (changed && !bumped) {
    issues.push({
      code: "revision-not-incremented",
      message:
        `revision-not-incremented: the report changed but revision stayed ` +
        `${delta.current_revision ?? "unset"} (baseline ${delta.baseline_revision ?? "unset"})`,
    });
  }
  if (baselineId !== undefined && delta.current_supersedes !== baselineId) {
    issues.push({
      code: "supersedes-mismatch",
      message:
        `supersedes-mismatch: the report names ${delta.current_supersedes ?? "no baseline"} ` +
        `but the compared baseline is ${baselineId}`,
    });
  }
  return issues;
}
