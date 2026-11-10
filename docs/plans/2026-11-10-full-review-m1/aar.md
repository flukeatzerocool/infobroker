# AAR — full-review sweep, chunk M1 (machine evidence and program close)

**Date:** 2026-11-10 · **Chunk:** M1 · **Depth:** standard · **Status:** closed — the program is closed and the roadmap item retired.
**Plan:** `plan.md` (stamped `0157b90f…`, standard depth, `fresh`; cold pass 1 FAILED with 1 Blocker + 5 Majors, cold pass 2 passed, report in `plan.cold/`).
**Program AAR:** `docs/plans/2026-11-09-full-review-sweep/aar.md`.

## What happened

1. **Baseline.** `npm run check` PASS (full, 51.2 s) at HEAD `deab019`, tree clean, 22 gates, 4 low `audit` advisories; `npm run status` 28 unpushed commits (oldest 19.2 h), 28 roadmap items, version 2026.11.7.
2. **Machine evidence.** Re-ran the battery un-piped: full `check`, `check-pack`, Arena, `audit`, TDQS report, gate-coverage report, fixture freshness. All gating legs exit 0; informational legs recorded by parsed result (0 violations, 0 uncovered, 0 stale).
3. **Reconciliation.** 142/142 distinct REQ IDs carry a verdict row (143 rows, REQ-106 twice); 275 register rows with all 119 verdict citations resolving; 4 P0 all resolved, zero open; 22/22 prose units after writing the §1 goal 3 row.
4. **Repairs.** Wrote the missing §1 goal 3 prose row from R3's recorded verdicts (F-M1-1); repaired the unparseable `F-R5-B-8` register row (F-M1-2); re-targeted the orphaned `Deferred-R1` finding F-R4-C-9 (F-M1-3).
5. **Close.** Retired the roadmap section (29 → 28 headings, 27 remediation sections intact), closed the status board, ticked the sweep task list, wrote both AARs, and committed in three concerns.

## What went right

- The cold pass caught a false coverage invariant in the plan before execution could manufacture a green close. The re-verified truth — three mapping forms, 52 unbacked P1-bypassing P2 rows — is now recorded rather than papered over.
- Gating legs and informational legs were kept separate, so the always-zero report modes were never counted as passes.
- The close artifacts followed the authoritative gate: tokens were written only after the edited docs were green.
- Two tracker defects (a prose gap and an unparseable row) were repaired with evidence already on record, without re-reviewing a REQ surface.

## What went wrong

- **Plan pre-scan produced a false universal.** The `Scheduled-roadmap` regex missed backticked dispositions, so "every scheduled ID is named in ROADMAP" looked true. This is the same class the sweep exists to find: a check that asserts less than its claim.
- **A register row survived nine chunks unparseable.** Unescaped formula pipes in `F-R5-B-8` split the Markdown cells; no gate reads the register, so nothing caught it.
- **A deferral target was already closed.** R4 deferred F-R4-C-9 to R1, which had closed before R4 filed it — nothing tracked the orphan until this pass.
- **Plan step order needed a deviation.** Step 12's roadmap heading diff depends on step 15's removal, so step 12 ran after step 15. Recorded here; no content changed.

## Findings

| ID | Severity | Predicate | Disposition |
|---|---|---|---|
| F-M1-1 | P3 | Ownership table assigns §1 goal 3 to R3 (`worklist.md:86`); R3's D28 records §7.4 only; no chunk wrote the row | Resolved in-session — row recorded from R3's REQ-020a/020c/020h verdicts plus F-R2-27 |
| F-M1-2 | P3 | 52 rows assert `Scheduled-roadmap` with no roadmap home (R4 18, R5 28, R6 6); R2 27 and R3 15 are chunk-register covered; `F-R5-B-8` was unparseable | `Closed-P3` — census recorded; malformed row repaired; re-disposition deferred |
| F-M1-3 | P3 | F-R4-C-9 deferred to R1, which had already closed (`src/index.ts:1092,1163`) | Resolved in-session — re-targeted `Scheduled-roadmap`, added to the R4 extraction section and its trigger |

Deviation from plan: one bounded repair beyond the two the plan named (F-M1-3), and steps 12/15 swapped for dependency order. Neither changes scope or a verdict.

## Gate evidence

| Gate | Result |
|---|---|
| `npm run check` (step 1) | PASS (full, 51.2 s) |
| `check-pack` / `test-debate-club` / `audit` | PASS individually (358 files / 37 Arena tests / 4 low advisories) |
| Informational reports | TDQS 0 violations; G1 0 uncovered; fixtures 0 stale |
| `npm run check` (step 16, edited docs) | PASS (full, 53.7 s) |
| `npm run check` (step 18, final tree) | PASS (full, 51.1 s, exit 0) |
| `check-roadmap` / `check-non-goals` / `check-loop-artifacts` | PASS (28 sections / pointer intact / 18 increments) |

## Recommendations

None outside `ROADMAP.md`. The 27 remediation sections are the scheduled surface; the first is the R6 action-contract item, whose trigger has fired. The 28-commit backlog remains a separate, user-authorized publication.

LOOP PAUSED
