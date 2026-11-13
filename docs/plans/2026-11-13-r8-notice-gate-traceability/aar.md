# AAR — R8 notice and gate-traceability evidence

**Date:** 2026-11-13 · **Plan:** `plan.md` (revision 6, stamped) · **Status:** gates green, closing

## What happened

Closed two R8 findings that shared one shape — a REQ clause implemented but
only partially observed by a gate.

- **F-R8-C-1.** `src/dispatch-orchestration.test.ts` now drives a real provider
  cooldown through the tool boundary: a loopback 429 cools the primary, the
  fallback serves, and the successful response carries one bounded
  `provider_cooldown` notice naming the provider and its remaining window. A
  pre-cooldown control call and a stub request delta keep the causal claim
  honest; a following `inspect_providers` call proves the notice is not
  search-specific. Mutation of the `collectNotices` cooldown loop fails it
  (`expected [] to have a length of 1`).
- **F-R8-D-1.** The §E check moved to `scripts/lib/security-model.ts`
  (15 fixtures, one per branch). It fails on a missing appendix, a missing
  OWASP heading, an unreferenced §4.11 REQ, a missing or unmapped category
  row, an out-of-standard category code, and a §4.11 REQ with no §9.5 row or
  no gate. Scope is the §4.11 body headings; gates come only from §9.5. The
  end-to-end red path was exercised through `validate-spec` on an emptied gate
  cell.

Both findings are `Resolved 2026-11-13` in the sweep register; `ROADMAP.md`
§ R8 notice and gate-traceability evidence is retired and folded into
`CHANGELOG.md`.

## What went right

- The spawned-server harness already had a `rate_limited` stub mode, so the
  notice test needed no new fixture machinery and reused the existing
  `a.requests` delta guard.
- The pure-module seam made every gate branch negatively testable; all 15
  fixtures passed on the first run.
- The plan's mutation checks were the right size: both failed for the intended
  reason and both restored to the same `sha256`.

## What went wrong

- **The cold pass was expensive and did not converge.** Stages 1–4 drove four
  revisions (a duplicated §E.5 table was dropped; the security-REQ scope moved
  from a constant to the §4.11 body; check 4 was restored to its existing
  reference assertion after being over-tightened). Stage 5 returned NO-GO
  twice on consistency defects, the review cap was reached, and the user
  approved revision 6 without a third audit. The residual risk was recorded.
- **Plan-text anchors drifted repeatedly.** Several line references were wrong
  on the first write and were corrected only by cold review; the execution
  steps then used the corrected set. Two execution-time reads still refined
  them (`injectNotices` spans `:172-200`, not `:172-192`).
- **The commit-msg hook rejected the first commit-2 subject** (73 > 72
  characters); the subject was shortened and the commit re-made.

## Findings

| ID | Severity | Disposition |
|---|---|---|
| P3 — cold pass ran five stages and capped | P3 | record-and-close; the cap is now recorded in the plan and here |
| P3 — plan anchors needed several corrections | P3 | record-and-close; execution used the corrected anchors and `tasks.md` carries them |
| P3 — commit subject length limit is enforced at 72 | P3 | record-and-close; no action needed |

No P0 or P1 findings. Nothing to schedule on `ROADMAP.md`.

## Review cap

One cold pass at standard depth plus at most one targeted diff re-review. Stage
5 failed twice; the run stopped at the cap and the user approved revision 6
as-is (`Risk accepted`, stamp condition C-6). Retiring `ROADMAP.md` §
Review-loop convergence remains a user decision.

## Roadmap dispositions

- `ROADMAP.md` § Review-loop convergence — **stays**: the cap is recorded, but
  retiring the section is a user decision (same precedent as
  `docs/plans/2026-11-12-r8-update-preservation-evidence/aar.md:55-61`).
- `ROADMAP.md` § Hermetic test option forwarding — **stays**: the trigger is
  “the next increment that touches the hermetic harness”; this increment edits
  the test that consumes the harness, and `setup()` is unchanged, so the
  trigger did not fire. No `setup()` option was dropped.

## Gate results

| Gate | Result |
|---|---|
| `npx vitest run src/dispatch-orchestration.test.ts` | 23 passed |
| `npx vitest run scripts/lib/security-model.test.ts` | 15 passed |
| `npm run typecheck` / `typecheck:scripts` | exit 0 |
| `npm run validate-spec` | exit 0 (mutation → 1 error, restored) |
| `npm run check-gate-coverage` | exit 0 (118 G1: 117 cited, 1 exempt, 0 waived) |
| `npm run check-script-discipline` | exit 0 (76 TS + 9 shell) |
| `npm run check-non-goals` / `check-roadmap` | exit 0 |
| `npm run version-sync` | exit 0 |
| `npm run test` | 124 files / 1469 tests passed |
| `npm run check-loop-artifacts` | 0 errors, 1 pre-existing warning |
| `npm run check` | **exit 0**, `gates: PASS (full, 164.8s)` |

LOOP PAUSED
