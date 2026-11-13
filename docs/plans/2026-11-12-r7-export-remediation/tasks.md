# Tasks — R7 export evidence remediation

Plan: `plan.md`. Status legend: `pending`, `in-progress`, `done`, `blocked`.

| # | Task | Status |
|---|---|---|
| T0 | Record baseline (status, `npm run check`, invalid-export probe, repeat probe) | done |
| T1 | Create `tasks.md` and `aar.md` seeded `LOOP OPEN` | done |
| T2 | Red: refusal test for the three exports on `bad-confidence.md` | done |
| T3 | Implement `ExportOptions`, `ReportExportError`, `ensureValidated` | done |
| T4 | CLI: pass `{ skipValidation: !validate }`; map the refusal to exit 1; capture both transcripts | done |
| T5 | Add `scripts/render-report.test.ts` (no-flag exit 1, skip exit 0, good exit 0) | done |
| T6 | typecheck + vitest for both files green | done |
| T7 | Repeat-and-compare determinism assertion | done |
| T8 | Mutation check in place with backup/restore | done |
| T9 | Three named REQ-126 clause tags | done |
| T10 | Worklist: REQ-126 row + `F-R7-F-1`/`F-R7-F-2` register rows | done |
| T11 | Remove § R7 export remediation from `ROADMAP.md` | done |
| T12 | CHANGELOG section under `2026.11.11` | done |
| T13 | `DECISIONS.md` entry (D-110) | done |
| T14 | Gate set: `validate-spec`, `check-roadmap`, `version-sync`, `check-script-discipline`, `typecheck:scripts`, `check-loop-artifacts` | done |
| T15 | AAR rewrite with terminal token; `npm run session:close` | done |
| T16 | `check-loop-artifacts`, then full `npm run check` on the final tree | done |

## Baseline capture

Recorded at T0.

- `npm run status`: version 2026.11.11, latest tag `v2026.11.07`, 148 unpushed
  commits, oldest 3.1 d, 9 open roadmap items.
- `npm run check`: FAIL at gate 21 of 22, `check-loop-artifacts` only — the
  increment directory was created mid-run, so the gate saw it without
  `tasks.md`/`aar.md`. Every earlier gate passed (121 test files / 1438 tests,
  `test-push-pipeline`, `check-pack`, `test-debate-club` 8 files / 61 tests,
  `audit` 4 low-severity advisories, under the high/critical threshold).
  `typecheck:scripts` did not run (stop at first failure).
- Re-run after T1: `npm run check-loop-artifacts` → PASS, 0 errors, 1
  pre-existing warning (`2026-11-10-r6-encryption-capacity-remediation` has no
  `**Done bar:**` line; not this increment's).
- Probe, `bad-confidence.md`: `validateReport` → `ok: false`, 12 error codes;
  `reportToJson` still returns a manifest and 10 sections, both CSVs return 2
  rows. The F-R7-F-2 predicate is reproduced.
- Probe, `good-report.md`: two `reportToJson` calls → byte-identical JSON. The
  current code is deterministic; F-R7-F-1 is a coverage gap.

## Red/green transcript

### T2 — red (before the implementation)

```
FAIL src/lib/report-export.test.ts > refuses a JSON export of a report that fails validation
AssertionError: expected [Function] to throw an error
FAIL src/lib/report-export.test.ts > refuses a Source Register CSV export …
FAIL src/lib/report-export.test.ts > refuses a claims CSV export …
Tests  3 failed | 2 passed (5)
```

All three exports returned data for the invalid report — the finding's predicate.

### T4 — CLI transcripts (after the implementation)

```
$ npx tsx scripts/render-report.ts --report test-fixtures/reports/bad-confidence.md --format json
exit=1
ERROR [manifest-as-of] report-manifest.as_of must be an ISO date (YYYY-MM-DD)
ERROR [manifest-handling-required] report-manifest.handling is required
ERROR [manifest-confidence] report-manifest.claims[0].confidence must be one of High, Medium, Low

$ npx tsx scripts/render-report.ts --report test-fixtures/reports/bad-confidence.md --format json --no-validate
exit=0
{
  "manifest": {
    "shape": "Fact-Check",

$ npx tsx scripts/render-report.ts --report test-fixtures/reports/good-report.md --format csv
exit=0
```

### T6/T7 — green

`npx vitest run src/lib/report-export.test.ts scripts/render-report.test.ts` →
2 files / 10 passed. `npm run typecheck` and `npm run typecheck:scripts` → exit 0.

### T8 — mutation check bites

Backup `src/lib/report-export.ts` to `/tmp/opencode/report-export.bak.ts`, inject
`stamp: Date.now()` into `reportToJson`'s return in place, run the suite:

```
FAIL src/lib/report-export.test.ts > is deterministic across repeated calls
AssertionError: expected '{"stamp":1794530514602,…}' to be '{"stamp":1794530514601,…}'
Tests  1 failed | 7 passed (8)
```

Restore from the backup: `grep -c stamp` → 0, suite → 8 passed. The pre-change
code was already deterministic; the finding was coverage, as recorded in C-3.

## Step-to-evidence table

| Step | Files | Command | Result |
|---|---|---|---|
| T2 | `src/lib/report-export.test.ts` | `npx vitest run src/lib/report-export.test.ts` | FAIL, 3 refusal tests red |
| T3 | `src/lib/report-export.ts` | `npx vitest run src/lib/report-export.test.ts` | PASS, 7 tests |
| T4 | `scripts/render-report.ts` | CLI transcripts above | exit 1 invalid, 0 with `--no-validate`, 0 valid |
| T5 | `scripts/render-report.test.ts` | `npx vitest run scripts/render-report.test.ts` | PASS, 3 tests |
| T6 | module, script, tests | `npm run typecheck`; `npm run typecheck:scripts` | exit 0 |
| T7 | `src/lib/report-export.test.ts` | `npx vitest run src/lib/report-export.test.ts` | PASS, 8 tests |
| T8 | module (restored) | mutated run, then restore + rerun | mutation FAIL → restored PASS |
| T9 | `src/lib/report-export.test.ts` | `npm run validate-spec` | all checks passed |
| T10 | `docs/plans/…/worklist.md` | `grep -rn "F-R7-F-"` | rows updated |
| T11 | `ROADMAP.md` | `npm run check-roadmap` | OK, 9 sections |
| T12 | `CHANGELOG.md` | `npm run version-sync` | OK |
| T13 | `DECISIONS.md` | `npm run validate-spec` | all checks passed |
| T14 | docs + tests | gate set in the plan | all green |
| T16 | whole tree | `npm run check` | see AAR |
