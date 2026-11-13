# AAR — R8 state-hardening evidence

**Date:** 2026-11-13 · **Plan:** `plan.md` (revision 2b) · **Status:** closed
**Done bar:** met — F-R8-F-1 and F-R8-F-2 read `Resolved 2026-11-13` with
file:line evidence, every guard has a failing mutation, and the full suite is
green.

## What happened

1. **Plan.** Selected `ROADMAP.md` § R8 state-hardening evidence (first open
   section). Baseline: `npm run check` PASS, 22 gates, 165.2 s, HEAD `fc6228c`.
   Self-review corrected the revision-1 read-test design before review: the
   shared `resetKeyPoolStateForTests()` seam seeds an empty in-memory state, so
   the planned read tests would have been vacuous; they now use a fresh module
   instance.
2. **Cold pass** (standard depth, fresh reviewer): `plan.cold/report.md` —
   NO-GO, 1 Blocker (done bar demanded a quota mutation no step performed and
   no target declared), 2 Majors (commit-1 ordering; "asserts both halves"
   overstated), 6 Minors. Revision 2 resolved all of them.
3. **Diff re-review:** `plan.cold/06-rereview.md` —
   `independent-review passed.`, no new Blocker/Major; one deferred Major
   (`src/kb.ts` used as a mutation target but undeclared).
4. **Amendment 2b** (condition-only): declared `src/kb.ts` mutation-only, added
   the `git status` confirmation to T9, corrected two `src/quota.ts` spans,
   split the Predecessor line.
5. **Gate binding.** The plan gate requires the passing report to carry
   `Plan sha256: <current hash>`. Amendment 2b changed the hash, so the passing
   report no longer bound; two further bounded checks were run
   (`07-rebind.md` and the amendment check) and two citation nits they raised
   were fixed and re-bound.
6. **Execution.** T2–T14 completed with the planned commit series:
   `e9e3cc7` (spec), `30f4f40` (key-pool), `d911bc3` (kb test), `8453a2b`
   (D-113), `a265bdf` (worklist), `5e3059d` (changelog), `94fc2ac` (roadmap).
   T17–T19 close the increment with the eighth commit.

## What went right

- The fail-before step did its job: with the tests added and the guard absent,
  the read test failed exactly as predicted (`expected 'k2' to be 'k1'`), so
  the later green run is evidence rather than coincidence.
- All four mutations (key-pool read guard, key-pool write compare, quota read
  compare, `resolveKeyFile`'s `mkdirSync`) failed the test that covers them and
  each file was restored byte-identically (`sha256sum` match; `git status`
  showed no `src/quota.ts` or `src/kb.ts` change).
- The cold pass earned its cost: it found a genuinely unsatisfiable done bar
  and an overstatement in the evidence claim that the self pass missed.
- No production regression: 124 files / 1473 tests pass; the only behaviour
  change is the key-pool read guard.

## What went wrong

- **Review churn.** The recorded cap was one cold pass plus one diff
  re-review; execution needed four reviewer dispatches (cold, diff re-review,
  amendment binding, citation re-bind). The last two were forced by the plan
  gate binding `Plan sha256` to the report, not by new substantive findings.
  This is an instance of the open `ROADMAP.md` § Review-loop convergence item
  (cap recorded inside the plan vs. gate mechanics outside it); it is cited
  there, not re-filed.
- **Commit-msg hook.** The first commit subject was 77 characters and was
  rejected (`max 72`); shortened on the second attempt. Trivial, but the plan's
  commit series did not state the subject limit.
- **Plan citation slop.** `plan.cold/07-rebind.md` flagged one remaining
  cosmetic span (`loadQuotaState` guard `:130-136` vs the real `:131-137`).
  Left as-is: it is outside the amended text and does not affect a decision.

## Findings

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| F-R8F-1 | P3 | Revision-1 read tests would have been vacuous (shared seam seeds state) | Resolved in-session before review: fresh-module helper; the vacuous malformed-state test was moved onto that path |
| F-R8F-2 | P3 | Review cap exceeded by gate-binding mechanics (4 dispatches) | Closed as informational; instance of open `ROADMAP.md` § Review-loop convergence |
| F-R8F-3 | P3 | Commit subject exceeded the 72-character hook limit | Resolved in-session (shortened); noted for the next plan's commit series |
| F-R8F-4 | P3 | `plan.md` retains one cosmetic line-span nit | Closed as informational (`07-rebind.md`) |
| — | — | Quota **write** refusal not separately asserted | Named residual (D-113); routes through the same `ensureDir()` the read test exercises |

No P0, P1, or P2 findings.

## Gates

| Gate | Result |
|---|---|
| `npx vitest run src/key-pool.test.ts` (fail-before) | 1 failed / 16 passed — read test red as designed |
| `npx vitest run src/key-pool.test.ts src/quota.test.ts` | 30 passed |
| `npx vitest run src/kb-encryption-tools.test.ts` | 10 passed |
| `npm run typecheck` (T7, T10) | exit 0 |
| `npm run validate-spec` (T2, T14) | exit 0 |
| `npm run check-gate-coverage` (T14) | exit 0 — 118 G1 REQs: 117 cited, 1 exempt |
| `npm run version-sync` (T13, T15) | exit 0 |
| `npm run check-roadmap` (T14, T15) | exit 0 |
| `npm run test` (T15) | exit 0 — 124 files / 1473 tests |
| `npm run check-loop-artifacts` (T15) | exit 0, one pre-existing warning |
| `npm run check-shipped-kb-empty` (T15) | exit 0 |
| `npm run check` (T17) | **exit 0** — `gates: PASS (full, 164.9 s)` |
| `npm run check:fast` (T19) | recorded in `tasks.md` after the run |

## Review cap (recorded)

One cold pass, one diff re-review, plus two bounded binding checks required by
the plan gate. No finding was re-litigated; each pass's findings are in
`plan.cold/`. At the cap no item remained unresolved.

LOOP PAUSED
