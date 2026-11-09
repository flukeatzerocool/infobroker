# Plan — Full-repository review sweep

**Status:** draft, awaiting user approval · **Date:** 2026-11-09 · **Depth:** standard
**Review independence:** self pass for this program scaffold; every chunk gets a fresh cold pass before execution.
**Rollback cost:** 1 — documentation only until a chunk review begins.
**Roadmap item:** `ROADMAP.md` § Full-repository review sweep
**Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md`

## Done bar

**Done bar:** the program is complete when all nine review chunks and the machine-evidence pass are closed, and every one of the 142 §4 REQs plus every non-REQ section of §1–§10 and Appendices A–E has one recorded verdict with no section assigned twice. Each chunk closes only when its verdict table is complete, every `finding:<ID>` has a `file:line` or `spec:line` predicate, a P-severity, and a terminal disposition, zero P0 remains open, its exit gates are green, its increment AAR ends `LOOP PAUSED` or `LOOP OPEN`, and the roadmap trigger has advanced. The program closes with the roadmap item retired and a final machine-evidence pass that re-runs the full suite.

## Scope

**In scope.** A semantic review of the whole repository against its spec, one workable chunk per session: source behavior against REQ bodies, gate assertions against the REQ text they claim to carry, test citations against the behavior they claim to exercise, and documentation/README/skill claims against the code and configuration. Findings are dispositioned in the same increment.

**Out of scope.** Publication, version release notes, and any rewrite of the spec's architecture. A P0 fix inside a chunk is in scope; a redesign is scheduled, not improvised.

## Review model

This is the Elephant–Goldfish split as approved:

- **Elephant — this session.** Holds the durable worklist, the chunk map, cross-chunk decisions, and the roadmap trigger. It is the only writer.
- **Goldfish — fresh subagents.** Each chunk's plan and code review runs in a fresh context that receives only the chunk plan, the in-scope REQ bodies, the enumerated file set, and the review prompt. It never receives the parent's findings, reasoning, or prior transcript. If a fresh context cannot be created, the result is recorded `NOT_RUN.` and the chunk does not claim independent review.

Each chunk uses the repo's own loop: `plan-review` at standard depth with an `independent-review` cold pass, `code-review` for the module review, `drift-report` where documents are the surface, `build-review` before any edit, and `after-action-report` at close. A chunk that changes behavior also runs `changelog-before-commit`.

## Decisions (user-approved 2026-11-09)

- **D1 — Fix policy.** P0 fixed in-session (bounded); P1 scheduled on `ROADMAP.md`; P2 fixed only when a failure is demonstrated; P3 record-and-close. Unchanged from the repo's AAR governance.
- **D2 — Chunk map.** The nine chunks plus M1 below, resized during execution if a chunk proves too large; a resize is recorded as a worklist amendment, never a silent re-scope.
- **D3 — Findings home.** The program `worklist.md` carries the per-chunk verdict tables and the finding register; each chunk's `aar.md` carries the terminal dispositions. No new ungated register is introduced.
- **D4 — Plan depth.** Standard for every chunk; deep only if a chunk touches release, credentials, or schema migration.
- **D5 — Coverage.** The whole repo: §1–§3 prose, §4 requirements, §5–§10 process/runtime/verification, and Appendices A–E.

## Evidence base (this session)

| # | Evidence | Source | Trust |
|---|---|---|---|
| EV1 | Baseline green: `npm run check` PASS (22 gates, 50.7 s), 105 test files / 1087 tests, `audit` exit 0 with 4 low-severity advisories; tree clean at `3ca61bd`, 0 unpushed | tool output, 2026-11-09 | tool-output |
| EV2 | 142 REQ bodies in §4.1–§4.11: 4.1 = 6, 4.2 = 7, 4.3 = 49, 4.4 = 10, 4.5 = 1, 4.6 = 3, 4.7 = 17, 4.8 = 5, 4.9 = 29, 4.10 = 8, 4.11 = 7 | `infobroker.md` (enumerated this session) | repo |
| EV3 | §9.5 manifest: 142 rows; 24 carry G0, 118 carry G1, 27 carry G3 (a REQ may carry more than one) | `infobroker.md` §9.5 (parsed this session) | repo |
| EV4 | 129 unique REQ IDs carry an `@implements` citation in a test file; 13 do not, and all 13 carry G3 (REQ-091 additionally carries G1 and is the sole `G1_EXEMPT` entry). Absence of a test citation is therefore not a finding for a G3-only REQ | `src/**/*.test.ts`, `debate-club/src`, `scripts/check-gate-coverage.ts` | repo |
| EV5 | Surface: 7 tools, 27 configured providers, 109 non-test source files, 91 test files | `src/index.ts`, `config.json`, `find` | repo |
| EV6 | Infobroker has no `spec/audit/req-coverage.md`; `check-gate-coverage` proves that a G1 REQ has *a* `@implements` citation, not that the cited test exercises the stated behavior. That gap is a primary review target | `scripts/check-gate-coverage.ts` | repo |
| EV7 | `validate-spec` reports 142 REQs, 15 artifact-exempt, 127 cited in source files, 0 source files without `@implements` | tool output, 2026-11-09 | tool-output |
| EV8 | `ROADMAP.md` has zero scheduled items; last pipeline run 2026-11-07; version 2026.11.7 | `npm run status` | tool-output |
| EV9 | Repo loop contract: `docs/plans/<date>-<slug>/` with `plan.md`, `tasks.md`, `aar.md`, terminal LOOP token; `check-loop-artifacts`, `check-roadmap`, `session:close` are the gates | `scripts/lib/loop-artifacts.ts`, `scripts/check-roadmap.ts` | repo |

## Coverage invariant

Every scope section is assigned to exactly one chunk. The right-hand column repeats the count so a later edit cannot silently drop or duplicate a REQ.

| Chunk | Spec surface | REQs | Code surface | Lens | Gates already carrying part |
|---|---|---|---|---|---|
| **R1** Contracts and envelope | §3 SR-009; §4.1; §6.1–6.2 | 6 | `src/index.ts` dispatch/envelope, `error-envelope`, `output-schema`, `structured-output`, `truncate`, `verbosity`, `normalizer`, `types.ts` | contract + security | `typecheck`, `test`, `check-pack`, `test-debate-club` |
| **R2** Config, providers, resilience | §4.2, §4.4, §4.5, §4.6, §5.3, §6.3, §7.1–7.3, App A | 25 | `config*`, `key-pool`, `rate-limiter`, `quota`, `retry`, `cooldown`, `health-status`, `providers/` (29 files) | config + resilience | `test`, `check-gate-coverage` |
| **R3** `search_web` | §4.3 (REQ-020–020i, 124, 127, 128, 028); §7.4 | 14 | `chain`, `task-type`, `intent-citations`, `dedup`, `source-quality`, `batch`, `expand`, `research`, `deep-search`, `analysis`, `rerank`, `language` | selection + result integrity | `check-intent-citations`, `check-tdqs`, `test` |
| **R4** `fetch_page` | §4.3 (REQ-021–021k); §6.4 | 12 | `fetch-fallback`, `extract`, `jina`, `preservation`, `modality`, `http`, `truncate`, `structured-fact` | ingestion + safety | `test`, `check-pack` |
| **R5** Corroboration and citations | §4.3 (REQ-026–026h, 121–123, 130, 027/027a); §5.5; §8 | 15 | `corroborate`, `calibration`, `source-family`, `structured-fact`, `cite`, `bibtex` | algorithm + evidence | `test`, `check-gate-coverage` |
| **R6** Knowledge base | §4.9 | 29 | `kb*`, `embed`, `retrieval-benchmark` | persistence + correctness | `test`, `check-shipped-kb-empty`, `check-pack` |
| **R7** Client artifacts and reporting | §4.7; §10.2–10.3; App D | 17 | `skills/`, `instructions/`, `README.md`, `report-*`, `monitor-*`, `validate-readme` | doc ↔ code reconciliation | `validate-readme`, `check-report-fixtures`, `check-skill-harness`, `check-intent-citations` |
| **R8** Deployment, state, security | §2; §4.10; §4.11; §5.1–5.2, §5.4; §10.1; App E | 15 | `config-path`, `config-migrations`, `update-check`, `state-health`, `audit-log`, `content-policy`, `kb-hardening`, scripts/gates, hooks | security + lifecycle | `audit`, `check-script-discipline`, `check-shipped-kb-empty`, `version-sync`, `check-pack` |
| **R9** Spec integrity and tool quality | §3 Terminology; §4.3 (REQ-089/090/092/106); §4.8; §9; App B–C | 9 | `tdqs`, `tool-surface`, `intent-citations`, `validate-spec`, `check-*` | traceability + gate honesty | `validate-spec`, `check-tdqs`, `check-intent-citations`, `check-gate-coverage`, `check-gate-table`, `check-loop-artifacts`, `check-harness-expectations` |
| **M1** Machine evidence | all | — | full gate suite, `check-pack`, debate-club Arena, TDQS, intent citations, fixtures | evidence pass | all |

The counts sum to 142. §2 is R8; §3 terminology is R9; §7.1–7.3 are R2 and §7.4 is R3. The §1 goals and §3 invariants are split per the prose-ownership table in `worklist.md` (D11), so no unit is owned twice.

## Steps

### Phase A — Program scaffold (this increment)

1. Record the baseline (EV1–EV9).
2. Write `worklist.md`: the chunk table above, the exact REQ list per chunk, the calibration rules, the per-chunk close checklist, and the status board.
3. Add the `ROADMAP.md` section with a trigger naming R1.
4. Stop for user approval. No chunk review starts in this increment.

### Phase B — One chunk per session

For each chunk, in the order R1 → R9 → M1:

1. **Baseline.** Re-run `npm run check:fast` un-piped and record HEAD; run the chunk's named harnesses. A red baseline is a P0 fixed as its own commit before review.
2. **Enumerate.** Record `file:line` anchors for the chunk's code surface and confirm the REQ count against the worklist.
3. **Plan.** Draft the chunk plan, run `plan-review` at standard depth, obtain the fresh `independent-review` cold pass, stamp, then get user approval.
4. **Review.** Run `code-review` cluster by cluster in a fresh context; for a document surface run `drift-report`. Open every cited test and check its assertion against the REQ text.
5. **Verdicts.** Fill one row per in-scope REQ: `holds`, `finding:<ID>`, or `deferred:<chunk>` only when the predicate lands wholly in a later chunk's surface.
6. **Disposition.** P0 fix with a test; P1 roadmap row; P2 only on a demonstrated failure; P3 record-and-close.
7. **Close.** Green `check:fast` and `check`; AAR with findings and LOOP token; roadmap trigger advanced; split commits; `npm run session:close`.

### Phase C — Program close

1. Run M1: the full suite, `check-pack`, debate-club Arena, TDQS, intent citations, fixture checks.
2. Confirm every chunk closed and every REQ row present.
3. Retire the roadmap item; write the program AAR.

## Risks

- **Chunk drag.** R2 and R6 are the two heaviest (25 and 29 REQs) across many files. The worklist permits a recorded split if either does not close in one session.
- **False findings from citations.** The first pass must classify `_Check:_` kind before judging a missing `@implements`; otherwise all 13 G3-only REQs become false findings.
- **Gate satisfaction mistaken for correctness.** `check-gate-coverage` is existence-only. Every "gate already carries it" claim must be read against the gate's actual assertion.
- **Roadmap bloat.** One sweep section only; remediation items are added per finding, not pre-listed.
- **Review independence.** If the harness cannot create a fresh context, record `NOT_RUN.` rather than simulating a cold pass in this session.
