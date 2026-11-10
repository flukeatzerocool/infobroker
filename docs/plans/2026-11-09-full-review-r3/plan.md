# Plan — Full-review sweep, chunk R3 (`search_web`)

**Status:** draft, awaiting plan review and user approval · **Date:** 2026-11-09 · **Depth:** standard (worklist D4: no release, credential, or schema-migration surface) · **Review route:** standard — one self pass plus one `independent-review` cold pass.
**Review independence:** self (cold pass pending).
**Rollback cost:** 1 — review-only unless a bounded P0 fix lands; the close writes docs and split commits.
**Roadmap item:** `ROADMAP.md` § Full-repository review sweep
**Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md`
**Predecessor:** chunk R2 closed 2026-11-09 (`docs/plans/2026-11-09-full-review-r2/aar.md`, `LOOP PAUSED`); its P1 remediation is scheduled and starts after R3 closes.

## Done bar

**Done bar:** chunk R3 is closed when all 14 worklist REQs (`REQ-020`, `020a`, `020b`, `020c`, `020d`, `020e`, `020f`, `020g`, `020h`, `020i`, `124`, `127`, `128`, `028`) and the R3-owned prose surface (§7.4 Priority Routing) carry a verdict — or, when D24 splits the chunk, R3a's 9-REQ subset and its prose subset carry a verdict and the successor trigger is R3b; every finding has a `file:line` or `spec:line` predicate, a P-severity, and a terminal disposition; zero P0 is open and every new P1 is scheduled on `ROADMAP.md` before the AAR closes; the R3 verdict table and finding register are appended to `worklist.md`; the roadmap trigger names R4 (or R3b at an R3a close); `npm run check` exits 0 before the AAR is written and `npm run check:fast` exits 0 on the final tree after the roadmap/status edit (`session:close` re-runs it); and the AAR ends `LOOP PAUSED`.

**Non-closure rule:** a P0 that cannot be fixed inside D23's bound stops the chunk. The AAR then ends `LOOP OPEN`, the roadmap trigger stays on R3, and the done bar is not claimed.

## Scope

**In scope.** The `search_web` request path and its supporting modules: parameter intake and validation, task-type classification and override, dispatch-chain selection (priority routing, quota demotion, language preference), query operator parsing and operator/language transparency, provider suggestion fallback, query expansion, batch parallel execution and per-input metadata, result reconciliation/dedup, source-quality ordering and the domain blocklist, semantic reranking, deep reading, research compilation, in-process analysis, the `search_web` handler's response metadata, and the tool's routing citations in `src/intent-citations.ts` (judged only where a route violates an R3 REQ).

**Out of scope.** Provider modules' result parsing and normalization (R2 owns provider registration and the provider files; R3 reads them only as evidence for `suggest` and operator support). `fetch_page` transport and passage ranking internals (R4 owns `REQ-021*`); R3 judges `REQ-028` only through its reuse of `REQ-021b` ranking. Corroboration (R5). KB retrieval internals (R6); R3 judges KB recall only where `search_web` output ordering (`REQ-020h`) or freshness (`REQ-020`) depends on it, and files a KB defect as a prose note pointing at R6. Client artifacts and README (R7). Config-file validation and dispatch-table contents (R2, already closed); §7.1–7.3 prose (R2, already reviewed — R3 owns only §7.4 and the classification sentence under `REQ-020a`).

## Decisions

- **D23 — Fix policy.** Same bound as R2/D12: P0 fixed in-session within at most 2 source files (a regression test counts as one) and 100 changed lines, one attempt; exceeding it or failing to reach green lands `LOOP OPEN`. P1 scheduled on `ROADMAP.md`; P2 fixed only on a demonstrated failure; P3 record-and-close.
- **D24 — Increment record and split rule.** `docs/plans/2026-11-09-full-review-r3/` carries this plan, `tasks.md`, and `aar.md`; `worklist.md` carries the verdict table and finding register.
  - Split by cluster only when the Phase 1 enumeration records more than 120 distinct `file:line` predicates, or when four or more clusters each need a live probe. The split is decided at the end of Phase 1 and recorded in `worklist.md` before Phase 2.
  - **R3a** = clusters A–B (routing/selection, query intake, suggestion/expansion, batch) plus §7.4. REQs: `020`, `020a`, `020b`, `020c`, `020d`, `020e`, `020i`, `124`, `128` (9).
  - **R3b** = clusters C–E (result assembly, deep reading, research, analysis) plus their handler metadata. REQs: `020f`, `020g`, `020h`, `127`, `028` (5).
  - The union is the 14-REQ list, 9 + 5. At an R3a close the done bar applies to R3a's subset and the successor trigger is R3b, not R4. The status board gains R3a/R3b rows in place of R3.
- **D25 — Cross-chunk dedup.** Open findings from R1/R2 that touch the `search_web` path are **not re-filed**. F-R2-19 (`degraded` partial-results leg), F-R2-29 (explicit provider prepended before the auth filter), F-R2-30 (quota-exhausted chain returns empty success), F-R2-35 (dispatch orchestration has no integration test), F-R1-1 (compact verbosity bypass), and F-R1-3 (`max_results` headroom) stay owned by their chunk. R3 cites them in the predicate cell where a verdict depends on them. A **new** violation of an R3-owned REQ gets its own R3 ID even when the same line is already named by an R1/R2 finding.
- **D26 — Citation resolution.** Classify `_Check:_` first (worklist calibration rule 1). G0+G1 REQs (`020`, `020b`, `020d`, `020e`, `127`) require the live advertised schema — parameters, defaults, and descriptions — plus behavior evidence; `tool-surface.test.ts:187` carries the schema half of `REQ-020`. The remaining nine are G1 and require a cited test that exercises the stated behavior, not merely names the REQ (calibration rule 2). A missing citation is only a finding for a G1 REQ with no test exercising the clause.
- **D27 — State and network isolation.** Every live probe runs with a temp `TMPDIR`, a temp `INFOBROKER_CONFIG_LOCAL`, and a temp KB storage path; no probe mutates the real KB, quota file, or user config layer. Outbound search is best-effort: the deterministic preference is debate-club Arena replay (`debate-club/src/mcp-contract.test.ts`) and the module tests; a live probe that is blocked, throttled, or times out is recorded `NOT_RUN` with the reason, never inflated into a finding. `fresh: true` is used where a live outbound call is the only way to observe the behavior.
- **D28 — Prose ownership and boundary.** R3 owns §7.4 only. §7.1/§7.2 table rows and §7.3 deprioritization were reviewed by R2 (F-R2-40 recorded the `>80%` boundary); R3 reads them as evidence for routing verdicts but files no prose defect there. The §7.1 classification sentence ("MAY consider semantic similarity … confidence floor") is adjudicated under `REQ-020a`, not as a separate row.
- **D29 — No push.** Publication stays user-authorized.

## Evidence base (this session)

| # | Evidence | Source | Trust |
|---|---|---|---|
| EV1 | Baseline green at `6d7f437`: `npm run check` PASS (22 gates, 55.4 s), tree clean, 6 unpushed commits, version 2026.11.7 | tool output, 2026-11-09 | tool-output |
| EV2 | 14 R3 REQs confirmed against `worklist.md` § R3 and the §9.5 manifest (`REQ-020` family = 10, plus `124`, `127`, `128`, `028`) | `worklist.md:190-199`; `infobroker.md` §9.5 | repo |
| EV3 | Citation map: `020` → `batch.test.ts`, `providers/*`, `tool-surface.test.ts`; `020a` → `chain.ts`/`task-type.test.ts`; `020b` → `embed.test.ts:1` only (no dedicated suggest test; `expand.test.ts` covers `deriveExpansions` only); `020c`/`020d` → `chain.test.ts`; `020e` → `expand.test.ts`; `020f` → `research.test.ts`; `020g` → `dedup.test.ts` + `embed.test.ts`; `020h` → `source-quality.test.ts`; `020i` → `batch.test.ts` + `batch-run.test.ts`; `124` → `query.test.ts`; `127` → `analysis.test.ts` (5 tags); `128` → `language.test.ts` + `embed.test.ts`; `028` → `deep-search.test.ts` + `rerank.test.ts:1` | `grep -rn '@implements'`, 2026-11-09 | repo |
| EV4 | Surface sizes: `chain.ts` 117 L, `task-type.ts` 340 L, `intent-citations.ts` 381 L, `dedup.ts` 86 L, `source-quality.ts` 75 L, `batch.ts` 297 L, `batch-run.ts` 23 L, `expand.ts` 60 L, `research.ts` 59 L, `deep-search.ts` 138 L, `analysis.ts` 236 L, `rerank.ts` 100 L, `language.ts` 64 L, `query.ts` 55 L; carrying tests 1 777 L across 14 files | `wc -l` | repo |
| EV5 | Open findings overlapping this surface: F-R2-19, F-R2-29, F-R2-30, F-R2-35, F-R1-1, F-R1-3 — all `Scheduled-roadmap` or already resolved elsewhere; D25 prevents duplicate rows | `worklist.md` § Finding register | repo |
| EV6 | §7.4 Priority Routing is at `infobroker.md:896`; §7.3 deprioritization is at `:886`-`:894` (R2-owned) | `grep -n '### 7.4'` | repo |
| EV7 | Handler anchors: `doWebSearch` at `src/index.ts:216`; tool registration `:1684`–`:1762`; suggest path `:269`–`:293`; expand path `:297`–`:309`; `ignored_params` assembly `:671`, `:690`; empty-chain success `:773`; `language` schema description `:1726` | `grep -n` | repo |
| EV8 | Debate-club Arena carries a `search_web` contract test (`debate-club/src/mcp-contract.test.ts:115`) over committed fixtures — the deterministic substitute for live probes | `grep -n` | repo |
| EV9 | Clause-bearing REQs in scope: `020b` (suggestion-provider failure branch), `020g` (no-embedding branch), `020h` (blocklist vs distinct-count), `020i` (all-fail branch), `124` (unrecognized operator), `128` (no-language-provider fallback), `028` (unfetchable page), `020f` (variant with no fetchable page). Phase 2 checks each branch has a named clause tag (calibration rule 5) | `infobroker.md:237-266`, `:360-370` | repo |

## Review surface

| Cluster | Files | REQs | Carrying gates/tests |
|---|---|---|---|
| A — Routing and selection | `chain.ts` (`selectChain`, `demoteQuotaWarnings`, `preferLanguageCapable`, `ignoredParams`), `task-type.ts` (`classifyTaskType`, `resolveTaskType`), handler selection at `src/index.ts:216-500` | 020a, 020c, 020d | `chain.test.ts`, `task-type.test.ts`, live schema |
| B — Query intake, suggestion, expansion, batch | `query.ts`, `expand.ts`, `batch.ts`, `batch-run.ts`, suggest/expand paths `src/index.ts:269-309` | 020, 020b, 020e, 020i, 124 | `query.test.ts`, `expand.test.ts`, `batch.test.ts`, `batch-run.test.ts`, `providers/duckduckgo.test.ts`, `tool-surface.test.ts:187`, debate-club `mcp-contract.test.ts` |
| C — Result assembly and ordering | `dedup.ts` (`reconcileResults`), `source-quality.ts`, `rerank.ts`, `language.ts`, reconciliation call sites in `src/index.ts` | 020g, 020h, 128 | `dedup.test.ts`, `source-quality.test.ts`, `rerank.test.ts`, `language.test.ts`, `embed.test.ts` |
| D — Deep reading and research | `deep-search.ts` (`deepRead`), `research.ts` (`deriveResearchVariants`, `compileResearchGroups`), shared fetch path `src/index.ts:805` | 028, 020f | `deep-search.test.ts`, `research.test.ts` |
| E — Analysis | `analysis.ts` (`extractTopics`, `extractEntities`, `clusterResults`, `buildTimeline`, `analyzeResults`), handler `analyze` branch | 127 | `analysis.test.ts` |
| F — Handler contract, routing citations, and prose | `search_web` registration `src/index.ts:1684-1762`, `doWebSearch` `:216-805`, `intent-citations.ts` routing coverage, §7.4 | 020, 020a, 020d, 020i, 124 | live schema + stdio probe, `tool-surface.test.ts`, `intent-citations.test.ts`, `drift-report` over §7.4 |

Cluster A excludes `crossTaskFallbackChain` (`src/chain.ts:95-103`), which implements `REQ-031a` and belongs to R2; it is read only where selection order depends on it.

## Steps

### Phase 0 — Baseline

1. Run `npm run check:fast` un-piped and record the exit status. Run the carrying tests un-piped: `npx vitest run src/chain.test.ts src/task-type.test.ts src/query.test.ts src/batch.test.ts src/batch-run.test.ts src/dedup.test.ts src/source-quality.test.ts src/expand.test.ts src/research.test.ts src/deep-search.test.ts src/analysis.test.ts src/rerank.test.ts src/language.test.ts src/embed.test.ts src/intent-citations.test.ts src/tool-surface.test.ts src/providers/duckduckgo.test.ts src/providers/new-providers.test.ts`.
2. Record `git status --porcelain` and `git rev-parse --short HEAD`; confirm `6d7f437` or note the drift. Review the six unpushed commits for overlap with the R3 surface before reviewing (a fix already in flight may change a verdict).

### Phase 1 — Enumerate

1. Record `file:line` anchors for clusters A–F; confirm the 14 REQ rows against `worklist.md` and the §9.5 manifest.
2. Record which R3 REQs are G0/G3 and which already carry clause tags (EV9); clause findings are adjudicated against the REQ text, not the detector (D26, calibration rule 5).
3. Apply D24: count distinct `file:line` predicates and live-probe clusters. Record `split: not triggered` or the R3a/R3b amendment — before Phase 2.

### Phase 2 — Review (read-only)

1. Run `code-review` cluster by cluster in a fresh context; run `drift-report` over §7.4 (cluster F).
2. Open every cited test and check the assertion against the REQ text. Specific branch checks:
   - **REQ-020**: parameters, defaults, and bounds in the live schema; single vs array (up to five) concurrency and merge; `max_results` enforced; provenance present; unsupported parameters ignored without error. Cross-check F-R1-3 (headroom) and F-R2-30 (exhausted chain) rather than re-filing.
   - **REQ-020a**: `task_type` override skips reclassification; `provider` override falls back through the selected chain; scholarly identifier/author-year/journal/cited-work classification; confidence-floor retention of `general_web`; semantic-only match does **not** select place/fact/filing/definition/code; selection excludes exhausted/disabled/unauthenticated and demotes quota-warning providers; response reports task type and serving provider.
   - **REQ-020b**: `suggest` returns title-only results ordered by relatedness (provider order when no embedding); primary suggestion provider failure falls through to another suggestion-capable provider; error per `REQ-002` when none available or all fail. The only citation is `embed.test.ts:1`; no dedicated suggest-path test exists today (EV3) — judge the assertion that is there, not the citation.
   - **REQ-020c**: each of `privacy`/`free_only`/`speed`/`quality` produces the stated chain; `speed` orders by recent latency with config order as the fallback; response identifies the serving provider; explicit `provider` precedence (F-R2-29 owns the auth-filter defect).
   - **REQ-020d**: each unsupported parameter lands in `meta.ignored_params`; the list is empty when all supplied parameters are supported.
   - **REQ-020e**: `expand` returns title-only strings, deduplicated and relatedness-ordered; no suggestion provider → query-derived expansions, not an error.
   - **REQ-020f**: multiple variants, per-variant chain search, deep-read of top pages, grouping by variant with relevance and provenance, configured bounds, `REQ-004` truncation, and the no-fetchable-page variant reporting its search results.
   - **REQ-020g**: duplicate-content collapse with merged contributing providers and preserved original source; distinct-result count is not reduced below the requested maximum; blocklisted results excluded from that guarantee; non-semantic ordering still applied without embeddings.
   - **REQ-020h**: semantic ordering with source-quality weights; primary/trusted over low-quality; blocklist exclusion with a reported excluded count; weight zero leaves ordering unchanged; case-insensitive and subdomain matching; invalid pattern ignored. Verify KB-recall results take the same ordering path.
   - **REQ-020i**: failing element does not fail the batch; success when ≥1 element succeeds; error only when all fail; per-input metadata names input, provider, status, ranked-passage count, and truncation state.
   - **REQ-124**: `site:`, `filetype:`, quoted phrases, and exclusions parsed; supported operators passed to providers; unsupported operator reported in ignored-parameter metadata; unrecognized operator remains text.
   - **REQ-128**: Unicode tokenization without dropping non-Latin scripts; Latin tokenization unchanged (vector comparability); separator-less scripts n-gram segmented; language-restricted routing plus reporting of providers that cannot honor it; encyclopedia/dictionary language editions included; no eligible provider → default chain + ignored language reported.
   - **REQ-127**: topics/entities bounded and relevance-ordered; clusters without removal from the primary list; chronological timeline with undated results reported separately; computed in-process with no extra outbound call; omitted when there are no results.
   - **REQ-028**: deep mode fetches top-ranked pages after results, reuses `REQ-021b` passage ranking, associates passages with scores and span anchors, reports unfetchable pages with their snippet, and honors the configured fetch bound.
   - **§7.4**: each priority row matches `selectChain`; explicit `provider` precedence; fallback to the task chain when the privacy chain is empty.
3. Live probes, isolated per D27. Preferred deterministic evidence: `npx vitest run debate-club/src/mcp-contract.test.ts` and the module tests. Where a live observation is required (suggest fallback, `ignored_params` on a live provider, `speed` ordering), drive the server through a purpose-written stdio probe under `/tmp/opencode/r3-probe/` with a temp `TMPDIR`, temp `INFOBROKER_CONFIG_LOCAL`, and temp KB path, 30 s per-call timeout. A probe blocked by network denial is `NOT_RUN`, not a finding.
4. Check each carrying gate's assertion against the REQ it claims to carry; a green gate asserting less is a finding (calibration rule 6).
5. Run `npm run check-intent-citations` and `npm run check-tdqs` and confirm the `search_web` routing citations still resolve; a routing gap is an R3 finding only when it violates an R3 REQ, otherwise it is a prose note for R7/R9.

### Phase 3 — Disposition and close

1. P0 fix with a regression test inside D23; otherwise record P1/P2/P3.
2. Append the R3 verdict table and finding register rows to `worklist.md`; update the status board (R3 closed / R3a closed, and the R3b row when split).
3. Run `npm run check:fast`, then `npm run check`, un-piped; record the exit status.
4. Only after the gates are green, write `aar.md` with the recorded gate evidence and the terminal token.
5. After `aar.md` lands, run `npm run check:fast` on the final tree (after the roadmap/status edit) and record the exit status. The full `check` evidence is the run before the AAR is written; the post-AAR `check:fast` covers the artifact-contract gate and the final tree.
6. On closure, advance the `**Trigger:**` line of the `ROADMAP.md` sweep section and the `Next trigger` cell of the worklist status board to R4 (to R3b at an R3a close). On non-closure, leave both on the current unit and land `LOOP OPEN`.
7. `npm run session:close`; split commits after the final tree is green.

## Blast radius

| Change | Files | Size | Rollback |
|---|---|---|---|
| Verdict table and register | `docs/plans/2026-11-09-full-review-sweep/worklist.md` | M | 1 |
| Roadmap trigger advance | `ROADMAP.md` (one line) | S | 1 |
| Increment record | `docs/plans/2026-11-09-full-review-r3/{plan,tasks,aar}.md` | M | 1 |
| P0 fix (conditional) | at most 2 files including the regression test (D23) | S | 2 (source change) |
| CHANGELOG (only if the P0 changes shipped behavior) | `CHANGELOG.md` | S | 1 |

## Commit order

Each commit is `npm run typecheck`-clean; the final tree runs the full gate.

1. `fix(<area>): <P0 finding>` — only when a bounded P0 fix lands: source plus its regression test. Gate: `npm run typecheck` and the touched tests.
2. `docs(plans): close chunk R3 and record verdicts` — `worklist.md`, `ROADMAP.md` trigger advance, and the increment record. Gate: `npm run check-loop-artifacts`, `npm run check-roadmap`.
3. `docs(roadmap): schedule R3 findings` — only when a P1 lands. Gate: `npm run check-roadmap`. A shipped behavior change would also need a CHANGELOG entry.

A clean close collapses to commit 2 alone.

## Risks

- **Chunk drag.** 14 REQs across 14 modules plus the handler; D24 fixes the split trigger before review starts.
- **Live-network evidence.** Suggest, priority and operator probes need outbound calls; D27 substitutes Arena replay and records `NOT_RUN` rather than converting a blocked probe into a finding.
- **Known-finding duplication.** F-R2-19/29/30/35 and F-R1-1/3 sit on the same lines; D25 keeps ownership with the originating chunk.
- **G0 misclassification.** Five REQs carry G0; a missing dedicated test is not a finding when the live schema and a behavior test agree.
- **Handler concentration.** `src/index.ts:216-805` holds the shared path for search, batching, research, and analysis; findings there are filed once, under the REQ whose clause is violated, with the line as predicate.
- **Prose boundary drift.** §7.1–7.3 defects are R2's; R3 files only §7.4 and `REQ-020a` classification defects (D28).
