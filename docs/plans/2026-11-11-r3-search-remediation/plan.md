# Plan — R3 `search_web` findings remediation

**Status:** draft, awaiting plan review and user approval · **Date:** 2026-11-11 · **Depth:** standard (multiple production modules, reversible behavior edits, no destructive or publish surface)
**Review independence:** fresh — self pass; one cold pass (fresh context, standard depth, stages 1–3 and 5: 4 Major and 8 Nit findings, all resolved); one targeted diff re-review (1 Major, 4 Nits, all resolved); and a final confirmation pass (stage 4 plus readiness) that returned `independent-review passed.` with 5 clarity-only Nits. Those 5 nits were applied after the passing pass and are condition-level only (no new file, gate, or destructive operation); `build-review` verifies them (C-11).
**Rollback cost:** 1 — source-level behavior edits in nine production modules, one additive config key, tests and bookkeeping. No state-format change, no schema or credential change, no new dependency.
**Roadmap item:** `ROADMAP.md` § R3 findings remediation (retired to `CHANGELOG.md` when this increment closes)
**Predecessor:** `c8408d5` (R2e close; its AAR names `## R3 findings remediation` as the next scheduled work)
**Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md` § Finding register (F-R3-1 … F-R3-30)

## Why this section

R3 remediation is the first section in `ROADMAP.md`, and the ordering rule is top section first. Its trigger ("start after chunk R4 closes") is met: chunks R4 through R9 and M1 all carry a closed AAR (`docs/plans/2026-11-09-full-review-r4/aar.md`, `…-r9/aar.md`, `…-m1/`). The section carries 10 P1 and 5 P2 register rows, all `Scheduled-roadmap`.

The 15 rows share three concerns — what the response *reports* (metadata and provenance), what set of results it *returns* (collapse, ordering, top-up), and which *modes* actually run (deep under compact, research variants, truncation, analysis on empty). They are grouped into four slices below.

## Baseline (verified this session)

- `git log -1` → `c8408d5`; `git status --porcelain` empty.
- `npm run status` → version 2026.11.11 (tag `v2026.11.07`), **82 unpushed commits, oldest 2.0 d**, 20 open roadmap items.
- `npm run check` → **PASS** (full, 22 gates, 119.2 s, run record for `c8408d5`).
- One pre-existing warning: `check-loop-artifacts` reports `2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:** line`. Warning only; out of scope (C-8).
- The 15 register rows re-read at `worklist.md:665-694`; every predicate was re-checked against the working tree this session (table below). None has been fixed since the R3 review.

## Predicates re-verified by reading the code this session

| Finding | Current code | What is wrong |
|---|---|---|
| F-R3-1 (P1) | An explicit provider is prepended to the task chain (`src/index.ts:429-440`), then `selectChain(chain, priority, …)` replaces the list outright for `privacy` and `free_only` (`:443`; `src/chain.ts:45-62`) | `provider` + `priority` discards the explicit choice; §7.4's precedence row is violated (live probe in the R3 AAR). |
| F-R3-3 (P1) | The KB-first early return (`src/index.ts:398-411`) fires before `resolveTaskType` (`:419`) and `parseQuery` (`:459`), so it omits `task_type`, `ignored_params`, and `ignored_operators` | A cache hit reports less about the same request than a cache miss. |
| F-R3-5 (P1) | `mergeItems` keeps `firstError` and returns it alone when no item succeeded (`src/batch.ts:239-241`); `EnvelopeError` has no `meta` (`:123-127`) | REQ-020i requires each failed element's error in per-input metadata; an all-fail batch reports one error and loses the rest. |
| F-R3-15 (P1) | `attempt` slices to `maxResults` before reconciliation (`src/index.ts:537`); `buildSuccess` collapses afterwards (`:629-632`) | Collapse can reduce distinct results below the requested maximum even though the provider was asked for headroom (`requestLimit`). |
| F-R3-16 (P1) | `mergeProvenance` copies `original_source`, `source_type`, and `source_family` only (`src/dedup.ts:17-21`); `SearchResult` has a single `provider` (`src/types.ts:36-37`) | REQ-020g requires the representative to preserve the *contributing providers*; the dup's provider is dropped. |
| F-R3-18 (P1) | The KB-first return bypasses reconciliation (`src/index.ts:398-411`); the blend appends KB rows after external ordering (`:637-638`) | REQ-020h says ordering covers knowledge-base recall; stored hits keep insertion order. |
| F-R3-22 (P1) | `deriveResearchVariants(query, max)` calls `deriveExpansions(query, [], max)` (`src/research.ts:28-30`); `deriveExpansions` adds only the stopword-stripped phrase, which equals the query for most keyphrases (`src/expand.ts:24-39`) | REQ-020f requires multiple variants derived from the query; a normal keyword query yields one. |
| F-R3-23 (P1) | `maybeTruncate` is called only on fetched content (`src/index.ts:901`, `:1315`); the `search_web` body never passes through it | REQ-004 and REQ-020f require the response to be subject to truncation with `truncated`/`output_path`. |
| F-R3-24 (P1) | The deep branch is gated on `deep && !compactMode(config)` (`src/index.ts:646`) | `deep:true` under compact verbosity silently returns plain results; REQ-028 does not make deep reading verbosity-dependent. |
| F-R3-28 (P1) | Analysis is attached conditionally on the `analyze` flag only (`src/index.ts:349`, `:406`, `:708`, `:725`) | REQ-127: analysis is omitted when no results are available; today it is attached with empty sections. |
| F-R3-2 (P2) | `speed` comparator returns `1` when the first latency is 0 and `-1` when the second is (`src/chain.ts:63-70`) | Not antisymmetric; two unmeasured providers do not retain configuration order. |
| F-R3-17 (P2) | The `pairwiseSimilarity` catch returns input order unless a quality weight is set (`src/dedup.ts:44-49`) | REQ-020g: without embeddings the tool must still return a non-semantic ranking. |
| F-R3-20 (P2) | `ignoredParams` is computed for the serving slug only (`src/index.ts:700`, `:719`); `preferLanguageCapable` knows the unsupported set but reports nothing (`src/chain.ts:108-117`) | REQ-128 requires reporting providers that cannot honor the language; only the serving one is reported. |
| F-R3-26 (P2) | `mergeItems` reads `env.snippets` for `passages_returned` (`src/batch.ts:203`); `search_web` deep puts passages on each result (`src/deep-search.ts:11`) | A deep batch element reports no passage count. |
| F-R3-27 (P2) | `mergeItems` copies the first successful item's `meta` (`src/batch.ts:289-297`), including its `analysis` | Batch analysis describes one query, not the merged set. |

Seams read this session: `requestLimit` (`src/normalizer.ts:15-17`), `compactEnvelope` (`src/verbosity.ts:24,41-54`), `finalizeToolResult` (`src/structured-output.ts:60-93`), `ignoredOperators` (`src/query.ts:47-55`), `PerInputMeta` (`src/batch.ts:142-167`), `config.output` defaults (`config.json:355-372`) and `max_chars` validation (`src/config.ts:766-767`).

Evidence sidecar: `~/.local/state/opencode/plans/3b34aea2bce9fb4da60d99c296e2000157a146aca988b48969a73d1a3d3aec94/plan.evidence.json` (regenerated after the review edits; git HEAD `c8408d5`, 10 targets present and tracked, 15 REQs resolved). The cold pass, its targeted diff re-review, and the final confirmation pass were delivered by a fresh reviewer context in this session (reports recorded in `tasks.md`); their findings and dispositions are summarized in the Status line above.

## Done bar

**Done bar:** F-R3-1, -2, -3, -5, -15, -16, -17, -18, -20, -22, -23, -24, -26, -27, and -28 are fixed and marked `Resolved` in the worklist with a one-line summary; every behavior change ships a test that fails on the unmodified source and passes on the final tree (the red result is recorded in `tasks.md`); specifically: an explicit `provider` stays ahead of the priority chain under `priority: privacy|free_only|speed` while still yielding to language and quota reordering; a KB-first response carries `task_type`, `ignored_params`, and `ignored_operators`, and a KB row obeys the blocklist and source-quality ordering on all three KB paths; an all-fail batch returns per-input errors plus `meta.per_query`; collapse consumes provider headroom instead of discarding it before collapse; a collapsed representative carries every contributing provider; a research call derives more than one variant from an ordinary multi-token query with at least two content tokens and `research.max_variants > 1`; an oversized `search_web` response returns `truncated: true` with `output_path` while `structuredContent` stays intact; `deep:true` under compact verbosity fetches and ranks pages rather than returning a plain search (payload visibility under compact verbosity is recorded as governed by REQ-079); analysis is omitted when that site's result array is empty; two unmeasured providers keep configuration order under `speed`; a no-embedding reconciliation returns a deterministic relevance ranking; a language-restricted chain reports `meta.language_unsupported` for every non-serving provider that cannot honor it, retains that field under compact verbosity, and keeps the serving provider's loss in `ignored_params` outside compact mode; a deep batch element reports `passages_returned`; and batch analysis is computed over the merged set; `ROADMAP.md` no longer carries the R3 section; `CHANGELOG.md` carries one entry; the increment record carries plan, tasks, and an AAR ending `LOOP PAUSED` or `LOOP OPEN`; `npm run typecheck`, `npm run check:fast`, `npm run check`, and `npm run validate-spec` exit 0 on the final tree.

**Non-closure rule:** a fix that needs a response-schema breaking change, a KB storage-format change, a new dependency, or more than one production module beyond the blast radius stops that slice. Shipped slices are recorded in `CHANGELOG.md`, the unshipped rows stay scheduled on a successor `ROADMAP.md` section, and the AAR ends `LOOP OPEN`.

## Decisions

- **D1 — Explicit provider is re-inserted after priority selection and before the language/quota reorderings.** `selectChain` stays a pure selector over the *priority* list; `index.ts` applies selection first, then, immediately after `selectChain` and before `preferLanguageCapable` and `demoteQuotaWarnings` (`src/index.ts:443-452`), moves a usable `preferredProvider` to the head and re-applies `fallback_depth`. REQ-128 language preference and REQ-034 quota demotion therefore still reorder it, so an explicit provider cannot override either policy. **Alternative rejected:** teaching `selectChain` about a header argument — it would duplicate the usability check `index.ts` already performs (`providerUsable`, `src/index.ts:435-437`) and make two call sites responsible for the same contract.
  - Consequence: `privacy` + `provider: marginalia` returns `marginalia` first and falls back into the privacy chain, which is what §7.4 states today (no prose edit).
- **D2 — Contributing providers are a new array field, not a string rewrite.** `SearchResult` gains `providers?: string[]`; `mergeProvenance` unions the keeper's and the dup's `provider` plus any existing `providers` into it, sorted for determinism; the representative's `provider` keeps naming the serving slug. **Alternative rejected:** comma-joining into `provider` — it breaks every consumer that treats `provider` as a slug, and `source_family` counting is unaffected either way.
- **D3 — Headroom is consumed after collapse, never before it.** `attempt` stops slicing to `maxResults`; it returns up to the `requestLimit` it already asked the provider for. `buildSuccess` reconciles, blends, orders, and only then slices to `maxResults`, and the `kbMeta` counts are derived after that slice so `kb_results`/`kb_duplicates` describe the returned set. The deep branch slices before `deepRead` so the page budget is unchanged.
  - Consequence: the guarantee is "collapse does not throw away headroom", not "the server invents results". A provider that returns fewer than `requestLimit` rows, or whose rows all collapse into duplicates, can still yield fewer than `maxResults`; that is a provider-supply limit, and REQ-020g's second sentence is read as prohibiting *self-inflicted* loss.
- **D4 — Ordering is one exported comparator over a result set.** `dedup.ts` gains `orderByRelevance(results, query, options)` — the scoring half of `reconcileResults`, exported so the blend path can order external-plus-cached rows without collapsing across tiers (the external row still wins a URL duplicate per REQ-076a). The KB-first path runs `filterBlocked` → `reconcileResults` (collapse within cache hits is correct) with the configured quality weight, and the external-failure return that serves `kbCached` when the chain failed (`src/index.ts:779-787`) runs the same `filterBlocked` → `reconcileResults` treatment. **Alternative rejected:** running `reconcileResults` over the blend — a cached copy of a fresh page could become the representative when the caller asked for the blend.
- **D4a — The chain-wide language report is a named meta field.** When `language` is supplied and non-empty, the response carries `meta.language_unsupported: string[]` — the slugs in the selected chain whose `SUPPORTED_OPTIONS` entry lacks `language`, in chain order, deduplicated, excluding the serving provider (whose loss is already in `ignored_params`). The field is omitted entirely when the list would be empty or no language was requested. `ignored_params` keeps its serving-provider meaning. Because REQ-128 requires the report rather than making it optional, `language_unsupported` joins `REQUIRED_META_KEYS` in `src/verbosity.ts` so compact shaping retains it, with a compact-mode assertion in the handler test. **Alternative rejected:** folding provider slugs into `ignored_params` — that array names parameter names, not providers, and mixing the two breaks REQ-020d's contract.
  - **Out of scope, recorded:** compact shaping also strips `task_type`, `ignored_params`, and `ignored_operators`. That pre-dates this increment (the same fields are lost on a compact cache miss today) and belongs to a REQ-079 remediation, not to R3. It is recorded in the AAR as a cross-chunk note; this plan changes only the field it introduces.
- **D5 — The no-embedding fallback is a deterministic lexical ranking.** A token-overlap score (query content words vs `title + snippet`) ordered descending, ties by source-quality score then by input index, replaces both input-order catch branches. **Alternative rejected:** leaving insertion order — REQ-020g names "its non-semantic ranking" as an existing behavior, and empty order is not a ranking.
- **D6 — Research variants come from the provider suggestion path when available, else from deterministic query shaping that yields more than one variant for an ordinary multi-token query.** The suggestion loop currently inlined in the `expand` branch (`src/index.ts:300-311`) becomes `collectSuggestions(query)`; `deriveResearchVariants` takes those suggestions. Shaping order: the original, the stopword-stripped phrase, clauses split on `,` / `;` / ` and `, then — when the set is still a single variant and the query has at least two content tokens — the individual content keywords as relaxation variants (at most two, in query order). Everything is deduplicated case-insensitively and capped by `research.max_variants`. **Cases that legitimately yield one variant:** a single-token query, a query whose content tokens are fewer than two after stopword removal, and any query with `research.max_variants: 1`; the response reports `variants: 1` and the plan does not invent a variant it cannot derive from the query. **Alternative rejected:** appending intent words ("review", "overview") — that fabricates a search the caller did not ask for and would surface in citations.
- **D7 — Truncation applies at the shared tool boundary, after the compact rewrite.** `finalizeToolResult` gains an optional `truncate?: (text: string) => { text: string; truncated: boolean; outputPath?: string }` callback; `index.ts:1697` passes one bound to `maybeTruncate(text, config.output.response_max_chars)`. The new output key is additive and optional with a runtime fallback of 50000, validated as a positive integer. Order inside the finalizer is fixed: parse/build `structuredContent` → apply the compact rewrite → **then** truncate the serialized text that will be returned, so a compact re-serialization cannot overwrite the truncated body. `truncated: true` and `output_path` are written into the structured object. The truncation is skipped when the envelope already carries `truncated: true` (the `fetch_page` path). **Alternative rejected:** truncating before parse — a sliced JSON body breaks `structuredContent`.
  - Consequence: `fetch_page` text that is already truncated by its own deeper bound is left alone (guard: skip when the envelope already carries `truncated: true`), so the existing REQ-004 path and its tests are unchanged. An operator who sets `max_chars` above `response_max_chars` therefore keeps `fetch_page` governed by `max_chars`; that is the operator's explicit per-page choice, and the skip is recorded as intended rather than an accidental gap.
- **D8 — Deep reading is verbosity-independent; compact shaping still trims the payload.** Remove `!compactMode(config)` from the deep gate, so pages are fetched, ranked, snapshotted, and indexed under compact verbosity instead of being silently skipped. `compactEnvelope` continues to trim per-result fields and optional meta for compact responses (REQ-079), so a compact deep response exposes the enriched `snippet` but not `passages`, `pages_read`, or `top_score`. **This is a recorded residual, not a fix:** the defect was that the work did not run; the visibility of its payload under compact verbosity is governed by REQ-079, which this increment does not amend. The worklist summary for F-R3-24 states both halves. **Alternative rejected:** adding deep fields to `REQUIRED_META_KEYS` — REQ-079 requires compact responses to omit optional metadata, and no other REQ makes those fields required.
- **D9 — Analysis omission is a single predicate.** Every `analyze ? …` attachment becomes `analyze && <that site's result array>.length > 0 ? …`: `finalResults`/`deepMeta.results` on the plain and deep paths, the flattened `groups.flatMap((g) => g.results)` on the research path, and `merged.results` on the batch path. **Alternative rejected:** teaching `analyzeResults` to return `undefined` — it is a pure shaper used by tests that assert its empty-input output, and the omission rule belongs to the response contract (REQ-127), not the analyzer.
- **D10 — Batch analysis is recomputed over the merged set.** The batch branch recomputes `meta.analysis` from `merged.results` after `mergeItems` when `analyze` is on, replacing the copied first-item analysis. `mergeItems` stays pure and drops `analysis` from the copied meta so a stale block cannot survive.
- **D11 — All-fail batch metadata lives on the error envelope.** `EnvelopeError` gains optional `meta?: { per_query: PerInputMeta[] }`; `mergeItems` populates it on the all-fail return. REQ-002's required error fields are unchanged. **Alternative rejected:** folding per-input errors into `error.details` — REQ-020i calls it metadata, and `per_query` already names the shape on the success path.
- **D12 — Slices and commit series.** Four slices, committed as nine convention buckets (above the five-commit default, so the grouping is stated here): (1) precedence and speed order; (2) provenance and non-semantic ordering; (3) collapse-before-slice and KB ordering; (4) KB-first metadata and chain-wide language reporting; (5) batch errors, deep passage counts, merged analysis; (6) research variants; (7) deep under compact and analysis omission; (8) response truncation; (9) docs and bookkeeping. Each commit is `typecheck`-clean; the final tree runs the full gate.
- **D13 — No push.** Publication stays user-authorized. The 2.0 d, 82-commit backlog is recorded in the AAR; it is not published by this increment.

## Slice map

| Slice | Findings | Files |
|---|---|---|
| A — Selection and reporting | F-R3-1, F-R3-2, F-R3-3, F-R3-20 | `src/index.ts`, `src/chain.ts`, `src/verbosity.ts` |
| B — Result set and provenance | F-R3-15, F-R3-16, F-R3-17, F-R3-18 | `src/index.ts`, `src/dedup.ts`, `src/types.ts` |
| C — Batch and analysis | F-R3-5, F-R3-26, F-R3-27, F-R3-28 | `src/batch.ts`, `src/index.ts` |
| D — Modes and truncation | F-R3-22, F-R3-23, F-R3-24 | `src/research.ts`, `src/index.ts` (`collectSuggestions`, deep gate), `src/structured-output.ts`, `src/config.ts`, `src/types.ts`, `config.json` |

## Blast radius

**Production (9 TS modules plus `config.json`).** `src/index.ts` (selection order, KB-first metadata and ordering, slice placement, analysis predicate, research suggestions, finalizer wiring), `src/chain.ts` (`speed` comparator), `src/dedup.ts` (`providers` merge, `orderByRelevance`, lexical fallback), `src/batch.ts` (all-fail metadata, deep passage counts, analysis drop), `src/research.ts` (variant derivation), `src/structured-output.ts` (optional truncator), `src/verbosity.ts` (`language_unsupported` retained in compact mode), `src/types.ts` + `src/config.ts`, and `config.json` (`providers` field, `response_max_chars`).

**Tests.** Edited: `src/chain.test.ts`, `src/dedup.test.ts`, `src/batch.test.ts`, `src/batch-run.test.ts`, `src/research.test.ts`, `src/deep-search.test.ts`, `src/analysis.test.ts`, `src/structured-output.test.ts`, `src/verbosity.test.ts`, `src/config.test.ts`, `src/tool-surface.test.ts` (response fields, including `providers` and `meta.language_unsupported`), and `src/dispatch-orchestration.test.ts` (the handler-level cases). Run-only in Phase 3: `src/query.test.ts`, `src/embed.test.ts`, `src/source-quality.test.ts`.

**Documentation and bookkeeping.** `CHANGELOG.md` (one entry), `ROADMAP.md` (retire the section), `worklist.md` (15 dispositions plus any stale pointer), `docs/plans/2026-11-11-r3-search-remediation/{plan,tasks,aar}.md`. `README.md` stays unchanged: no tool parameter, description, provider, or REQ body changes, so `npm run validate-readme` is the check rather than an edit.

**Explicitly out of scope.** Every R4, R5, R7, R8, and R9 remediation row (each has its own section and trigger); the R3 P3 rows already closed; REQ-021b ranking internals (R4); KB retrieval internals beyond the two `search_web` call sites (R6); the R6 `check-loop-artifacts` warning (C-8).

## Phases and steps

### Phase 0 — Scaffold and baseline

0. Keep the increment directory carrying `plan.md`, `tasks.md`, and an in-progress `aar.md` whose final line is `LOOP OPEN`.
1. Re-confirm the baseline if execution starts on a different HEAD: `npm run check` un-piped, recording exit status, gate count, and wall time. **Red-baseline branch:** a failure caused by this increment's artifacts is fixed by step 0; a pre-existing failure is fixed as its own commit and Phase 0 restarts; a failure on the `search_web` surface stops the increment with `LOOP OPEN`.
2. Seam audit in `tasks.md`: enumerate callers of `reconcileResults`, `mergeItems`, `mergeKnowledgeBaseResults`, `finalizeToolResult`, `deriveExpansions`, and `analyzeResults`, and confirm which existing tests already assert the fields being added (`providers`, `per_query` on errors, `truncated`).
3. Confirm no existing test already asserts any of the 15 corrected behaviors; if one does, it is the landing site, not a new test.

### Phase 1 — Failing evidence first

4. Add one test per finding, each asserting the correct contract and run **before** its fix; record the failure text in `tasks.md`.
   - `src/chain.test.ts`: `speed` with two unmeasured providers keeps configuration order and the comparator is antisymmetric (F-R3-2). The explicit-provider precedence (F-R3-1) is asserted at the handler level instead, because the re-insertion lives in `index.ts`.
   - `src/dedup.test.ts`: a collapsed representative carries `providers` from both sides; with `pairwiseSimilarity`/`rankDocs` forced to throw, ordering is deterministic and quality-weighted (F-R3-16, F-R3-17).
   - `src/batch.test.ts`: an all-fail merge carries `meta.per_query` with one error per input; a deep element carries `passages_returned` from its results; merged meta carries no per-item `analysis` (F-R3-5, F-R3-26, F-R3-27).
   - `src/research.test.ts`: a multi-token keyphrase query with no suggestions yields more than one variant; a single-token query yields one (F-R3-22).
   - `src/structured-output.test.ts`: an oversized envelope returns `truncated: true`, `output_path`, and an intact `structuredContent`, including under compact shaping (F-R3-23).
   - `src/verbosity.test.ts`: `compactEnvelope` retains `language_unsupported` while still dropping other optional meta (D4a).
   - Handler-level tests in `src/dispatch-orchestration.test.ts` (the existing spawned-server suite) for the KB-first metadata, KB ordering on all three paths, collapse-before-slice, deep-under-compact, analysis omission, explicit-provider precedence, and chain-wide language reporting (F-R3-1, -3, -15, -18, -20, -24, -28), using the existing hermetic stub provider (`src/lib/stub-provider.ts`) with an isolated `TMPDIR` and knowledge-base path.
5. Record every red result; a test that passes unmodified is either mis-aimed or the behavior already holds, and either is recorded before any source edit.

### Phase 2 — Fixes, in dependency order

6. **Slice A.** `src/chain.ts`: antisymmetric `speed` comparator (a zero latency sorts after a measured one; two zeros keep input order). `src/index.ts`: select, re-insert the usable explicit provider, then run the language/quota reorderings (D1); move `resolveTaskType`/`parseQuery` above the KB block and add `task_type`, `ignored_params`, and `ignored_operators` to the KB-first return (F-R3-3); emit `meta.language_unsupported` (D4a). `src/verbosity.ts`: add `language_unsupported` to `REQUIRED_META_KEYS` (D4a).
7. **Slice B.** `src/types.ts` + `src/dedup.ts`: `providers` and `orderByRelevance` plus the lexical fallback (D2, D4, D5). `src/index.ts`: return unsliced headroom from `attempt`, reconcile/blend/order, slice, then derive `kbMeta` (D3); route the KB-first path, the blend, and the external-failure KB return through `filterBlocked` + `reconcileResults` / `orderByRelevance` (D4).
8. **Slice C.** `src/batch.ts`: `EnvelopeError.meta.per_query`, deep passage aggregation from results, and dropping the copied `analysis` (D10, D11). `src/index.ts`: recompute batch analysis over `merged.results`; apply the analysis-omission predicate at every attachment site (D9).
9. **Slice D.** `src/index.ts`: extract `collectSuggestions` and pass it to `deriveResearchVariants` (D6); drop `!compactMode` from the deep gate (D8). `src/structured-output.ts` + `src/index.ts` + `src/types.ts` + `src/config.ts` + `config.json`: optional truncator (applied after the compact rewrite) and `response_max_chars` (D7).
10. Fill in any remaining behavior the Phase 1 tests expose. A failing expectation is a real defect and is fixed, not weakened.

### Phase 3 — Verification and documentation

11. Run the targeted suites: `chain`, `dedup`, `batch`, `batch-run`, `research`, `deep-search`, `analysis`, `structured-output`, `config`, `tool-surface`, `verbosity`, `query`, `embed`, `source-quality`. Record counts.
12. Run `npm run typecheck`, then `npm run check:fast`, then `npm run check` (full). A gate failure is repaired inside this increment; an out-of-scope failure becomes an AAR cross-chunk note.
13. Run `npm run validate-spec` and `npm run check-intent-citations`: no REQ body changes are planned, so the check is that nothing new is required; a newly required named clause tag lands in the same commit (C-7).
14. `CHANGELOG.md`: one entry naming the precedence fix, the provenance field, collapse-before-slice, KB ordering, batch metadata, research variants, deep-under-compact, analysis omission, and response truncation, with REQ IDs and the tests that pin them.
15. `ROADMAP.md`: remove the R3 section. Run `npm run check-roadmap`.
16. `worklist.md`: mark the 15 rows `Resolved` with a one-line summary, following the F-R2-1 row's form, and retarget any pointer naming the retired section. The F-R3-24 summary names both halves: the deep work now runs under compact verbosity, and the compact payload is trimmed per REQ-079 (C-5a).
17. Finish `aar.md` with dispositions, verification counts, the 82-commit/2.0 d backlog note (D13), cross-chunk notes, and a terminal `LOOP PAUSED` or `LOOP OPEN`.
18. `npm run session:close`, then the commit series (D12). Stop and report rather than commit a failing tree.

## Conditions

- **C-1** — `orderByRelevance` must be stable for equal scores (input order preserved) so a rerun of the same request is byte-identical.
- **C-2** — the lexical fallback is O(results) with no new dependency and no embedding call; it is exercised by forcing the embedding path to throw, never by disabling the model globally in a test that also asserts semantic ordering.
- **C-3** — the truncation test writes under an isolated `TMPDIR` and never into the operator's real `trunc-*` directory; `output_path` is asserted to exist and be mode-0600 readable.
- **C-4** — `response_max_chars` is additive and optional with a runtime fallback; a user layer omitting it inherits the shipped default, and an older build ignoring it still reads the config.
- **C-5** — the `providers` field, the error `meta`, and `meta.language_unsupported` are additive; no existing declared output schema may be narrowed. `tool-surface.test.ts` is the check. `language_unsupported` is retained by `compactEnvelope`, asserted in `verbosity.test.ts` and in a compact-mode handler case.
- **C-5a** — F-R3-24's compact-visibility residual is recorded in the worklist summary, the CHANGELOG entry, and the AAR; the increment does not amend REQ-079.
- **C-6** — every handler-level test sets `TMPDIR`, `INFOBROKER_CONFIG_LOCAL`, and an isolated KB path (the R3 D27 convention); no test reads the operator's real KB or quota file.
- **C-7** — if a REQ body must change, its Appendix B counts (≤800 chars, ≤8 sentences, ≤8 SHALL clauses, ≤5 backtick tokens) are measured before commit; no violation ships.
- **C-8** — the `check-loop-artifacts` warning for `2026-11-10-r6-encryption-capacity-remediation` is recorded, not fixed.
- **C-9** — independence: this draft is a self pass. A cold pass runs before approval; if one cannot be created, the AAR records `NOT_RUN` and the plan does not claim `independence: fresh`.
- **C-10** — the `speed` comparator fix must not change the `quality` chain order, which has no latency term; `chain.test.ts` pins both.
- **C-11** — the five post-confirmation clarity edits are exactly: evidence counts, `src/verbosity.ts`/`src/verbosity.test.ts` added to the slice map, Phase 1 list, and Phase 2 step 6, the done bar's serving-provider and content-token qualifications, and the run-only suite note. `build-review` confirms nothing else changed between the passing artifact and the stamped one.

## Rollback

Every edit is a source-level behavior change plus one additive config key and two additive response fields (`providers`, `meta.language_unsupported`). Reverting the nine commits restores the prior tree; the KB store, credential pool, and quota file are untouched, so a downgrade reads prior state safely. No provider contract, schema migration, or dependency is involved.

## Verification summary
| Claim | How it is proven |
|---|---|
| Explicit provider survives priority selection | Handler test in `dispatch-orchestration.test.ts` pairing (`privacy`, `free_only`, `speed`) with `chain.test.ts` pinning the selector itself |
| KB-first reports the same metadata as a miss | Handler test over a seeded isolated KB |
| All-fail batch reports every input's error | `batch.test.ts` all-fail merge with `meta.per_query` |
| Collapse does not undershoot the requested maximum | Handler test with a stub provider returning `requestLimit` rows |
| Representatives carry contributing providers | `dedup.test.ts` two-provider collapse |
| KB rows obey blocklist and source-quality order | Handler test on the KB-first, blend, and external-failure paths |
| Research derives multiple variants for an ordinary multi-token query | `research.test.ts` keyphrase, short-token, and `max_variants: 1` cases |
| Oversized responses truncate with an intact structured body | `structured-output.test.ts`, including the compact rewrite |
| Deep reading runs under compact verbosity | `dispatch-orchestration.test.ts` asserting fetch and index side effects with `verbose: false` |
| Analysis is omitted on empty results | Handler test (policy-refusal and blocklist-only result sets) |
| No-embedding reconciliation ranks deterministically | `dedup.test.ts` with a forced throw |
| Language reporting covers the whole chain | Handler test over a mixed chain asserting `meta.language_unsupported` |
| Deep batch elements report passages | `batch.test.ts` |
| Nothing else regressed | `npm run check` (22 gates), `npm run validate-spec`, `npm run check-intent-citations` |
