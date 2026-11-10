# AAR — R6 auto-index, collection-scoping, and expiry test evidence

**Date:** 2026-11-10 · **Plan:** `plan.md` (approved, `plan-review passed.`, cold pass fresh)
**Done bar:** F-R6-B-1/2/3 `Resolved`, mutation coupling recorded, section retired (25 → 24), gates green, increment record complete. **Met.**

## What happened

1. Confirmed the baseline (`f4ce094`, `check:fast` PASS, tree clean) and the R7 trigger.
2. Ran the plan gate: cold pass FAILED on the first revision (1 Blocker, 4 Majors), all fixed; diff re-review passed with four author amendments recorded as C-3.
3. Added four test surfaces: `src/kb-auto-index.test.ts` (4), three REQ-066 expiry tests in `src/kb-hardening.test.ts`, a rewritten REQ-065 precedence test in `src/kb.test.ts`, and `debate-club/src/kb-auto-index.test.ts` (3).
4. Recorded fail-under-mutation evidence for each finding (five mutations, each restored; `git diff --stat -- src/kb.ts` empty after every restore).
5. Marked the three worklist rows `Resolved` (and refreshed the three REQ evidence rows that claimed the gaps still existed), retired the roadmap section, and wrote the increment record.

## What went right

- The tests-only premise held: every new assertion passed on the shipped tree, so no production defect surfaced (C-1 did not fire).
- The cold pass caught a real done-bar defect: the B-2 coupling proof mutated the test fixture rather than `resolveCollection`, which would have made the bar unsatisfiable.
- Fake timers worked with `node:sqlite` (`vi.setSystemTime` + `advanceTimersByTime`), so the interval test needs no real sleep and no SQL backdating.
- The Arena hooks all fired on the first run with the pinned `content_policy.mode: "off"`; the replay fixtures needed no additions.

## What went wrong

- The first plan revision asserted "every earlier chunk is closed" against 25 open roadmap items, conflating sweep chunks with roadmap sections. Fixed with the R7 closure citation and explicit wording.
- The interval-removal step initially advanced 60 s while the short tier's expiry was one hour, so the tick would have removed nothing. Caught by the re-reviewer as deferred and fixed before execution (sub-minute `expiry_hours: 0.001`).
- The build-review independence artifact initially pointed at the plan rather than a reviewer report; the report was persisted and the stamp re-issued before the first edit.
- `check:fast` initially failed on this record's missing `aar.md` — expected sequencing, resolved by writing this file before the final gate run.

## Findings register

| Finding | Disposition |
|---|---|
| F-R6-B-1 (auto-index unobserved) | Resolved in-session — unit seam tests + three Arena hook tests; toggle guard mutation fails 2 tests. |
| F-R6-B-2 (config tier indistinguishable) | Resolved in-session — `config-col` + empty-string literal tier; config-tier mutation fails 1 test. |
| F-R6-B-3 (expiry unasserted) | Resolved in-session — startup, interval, tier-vs-`source_type`, indefinite, no-error-event; three mutations fail the corresponding tests. |
| Cold-pass blocker (fixture mutation) | Resolved before execution. |
| Cold-pass majors (trigger evidence, registry path, policy pin, unit fixture) | Resolved before execution. |
| Post-review amendments C-3 | Verified by build-review: sub-minute expiry, `npm audit` probe, sweep wording, third B-3 mutation. |
| `search_web collection` does not scope its auto-index target | Informational (P3) — the schema documents `collection` as recall-only; the Arena test passes no collection and does not pin the contested case. No action. |
| Interval test depends on fake timers advancing `Date` | Closed — verified in practice; documented in D4. |

## Evidence

| Command | Result |
|---|---|
| `npx vitest run src/kb-auto-index.test.ts` | 4 passed |
| `npx vitest run src/kb-hardening.test.ts` | 11 passed |
| `npx vitest run src/kb.test.ts` | 28 passed |
| `npm run test-debate-club` | 6 files / 51 tests passed; `tsc` exit 0 |
| B-1 toggle mutation | 2 failed (`expected [ { … } ] to have a length of +0 but got 1`) |
| B-2 config-tier mutation | 1 failed (`expected 'default' to be 'config-col'`) |
| B-3 startup mutation | 2 failed (`expected { title: 'short' … } to be null`) |
| B-3 interval mutation | 1 failed (`expected { title: 'tick' … } to be null`) |
| B-3 predicate mutation | 3 failed (both tier tests + corrupt-metadata isolation) |
| `npm run check:fast` | PASS (final tree) |
| `npm run check` | PASS (22 gates, final tree) |

## Recommendations

None beyond the roadmap. The remaining R6 sections (config/dedup/report, retrieval, encryption/capacity, ledger/receipt) are already scheduled; the informational `search_web collection` ambiguity is recorded here and needs no roadmap item.

LOOP PAUSED
