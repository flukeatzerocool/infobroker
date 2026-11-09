# Tasks — full-repository review sweep

## Phase A — Program scaffold (this increment)

- [x] Record baseline: `git status` clean at `3ca61bd`, 0 unpushed, `npm run check` PASS, 22 gates, 1087 tests, audit exit 0.
- [x] Enumerate the spec: 142 REQs across §4.1–§4.11; list every non-REQ section of §1–§10 and Appendices A–E.
- [x] Enumerate the surface: 7 tools, 27 providers, 109 non-test source files, 91 test files, 22 gates.
- [x] Calibrate citation rules: classify `_Check:_` kind first; 129 cited, 13 G3-only uncited, REQ-091 G1-exempt.
- [x] Write `worklist.md` with the chunk map, exact REQ lists, calibration rules, and close checklist.
- [x] Add the `ROADMAP.md` section with an R1 trigger.
- [ ] User approves the program and the R1 start.

## Chunk R1 — Contracts and envelope

- [ ] Baseline: `check:fast`, contract tests, HEAD recorded.
- [ ] Enumerate envelope, dispatch, error, output-schema, truncation, and verbosity surfaces with `file:line`.
- [ ] Plan, `plan-review` standard, fresh cold pass, stamp.
- [ ] Review against REQ-001/002/003/004/073/079 and §1/§3/§6.1/§6.2.
- [ ] Fill 6 verdict rows; disposition findings.
- [ ] Green gates, AAR, roadmap trigger → R2, split commit, `session:close`.

## Chunk R2 — Config, providers, resilience

- [ ] Baseline: config/provider/resilience tests, HEAD recorded.
- [ ] Enumerate `config*`, `key-pool`, `rate-limiter`, `quota`, `retry`, `cooldown`, `health-status`, `providers/`.
- [ ] Plan, `plan-review` standard, fresh cold pass, stamp.
- [ ] Review against §4.2, §4.4, §4.5, §4.6, §5.3, §6.3, §7.1–7.3, App A, and the 25 REQs.
- [ ] Fill 25 verdict rows; disposition findings.
- [ ] Green gates, AAR, roadmap trigger → R3, split commit, `session:close`.

## Chunk R3 — `search_web`

- [ ] Baseline: chain/task/selection/batch tests, HEAD recorded.
- [ ] Enumerate `search_web` handler and selection/merge/ranking modules.
- [ ] Plan, `plan-review` standard, fresh cold pass, stamp.
- [ ] Review against the 14 REQs and §7.4.
- [ ] Fill 14 verdict rows; disposition findings.
- [ ] Green gates, AAR, roadmap trigger → R4, split commit, `session:close`.

## Chunk R4 — `fetch_page`

- [ ] Baseline: fetch/extract/jina/preservation tests, HEAD recorded.
- [ ] Enumerate fetch handler, fallback, extraction, and preservation modules.
- [ ] Plan, `plan-review` standard, fresh cold pass, stamp.
- [ ] Review against the 12 REQs and §6.4.
- [ ] Fill 12 verdict rows; disposition findings.
- [ ] Green gates, AAR, roadmap trigger → R5, split commit, `session:close`.

## Chunk R5 — Corroboration and citations

- [ ] Baseline: corroboration/calibration/citation tests, HEAD recorded.
- [ ] Enumerate corroboration, calibration, source-family, structured-fact, cite, and bibtex surfaces.
- [ ] Plan, `plan-review` standard, fresh cold pass, stamp.
- [ ] Review against the 15 REQs, §5.5, and §8.
- [ ] Fill 15 verdict rows; disposition findings.
- [ ] Green gates, AAR, roadmap trigger → R6, split commit, `session:close`.

## Chunk R6 — Knowledge base

- [ ] Baseline: KB store/encryption/claims/receipt tests, HEAD recorded.
- [ ] Enumerate the `kb*` family, `embed`, and retrieval benchmark.
- [ ] Plan, `plan-review` standard, fresh cold pass, stamp.
- [ ] Review against the 29 REQs.
- [ ] Fill 29 verdict rows; disposition findings.
- [ ] Green gates, AAR, roadmap trigger → R7, split commit, `session:close`.

## Chunk R7 — Client artifacts and reporting

- [ ] Baseline: `validate-readme`, report fixtures, skill harness, HEAD recorded.
- [ ] Enumerate `skills/`, `instructions/`, README, reporting and monitoring modules.
- [ ] Plan, `plan-review` standard, fresh cold pass, stamp.
- [ ] Review against the 17 REQs, §10.2–10.3, and App D; run `drift-report` on the doc surface.
- [ ] Fill 17 verdict rows; disposition findings.
- [ ] Green gates, AAR, roadmap trigger → R8, split commit, `session:close`.

## Chunk R8 — Deployment, state, security

- [ ] Baseline: config-path/migrations/update/audit/content-policy tests, HEAD recorded.
- [ ] Enumerate deployment, state, update, audit, and content-safety surfaces.
- [ ] Plan, `plan-review` standard (deep if release/credentials are touched), fresh cold pass, stamp.
- [ ] Review against the 15 REQs, §2, §5.1–5.2, §5.4, §10.1, and App E.
- [ ] Fill 15 verdict rows; disposition findings.
- [ ] Green gates, AAR, roadmap trigger → R9, split commit, `session:close`.

## Chunk R9 — Spec integrity and tool quality

- [ ] Baseline: `validate-spec`, TDQS, intent citations, gate coverage, HEAD recorded.
- [ ] Enumerate the spec tooling, TDQS, tool-surface, and gate scripts.
- [ ] Plan, `plan-review` standard, fresh cold pass, stamp.
- [ ] Review against the 9 REQs, §9, and App B–C.
- [ ] Fill 9 verdict rows; disposition findings.
- [ ] Green gates, AAR, roadmap trigger → M1, split commit, `session:close`.

## Machine-evidence pass M1 and program close

- [ ] Run the full suite un-piped: `npm run check`, `check-pack`, debate-club Arena, TDQS, intent citations, fixtures.
- [ ] Confirm every REQ row is present and every chunk is closed.
- [ ] Retire the roadmap item and write the program AAR.
