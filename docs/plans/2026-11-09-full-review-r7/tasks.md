# Tasks — chunk R7 (client artifacts and reporting)

## Plan review

- [x] Self pass + cold pass stages 1–5 (3 critic lenses, 2 stage-5 audits, one targeted confirm).
- [x] Cold report at `plan.cold/report.md`; plan stamped `fresh` (depth standard, 5/5 stages).
- [x] Conditions C-1 (successor `Next trigger` naming) and C-2 (script-only P-level) resolved.

## Phase 0 — Scaffold and baseline

- [x] Step 0: increment carries `plan.md`, `tasks.md`, and the `LOOP OPEN` AAR stub (now the finished AAR).
- [x] `npm run check` → PASS (full, 22 gates, 54.5 s).
- [x] Carrying tests → 7 files / 60 tests PASS.
- [x] `git status` → only this untracked increment; HEAD `db8eff9`; 16 unpushed.
- [x] Arena → 3 files / 37 tests PASS.

## Phase 1 — Enumerate

- [x] Clusters A–H anchored; 34 distinct anchors; 1 probe-dependent cluster (E); split `not triggered`.
- [x] 17 REQ rows confirmed; `_Check:_` kinds and clause-bearing branches mapped.
- [x] Tracker drift recorded (nonexistent code paths, omitted scripts/fixtures, missing §1 goal 5, stale trigger, date inversion).
- [x] Artifact checks read; G0-free surface confirmed.

## Phase 2 — Review

- [x] Step 11 probes (a)–(e) under `/tmp/opencode/r7-probe/` — all PASS.
- [x] Cluster A → `REQ-050`, `051`, `053`.
- [x] Cluster B → `REQ-052`, `088`, `115`.
- [x] Cluster C → `REQ-114`, `116`, `118`, `119` (branch→fixture matrix built).
- [x] Cluster D → `REQ-120`, `120a`.
- [x] Cluster E → `REQ-117`, `125`.
- [x] Cluster F → `REQ-126`.
- [x] Cluster G → `REQ-054`, `107` plus §10.2–10.3 / App D prose rows.
- [x] Cluster H → §1 goal 5 prose row.
- [x] Gate-assertion check for every carrying gate; split re-confirmed.

## Phase 3 — Disposition and close

- [x] Disposition every finding P0–P3: 1 P0 fixed, 7 P1 and 16 P2 scheduled, 18 P3 closed.
- [x] Verdict/prose tables and register rows appended; status board and R7 code/spec lines corrected.
- [x] P0 fix implemented (`scripts/monitor-watchlist.ts` + `scripts/monitor-watchlist.test.ts`) with CHANGELOG entry.
- [x] `npm run check:fast` → PASS (21.9 s); `npm run check` → PASS (53.6 s).
- [x] Roadmap trigger advanced to R8; six R7 remediation sections added.
- [x] `aar.md` rewritten with the terminal token.
- [x] `check` on the finished tree → recorded.
- [x] Split commits; `npm run session:close` → fast gates PASS (21.5 s), run `8f5be18`.
- [x] Final full `npm run check` on the committed tree → PASS (52.9 s).
