# AAR — R7 monitoring and watchlist remediation

**Increment:** `docs/plans/2026-11-12-r7-monitoring-watchlist-remediation/` · **Date:** 2026-11-12
**Findings:** F-R7-E-1, F-R7-E-2, F-R7-E-3, F-R7-E-5, F-R7-E-6, F-R7-E-7 · **Gate depth:** standard (cold pass + one diff re-review)
**Plan sha256 (reviewed):** ee1ecc61…b56521 · **Independent review records:** cold pass `/tmp/opencode/r7-monitoring-cold-review.md` sha256 d2ae102a…015f (`FAILED`, 3 Blockers / 4 Majors / 6 Minors / 4 Nits, all resolved); diff re-review `/tmp/opencode/r7-monitoring-diff-rereview.md` sha256 7f38beaa…3fa2 (`passed`, 9/10 reads)

## What happened

The first open roadmap section was R7 monitoring and watchlist remediation, triggered
by R8 closing on 2026-11-10. Two findings were contract gaps the documentation already
described: README promised that monitoring could "baseline, revalidate, and publish a
delta revision", while `monitor-delta` was a pure Markdown diff with no receipt and no
`verify_report`. Four were runner lifecycle defects: an unconditional record overwrite,
a `last_run` that was read but never written, and no assertion for the dry-run or the
per-topic error isolation.

Execution followed the plan's five phases:

1. **Delta library (T2–T6).** `current-drift.md` was cut from `current.md` first and
   proven by the existing test run, then the red tests were added
   (`6 failed | 1 passed`) and the library closed them (`7 passed`). `parseSourceRegister`
   gained an additive `rows` map; `ReportSnapshot` carries sources with grades plus
   revision/supersedes; `changed_sources` and `successionIssues` land in
   `src/lib/report-delta.ts`.
2. **Receipt-backed delta (T7–T10).** The entry point gained the `import.meta.url` guard
   it lacked (without it the new test file would have hit `process.exit(2)` on import —
   cold-review B1), `--receipt`/`--baseline-id`, `parseVerifyReport`,
   `summarizeVerification`, `buildComparison`, `baselineProblems`, and
   `comparisonVerdict`. The verification block drops `age_days`, `stale`, and
   `created_at`; a determinism test proves two different clocks produce identical JSON.
3. **Runner lifecycle (T11–T14b).** `markRun` and `src/lib/watchlist-run.ts` separate
   claims found this run from `retained_claims`, so a failure or an empty result neither
   erases the chain nor restates claims as new, and a genuine removal inside a non-empty
   result is still reported. The CLI was reduced to argument parsing plus the client, and
   a network-free dry-run transcript replaced the untestable entry-point path.
4. **Spec and docs (T15–T21).** REQ-117's opening clause now attaches revalidation to a
   baseline that carries a receipt and requires an unverified marking otherwise
   (cold-review B2); the delta-record sentence carries a SHALL. REQ-125 gained the
   `last_run` persistence, claim-retention, and empty-result clauses. README, worklist,
   roadmap, and CHANGELOG followed.
5. **Gates and close (T22–T24).** Gate suite green before the AAR; full `npm run check`
   run after the terminal token.

## Finding dispositions

| Finding | Severity | Disposition |
|---|---|---|
| F-R7-E-1 receipt baseline | P1 | **Resolved in-session** — `--receipt` revalidates via `verify_report` and refuses an untrusted baseline; a receiptless run is stamped unverified (`scripts/monitor-delta.ts`, `scripts/monitor-delta.test.ts`) |
| F-R7-E-2 source drift | P1 | **Resolved in-session, narrowed** — same-id URL and grade drift in `changed_sources`; hash drift and unverifiable sources come from `verify_report`. The report-level limb exposes counts only (REQ-060i's response shape), so `report_source_drift` is a count and the worklist evidence says so |
| F-R7-E-3 revision/supersedes | P2 | **Resolved in-session** — `baseline_revision`/`current_revision`/`current_supersedes` plus `successionIssues`; `monitor-delta` exits 1 on a violation (`src/lib/report-delta.ts`, `src/monitor-delta.test.ts`) |
| F-R7-E-5 dry-run and isolation | P2 | **Resolved in-session** — injected `callTool`/`now` make both paths assertable; a recorded CLI dry-run transcript covers the entry point (`src/lib/watchlist-run.test.ts`, `tasks.md` T14b) |
| F-R7-E-6 record overwrite | P2 | **Resolved in-session** — found-versus-retained claims, `suspected_empty`, and `effectivePrior` diffing; a failed run keeps the chain and a recovery restates nothing (`src/lib/watchlist-run.ts`) |
| F-R7-E-7 `last_run` | P2 | **Resolved in-session** — `markRun` plus an atomic watchlist rewrite; the runner owns only `last_run` and cron/CI owns the schedule (`src/lib/watchlist.ts`, `src/lib/watchlist-run.ts`) |

## Review loop

- Cold pass (revision 1) returned `independent-review FAILED.` with 3 Blockers,
  4 Majors, 6 Minors, 4 Nits. Every Blocker was real: the entry point could not be
  imported by a test, REQ-117's mandatory-receipt clause contradicted the optional flag,
  and the done bar demanded a grade transition the fixture could not produce.
- Revision 2 returned `independent-review passed.` (9/10 reads) with two bookkeeping
  nits (sentence-count baselines, one stale README line reference) and a provenance nit
  (the prompt's hash predated the last edit). All were applied; no design decision
  changed.
- **Cap recorded and spent:** one cold pass plus one targeted diff re-review. No second
  full pass ran.
- § Review-loop convergence stays on the roadmap: the cap was recorded and this
  increment stopped at it, but the "narrow at the first blocker" bullet was not
  exercised in the way the section describes (the revision fixed all three Blockers
  together). Retiring the section is a user decision, not an agent judgement.

## What went wrong

1. **A plan step claimed a red it did not produce.** `plan.md` T14 said the runner test
   would be red-first because the module did not exist; the module was written first, so
   no such red exists. `tasks.md` records the deviation and points at the T0 static
   proof instead. Lesson: a red-first step must be ordered before the implementation in
   the step list, not only described as red-first in prose.
2. **A local name collided with a new return field.** Adding `rows` to
   `parseSourceRegister` collided with the function's existing `rows` table variable;
   `typecheck` caught it immediately and the map was renamed `gradeRows`. The plan's
   predicate table did not name that variable.
3. **The README word budget was overrun twice.** The first draft put the section at 401
   words (limit 350), the second at 358. The fix was compressing the same paragraph
   rather than trimming unrelated sections; a bounded-prose check belongs in the plan's
   README step, not discovered by the gate.
4. **The plan's determinism claim needed a field the summary did not carry.** The
   claim-count identity check was first written against a field that only existed in
   `main()`; it moved into `VerificationSummary.claim_count` so the pure verdict
   function could assert it. Cheap, but a plan-level API detail that was underspecified.

## What went right

1. **Fixture before red.** `current-drift.md` was cut and proven by the passing suite
   before the red assertions, so the only delta in the red run was the missing API.
2. **Additive parser change.** `parseSourceRegister` kept `sources` untouched and added
   `rows`; both call sites compiled unchanged and the 26 report-contract tests plus 25
   fixture expectations stayed green.
3. **Determinism by construction.** The verification summary is built from a named field
   list, so the clock fields never enter; the test asserts it at the boundary rather than
   trusting the reviewer.
4. **Entry guard before the test.** Adding the `import.meta.url` guard in the same step
   as the parser exports meant `scripts/monitor-delta.test.ts` could import the module
   without terminating the worker.

## Gate evidence (final tree)

| Command | Result |
|---|---|
| `npx vitest run src/monitor-delta.test.ts src/lib/watchlist.test.ts src/lib/watchlist-run.test.ts scripts/monitor-delta.test.ts scripts/monitor-watchlist.test.ts src/report-contract.test.ts` | 6 files, 55 tests passed |
| `npm run typecheck` | clean |
| `npm run typecheck:scripts` | clean |
| `npm run validate-spec` | all checks passed (142 REQs, 127 cited, 0 uncited source files) |
| `npm run validate-readme` | 0 errors |
| `npm run check-roadmap` | OK, 13 sections |
| `npm run check-script-discipline` | 73 TS + 9 shell scripts conform |
| `npx tsx scripts/check-report-fixtures.ts` | 25 fixtures, 0 violations |
| `npm run version-sync` | OK, 2026.11.11 |
| `npm run check-loop-artifacts` | 0 errors, 1 pre-existing warning |
| `npm run check` | **PASS (full, 157.9 s), exit 0** |

## Recommendations

None open. The one narrowing (report-level source drift is count-only because REQ-060i
exposes counts) is a recorded limitation of the tool response, not a defect; widening
it would need a REQ-060i surface change of its own.

LOOP PAUSED
