#!/usr/bin/env npx tsx
// monitor-delta.test.ts — regression tests for the receipt-backed delta entry
// point (REQ-117): envelope classification, baseline refusals, the revision
// contract, and the deterministic verification subset.
//
// Role: test (run by `npm run test`). Exit codes are vitest's.

// @implements REQ-117 verified-baseline
// @implements REQ-117 baseline-unverified
// @implements REQ-117 unverifiable-sources

import { describe, it, expect } from "vitest";
import {
  parseVerifyReport,
  summarizeVerification,
  buildComparison,
  comparisonVerdict,
  baselineProblems,
  type VerificationSummary,
} from "./monitor-delta.js";
import type { ReportSnapshot } from "../src/lib/report-delta.js";

const VERIFICATION_ENVELOPE = `[OK] ${JSON.stringify({
  status: "ok",
  provider: "knowledge_base",
  results: [
    {
      state: "verified",
      digest_match: true,
      digest_sha256: "a".repeat(64),
      report: "verified",
      report_id: "report://baseline",
      content_sha256: "b".repeat(64),
      revision: 1,
      supersedes: undefined,
      created_at: "2026-10-26T00:00:00.000Z",
      age_days: 12,
      stale: false,
      claims: 2,
      sources: {
        total: 2,
        verified: 1,
        drift: 1,
        unverifiable: 1,
        details: [
          { claim_index: 0, url: "https://example.com/two", state: "drift", hash_basis: "document" },
          { claim_index: 1, url: "https://example.com/three", state: "unverifiable", hash_basis: "snippet" },
        ],
      },
      report_sources: { total: 2, verified: 2, drift: 0, unverifiable: 0 },
    },
  ],
  meta: { network: false },
})}`;

const SNAPSHOT: ReportSnapshot = {
  claims: [{ claim: "claim one" }, { claim: "claim two" }],
  sources: [{ id: "S1", url: "https://example.com/one" }],
  revision: 1,
};

function verifiedSummary(): VerificationSummary {
  const parsed = parseVerifyReport(VERIFICATION_ENVELOPE);
  if (!parsed.ok) throw new Error(parsed.error);
  return summarizeVerification(parsed.verification);
}

describe("monitor-delta verification envelope (REQ-117)", () => {
  it("maps a successful verify_report envelope to its result", () => {
    const parsed = parseVerifyReport(VERIFICATION_ENVELOPE);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.verification["state"]).toBe("verified");
  });

  it("treats an [ERROR] body and a non-JSON body as a failed baseline", () => {
    const failed = parseVerifyReport('[ERROR] {"code":"receipt_not_found"}');
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.error).toContain("receipt_not_found");
    expect(parseVerifyReport("not json").ok).toBe(false);
    expect(parseVerifyReport('[OK] {"status":"ok","results":[]}').ok).toBe(false);
  });
});

describe("monitor-delta baseline refusals (REQ-117 verified-baseline)", () => {
  it("refuses a digest mismatch, an unverified report, and a claim-count mismatch", () => {
    const summary = verifiedSummary();
    expect(baselineProblems(summary, 2)).toEqual([]);
    expect(baselineProblems({ ...summary, digest_match: false }, 2)[0]).toMatch(/baseline-digest-mismatch/);
    expect(baselineProblems({ ...summary, report: "drift" }, 2)[0]).toMatch(/baseline-report-drift/);
    expect(baselineProblems(summary, 3)[0]).toMatch(/baseline-claim-count-mismatch/);
  });

  it("does not refuse a receiptless comparison but marks it unverified", () => {
    const comparison = buildComparison(SNAPSHOT, SNAPSHOT, { baseline: "base.md", current: "next.md" });
    expect(comparison.baseline_verified).toBe(false);
    expect(comparison.baseline_unverified).toMatch(/not revalidated/);
    expect(comparisonVerdict(comparison).exit).toBe(0);
  });

  it("marks a receipted comparison verified and carries the drift lists", () => {
    const summary = verifiedSummary();
    const comparison = buildComparison(SNAPSHOT, SNAPSHOT, {
      baseline: "base.md",
      current: "next.md",
      verification: summary,
    });
    expect(comparison.baseline_verified).toBe(true);
    expect(comparison.verification?.source_drift).toEqual(["https://example.com/two"]);
    expect(comparison.verification?.unverifiable_sources).toEqual(["https://example.com/three"]);
    expect(comparison.verification?.report_source_drift).toEqual({ total: 2, drift: 0, unverifiable: 0 });
    expect(comparisonVerdict(comparison, { verification: summary, claimCount: 2 }).exit).toBe(0);
  });

  it("exits 1 on a refused baseline even when the diff itself is clean", () => {
    const summary = { ...verifiedSummary(), digest_match: false };
    const verdict = comparisonVerdict(buildComparison(SNAPSHOT, SNAPSHOT, { baseline: "b.md", current: "c.md" }), {
      verification: summary,
      claimCount: 2,
    });
    expect(verdict.exit).toBe(1);
    expect(verdict.problems.join(" ")).toMatch(/baseline-digest-mismatch/);
  });
});

describe("monitor-delta revision contract (REQ-117)", () => {
  it("exits 1 when a changed report did not bump its revision", () => {
    const next: ReportSnapshot = { ...SNAPSHOT, claims: [...SNAPSHOT.claims, { claim: "claim three" }] };
    const verdict = comparisonVerdict({
      ...buildComparison(SNAPSHOT, next, { baseline: "base.md", current: "next.md" }),
    });
    expect(verdict.exit).toBe(1);
    expect(verdict.problems.join(" ")).toMatch(/revision-not-incremented/);
  });

  it("exits 1 when the report supersedes a different baseline", () => {
    const next: ReportSnapshot = { ...SNAPSHOT, revision: 2, supersedes: "report://other" };
    const verdict = comparisonVerdict(
      { ...buildComparison(SNAPSHOT, next, { baseline: "base.md", current: "next.md" }) },
      { baselineId: "report://baseline" }
    );
    expect(verdict.problems.join(" ")).toMatch(/supersedes-mismatch/);
  });
});

describe("monitor-delta determinism (REQ-117)", () => {
  it("drops clock-derived fields so two runs are byte-identical", () => {
    const parsedA = parseVerifyReport(VERIFICATION_ENVELOPE);
    if (!parsedA.ok) throw new Error(parsedA.error);
    const shifted = { ...parsedA.verification, age_days: 99, stale: true, created_at: "2027-01-01T00:00:00.000Z" };
    const a = buildComparison(SNAPSHOT, SNAPSHOT, {
      baseline: "base.md",
      current: "next.md",
      verification: summarizeVerification(parsedA.verification),
    });
    const b = buildComparison(SNAPSHOT, SNAPSHOT, {
      baseline: "base.md",
      current: "next.md",
      verification: summarizeVerification(shifted),
    });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(JSON.stringify(a)).not.toMatch(/age_days|stale|created_at/);
  });
});
