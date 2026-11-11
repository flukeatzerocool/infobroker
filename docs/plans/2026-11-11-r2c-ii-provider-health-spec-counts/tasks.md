# Tasks — R2c-ii provider health and spec counts

**Status:** executed 2026-11-11 (plan revision 2a)
**Plan:** `plan.md` in this directory
**Findings:** F-R2-22, F-R2-23, F-R2-24 → `Resolved`; R2c-i DB-3 deferral

## Phase 0 — Discovery and frozen observations (no edits)

- [x] 0.1 Baseline confirmed: `git log -1` = `48ae564`; `npm run status` (24
      roadmap items, 69 unpushed, oldest 42.4 h); `npm run check:fast` PASS
      (20 gates, 20.5 s).
- [x] 0.2 P1-P8 re-confirmed against the current tree; a mismatch stops the
      increment.
- [x] 0.3 Pre-change matrix recorded (red or regression-evidence with reason):
      - [x] disabled provider health row (expect: `inactive`, no reason field);
            `wikipedia` ships `enabled: true`, so flipping it to `false` in the
            isolated copy is a real state change;
      - [x] `total_requests_served` after two known tool calls (expect: provider
            sample count, not 2);
      - [x] REQ-013 legs through the stub (active/degraded/inactive).
- [x] 0.4 Stub pattern proven feasible: `node:http` on `127.0.0.1:0`,
      `INFOBROKER_SEARXNG_URL` set in the child env, real URL env deleted from
      the test env, no external request; a bind-then-close socket supplies the
      provably closed port for the `inactive` leg.
- [x] 0.5 Surface probe: new test-file `@implements` citations for
      `check-gate-coverage` / `check-intent-citations`;
      `src/tool-surface.test.ts`, `src/structured-output.test.ts`, and
      `debate-club/src/mcp-contract.test.ts` re-confirmed not to pin the health
      field set.
- [x] 0.6 Sibling-REQ sweep: REQs citing REQ-024b/REQ-024c, README `:287-292`
      and `:389-393`, `skills/infobroker/**`.
- [x] 0.7 REQ-024b and REQ-024c bodies measured before the amend (baseline:
      254 / 473 characters); amended wording counted against Appendix B.
- [x] 0.8 `DECISIONS.md` highest ID confirmed `D-102`; D-103–D-105 allocated.
- [x] 0.9 `git check-ignore` exits 1 for the increment directory.

## Phase 1 — Additive modules and failing evidence

- [x] 1.1 `src/provider-history.ts` created (record success/error, read, reset
      seam); `src/index.ts` writes routed through it; suite green.
- [x] 1.2 `src/provider-health.ts` created (`assembleHealthReport`);
      `doProviderHealth` calls it; suite green.
- [x] 1.3 `src/provider-status.ts`: `isOperational` exported, `operational`
      added to `ProviderAssessment`; `src/tool-metrics.ts`: `totalCalls()`.
- [x] 1.4 `src/lib/stub-provider.ts` written (loopback SearXNG-shaped stub:
      200 with one result, 404, closed port) and the hermetic-config helper
      (searxng enabled, every dispatch chain pinned to searxng, all other
      providers disabled).
- [x] 1.5 Unit tests written: `src/provider-history.test.ts`,
      `src/provider-health.test.ts`, `src/tool-metrics.test.ts` (`totalCalls`),
      `src/provider-status.test.ts` (operational cases).
- [x] 1.6 `src/provider-health-action.test.ts` written (spawned): disabled
      provider, served-request count, stub round-trips, three probe legs.
- [x] 1.7 Pre-fix results recorded in this file: DB-1 red, DB-3 red, DB-2 and
      DB-4 green as regression evidence with the reason recorded (C-1).

## Phase 2 — Fix

- [x] 2.1 `doProviderHealth`: probe eligibility from `isOperational`; skip the
      probe when non-operational; pass `probeStatus` into `providerStatusInput`;
      build the report through `assembleHealthReport`.
- [x] 2.2 `doSpecHealth`: `total_requests_served: toolMetrics.totalCalls()`.
- [x] 2.3 `src/types.ts`: `HealthReport.inactive_reason?`.
- [x] 2.4 Touched suites re-run; every red case passes; regression evidence
      stays green.

## Phase 3 — Spec, verification, documentation

- [x] 3.1 `infobroker.md`: REQ-024b (disabled-provider clause, "since server
      start") and REQ-024c (tool-request wording) amended; clause tags added
      (C-5); bodies re-measured.
- [x] 3.2 Blast-radius audit: `git diff --stat`, `git status --porcelain`
      against § Blast radius (DB-8, C-3).
- [x] 3.3 Targeted suites, then `npm run typecheck`, `npm run validate-spec`,
      `npm run check-gate-coverage`, `npm run check-intent-citations`.
- [x] 3.4 README audit; edit only on a demonstrated contradiction;
      `npm run validate-readme`.
- [x] 3.5 `DECISIONS.md`: D-103, D-104, D-105.
- [x] 3.6 `CHANGELOG.md`: one entry under the current section.
- [x] 3.7 `ROADMAP.md`: retire § R2c-ii; `npm run check-roadmap` and
      `npm run check-non-goals`.
- [x] 3.8 `docs/plans/2026-11-09-full-review-sweep/worklist.md`: rows
      638/639/640 resolved with refreshed anchors;
      rows 169/170 corrected.
- [x] 3.9 `aar.md`: DB-to-evidence table, findings register, LOOP token;
      this file fully ticked.
- [x] 3.10 Final `npm run check` and `npm run check-loop-artifacts`.

## Phase 4 — Commit series

- [x] 4.1 **Spec, source, tests.** `infobroker.md`, the six production files,
      the six test files; gate `typecheck`, `validate-spec`, targeted suites.
- [x] 4.2 **Documentation and record.** `README.md` (if changed),
      `DECISIONS.md`, `CHANGELOG.md`, `ROADMAP.md`,
      `docs/plans/2026-11-09-full-review-sweep/worklist.md`, this
      directory; gate `npm run check`.

## Deviations

- **DB-3 call arithmetic (plan revision 2a said 3; executed as 4).** Phase A's
  `spec` call is itself the third tool request, so the phase-B search is the
  fourth and the second `spec` observes `4`, not `3`. The done-bar intent is
  unchanged and still proven: one provider sample moved the served count by
  exactly one tool request. No scope or risk change; recorded here and in the
  AAR instead of amending the stamped plan.
- **`src/config.ts` gained `isOperational`** as planned (D-5); `providerUsable`
  delegates to it and the frozen truth table is untouched.
