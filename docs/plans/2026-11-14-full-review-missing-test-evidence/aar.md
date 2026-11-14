# AAR — Close the full-review register's pure evidence rows

**Date:** 2026-11-14 · **Plan:** `plan.md` revision 3 · **Roadmap item:** `ROADMAP.md` § Missing test evidence across R4–R6 (kept, reduced)
**Review cap:** 2; used 2 passes

## What happened

1. Drafted the plan, then ran the plan gate: one cold pass (fresh context) and one diff re-review (fresh context).
2. The cold pass returned **FAILED** with 7 Majors and 0 Blockers; revision 2 applied all seven. The diff re-review found three still-open Majors (`tasks.md` had not been updated) and one new Major; revision 3 rewrote `tasks.md` and fixed the plan nits. The standard-depth cap allows one diff re-review, so revision 3 was not re-read; the residual is recorded as condition C-4 on the stamp.
3. Executed the census in `tasks.md`: 22 rows re-located and re-adjudicated. Two were already covered by the 2026-11-14 confidence increment, three are blocked by the hermetic harness, one needs a spawned-server suite, one needs a reduced-heap process.
4. Added driving tests and tags in seven commits plus one defect fix.

## What went right

- Step 0's re-verification paid for itself three times: `F-R5-B-4`/`F-R5-B-5` were already asserted, `F-R5-D-5` was asserted by value, and `F-R4-C-3`'s page cap already had a driving test.
- Every new assertion was mutation-proved before its commit (hop cap → literal 5, depth cap → 99, `maxItems` → 6, agreement map → always green, family threshold → hardcoded 0.9, KB cap → 8, recall → skipped, KB catch → rethrow, calibration → disable line removed, baseline → corrupted version, decay → factor 1, `stats.encryption` → plaintext).
- The cold pass caught that four rows named no test home and that the tag proof was circular.

## What went wrong

- The first draft's census counts (6/13/3) disagreed with the roadmap's hand count and the plan did not mark which reading won until revision 2.
- Two test attempts failed before passing: the agreement-map fixtures needed the describe's mock setup, and the retrieval baseline case key was `id`, not `query`.
- The **P0**: the REQ-075 decay test exposed that the bounded ranker added in `2026-11-14-fetch-kb-resource-bounds` inverted `kbSearch` ordering. `BoundedRank` takes an ascending comparator (the `Array.sort` convention) and `kbSearch` passed a descending one, so every search returned the weakest match first. Fixed in `e58fdad`; the existing ordering test compared the bounded result to a full sort using the same inverted comparator, which is why it stayed green.

## Findings and dispositions

| # | Finding | Severity | Disposition |
|---|---|---|---|
| 1 | `kbSearch` ranked ascending after the bounded-ranker change | P0 | Resolved in-session (`e58fdad`); regression test `src/kb.test.ts` `confidence decay` |
| 2 | `F-R4-B-3` needs a second hermetic fetch renderer; `jina` hardcodes its base URL | P2 | Blocked on a seam; scheduled on the roadmap residual |
| 3 | `F-R4-C-3` per-hop-guard cannot be refused on a loopback hop under `allow_private_urls: true` | P2 | Scheduled on the roadmap residual; redirect-hop re-guard stays unit-covered |
| 4 | `F-R5-A-4` needs a spawned-server suite for the REQ-026g bounds | P2 | Scheduled |
| 5 | `F-R6-D-3` handler-level lock refusal and encryption-action reachability need a spawned server | P2 | Scheduled (the unit half is closed) |
| 6 | `F-R6-E-3` clause (a) needs a reduced-heap spawned process | P2 | Scheduled (the false tag is removed) |
| 7 | `clauseTagsFromPayload` cannot bind a tag to a driving test | P2 | Scheduled on the reconciliation section (D3) |
| 8 | Cold pass Majors were documentation gaps, not design errors | P3 | Closed in revisions 2–3 |

## Evidence

- `npx vitest run src/fetch-page-extraction.test.ts` → 12 passed; `src/tool-surface.test.ts` → 6; `src/structured-fact.test.ts` → passed; `src/source-family.test.ts` → 12; `src/corroborate.test.ts` → 118; `src/calibration.test.ts` → 8; `src/preservation.test.ts`, `src/cite.test.ts` → passed; `src/retrieval-benchmark.test.ts` → 8; `src/kb.test.ts` → 36; `src/kb-encryption-tools.test.ts` → 11.
- `npm run validate-spec` → all checks passed; `npx tsc --noEmit` → clean.
- 8 commits: `13cc65d`, `6642233`, `5492859`, `5ea1935`, `be4dae4`, `8eead82`, `e58fdad`, plus the tracker commit.

## Residual

The increment did not meet done bar 2 in full: five rows remain open or partially resolved, each blocked by a missing seam, harness capability, or a reduced-heap process. They are scheduled on `ROADMAP.md`, not left as AAR recommendations.

LOOP OPEN
