# AAR — R6 ledger and receipt remediation

**Date:** 2026-11-10 · **Plan:** `docs/plans/2026-11-10-r6-ledger-receipt-remediation/plan.md` (sha `822ca895…`) · **Roadmap item:** retired

## What happened

1. `verify_claims` now persists every finding: the URL-bearing-source filter in the ledger mapping is gone, so a batch claim no provider could corroborate becomes a claim record with no source edges (F-R6-F-1, REQ-109).
2. A claim source's retrieval time moved inside the sealed edge payload; the clear `claim_sources.retrieved_at` column holds an empty placeholder, the read path falls back to the column for rows written by the earlier build, and `resealAll` carries the fallback into the payload and blanks the column inside the REQ-086 transition (F-R6-F-2, REQ-109).
3. `buildReceiptManifest` takes the ingest instant and stamps every source with no caller `retrieved_at`, so the canonical manifest always carries a retrieval time; provenance stays visible through `hash_basis: "snippet"` (F-R6-F-4, REQ-110).
4. Added `debate-club/src/kb-ledger.test.ts` (unsourced batch finding reaches `action: claims`), two `src/kb-claims.test.ts` cases (at-rest sealing and the legacy-value transition scrub), and a `src/kb-report-receipt.test.ts` case (snippet-source stamp).
5. Retired the roadmap section (22 → 21 items), marked all three findings `Resolved`, refreshed the REQ-109/REQ-110 evidence rows, recorded D-096 for the residual, and added the CHANGELOG entry.

## What went right

- The cold pass stopped a bad plan: it caught that the Arena step named a `task_type` input `verify_claims` does not have, and that the original init-time scrub was an unversioned store migration REQ-108 would require a backup and status event for. The revision replaced both before any code existed.
- The transition-only design fell out of existing structure: `resealAll` already deletes and reinserts every edge row, so sealing the timestamp needed no new migration, marker, or format bump.
- The Arena test needed no new fixtures: `duckduckgo` is a builtin provider with no fixture host, so the replay's synthetic 599 produces the source-less batch finding the finding register described.
- All four behavior changes were proven by a mutation that failed its intended assertion and was reverted.

## What went wrong

- `plan-gate mark-build` refused with "independent-review report is not bound to this plan": the cold report recorded the plan hash at review time, and the five Minor/Nit folds changed the bytes afterwards. Resolved by recording the binding line plus an explicit note that the delta is exactly the reviewer's own closing findings; the plan was re-stamped.
- The first `docs` commit subject (`test(kb): assert unsourced persistence, sealed timestamps, and receipt stamps`, 77 characters) and the first docs-commit subject (`docs(kb): resolve the R6 ledger and receipt findings and retire the section`, 75 characters) were both rejected by the `commit-msg` hook (72-character limit); both were shortened and re-committed with identical content. The plan's commit list named the longer subjects.
- The first `check:fast` run failed on `check-loop-artifacts` because `aar.md` did not exist yet; expected, and the gate passes once this file is present.

## Findings register

| ID | Severity | Disposition |
|---|---|---|
| A-1 — plan's Arena step named a nonexistent `verify_claims` input; init-time scrub was an unversioned migration | P2 | Resolved in-session — cold pass finding, plan revised and re-stamped before execution |
| A-2 — cold report was not bound to the final plan hash after the Minor/Nit folds | P3 | Closed-P3 — binding line and note recorded, plan re-stamped |
| A-3 — test commit subject exceeded the 72-character hook limit | P3 | Closed-P3 — subject shortened; no content change |
| A-4 — an unattributed claim in single-query mode never becomes a finding (`src/corroborate.ts:770`), so F-R6-F-1's fix covers batch mode by construction | P3 | Closed-P3 — recorded in D1 and the AAR; no behavior change intended or implied |
| A-5 — an already-encrypted store that is never transitioned keeps the legacy clear retrieval time | P2 | Resolved as a recorded decision — D-096 names the transition remediation and records the residual |

## Gate evidence

| Gate | Result |
|---|---|
| `npm run check:fast` (pre-plan baseline) | PASS (19 gates, 22.2 s) |
| `npm run test` (pre-edit) | PASS — 108 files, 1149 tests |
| `npm run test-debate-club` (pre-edit) | PASS — 7 files, 58 tests |
| `npm run validate-spec` | PASS (pre-edit; 142 REQs, 127 cited, 0 errors) |
| `npm run check-intent-citations` | PASS (141 citations, 0 findings) |
| `npm run check-tdqs` | PASS (7 tools, 0 violations) |
| `npm run typecheck` | PASS after every source edit and after each commit |
| `npx vitest run src/kb-claims.test.ts src/kb-report-receipt.test.ts` | PASS — 51 tests |
| `cd debate-club && npx vitest run src/kb-ledger.test.ts` | PASS — 1 test |
| `npm run test` (post-edit) | PASS — 108 files, 1152 tests |
| `npm run test-debate-club` (post-edit) | PASS — 8 files, 59 tests |
| Mutation evidence | 4/4 mutations failed the intended assertions and were reverted |
| `npm run check:fast` (final tree) | PASS — 19 gates |
| `npm run check` (final tree) | PASS — full gate suite |

## Recommendations

- None beyond the scheduled roadmap items. The next section by the roadmap ordering rule is § R6 dedup false-positive bound, whose trigger is a collapsed document or more than 10% collapse on the seeded corpus — it does not fire on a clean run, so the next item is chosen by its own trigger.

## Commits

- `0856cf7` `fix(kb): persist unsourced findings and seal the ledger retrieval time`
- `6484c00` `fix(kb): stamp receipt source retrieval time at ingest`
- `87749f8` `test(kb): assert unsourced persistence and sealed retrieval times`
- This record update, committed as `docs(kb): resolve the R6 ledger and receipt findings`.

LOOP PAUSED
