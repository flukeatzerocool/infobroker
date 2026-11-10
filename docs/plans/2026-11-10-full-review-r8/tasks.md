# Tasks — Full-review sweep, chunk R8 (deployment, state, security)

Tracker for `plan.md` steps. Mark each step when it completes; record evidence
inline. A step is never marked complete on an assumption.

## Phase 0 — Scaffold and baseline

- [x] 0. Increment directory carries `plan.md`, `tasks.md`, and an `aar.md` stub ending `LOOP OPEN`
- [x] 1. Baseline `npm run check` run un-piped; status, gate count, wall time, failing gate recorded — first run red at `test` (EV1); re-run PASS (53.5 s, 22 gates)
- [x] 2. Baseline repair (`vitest.config.ts` timeout) as its own commit; `npm run test` green twice — commit `db4ee99`; runs: 1101/1101 ×2, verbose run 1101/1101 with target test 2354 ms
- [x] 3. `npm run check:fast` re-run green — PASS (fast, 19.1 s)
- [x] 4. Carrying tests run un-piped — 15 files / 163 tests PASS
- [x] 5. `npm run test-debate-club` run un-piped — 3 files / 37 tests PASS

## Phase 1 — Enumerate

- [x] 6. `file:line` anchors per cluster A–H, de-duplicated; probe-dependence recorded per cluster — `phase1-enumeration.md`: 90 distinct anchors
- [x] 7. 15 REQ rows confirmed against `worklist.md` and the §9.5 manifest
- [x] 8. `_Check:_` kind and cited tags mapped per REQ; clause-bearing REQs flagged
- [x] 9. Tracker drift recorded (omitted modules/regions, coarse `scripts/` entry, missing §3 units in `Spec:` line and status-board cell)
- [x] 10. Live surfaces confirmed (`spec` action, notices, audit target)
- [x] 11. `split: triggered | not triggered` recorded before Phase 2 — **not triggered** (90 anchors; 2 probe-dependent clusters B, C)

## Phase 2 — Review

- [x] 12. Isolated probe under `/tmp/opencode/r8-probe/`; legs (a)–(f) recorded
- [x] 13. Cluster A review → REQ-042, REQ-043, REQ-105
- [x] 14. Cluster B review → REQ-111, REQ-112, REQ-113
- [x] 15. Cluster C review → REQ-111a
- [x] 16. Cluster D review → REQ-096, REQ-091, REQ-101
- [x] 17. Cluster E review → REQ-097
- [x] 18. Cluster F review → REQ-098, REQ-099, REQ-100
- [x] 19. Cluster G review → REQ-102
- [x] 20. Cluster H `drift-report` over the R8 prose units → prose rows
- [x] 21. Gate-assertion check for every carrying gate

## Phase 3 — Disposition and close

- [x] 22. Findings dispositioned P0–P3; P1s scheduled on `ROADMAP.md`; D77 notes recorded
- [x] 23. Verdict/prose tables and register rows appended; tracker corrected in three edits
- [x] 24. `npm run check:fast` then `npm run check` un-piped; status recorded
- [x] 25. Roadmap trigger and worklist `Next trigger` advanced (skipped on `LOOP OPEN`)
- [x] 26. `aar.md` rewritten from the stub with the finished AAR
- [x] 27. Final-tree `npm run check:fast` un-piped; status recorded
- [x] 28. Split commits in the AGENTS order; `npm run session:close`

## Open conditions

- [ ] C-1. 21 unpushed commits (oldest 17 h at plan time) — separate user decision; not part of this increment (D78)
