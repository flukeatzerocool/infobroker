# Plan — R6 retrieval remediation

**Status:** reviewed · **Date:** 2026-11-10 · **Depth:** standard
**Review independence:** fresh — cold pass passed with 5 Majors and 6 Minors, all resolved; diff-only re-review passed with 3 Nits, all resolved. Cold report `/tmp/opencode/r6-retrieval-cold.md`; re-review `/tmp/opencode/r6-retrieval-rereview.md`.
**Rollback cost:** 1 — two small behavior edits in `src/index.ts` and `src/kb.ts`, plus tests and bookkeeping; no schema, config-key, dependency, or release-surface change
**Roadmap item:** `ROADMAP.md` § R6 retrieval remediation (retire on close)
**Predecessor:** `d4d2f76` (R6 config/dedup/report close, `LOOP PAUSED`). Every review-sweep chunk (R1–R9, M1) is closed, so this section's trigger — "start after chunk R7 closes" — and the roadmap ordering rule (top section first) both select it.

## Baseline (verified this session)

- `git log -1` → `d4d2f76`; 44 unpushed commits, oldest 21.5 h; version 2026.11.7; 24 open roadmap items (25 `##` sections including `## Non-goals`); last pipeline run 2026-11-07.
- `npm run check:fast` → PASS (19 gates, 20.1 s).
- Working tree changes at plan time: none.
- `ROADMAP.md:17-23` is the top scheduled section and names exactly F-R6-C-5, F-R6-C-6, F-R6-C-7.
- `docs/plans/2026-11-09-full-review-sweep/worklist.md:815-817` carries those three rows as `Scheduled-roadmap`; the register header is at `:794`.

## Done bar

**Done bar:** F-R6-C-5, F-R6-C-6, and F-R6-C-7 are fixed and marked `Resolved` in the sweep worklist; each fix is shown to fail under a recorded source mutation and to pass on the restored tree; a research request reports `kb_recall: "not_applicable"`, a deep request reports the same even with no KB configured and when `fresh: true` is also set, a blend returns cached rows that fail the KB-first sufficiency thresholds, and the embedding-model degradation event carries a remediation naming the configured reference and the built-in fallback; the R6 retrieval section is retired from `ROADMAP.md` (24 work items → 23); `CHANGELOG.md` gains an entry naming the three behavior changes; `npm run check:fast` exits 0 on the final tree and `npm run check` exits 0 when the `npm audit` probe answers (otherwise recorded under C-2); the increment record under `docs/plans/2026-11-10-r6-retrieval-remediation/` carries plan, tasks, and an AAR ending `LOOP PAUSED` or `LOOP OPEN`.

**Conditions:**
- **C-1** — an assertion that fails on the unmodified tree exposes a real defect; the defect is fixed in this increment and the plan amended, never weakened to green.
- **C-2** — if the `npm audit --json` probe cannot reach the registry, the full `npm run check` is recorded as not-run for that reason and `check:fast` is the terminal gate; the AAR says so.
- **C-3** — the Arena blend test requires the seeded row's relevance `score` to be below `kb_first_relevance_threshold` (0.99). A fresh stable row's `freshness_score` is at or above the confidence threshold and cannot be pushed below it without an age fixture, so the relevance leg is the one the precondition probes; the filter is an AND and the relevance leg decides it. If the score is at or above 0.99, the fixture text and query are adjusted; the thresholds are never lowered and the test is never skipped.
- **C-4** — no REQ body edit is planned; if the cold pass shows REQ-076a or REQ-103 text must change, Appendix B limits are measured before commit and the spec→README binding step in the pipeline applies.
- **C-5** — the cold pass runs in a fresh context; if it cannot be created, the run records `NOT_RUN.` and the plan does not claim `independence: fresh`.

## Findings in scope

| ID | Predicate (verified by reading the code and tests this session) | Fix |
|---|---|---|
| F-R6-C-5 | The `research` branch returns at `src/index.ts:322-346` before the KB block at `:349-404`, so its response has no `kb_recall`; REQ-076a (`infobroker.md:598`) requires a research request to report recall as not applicable | Behavior change (`src/index.ts`), Arena test |
| F-R6-C-6 | For `fresh: "blend"` the cached rows pass through the KB-first sufficiency filter (`src/index.ts:364-369`), so sub-threshold cached rows are dropped; the all-external-fail branch at `:749-760` then has nothing to return | Behavior change (`src/index.ts`), Arena test |
| F-R6-C-7 | `configureModel` records "retrieval degraded" without a remediation (`src/kb.ts:110-120`); `kbStats` reports `model_available`/`model_name` and events but no remediation, and no test asserts the degradation path (`src/kb.ts:730-764`, `:854-879`) | Behavior change (`src/kb.ts`), unit test |

## Design decisions

**D1 — A deep or research request reports not applicable, whether or not a KB is configured and regardless of skip.** The research branch gets a literal `kb_recall: "not_applicable"` in its `meta`, because the branch never consults the KB by design. `kbRecall` is initialized from `deep ? "not_applicable" : "unavailable"` (research returns before the KB block and carries its own literal), so a deep request with no KB reports the same state. Inside the KB block the order becomes deep/research first, then skip, then the search path, so `deep: true, fresh: true` reports `not_applicable` rather than `skipped`; no recall happens in either case, so the skip contract is unchanged and REQ-076a's unqualified sentence holds. A plain search with no KB keeps `unavailable`, which is the KB state REQ-076 already describes. Rejected: leaving `skipped` to win for deep+skip — it leaves one leg of REQ-076a unimplemented and is one reorder away from correct. Rejected: a new `kb_recall` enum member — the six existing states already cover the contract.

**D2 — Blend bypasses the sufficiency thresholds; KB-first mode keeps them.** The cached row set is selected once: `fresh === "blend"` uses every `kbSearch` row, the default mode uses the rows that clear both thresholds. Blocklist filtering (`src/index.ts:380-383`) and the `collection` scope stay identical for both. REQ-076a says the blend returns *both result sets*; REQ-076 says only the default KB-first mode replaces external search on sufficient results, so applying the filter to a blend is the defect, not a safety measure. Rejected: dropping the filter for every mode — it would break REQ-076's sufficiency contract. Rejected: relaxing only the relevance threshold — arbitrary, and still drops cached rows the caller explicitly asked to see.

**D3 — The all-external-fail branch itself needs no change.** `src/index.ts:749-760` is correct: it returns the cached set when one exists and otherwise reports chain exhaustion. Once D2 supplies sub-threshold rows, that branch does what REQ-076a requires. Rejected: returning an empty `[OK]` blend when no cached row exists — it would hide a total provider failure the error contract (REQ-031/REQ-038) already reports.

**D3a — The all-empty external path is out of scope and recorded as a deferred decision.** When every provider returns an empty result and none errors, the chain reports a legitimate zero-result answer at `src/index.ts:773` (`ok("none", [], ...)`) without consulting the cached set, so a blend returns no cached rows in that case. REQ-076a's sentence is "when every external provider fails", and REQ-031 explicitly distinguishes an empty result from a failure, so the current behavior matches the contract. The increment records this in the AAR as a P3 informational finding with REQ-031 as the rationale; changing the zero-result answer would be a separate behavior decision. Rejected: routing the all-empty path through the cache in this increment — it widens the finding's scope and changes the zero-result contract without a demonstrable defect.

**D4 — The degradation event carries the remediation in the same string `stats` returns.** `configureModel` appends one event naming the configured reference, the built-in fallback, and the action (`set kb.embedding_model` to a supported reference in `config.local.json`, or install the requested model, then reload). This matches §2 F9's mitigation ("KB tools report degraded status with a remediation naming the configured model reference and the built-in fallback") without a new response field or a schema change. Rejected: a new `model_remediation` field on `stats` — REQ-060c does not define one, and the existing `events` surface already carries operator-facing status. Rejected: throwing an error when the model is unknown — REQ-103 requires non-KB operation to continue and retrieval to degrade, not fail.

**D5 — No REQ body changes; the implementation is brought to the text.** REQ-076a and REQ-103 already state all three behaviors. No REQ edit means no Appendix B measurement and no spec→README binding obligation; the CHANGELOG still records the behavior changes. Rejected: clarifying REQ-076a with a "blend does not apply the thresholds" sentence — the existing "return both result sets" is unambiguous, and an edit would churn the fingerprint surface for no contract gain.

## Blast radius

| File | Change | Size |
|---|---|---|
| `src/index.ts` | Research `meta.kb_recall` literal; `kbRecall` initialization; blend row-set selection | S |
| `src/kb.ts` | Degradation event gains the remediation sentence | S |
| `src/kb-model.test.ts` | New degradation assertion (stats fields + event text) | S |
| `debate-club/src/kb-retrieval.test.ts` | New Arena file: research recall, deep+skip precedence, blend below thresholds, all-external-fail fallback, deep with no KB | M |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | F-R6-C-5/6/7 → `Resolved` with evidence | S |
| `ROADMAP.md` | Retire § R6 retrieval remediation | S |
| `CHANGELOG.md` | One entry naming the three behavior changes | S |
| `docs/plans/2026-11-10-r6-retrieval-remediation/` | `plan.md`, `tasks.md`, `aar.md` | S |

No README, provider, configuration-key, or dependency change: the README (`README.md:341`) already describes blend as keeping cached results, and the affected parameters are unchanged.

## Steps

### Phase 0 — preflight (no edits)

1. Confirm `git status --porcelain` is empty and HEAD is `d4d2f76`.
2. Run `npm run check-intent-citations` and `npm run check-tdqs`; record findings. No routing-file edit is expected because no tool name, action, or description changes.
3. Run `npm run validate-spec` pre-edit and record the counts (expect 142 REQs, 127 cited).
4. Grep the test corpus for an existing assertion covering the research/deep recall state or the blend threshold bypass (`grep -rn "not_applicable\|kb_recall" src/*.test.ts debate-club/src`). Expected: only `src/batch.test.ts` unit coverage and the existing Arena blend test at `debate-club/src/mcp-contract.test.ts:438-473`; if a covering assertion exists, extend it instead of adding a duplicate file.
5. Record the current `npm run test` baseline count so the increment can report the delta.

### Phase 1 — behavior

1. `src/index.ts` research branch: add `kb_recall: "not_applicable"` to `meta` beside `research: true`.
2. `src/index.ts` KB block: initialize `kbRecall` from `deep` (`deep ? "not_applicable" : "unavailable"`) and order the configured branch deep/research → skip → search. Replace `sufficientResults` as the mapped row set with `const cachedRows = fresh === "blend" ? kbResults : sufficientResults`.
3. `src/kb.ts` `configureModel`: extend the appended event with the remediation naming the configured reference, the fallback, and the config action.
4. Run `npm run typecheck` after each file.

### Phase 2 — tests

1. `src/kb-model.test.ts`: add a case that initializes the KB with an unknown `embedding_model`, then asserts `kbStats()` reports `model_available: false`, `model_name` equal to the configured reference, and an event containing the configured reference, the fallback name, and the remediation action.
2. `debate-club/src/kb-retrieval.test.ts` — start one server with a full `kb` config layer (tmp `storage_path`, `keys_path`, `reports_path`, `auto_index: false`, `kb_first_relevance_threshold: 0.99`, `kb_first_confidence_threshold: 0.99`) and assert:
   - **precondition:** ingest `https://example.com/arena-retrieval-seed` by passing the text content alongside that pinned `source_url` (no URL fetch) with a stable tier, then `manage_kb (action: search)` for the same query reports `score < 0.99` (the relevance leg of the AND filter; C-3 applies if not);
   - `fresh: "blend"` with `task_type: "general_web"` (those providers have no fixture hosts, so replay answers them with 599 and `lastError` is set) returns `kb_recall: "blended"` and that exact seeded URL in `results`;
   - the seeded query against `task_type: "encyclopedia"` in the default mode (external success via the Wikipedia fixture) reports `kb_recall: "miss"` and no seeded URL, proving the thresholds still gate KB-first;
   - `deep: true, fresh: true` with `task_type: "encyclopedia"` reports `kb_recall: "not_applicable"` (deep precedence over skip), reading the page through the existing `action=parse` Wikipedia fixture;
   - `research: true` with `task_type: "general_web"` reports `kb_recall: "not_applicable"`.
3. Second server in the same file with `configLayer: () => ({ kb: null })`: a `deep: true` request with `task_type: "encyclopedia"` against the existing Survivor Series fixture reports `kb_recall: "not_applicable"`.
4. Run the unit file with `npx vitest run src/kb-model.test.ts` (root config) and the Arena file from `debate-club/` with `npx vitest run src/kb-retrieval.test.ts` (the Arena's own `vitest.config.ts`); then run `npm run test-debate-club`.

### Phase 3 — mutation evidence

1. Revert the blend row-set selection to `sufficientResults` → the Arena blend assertion must fail; restore.
2. Remove the research `kb_recall` literal → the research assertion must fail; restore.
3. Revert the `kbRecall` initialization and the deep-before-skip order → the deep-with-no-KB and deep+skip assertions must fail; restore.
4. Remove the remediation sentence → the unit assertion must fail; restore.
5. Record each mutation, the failing test name, and the restored diff in the AAR.

### Phase 4 — bookkeeping

1. `worklist.md`: mark F-R6-C-5/6/7 `Resolved` with the test file and line that proves each; refresh the three affected REQ evidence rows in the `:381-384` range.
2. `ROADMAP.md`: remove § R6 retrieval remediation; confirm 23 work items remain (24 before removal).
3. `CHANGELOG.md`: add `## 2026.11.7 — R6 review: recall state and embedding degradation` with bullets for the research/deep state, the blend threshold bypass, and the remediation message. The heading date must equal the version date (the `version-sync` gate compares the top entry to `package.json`).
4. Draft `tasks.md` progressively; write the final `aar.md` after Phase 5's gates so its `LOOP PAUSED` reflects the verified tree.

### Phase 5 — verification and commits

1. `npm run check:fast` on the final tree; `npm run check` when the audit probe answers.
2. Split commits in convention order, each followed by `npm run typecheck`:
   - `fix(kb): report recall state and degrade with remediation` — `src/index.ts`, `src/kb.ts`;
   - `test(kb): assert blend recall, research recall, and degradation evidence` — `src/kb-model.test.ts`, `debate-club/src/kb-retrieval.test.ts`;
   - `docs(kb): resolve the R6 retrieval findings and retire the section` — `worklist.md`, `ROADMAP.md`, `CHANGELOG.md`, the increment record.
3. Report the commit list and stop before `npm run release`.

## Alternatives considered (summary)

- **Do nothing on deep with no KB; interpret "not applicable" as conditional on a configured KB.** Rejected in D1: REQ-076a's sentence is request-shaped, and the one-line initialization is cheaper than a spec waiver.
- **Test the blend defect at the unit seam by extracting a helper.** Rejected: the defect lives in the tool handler's ordering of filter and mode; an extracted helper would test the extraction, not the wiring the finding names. The Arena already drives this handler.
- **Add an error fixture per provider to force external failure.** Rejected: `general_web` providers (`duckduckgo`, `marginalia`, `mojeek`, `wiby`) have no fixture hosts, so replay already answers them with a synthetic 599 (`debate-club/scripts/preload.mjs:98-101`), the HTTP layer treats it as an error, and the unmatched fixture log stays empty.
- **Add a Jina page fixture for the deep read.** Rejected after reading `renderersForUrl` (`src/index.ts:933-951`): a `*.wikipedia.org` URL puts the Wikipedia renderer first, and the existing `action=parse` fixture (`debate-club/fixtures/index.json:173-176`) serves it, so no fixture change is needed.

## Edge cases and rollback

- **Every provider returns empty instead of erroring (no `lastError`).** The chain reports a legitimate zero-result answer at `src/index.ts:773` and does not consult the cache; D3a records that as an out-of-scope P3, so this test does not assert it and the plan relies on the verified 599/error path for the fallback assertion.
- **`kbSearch` scores the seed row at or above 0.99.** C-3 applies: adjust the fixture text/query, never the thresholds.
- **The deep read hits an unmatched fixture host.** The Wikipedia renderer is selected first for the `*.wikipedia.org` result URL and the `action=parse` fixture serves it; if the provider builds a different URL, check `server.unmatched()` and correct the request, not the fixture set.
- **No KB rows because the collection is wrong.** The ingest and the search both pass `collection: "arena-retrieval"`.
- **Rollback:** revert the two source edits and delete the new test file; bookkeeping is a normal `git revert` of the docs commit. No stored state, schema, config key, or fixture change.

## Delta amendments

- **2026-11-10 (execution) — C-3 probe narrowed to the relevance leg.** The original condition required `freshness_score < 0.99`, which is impossible for a freshly ingested stable row (score ≈ 1.0). The sufficiency filter is an AND, so a `score < 0.99` row is already sub-threshold. The precondition now probes `score`; no file, gate, or behavior scope changed. Cold review Major 1's requirement — that the default-mode contrast fail on the unmodified tree — is still met.

## Verification

| Claim | How verified |
|---|---|
| Research reports `not_applicable` | Arena `kb-retrieval.test.ts` assertion on `meta.kb_recall` |
| Deep with no KB reports `not_applicable` | Second Arena server, `kb: null`, `deep: true` |
| Deep+skip reports `not_applicable` | First Arena server, `deep: true, fresh: true` |
| Blend returns sub-threshold cached rows | Arena blend test with 0.99 thresholds, precondition `score < 0.99`, plus the default-mode contrast |
| KB-first still gates on thresholds | Same file, default-mode assertion (`miss`, no seeded URL) |
| Degradation event carries remediation and stats report the state | `src/kb-model.test.ts` |
| No regression in the tool surface | `check-tdqs`, `check-intent-citations`, `validate-spec`, `npm run test`, `test-debate-club` |
| Gates green | `check:fast`, then `check` (audit-conditioned) |
