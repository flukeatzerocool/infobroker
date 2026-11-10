# AAR — Full-review sweep, chunk R8 (deployment, state, security)

**Date:** 2026-11-10 · **Depth:** deep · **Outcome:** closed
**Plan:** `plan.md` (self pass + independent cold pass, 5/5 stages, report bound to sha `608e3a78…`)
**Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md`
**Next trigger:** R9

## What was done

1. **Baseline repaired.** `npm run check` was red at the `test` gate: `split_commit_series` timed out at 5565 ms against vitest's 5000 ms default in a loaded full-suite run while passing in isolation, and the same run's gates were green on a repeat. Raised `testTimeout`/`hookTimeout` to 30 s in `vitest.config.ts` as its own commit (`db4ee99`), verified with two full-suite runs plus a verbose run (target test 2354 ms).
2. **Phase 1 enumeration.** 90 distinct anchors (17 in `src/index.ts`, 10 in `src/config.ts`); probe-dependent clusters B and C only → **split not triggered**. Recorded in `phase1-enumeration.md`.
3. **Committed probe harness.** `probe.ts` spawns the real server over stdio with its own `TMPDIR`/`HOME`/`XDG_*`, a copied `config.json`, cleared `INFOBROKER_CONFIG_LOCAL`, and a pre-leg root assertion. 14 legs, all PASS; transcript in `probe-log.md`.
4. **15 REQ verdicts, 20 prose rows.** 10 REQs `holds`, 4 findings, 1 `holds` with a live `NOT_RUN` leg (REQ-091). Register rows appended; tracker corrected.
5. **Dispositions.** 1 P1 and 4 P2s scheduled on `ROADMAP.md`; 2 P3s closed; 1 D77 note.

## What went right

- The cold pass earned its cost: it caught a split mapping that would have deferred a cluster's own probe leg, an inverted update-check safety rationale, and a vacuous probe sub-case before any of them reached a register.
- The probe harness made `probe:` predicates repeatable; every one resolves to a leg.
- Isolation held: no probe touched the real config, KB, quota, audit, or key paths.

## What went wrong

- **Baseline evidence was thin at plan time.** EV1 came from one failing run; the first execution run passed. The repair is still right (an 11% margin on a shell-out is not a stable pass), but the plan should have recorded two runs before calling it a red baseline.
- **Plan-gate binding churned.** Three post-verdict wording edits moved the plan hash, so `mark-build` refused until the report was re-bound. The lesson: freeze wording before the readiness pass, or batch all post-verdict fixes into one re-bind.
- **Two probe assertions were wrong on the first run** (wrong envelope path for `state_health`), which produced two false `fail` legs before correction. A probe must print the envelope on mismatch, not one field.

## Findings and dispositions

| ID | Severity | Disposition |
|---|---|---|
| F-R8-A-1 | P1 | `Scheduled-roadmap` — R8 update-preservation evidence |
| F-R8-C-1 | P2 | `Scheduled-roadmap` — R8 notice and gate-traceability evidence |
| F-R8-D-1 | P2 | `Scheduled-roadmap` — same item |
| F-R8-F-1 | P2 | `Scheduled-roadmap` — R8 state-hardening evidence |
| F-R8-F-2 | P2 | `Scheduled-roadmap` — same item |
| F-R8-F-3 | P3 | `Closed-P3` (D77 note: error-code taxonomy is R1's) |
| F-R8-Z-1 | P3 | Resolved in-session (tracker corrections) |

D77 cross-chunk notes: the confinement refusal's `internal_error` code (REQ-002/R1) and the R6-owned store-format behavior were not filed as R8 findings.

## Gate evidence

| Gate | Result |
|---|---|
| `npm run check` (pre-close, un-piped) | PASS (full) |
| `npm run check:fast` | PASS (fast, 19.1 s) |
| Carrying tests | 15 files / 163 tests PASS |
| `npm run test-debate-club` | 3 files / 37 tests PASS |
| `npm run test` after repair | 1101/1101 ×2, verbose 1101/1101 |
| Probe legs | 14/14 PASS |
| Tracker/roadmap gates | `check-loop-artifacts`, `check-roadmap`, `validate-spec` PASS |

## Recommendations

- None outside `ROADMAP.md`; the five scheduled items are the remediation surface.

LOOP PAUSED
