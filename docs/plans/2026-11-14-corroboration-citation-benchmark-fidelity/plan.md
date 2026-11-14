# Plan — Citation chain, dedupe merge, benchmark failure, and bounded preservation

**Status:** plan-review — cold pass passed (0 blockers, 8 majors, 5 nits), all resolved
across the initial pass and one targeted diff re-review over the amended sections
· **Date:** 2026-11-14
**Depth:** standard — three source modules, one REQ amendment, one register, one roadmap
retirement; every change is reversible
**Review independence:** fresh — one cold dispatch over a frozen artifact; the reviewer
saw no authoring context (stages 1–3 and 5 ran in one fresh context; stage 4 was not
triggered, recorded as condition C-1)
**Rollback cost:** 1 — a commit-series revert restores code, spec, register, and roadmap
**Roadmap item:** `ROADMAP.md:17-31` § Corroboration, citation, and benchmark fidelity —
this increment closes the four remaining rows and retires the section
**Predecessor:** `5be14d3`
**Findings:** `F-R5-C-8`, `F-R5-E-1`, `F-R5-E-2`, `F-R5-F-1`

**Done bar:** all four register rows read `Resolved` with a driving test or a recorded
re-disposition; REQ-026c is amended inside its mechanical limits; `ROADMAP.md` no longer
carries the § Corroboration section; the register census is re-derived; `npm run check`
passes on the final tree; `aar.md` ends `LOOP PAUSED`.

**Review cap:** 2 passes — one cold pass plus one diff re-review.

## Scope

Four register rows, each re-verified against the current tree rather than trusted from
the roadmap text.

1. **`F-R5-E-1` — the academic chain is silently truncated.**
   `searchCitations` slices the configured `academic` chain to
   `config.output.fallback_depth` (`src/cite.ts:148`; `config.json:360` sets 5). The
   shipped chain is exactly five slugs (`semantic_scholar`, `arxiv`, `openalex`,
   `europe_pmc`, `crossref`), so the defect is latent today and reachable the moment an
   operator appends a sixth provider: that provider is neither attempted nor named in
   `providers[]`. REQ-027a requires aggregation from *every eligible* provider in the
   chain and a per-provider status for each attempted one
   (`infobroker.md:361`). `fallback_depth` is a sequential-dispatch concept;
   `DECISIONS.md` D-036 already refuses it for corroboration for the same reason
   (`DECISIONS.md:1861,1869-1871`).
2. **`F-R5-E-2` — a DOI-bearing and a title-only reference never merge.**
   `dedupeCitations` keys every reference by exactly one namespace: `doi:<normalized>`
   when a DOI is present, else `title:<slug>|<year>` (`src/cite.ts:115-139`). Two
   providers that return the same work — one with a DOI, one without — therefore survive
   as two citations, and the DOI-bearing copy does not enrich the one the caller sees.
   `titleKey` also folds the year into the key (`:116`), so a title-only reference that
   omits the year can never match its DOI-bearing twin even inside one namespace.
3. **`F-R5-F-1` — a broken reconciler scores as raw order and passes.**
   `rankedUrls` wraps `reconcileResults` in a bare `try`/`catch` and returns the
   unreconciled order on any error (`src/retrieval-benchmark.ts:99-106`). A thrower
   therefore silently degrades every run to raw order, so the reconciled-versus-raw
   comparison REQ-130 requires is never measured; the suite then compares a degraded
   aggregate against the recorded floor (`src/retrieval-benchmark.test.ts:61-66`) and can
   stay green over a totally broken reconciler (`infobroker.md:355`).
4. **`F-R5-C-8` — preservation is awaited inline, and two REQs disagree about it.**
   `verifyClaims` awaits the archive wave and then the snapshot wave before returning
   (`src/corroborate.ts:873-881`), so the response waits on the Wayback save (bounded at
   `ARCHIVE_TOTAL_BUDGET_MS` = 2000 ms, `:1019,1040-1073`). REQ-026c promises preservation
   is *non-blocking* **and** reports the archive reference in the finding
   (`infobroker.md:325`); a reference that is not awaited cannot be reported. The
   snapshot wave itself is local in production: `snapshotSource` calls `kbIngest`
   synchronously (`src/preservation.ts:61-88`) and `verify_claims` passes no
   `fetchSource` — that option exists only as a test seam (`src/corroborate.ts:940,959`).
   The genuine response-path risk is the archive wave plus, when an operator configures
   an external content-policy assessor, one 8 s assessment per source
   (`src/content-policy.ts:92-107`; mode defaults to `off`, `:46-49`).

**Not in scope, and why.**

- No new config key. The amendment bounds preservation by the existing budget rather than
  adding a `preservation.budget_ms` knob, which would require config schema, validation,
  docs, and a second REQ surface for no caller benefit.
- No change to `fallback_depth` semantics for `search_web`: the sequential chain keeps
  its cap, and only `get_citations` stops borrowing it. `E-1` fixes the wrong consumer,
  not the knob.
- Deferring preservation past the response is rejected (D4): a response that reports a
  snapshot it has not stored is the same class of provenance defect the previous
  increment fixed in `F-R5-C-4`.

## Baseline (verified this session)

- `npm run status` → 253 unpushed commits, oldest 5.0 d, version `2026.11.14`, latest tag
  `v2026.11.07`, 2 open roadmap items, last pipeline run 2026-11-07. The backlog is past
  AGENTS' 24 h AAR trigger; it is recorded here and handled at session close, not folded
  into this increment.
- `git status --short` → clean; `git log -1` → `5be14d3 release: 2026.11.14`.
- `npm run check:fast` → **PASS**, 19 gates, 30.2 s. The full `npm run check` (network +
  pack + debate-club build) runs as Step 0 of execution, before any edit.
- **Register census today** — `docs/plans/2026-11-14-register-reconciliation/evidence/census.ts`
  is authoritative and was run this session:
  `rows: 276 / distinct ids: 276 / Resolved: 179 / Closed-P3: 93 / Scheduled-roadmap: 4`,
  with the four scheduled IDs exactly the four this plan names and
  `scheduled without a ROADMAP.md mention (0)`. Two other figures in that file are not
  live counts: `worklist.md:588` ("7 rows") is a stale census cell to be rewritten in
  Step 5, and `worklist.md:894` is a dated 2026-11-14 disposition recording the state
  reached by the earlier reconciliation (170/93/13) — a historical record, left as-is.
- **Roadmap count:** `ROADMAP.md` carries two live sections (`:17` § Corroboration and
  `:33` § Calibration gold-set refresh) plus § Non-goals. Retiring the first leaves
  **1** open roadmap item, not 0.
- **Interim gate state:** once this directory exists and before `aar.md` is written,
  `check-loop-artifacts` reports a missing `aar.md`. That is expected during the
  increment and closes at Step 6.

## Design decisions

- **D1 — `get_citations` walks the full eligible chain.** Drop the
  `.slice(0, config.output.fallback_depth)` at `src/cite.ts:148`; `getDispatchChain`
  already filters to usable providers (`src/config.ts:1184-1190`) and
  `defaultEligibility` reports per-provider `skipped` states. The academic chain is
  operator-controlled and bounded by `config.dispatch.academic`, so no replacement cap is
  introduced. Rejected: raising `fallback_depth` in `config.json` (fixes one shipped
  chain, leaves every operator chain truncated, and conflates a sequential knob with a
  fan-out); rejected: slicing to a new `citation_max_providers` key (new config surface
  for a list the operator already controls).
- **D2 — dedupe reconciles across namespaces with a year guard.** Keep DOI as the
  authoritative identity and add a title index keyed by normalized title (year excluded)
  whose value is an **array** of representatives, because two different works can share a
  generic title: `Map<string, CitationResult[]>`, plus the existing `Map<string, CitationResult>`
  for DOI. On each citation, in chain order: compute its DOI key and title key; find a
  candidate group by DOI when a DOI is present, otherwise scan the title bucket for an
  entry that passes the year guard; when nothing matches, push the citation onto the
  title bucket (and the DOI map when it has a DOI) as a new representative; when it
  matches, merge into that member. **Year guard:** merge when either side lacks a year or
  when both years are equal; do not merge when both are present and differ. **Representative
  rule (single, order-independent):** the member first seen in chain order stays the
  representative whether it arrived with a DOI or as title-only; later members merge their
  fields into it and are not emitted. So a title-only first record is enriched with the
  later DOI rather than replaced, which is the case `F-R5-E-2` names. The merge keeps the
  existing richer-field rule (`src/cite.ts:129-136`) and recomputes BibTeX. `deduped`
  stays `rawCount - unique.length`. Rejected: keying everything by title (two different
  works with a generic title such as "Editorial" would collapse); rejected: title+year
  only (never merges the very case the finding names — a title-only reference with no
  year); rejected: promoting the DOI-bearing member to representative regardless of
  order (a later, lower-priority provider would displace the caller's first choice).
- **D3 — a reconciler failure fails the benchmark.** Remove the `try`/`catch` in
  `rankedUrls`. That function already has a third parameter named `reconcile`, typed
  `boolean` (`src/retrieval-benchmark.ts:99-100`); it keeps the name and gains a fourth.
  Exact shapes:
  - `type Reconciler = (results: SearchResult[], query: string) => SearchResult[];`
  - `rankedUrls(candidates, query, reconcile: boolean, reconciler: Reconciler): string[]`
    — `reconcile === false` maps candidates directly to URLs; otherwise it calls
    `reconciler(candidates, query)` and maps the result, with no `try`/`catch`;
  - `runBenchmark(cases, k = 5, reconciler: Reconciler = reconcileResults)`.
  The raw comparison therefore uses the boolean's false path and needs no identity
  function. `scripts/benchmark-retrieval.ts:59` and every existing caller keep the
  two-argument form. Rejected: keep the fallback and report a `reconciler_error` field
  (the floor still passes on raw order, so the gate remains blind); rejected: count
  errors and warn on stderr (advisory, so `npm run test` stays green — the finding is
  that the suite passes); rejected: making `runBenchmark` async so the failure surfaces
  as a rejection (changes two synchronous callers for no gain; a synchronous throw is
  already observable with `toThrow`).
- **D4 — preservation stays in the response path, bounded and concurrent; REQ-026c is
  amended to say so.** The two requirements cannot both hold as written, so the increment
  picks the clause that keeps the citation-grade promise: the archive reference is
  reported whenever the attempt completes inside the budget, and preservation is bounded
  rather than "non-blocking". Implementation: replace the two sequential awaits
  (`src/corroborate.ts:873-881`) with one `preserveCondensedSources` that starts the
  archive and snapshot waves **concurrently** under one `AbortController` deadline; the
  archive wave already honours the signal, and the snapshot worker passes the signal into
  the only network work it can do — the optional `fetchSource` document upgrade and the
  external content-policy assessment. Snapshot storage itself stays untouched: it is a
  synchronous local `kbIngest` (`src/preservation.ts:61-88`) and cannot block.
  **Divergence disposition (REQ-122):** a configured external assessor that does not answer
  inside the budget leaves that source ungraded. That is REQ-122's recorded storage-failure
  path — "SHALL NOT alter confidence, verdict, or the response when storage fails"
  (`infobroker.md:349`) — not a new branch, and the response stays unchanged. The common
  path (policy mode `off`, `src/content-policy.ts:46-49`) never reaches it. D-122 names
  this disposition explicitly. Both operator toggles (`preservation.enabled`,
  `preservation.archive`) keep their current independent meaning. Rejected: detach both
  waves and return a `pending` state (REQ-122 requires the hash and tier in the same
  response; a pending marker reports a snapshot the caller cannot retrieve); rejected:
  detach only archiving (REQ-026c's report-the-reference clause becomes unreachable and
  the response silently loses provenance); rejected: add a time qualifier to REQ-122 as
  well (it weakens a product promise to cover an opt-in assessor that already carries an
  8 s per-call ceiling). The option `archiveBudgetMs` is renamed `preservationBudgetMs` —
  it is internal (`CorroborateOptions`, set only at `src/corroborate.test.ts:1081`) and
  now bounds the shared deadline.
- **D5 — REQ-026c is reworded without adding a branch.** The amendment replaces
  "SHALL be non-blocking" with a bound and makes reporting conditional on the attempt
  completing inside it. **Post-edit counts (measured on the proposed body):** 535 body characters, 3 sentences,
  6 `SHALL` clauses, one paragraph — inside Appendix B's ≤800 characters, ≤8 sentences,
  ≤8 `SHALL`, one-paragraph limits, and it remains one logical contract (one budget to
  which reporting and failure-tolerance are attached). Pre-edit on the same basis: 436
  body characters, 3 sentences, 5 `SHALL` (449 characters including the `_Check:_ G1.`
  marker). The clause detector (`src/clause-coverage.ts:19,23`) matches only
  `when … declares` and parenthesized `or` enumerations, so "when the attempt completes"
  adds no detected branch; the four existing tags — `preservation-gate`
  (`src/corroborate.test.ts:965`), `archive-opt-out` (`:991`),
  `archive-failure-tolerant` (`:1013`), `archive-wave-budget` (`:1049`) — stay
  sufficient. `npm run validate-spec` is re-run at Step 1 to confirm.

## Steps

### Step 0 — Baseline and preflight

1. `npm run status`, `git status --short`, `git log -1 --oneline`; record them.
2. `npm run check` (full). Stop and report if it is red; a red baseline is fixed as its
   own commit before any step below.
3. Confirm the class-change probes the plan depends on, with these exact expected
   values (recorded at plan time):
   - `grep -c "fallback_depth" src/cite.ts` → `1` (the `:148` slice);
   - `grep -n "archiveBudgetMs\|ARCHIVE_TOTAL_BUDGET_MS" src/corroborate.ts src/corroborate.test.ts`
     → **5** lines: `src/corroborate.ts:583` (option), `:876` (call), `:1019`
     (`ARCHIVE_TOTAL_BUDGET_MS` declaration), `:1042` (its default use), and
     `src/corroborate.test.ts:1081` (the only override);
   - `grep -c "^| F-R5-" docs/plans/2026-11-09-full-review-sweep/worklist.md` → `53`
     (the R5 rows; the file's total row count is 276).
   A mismatch means the tree moved; stop and re-verify the affected step.

### Step 1 — Amend REQ-026c (spec)

**File:** `infobroker.md` (line 325 body only).

Replace the second sentence of REQ-026c with the bound, and qualify the reporting clause:

> … and SHALL report that reference alongside the live URL in the finding when the
> attempt completes within the preservation budget. Preservation SHALL be bounded in time
> and concurrency, SHALL run concurrently with snapshot storage, and SHALL NOT affect
> confidence, verdict, or the response on archive failure. …

**Verify:** `npm run validate-spec`; compare the body against Appendix B's limits
(≤800 characters, ≤8 sentences, ≤8 `SHALL` clauses, one paragraph, one logical contract)
and record the post-edit counts (D5 states the expected 535 / 3 / 6); confirm no
clause-coverage tag is newly required. Update `infobroker.md:1129` if its
`fallback_depth` verification line now overclaims beyond `search_web`.

### Step 2 — Citation chain and cross-namespace dedupe (`F-R5-E-1`, `F-R5-E-2`)

**Files:** `src/cite.ts`, `src/cite.test.ts`.

1. `src/cite.ts:148` — drop the `.slice(0, config.output.fallback_depth)`; update the
   file header comment to say the chain is walked whole.
2. `src/cite.ts:104-139` — split `titleKey` into a title-only key plus a year guard;
   add the two-index merge described in D2, keeping the richer-field merge and
   first-seen representative.
3. **Tests** (`src/cite.test.ts`):
   - chain of three with `fallback_depth: 1` in the mocked config: all three attempted,
     three `providers[]` rows, references from each merged;
   - a DOI-bearing reference followed by a title-only twin: one citation, DOI retained,
     richer fields merged, `deduped` incremented;
   - the reverse order (title-only first, DOI second): one citation, DOI adopted;
   - same title with two different years on both sides: two citations (guard holds);
   - same title, one side year-less: one citation;
   - existing "keeps distinct works separate" (`:152`) and "falls back to title identity"
     (`:139`) still pass unchanged.
4. **Verify:** `npx vitest run src/cite.test.ts`.

### Step 3 — Benchmark fails on reconciler error (`F-R5-F-1`)

**Files:** `src/retrieval-benchmark.ts`, `src/retrieval-benchmark.test.ts`.

1. `rankedUrls` keeps its `reconcile: boolean` third parameter and gains a fourth,
   `reconciler` (`src/retrieval-benchmark.ts:99-106`), and loses its `try`/`catch`;
   `runBenchmark` gains the optional third parameter
   `reconciler: Reconciler = reconcileResults` (`:108`); the raw comparison stays on the
   boolean's false path.
2. **Test:** `expect(() => runBenchmark(fixture.queries, fixture.k, () => { throw new Error("boom") })).toThrow("boom")`
   — `runBenchmark` is synchronous, so the assertion is `toThrow`, not `rejects`; the four
   existing metric tests, the floor test, and the baseline-binding test pass unchanged.
3. **Verify:** `npx vitest run src/retrieval-benchmark.test.ts` and
   `npm run benchmark-retrieval -- --json` (unchanged output).

### Step 4 — Bounded, concurrent preservation (`F-R5-C-8`)

**Files:** `src/corroborate.ts`, `src/corroborate.test.ts`.

1. Replace the two awaits at `src/corroborate.ts:873-881` with one
   `preserveCondensedSources(findings, config.preservation, budgetMs)` that:
   - starts `archiveCondensedSources` and `snapshotCondensedSources` concurrently under
     one `AbortController` and one deadline;
   - passes the signal into the snapshot worker, where it bounds only network work —
     the optional `fetchSource` document upgrade and the external content-policy
     assessment — and never skips the local synchronous store;
   - keeps `preservation.enabled === false` disabling both and `preservation.archive ===
     false` disabling only archiving.
2. Rename `archiveBudgetMs` → `preservationBudgetMs` in `CorroborateOptions` and in the
   one test that sets it (`src/corroborate.test.ts:1081`).
3. **Tests** (`src/corroborate.test.ts`):
   - a `fetch` stub that never settles for the Wayback save: `verifyClaims` resolves
     within budget + a stated slack, findings and confidence are unchanged, and
     `archived_url` is absent (re-disposition proof: bounded, not unbounded);
   - the same stalled archive with policy mode `off`: **every** cited source still
     carries a snapshot hash and tier, so the deadline does not truncate REQ-122's
     per-source coverage;
   - a `fetchSource` stub that never settles: same bound, and a source keeps its snippet
     hash — never a document-grade hash for text that was not stored;
   - `preservation.archive: false` still archives nothing while snapshots are stored
     (existing tests at `:966-1005` unchanged);
   - the archive-failure path still never alters verdict or confidence.
4. **Verify:** `npx vitest run src/corroborate.test.ts`.

### Step 5 — Docs, register, roadmap

**Files:** `DECISIONS.md`, `README.md`, `ROADMAP.md`,
`docs/plans/2026-11-09-full-review-sweep/worklist.md`,
`skills/infobroker/references/config-tune.md`.

1. `DECISIONS.md` — add **D-122** (next free id; current maximum is D-121) recording the
   REQ-026c/REQ-122 conflict, the bounded-and-concurrent choice, the REQ-122
   storage-failure disposition for a timed-out external assessor, and the three rejected
   alternatives from D4.
2. `README.md:361-364` — state that archiving is bounded and reports the reference when
   the save completes within the budget (spec→README binding: a REQ body changes this
   run, so `README.md` must carry a non-whitespace diff).
3. `worklist.md` — flip the four rows (`:767`, `:776`, `:777`, `:783`) to `Resolved` with
   the driving test named, then run
   `npx tsx docs/plans/2026-11-14-register-reconciliation/evidence/census.ts` and record
   its actual output. Expected: `276 rows / 276 ids / Resolved 183 / Closed-P3 93 /
   Scheduled-roadmap 0 / scheduled without a ROADMAP.md mention (0) / census self-check OK`.
   Also rewrite the disposition-census cell (`:585`) and the now-false
   `Roadmap mapping` cell (`:588`, which currently claims "7 rows") in the same commit.
   Leave `:894` untouched — it is a dated disposition recording an earlier census.
4. `ROADMAP.md` — remove the § Corroboration section (its four remaining rows are now
   resolved; the other three were retired on 2026-11-14); keep § Calibration gold-set
   refresh and § Non-goals. `npm run status` should then report **1** open roadmap item.
5. `skills/infobroker/references/config-tune.md:62` — reword `fallback_depth` to say it
   bounds sequential dispatch chains and does not bound `get_citations` aggregation.
6. **Verify:** `npm run check-roadmap`, `npm run check-non-goals`,
   `npm run validate-readme`, `npm run check-loop-artifacts` (still red until Step 6).

### Step 6 — Increment record and close

1. Write `tasks.md` entries with copy-pasted command output per step (created with this
   plan).
2. Write `aar.md`: findings register, dispositions, cap usage, `LOOP PAUSED`.
3. `npm run check` on the final tree; `npm run check-loop-artifacts` green.
4. `npm run session:close`.

## Blast radius

| File | Change | Size |
|---|---|---|
| `infobroker.md` | REQ-026c body; `:1129` scoping if needed | S |
| `src/cite.ts` | chain slice removed; dedupe indexes + year guard | M |
| `src/cite.test.ts` | five new cases | M |
| `src/retrieval-benchmark.ts` | injectable reconciler; no silent fallback | S |
| `src/retrieval-benchmark.test.ts` | throw-propagation case | S |
| `src/corroborate.ts` | merged bounded preservation wave; option rename | M |
| `src/corroborate.test.ts` | stall-under-budget cases; option rename | M |
| `DECISIONS.md` | D-122 | S |
| `README.md` | bounded-archiving sentence | S |
| `ROADMAP.md` | section removed | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | four rows + census | S |
| `skills/infobroker/references/config-tune.md` | `fallback_depth` wording | S |
| `docs/plans/2026-11-14-corroboration-citation-benchmark-fidelity/{plan,tasks,aar}.md` | increment record | M |

## Commit series

Order per AGENTS: spec → source (with its tests) → docs → release. Each commit is
`npm run typecheck`-verified; the final tree gets one full `npm run check`.

1. `spec(verify): bound preservation and report the archive reference` — `infobroker.md`.
2. `fix(cite): walk the full academic chain and merge DOI-less twins` — `src/cite.ts`
   and `src/cite.test.ts`.
3. `fix(benchmark): fail on a reconciler error instead of scoring raw order` —
   `src/retrieval-benchmark.ts` and its test.
4. `fix(verify): bound and overlap preservation with the response` —
   `src/corroborate.ts` and its test.
5. `docs(tracker): retire the citation and preservation rows` — `DECISIONS.md`,
   `README.md`, `ROADMAP.md`, `worklist.md`, `config-tune.md`.
6. `docs(plans): record the citation and preservation increment` — plan/tasks/aar.

**This series stops at commit 6.** Publishing is a separate instruction: `npm run prep`
(AI steps) then `npm run release` (deterministic) per AGENTS, and the release commit's
version stamps and CHANGELOG entry are produced by `prep`, not by this increment. If the
user asks to ship, commit 7 is `release: <version>` and is gated by a clean tree whose
version and CHANGELOG agree.

## Risks and rollback

| Risk | Mitigation |
|---|---|
| Removing the chain cap makes a misconfigured chain fan out unexpectedly | The chain is an explicit operator list; each provider is still eligibility-filtered, throttled, quota-checked, and reported; a test pins the full-chain behavior |
| The title index merges two different works that share a generic title | Year guard (merge only when a year is absent or equal) plus a per-title bucket rather than a single entry; a test pins the distinct-years case |
| A configured external assessor times out, so a source is left ungraded | Recorded as REQ-122's storage-failure path in D-122; only reachable with a non-`off` policy mode and an external endpoint; the response and confidence are unchanged |
| Concurrent archive and snapshot waves contend on the same `fetch` stub in tests | Tests stub `fetch` by URL; the archive path and the fetch-source seam are distinct |
| The census script's output differs from the expected counts | Re-derive and record the actual output; never hand-adjust the block |
| Rollback | Each commit is independently revertible; step 5 is the only coupled one, and reverting it restores the roadmap section and register dispositions |

## Verification summary

- Per step: the named vitest file, plus `npm run validate-spec` after Step 1 and the
  named doc gates after Step 5.
- Final: `npm run check` (full) on the tree to ship, then `npm run session:close`.
- No live network is required for any test: archive and fetch seams are stubbed, and the
  benchmark reads committed fixtures.

## Unknowns

- Whether `validate-spec`'s clause detector treats the amended REQ-026c as adding a
  branch — resolved by running it immediately after Step 1; the detector source
  (`src/clause-coverage.ts:19,23`) matches only `when … declares` and parenthesized `or`
  enumerations, so it should not. If it does, add
  `// @implements REQ-026c bounded-preservation` to the stall test.
- Whether the census script's `Roadmap mapping` line needs rewording once the section is
  removed — it is re-derived, not hand-edited, so the script decides; the stale `:588`
  cell is rewritten by hand in the same commit either way.
- The externally-assessed-policy timeout path has no injectable seam today, so its
  disposition is recorded in D-122 and covered by REQ-122's storage-failure clause rather
  than by a dedicated test. Condition C-2 for `build-review`.
- `npm run status`'s roadmap count is inferred from `ROADMAP.md` structure (two live
  sections now, one after Step 5); Step 5 verifies the printed number.
