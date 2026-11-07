# Tasks — gated code review in the push pipeline (2026-11-07)

- [x] Batch 1 — lib.sh: `review_required`, `review_gate_decision`
- [x] Batch 1 — push-pipeline.sh: OUT vars, `run_forked_step`, review block, readiness line, `SYNC_REVIEW_COUNTS`
- [x] Batch 1 — prompts: `sync-review.md`, `fix-review.md`, `sync.md` step 7 reworded
- [x] Batch 1 — pipeline-logic.test.ts: 11 new cases
- [x] Batch 2 — AGENTS.md sentence, CHANGELOG entry
- [x] Batch 3 — increment record: plan, tasks, aar
- [x] Verification: bash -n (0), vitest (64/64), check-script-discipline (0)
- [x] Verification: gate dry run — live status `false`, fixtures `true`, decisions `halt`/`pass`
- [x] Verification: test-push-pipeline (PASS)
- [x] Verification: check:fast (19 gates, 0), full check (51.5s, 0)
- [x] Commit series 1–3: 2b5465e, 063ff6b, and this record commit

## Notes

- The live `review_required` dry run returns false on this plan's own tree: it
  changes scripts and docs, not `src/` or `config.json`. That is the intended
  skip path, not a missing test.
- The 11 new cases: 4 `review_required`, 4 `review_gate_decision`, 3
  `summary_counts`.
