# Tasks — R7 monitoring and watchlist remediation

**Plan:** `plan.md` (sha256 `ee1ecc61…b56521`, plan gate `passed`, fresh, standard)
**Finding set:** F-R7-E-1, F-R7-E-2, F-R7-E-3, F-R7-E-5, F-R7-E-6, F-R7-E-7
**Done bar:** see `plan.md` § Done bar (items 1–7).

## T0 — Baseline (recorded before any edit)

**Tree:** `HEAD` `ec7d337`, clean apart from this increment directory.

**`npm run status`**

```
version: 2026.11.11 (latest tag v2026.11.07)
unpushed commits: 124, oldest 3.0 d
last pipeline run: 2026-11-07
open roadmap: 13 item(s)
```

**`npm run check`** → `gates: PASS (full, 155.8s)`, `gates: recorded full run for
ec7d33797c60`, exit 0. Sub-results: `vitest` 119 files / 1408 tests;
`test-debate-club` 8 files / 61 tests; `check-pack` 370 files; `check-gate-table`
22 gates; `check-gate-coverage` 118 G1 (117 cited, 1 exempt); `check-report-fixtures`
25 fixtures / 0 violations.

**Targeted pre-change tests** → `npx vitest run src/monitor-delta.test.ts
src/lib/watchlist.test.ts scripts/monitor-watchlist.test.ts` → 3 files, 9 tests
passed (exit 0).

**Fixture-gate scope:** `scripts/check-report-fixtures.ts:56` uses
`readdirSync(FIXTURES).filter(file => file.endsWith(".md"))` — non-recursive, so
`test-fixtures/reports/delta/` stays outside that gate and the new
`current-drift.md` is exercised by vitest only.

**Static red proofs (behavior gaps with no executable red available):**

- E-6: `writeFileSync(recordPath, …)` at `scripts/monitor-watchlist.ts:160` runs
  unconditionally after the `try`/`catch`; `previousClaims` feeds only the delta, so
  an error or empty run replaces the stored claim set.
- E-7: `grep -rn "last_run" src scripts --include=*.ts` (excluding tests) returns only
  reads — `src/lib/watchlist.ts:10,41,42` and the usage string at
  `scripts/monitor-watchlist.ts:25`. No writer exists.

**Expected red for this directory:** `npm run check-loop-artifacts` reports
`missing tasks.md` / `missing aar.md` until T1 lands. Gate run after T1 is the
first meaningful one.

## Steps

| # | Step | Status |
|---|---|---|
| T0 | Record baseline (above) | done |
| T1 | Create `tasks.md`, seed `aar.md` with `LOOP OPEN` | done |
| T2 | Add `test-fixtures/reports/delta/current-drift.md` (S1 URL moved, Reliability A→B, Evidence bullet follows) | pending |
| T3 | Red: extend `src/monitor-delta.test.ts` (changed_sources, revisions, succession); record failure | pending |
| T4 | `parseSourceRegister` additive `rows` map | pending |
| T5 | `report-delta.ts`: SourceRow, snapshot + delta fields, `successionIssues` | pending |
| T6 | Delta tests green; record red→green | pending |
| T7 | `monitor-delta`: entry guard, `--receipt`, `--baseline-id`, `parseVerifyReport` | pending |
| T8 | Deterministic verification block + `buildComparison` + receiptless marker | pending |
| T9 | Text output, `comparisonVerdict`, header/usage exit contract | pending |
| T10 | `scripts/monitor-delta.test.ts` (parser, verdicts, drift URL, determinism) | pending |
| T11 | `markRun` in `src/lib/watchlist.ts` + test | pending |
| T12 | `src/lib/watchlist-run.ts` (selection, dry-run, isolation, retention, write-back) | pending |
| T13 | Slim `scripts/monitor-watchlist.ts` to arg/IO shell | pending |
| T14 | `src/lib/watchlist-run.test.ts` (dry-run, isolation, retention, removal, write-back) | pending |
| T14b | Network-free CLI dry-run transcript | pending |
| T15 | REQ-117 amendment | pending |
| T16 | REQ-125 additions | pending |
| T17 | Clause tags; `validate-spec` | pending |
| T18 | README monitoring paragraph | pending |
| T19 | Worklist dispositions | pending |
| T20 | Roadmap section removal | pending |
| T21 | CHANGELOG section | pending |
| T22 | Gate suite on the working tree | pending |
| T23 | AAR with terminal token; `session:close` | pending |
| T24 | `check-loop-artifacts` + full `npm run check` | pending |

## Evidence log

- **T1:** `npm run check-loop-artifacts` → 0 errors after `tasks.md`/`aar.md` landed (one
  pre-existing warning for the r6 encryption increment).
- **T3 (red):** `npx vitest run src/monitor-delta.test.ts` → `Tests 6 failed | 1 passed (7)`,
  `TypeError: successionIssues is not a function` / missing `changed_sources`,
  `baseline_revision`, `current_revision`, `current_supersedes`.
- **T6 (green):** same command → `Tests 7 passed (7)`. `npx vitest run
  src/report-contract.test.ts` → 26 passed; `npx tsx scripts/check-report-fixtures.ts`
  → 25 fixtures, 0 violations (no regression from the additive register field).
- **T9/CLI:** `npx tsx scripts/monitor-delta.ts --baseline …/baseline.md --current
  …/current.md` → exit 0, prints `baseline_verified: false`, `revision: 1 → 2`,
  `supersedes: report://baseline`, `changed sources: 0`. `--baseline
  …/current.md --current …/current-drift.md` → exit 1 with
  `revision-not-incremented: the report changed but revision stayed 2 (baseline 2)`.
- **T10:** `npx vitest run scripts/monitor-delta.test.ts` → 9 passed. `npm run
  typecheck:scripts` → clean.
- **T14:** `npx vitest run src/lib/watchlist-run.test.ts` → 5 passed. Note: the module
  was written before the test, so no module-missing red was recorded; the behavior
  red evidence remains the T0 static proof. Honest deviation from `plan.md` T14.
- **T14b:** temp watchlist `{"topics":[{"id":"a","query":"q","interval_hours":1}]}`
  → `monitor-watchlist --dry-run` printed `a`, exit 0, `ls -A` showed only
  `w.json` (no out-directory) and the watchlist file was byte-identical after the run.
- **T15/T16:** `npm run validate-spec` → all checks passed (142 REQs, 127 cited,
  0 uncited source files), no Appendix B violation; bodies measure 654 and 697 chars.
- **T18:** `npm run validate-readme` → 0 errors. Two overruns on the way (401 words,
  then 358 against a 350 limit) were fixed by compressing the same paragraph rather
  than trimming unrelated sections.
- **T19/T20:** `grep -c "Resolved 2026-11-12" worklist.md` → 28 rows;
  `npm run check-roadmap` → OK, 13 sections.
- **T21:** `npm run version-sync` → OK, 2026.11.11.
- **T22:** `npx vitest run <five changed test files + report-contract>` → 6 files /
  55 tests passed; `typecheck`, `typecheck:scripts`, `check-script-discipline`
  (73 TS + 9 shell), `check-report-fixtures` (25/0) all clean.
- **T23:** `npm run check-loop-artifacts` → 0 errors, 1 pre-existing warning;
  `npm run session:close` → `gates: PASS (fast, 27.1s)`.
- **T24:** `npm run check` → `gates: PASS (full, 157.9s)`, exit 0 (run recorded as
  dirty-tree, so the pre-push hook will repeat it). Full log:
  `/tmp/opencode/final-check.log`.
