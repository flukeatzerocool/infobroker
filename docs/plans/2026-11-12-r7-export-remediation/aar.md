# AAR — R7 export evidence remediation

**Date:** 2026-11-12 · **Plan:** `plan.md` · **Status:** closed

## Findings in scope

- **F-R7-F-1** (P2) — export determinism was never asserted by a repeat-and-compare
  test (`src/lib/report-export.test.ts:9-26`).
- **F-R7-F-2** (P2) — the library exports discarded `validateReport().ok`, and
  `reportToSourcesCsv` never validated (`src/lib/report-export.ts:33-67`).

Both are `Resolved 2026-11-12` in the sweep register with file:line evidence.

## What went right

- The two findings were independent enough to split cleanly: enforcement in
  Phase 1, determinism coverage in Phase 2, bookkeeping in Phase 3. No step had
  to be re-ordered.
- The red at T2 was real and named all three exports, so the fix targeted the
  exact predicate the finding described rather than the CLI, which already
  complied.
- `validateReport` is pure and takes the same in-memory string as the CLI
  pre-check, so adding the library gate could not change output. Verified
  byte-identity for the skip path before declaring done.
- The cold review caught two plan defects before execution: a false uniqueness
  claim about open roadmap triggers, and a mutation harness that could not have
  run (a `/tmp` copy is never imported by the test). Both were fixed in the plan;
  neither surfaced during execution.
- The mutation check worked on the first attempt: an in-place `Date.now()` made
  the determinism test fail, and the backup/restore left the module exactly as
  the Phase 1 commit intended.

## What went wrong

- The baseline `npm run check` failed on `check-loop-artifacts` because the
  increment directory was created while the run was in flight. The red was an
  artifact of ordering, not of the tree; it cost one full gate run to explain.
  The next increment should create `tasks.md`/`aar.md` before starting the
  baseline, or accept the run starting after the directory exists.
- Writing the refusal tests first with a bare `.toThrow()` and tightening to
  `ReportExportError` after implementation meant the test file was edited twice.
  The red evidence was cleaner for it, but a single pass with the typed
  assertion written against a to-be-added export would have needed a
  module-link failure as its red, which is noisier; the two-step form was the
  better trade and is recorded here rather than rediscovered.

## Findings and dispositions

| Finding | Severity | Disposition |
|---|---|---|
| F-R7-F-1 — determinism unasserted | P2 | **Resolved in-session** — repeat-and-compare test, mutation-verified |
| F-R7-F-2 — exports ignore `ok` / one never validates | P2 | **Resolved in-session** — default validation, typed `ReportExportError`, explicit `skipValidation`, CLI exit-1 mapping |
| Cold-review Major 1 — false "only open gate" claim | plan defect | **Resolved before execution** — rationale rewritten to file-order selection |
| Cold-review Major 2 — unusable mutation harness | plan defect | **Resolved before execution** — in-place backup/restore method specified |
| Cold-review Minors/Nits (9) | plan clarity | **Resolved before execution** — all applied in revision 2 |
| `F-R7-F-4` (`worklist.md:873`, Closed-P3) — render-report CLI flags untested | P3 | **Partly retired, not reopened** — `scripts/render-report.test.ts` now covers the validation flags; the register row stays Closed-P3 and this AAR records the overlap |
| D-110 duplicate validation (CLI pre-check + export check) | informational | **Closed as by-design** — pure, bounded, and recorded in D-110 |

No new P0 or P1 was found during execution. No roadmap item was created; the
roadmap section this increment closes was removed, leaving nine sections.

## Review-loop cap

One cold pass at standard depth was spent before execution (5/5 stages, 0
Blockers / 2 Majors / 4 Minors / 5 Nits, all fixed), plus the one permitted
targeted diff re-review after the revision (7/10 reads, report
`/tmp/opencode/r7-export-diff-review.md`, sha256 `a19a9ae4…b0587`,
`independent-review passed.`). The re-review confirmed F1–F11 addressed and the
approved scope unchanged, and raised five residuals that are informational
against an already-executed plan:

| Residual | Disposition |
|---|---|
| N1 — the verification table still says "scratch-copy run" though T8 now runs in place | **Closed as informational (P3)** — the step text and AAR record the actual method; editing the plan now would break its stamped hash binding |
| N2 — a `Date.now()`-only mutation can land in the same millisecond | **Closed as informational (P3)** — the executed mutation did fail (2 ms apart, transcript in `tasks.md`) |
| N3–N5 — T0/T1 status wording in the plan, F1 line numbers shifted by the roadmap removal, F7's AAR note not listed in T15 | **Closed as informational (P3)** — all three are addressed in this AAR and `tasks.md` |

At the cap nothing was escalated: no blocker survived either pass.

## Gates

- `npm run validate-spec` → all checks passed (142 REQs, 127 cited).
- `npm run check-roadmap` → OK, 9 sections.
- `npm run version-sync` → OK.
- `npm run check-script-discipline` → 74 TS + 9 shell scripts conform.
- `npm run check-report-fixtures` → 25 fixtures, 0 violations.
- `npm run check-loop-artifacts` → 0 errors, 1 pre-existing warning outside
  this increment.
- `npx vitest run src/lib/report-export.test.ts scripts/render-report.test.ts` →
  2 files / 10 tests passed.
- `npm run typecheck`, `npm run typecheck:scripts` → exit 0.
- `npm run check` → see "Final tree" below.

## Final tree

- `npm run check` → **PASS (full, 158.3 s)**, all 22 gates, on the final tree
  with the AAR carrying `LOOP PAUSED`. `test` → 122 test files passed;
  `test-debate-club` → 8 files / 61 tests; `check-pack` → OK (373 files);
  `audit` → 5 vulnerabilities (4 low, 1 moderate), below the high/critical
  failure threshold (REQ-101). The moderate advisory is a registry-side change
  since the T0 run, which reported 4 low; no manifest or lockfile changed in
  this increment, so it is informational and outside this plan.
- `npm run session:close` → `gates: PASS (fast, 25.2 s)`; the full suite above
  is the recorded authority because the tree is intentionally left dirty for
  the split-commit series.

## Loop status

LOOP PAUSED
