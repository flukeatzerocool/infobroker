# Tasks — full-repository review sweep

## Phase A — Program scaffold (this increment)

- [x] Record baseline: `git status` clean at `3ca61bd`, 0 unpushed, `npm run check` PASS, 22 gates, 1087 tests, audit exit 0.
- [x] Enumerate the spec: 142 REQs across §4.1–§4.11; list every non-REQ section of §1–§10 and Appendices A–E.
- [x] Enumerate the surface: 7 tools, 27 providers, 109 non-test source files, 91 test files, 22 gates.
- [x] Calibrate citation rules: classify `_Check:_` kind first; 129 cited, 13 G3-only uncited, REQ-091 G1-exempt.
- [x] Write `worklist.md` with the chunk map, exact REQ lists, calibration rules, and close checklist.
- [x] Add the `ROADMAP.md` section with an R1 trigger.
- [x] User approves the program and the R1 start.

## Chunk R1 — Contracts and envelope

- [x] Baseline: `check:fast`, contract tests, HEAD recorded.
- [x] Enumerate envelope, dispatch, error, output-schema, truncation, and verbosity surfaces with `file:line`.
- [x] Plan, `plan-review` standard, fresh cold pass, stamp.
- [x] Review against REQ-001/002/003/004/073/079 and §1/§3/§6.1/§6.2.
- [x] Fill 6 verdict rows; disposition findings.
- [x] Green gates, AAR, roadmap trigger → R2, split commit, `session:close`.

## Chunk R2 — Config, providers, resilience

- [x] Baseline: config/provider/resilience tests, HEAD recorded.
- [x] Enumerate `config*`, `key-pool`, `rate-limiter`, `quota`, `retry`, `cooldown`, `health-status`, `providers/`.
- [x] Plan, `plan-review` standard, fresh cold pass, stamp.
- [x] Review against §4.2, §4.4, §4.5, §4.6, §5.3, §6.3, §7.1–7.3, App A, and the 25 REQs.
- [x] Fill 25 verdict rows; disposition findings.
- [x] Green gates, AAR, roadmap trigger → R3, split commit, `session:close`.

## Chunk R3 — `search_web`

- [x] Baseline: chain/task/selection/batch tests, HEAD recorded.
- [x] Enumerate `search_web` handler and selection/merge/ranking modules.
- [x] Plan, `plan-review` standard, fresh cold pass, stamp.
- [x] Review against the 14 REQs and §7.4.
- [x] Fill 14 verdict rows; disposition findings.
- [x] Green gates, AAR, roadmap trigger → R4, split commit, `session:close`.

## Chunk R4 — `fetch_page`

- [x] Baseline: fetch/extract/jina/preservation tests, HEAD recorded.
- [x] Enumerate fetch handler, fallback, extraction, and preservation modules.
- [x] Plan, `plan-review` standard, fresh cold pass, stamp.
- [x] Review against the 12 REQs and §6.4.
- [x] Fill 12 verdict rows; disposition findings.
- [x] Green gates, AAR, roadmap trigger → R5, split commit, `session:close`.

## Chunk R5 — Corroboration and citations

- [x] Baseline: corroboration/calibration/citation tests, HEAD recorded.
- [x] Enumerate corroboration, calibration, source-family, structured-fact, cite, and bibtex surfaces.
- [x] Plan, `plan-review` standard, fresh cold pass, stamp.
- [x] Review against the 15 REQs, §5.5, and §8.
- [x] Fill 15 verdict rows; disposition findings.
- [x] Green gates, AAR, roadmap trigger → R6, split commit, `session:close`.

## Chunk R6 — Knowledge base

- [x] Baseline: KB store/encryption/claims/receipt tests, HEAD recorded.
- [x] Enumerate the `kb*` family, `embed`, and retrieval benchmark.
- [x] Plan, `plan-review` standard, fresh cold pass, stamp.
- [x] Review against the 29 REQs.
- [x] Fill 29 verdict rows; disposition findings.
- [x] Green gates, AAR, roadmap trigger → R7, split commit, `session:close`.

## Chunk R7 — Client artifacts and reporting

- [x] Baseline: `validate-readme`, report fixtures, skill harness, HEAD recorded.
- [x] Enumerate `skills/`, `instructions/`, README, reporting and monitoring modules.
- [x] Plan, `plan-review` standard, fresh cold pass, stamp.
- [x] Review against the 17 REQs, §10.2–10.3, and App D; run `drift-report` on the doc surface.
- [x] Fill 17 verdict rows; disposition findings.
- [x] Green gates, AAR, roadmap trigger → R8, split commit, `session:close`.

## Chunk R8 — Deployment, state, security

- [x] Baseline: config-path/migrations/update/audit/content-policy tests, HEAD recorded.
- [x] Enumerate deployment, state, update, audit, and content-safety surfaces.
- [x] Plan, `plan-review` standard (deep if release/credentials are touched), fresh cold pass, stamp.
- [x] Review against the 15 REQs, §2, §5.1–5.2, §5.4, §10.1, and App E.
- [x] Fill 15 verdict rows; disposition findings.
- [x] Green gates, AAR, roadmap trigger → R9, split commit, `session:close`.

## Chunk R9 — Spec integrity and tool quality

- [x] Baseline: `validate-spec`, TDQS, intent citations, gate coverage, HEAD recorded.
- [x] Enumerate the spec tooling, TDQS, tool-surface, and gate scripts.
- [x] Plan, `plan-review` standard, fresh cold pass, stamp.
- [x] Review against the 9 REQs, §9, and App B–C.
- [x] Fill 9 verdict rows; disposition findings.
- [x] Green gates, AAR, roadmap trigger → M1, split commit, `session:close`.

## Machine-evidence pass M1 and program close

- [x] Run the full suite un-piped: `npm run check`, `check-pack`, debate-club Arena, TDQS, intent citations, fixtures.
- [x] Confirm every REQ row is present and every chunk is closed.
- [x] Retire the roadmap item and write the program AAR.
