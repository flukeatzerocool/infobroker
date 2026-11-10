# Tasks — chunk R3 (`search_web`)

## Phase 0 — Baseline

- [x] `npm run check:fast` un-piped; exit 0 (PASS, 20.3 s).
- [x] R3 carrying tests un-piped: 18 files / 201 tests PASS.
- [x] Record `git status --porcelain` and `git rev-parse --short HEAD` (`6d7f437`, only the untracked R3 plan directory); six unpushed commits reviewed for overlap — none changed an R3 verdict.

## Phase 1 — Enumerate

- [x] Anchors for cluster A (routing and selection).
- [x] Anchors for cluster B (query intake, suggest, expand, batch).
- [x] Anchors for cluster C (reconciliation, source quality, rerank, language).
- [x] Anchors for cluster D (deep reading, research compile).
- [x] Anchors for cluster E (analysis).
- [x] Anchors for cluster F (handler contract, routing citations, §7.4).
- [x] Confirm 14 REQ rows against `worklist.md` and the §9.5 manifest.
- [x] Record G0/G3 classification and existing clause tags (EV9).
- [x] Apply D24: ~40 predicates, 2 clusters needing a live probe → `split: not triggered`.

## Phase 2 — Review

- [x] Cluster A code review → verdicts REQ-020a, 020c, 020d.
- [x] Cluster B code review → verdicts REQ-020, 020b, 020e, 020i, 124.
- [x] Cluster C code review → verdicts REQ-020g, 020h, 128.
- [x] Cluster D code review → verdicts REQ-028, 020f.
- [x] Cluster E code review → verdict REQ-127.
- [x] Cluster F handler contract and `drift-report` over §7.4 → verdicts REQ-020, 020a, 020d, 020i, 124 and the prose row.
- [x] Deterministic Arena replay (`npm run test-debate-club`) → 3 files / 36 tests PASS.
- [x] Isolated live stdio probe under `/tmp/opencode/r3-probe/` (temp `TMPDIR`, temp config layer, temp KB path): suggest, expand, `ignored_params`, provider+priority precedence.
- [x] Gate-assertion check for every carrying gate; four green gates asserted less than the REQ (F-R3-5, F-R3-6, F-R3-10, F-R3-15).
- [x] `check-intent-citations`/`check-tdqs` resolve the `search_web` routing surface; `priority` is cited by no routing file (P3 prose note for R7/R9).

## Phase 3 — Disposition and close

- [x] Disposition every finding: 10 P1 and 5 P2 scheduled, 3 P2 evidence gaps and 12 P3 closed.
- [x] Append the R3 verdict table and finding register rows to `worklist.md`; update the status board (R3 closed, next R4) and the R3 code line (`query.ts`, `batch-run.ts`).
- [x] Run `npm run check:fast` then `npm run check`, un-piped; record exit status.
- [x] Write `aar.md` with the recorded gate evidence and the terminal token; re-run `check:fast` on the final tree.
- [x] Update the `ROADMAP.md` trigger line and the worklist `Next trigger` cell (R4).
- [x] Split commits; `npm run session:close`.
