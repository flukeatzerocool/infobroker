// @implements REQ-117
// report-delta.ts — deterministic, offline comparison of two report manifests
// (REQ-117). Pure functions; no filesystem or network access.
//
// Exit-code contract is owned by `scripts/monitor-delta.ts`.

import { extractManifest, parseSourceRegister, validateReport, type ManifestClaim } from "./report-manifest.js";

export interface ReportDelta {
  baseline: string;
  current: string;
  new_claims: string[];
  changed_claims: Array<{ claim: string; changed: string[] }>;
  removed_claims: string[];
  new_sources: string[];
  removed_sources: string[];
}

export interface ReportSnapshot {
  claims: ManifestClaim[];
  sources: string[];
}

export function readSnapshot(path: string, text: string): ReportSnapshot {
  const validation = validateReport(text);
  if (!validation.ok) {
    const first = validation.findings.find((finding) => finding.level === "error");
    throw new Error(`${path}: ${first?.message ?? "invalid report"}`);
  }
  const manifest = extractManifest(text);
  if (!manifest.ok) throw new Error(`${path}: ${manifest.message}`);
  return {
    claims: manifest.value.claims ?? [],
    sources: [...parseSourceRegister(text).sources.keys()].sort(),
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

export function diffReports(baseline: ReportSnapshot, current: ReportSnapshot): Omit<ReportDelta, "baseline" | "current"> {
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

  const beforeSources = new Set(baseline.sources);
  const afterSources = new Set(current.sources);
  return {
    new_claims: newClaims.sort(),
    changed_claims: changed.sort((a, b) => a.claim.localeCompare(b.claim)),
    removed_claims: removedClaims.sort(),
    new_sources: [...afterSources].filter((id) => !beforeSources.has(id)).sort(),
    removed_sources: [...beforeSources].filter((id) => !afterSources.has(id)).sort(),
  };
}
