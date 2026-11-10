# Tasks — Full-review sweep, chunk R9 (spec integrity and tool quality)

**Plan:** `plan.md` · **Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md`
**Status:** not started — plan drafted 2026-11-10, cold pass and approval pending.

## Phase 0 — Scaffold and baseline

- [x] 0. Increment scaffold present (`plan.md`, `tasks.md`, `aar.md` stub ending `LOOP OPEN`); keep this file current.
- [x] 1. `npm run check` un-piped: record exit status, gate count, wall time; repair a red baseline as its own commit.
- [x] 2. `npm run check:fast` un-piped: record exit status and wall time.
- [x] 3. Carrying tests + `npm run test-debate-club`: record files/tests.
- [x] 4. Capture gate assertions as text (D83 read set).

## Phase 1 — Enumerate

- [x] 5. Enumerate code anchors per cluster A–C; list 11 prose units; record probe-dependence (expect zero).
- [x] 6. Confirm nine REQ rows and `_Check:_` kinds.
- [x] 7. Record `split: triggered | not triggered` in `worklist.md`.
- [x] 8. Map REQs to carrying evidence; flag unexercised G1 clauses and missing clause tags; verify the `REQ-077`/`REQ-080` meta-REQ exemption is recorded.
- [x] 9. Record tracker drift (nonexistent `src/tool-surface.ts`; omitted modules/scripts; missing §1/SR-011/SR-012).
- [x] 10. Confirm live surfaces through `src/tool-surface.test.ts` and the Arena contract test.

## Phase 2 — Review

- [x] 11. Cluster A → `REQ-055` verdict.
- [x] 12. Cluster B → `REQ-089`, `REQ-090`, `REQ-092`, `REQ-106` verdicts.
- [x] 13. Cluster C → `REQ-077`, `REQ-078`, `REQ-080`, `REQ-081` verdicts.
- [x] 14. Cluster D `drift-report` → 11 prose rows.
- [x] 15. Gate-suite consistency cross-check (§9.4/§9.5 vs manifest vs AGENTS).
- [x] 16. Reconcile with closed chunks' open items (D80).

## Phase 3 — Disposition and close

- [x] 17. Disposition every finding P0–P3; create roadmap sections for P1s.
- [x] 18. Append verdict/prose tables and register rows; correct the R9 tracker cells.
- [x] 19. `check:fast` then `check` un-piped; record exit status.
- [x] 20. Advance the roadmap and worklist trigger to M1 (program-close clause preserved).
- [x] 21. Write the finished AAR with the terminal token.
- [x] 22. `npm run check` on the final tree; record exit status.
- [x] 23. Split commits in AGENTS order; `npm run session:close`.
