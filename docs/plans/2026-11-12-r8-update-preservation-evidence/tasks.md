# Tasks — R8 update-preservation evidence

**Date:** 2026-11-12 · **Plan:** `plan.md` · **Status:** awaiting approval

## Phase 0 — Scaffold and baseline

- [x] T0. Increment dir created: `tasks.md` and `aar.md` (seeded `LOOP OPEN`).
- [x] T1. Baseline recorded (below): `npm run status`, both gate runs, predicate reads.

### T0 baseline

- `npm run status` → version 2026.11.11 (latest tag `v2026.11.07`), 153 unpushed commits, oldest 3.1 d, 8 open roadmap items.
- `npm run check:fast` → PASS, 19 gates, 28.1 s (run before the increment directory existed).
- `npm run check` → PASS, 22 gates, 157.8 s (run after T0; `check-loop-artifacts` 0 errors, one pre-existing warning for `2026-11-10-r6-encryption-capacity-remediation`).
- Predicate reads: `src/config.ts:108-122,263,1077`; `src/kb.ts:334,489,891,939`; `src/quota.ts:22-27,130,220,231`; `src/clause-coverage.ts:19,23,89-102`; no update-simulation test exists.

## Phase 1 — The simulated-update test (F-R8-A-1)

- [x] T2. `src/update-preservation.test.ts` written (6 assertions, `@implements REQ-043`).
- [x] T3. First run: 5 passed, 1 failed — assertion 4 compared stored text to `BODY`, but ingestion stores the chunk title-prefixed (`Update survival: The reservoir…`). Fixed to `toContain(BODY)`; rerun 6/6 PASS. No fallback needed: **T3a** the stage-3 KB reopen worked; **T3b** the fake-timer quota write landed.
- [x] T4. Mutation checks (backup `/tmp/opencode/update-preservation.bak.ts`, sha256 `20a4b4ca…1e53`, restored byte-identical):
  - KB path moved under `install/` → assertions **4 and 6** failed (`expected null not to be null`; `[Array(4)]` vs three shipped files). Matches the plan.
  - `xdg/` deleted before stage 3 → assertions **1, 2, 3 and 4** failed (`expected 50000 to be 4321`; drift `null`; `ENOENT` on the layer; KB `null`). The plan expected 1–3; 4 also fails because the KB path came from the layer. Recorded as an evidence refinement, not a design change.
- [x] T5. `npm run typecheck` PASS; `npx vitest run src/update-preservation.test.ts src/config.test.ts src/quota.test.ts src/kb.test.ts` → 4 files / 156 tests PASS.

### T3/T4 evidence

- `npx vitest run src/update-preservation.test.ts` → 6/6 PASS (374 ms).
- Mutation 1 → 2 failed | 4 passed. Mutation 2 → 4 failed | 2 passed. Restored file hash equals the backup.
- `git status --porcelain` after restore → only the new test file and the plan directory (no stray mutation).

## Phase 2 — Bookkeeping

- [x] T6. `worklist.md` rows `:472`, `:492`, `:875` resolved; `:547` G1 bullet updated; stale `:74`→`:76`; `F-R2-4` cross-notes at `:146` and `:620`.
- [x] T7. `D-111` recorded (highest id was D-110).
- [x] T8. CHANGELOG section added as the top `2026.11.11` section.
- [x] T9. `validate-spec` and `check-gate-coverage` PASS; roadmap section removed after them; `check-roadmap` PASS.

## Phase 3 — Gates and close

- [x] T10. `check-roadmap`, `version-sync`, `test` (123 files / 1453 tests), `check-shipped-kb-empty`, `check-loop-artifacts` → PASS.
- [x] T11. `aar.md` rewritten with dispositions, review cap, and `LOOP PAUSED`; `npm run session:close` run.
- [x] T12. `npm run check` → **exit 0**, `gates: PASS (full, 158.2 s)`; log `/tmp/opencode/r8-check-final.log`.
- [x] T13. T12 exit recorded here and in `aar.md`; increment docs committed.
- [x] T14. `npm run check:fast` on the committed tree → **exit 0**, `gates: PASS (fast, 25.3 s)`.
