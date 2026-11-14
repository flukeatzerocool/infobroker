# Plan — fetch and extraction fidelity remediation

**Status:** revised after one cold pass (3 Blockers, 7 Majors, 6 Nits; all resolved in this revision), awaiting re-review and user approval · **Date:** 2026-11-14 · **Depth:** standard (six production modules, one shared test harness, reversible behavior edits, no destructive or publish surface)
**Review cap:** 3 passes (self pass, cold pass, one targeted re-review)
**Review independence:** fresh — one cold pass (5 stages: 3 Blockers, 7 Majors, 6 Nits) plus one targeted diff re-review (2 Majors) and one user-authorized final verification pass (`independent-review passed.` on both fixes); reports in `plan.cold/`
**Rollback cost:** 1 — source-level behavior edits plus test additions and one REQ sentence. No state-format change, no schema or credential change, no new dependency.
**Roadmap item:** `ROADMAP.md` § Fetch and extraction fidelity (retired to `CHANGELOG.md` when this increment closes)
**Predecessor:** `e1e49b4` (register reconciliation; its AAR re-homed these rows to the roadmap section)
**Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md` § Finding register (F-R4-C-4, C-5, C-6, C-11, D-4, E-2)

## Why this section

R4 fetch remediation closed the P1 extraction rows on 2026-11-11; the
`Scheduled-roadmap` rows that remediation left behind were re-homed on
2026-11-14 to the roadmap section named above. That section is first in
`ROADMAP.md` and every row it names is still `Open` as of the
register-reconciliation verification (`docs/plans/2026-11-14-register-reconciliation/tasks.md:69-74`).

The six rows share one surface: what `fetch_page` reports about a document it
already has (its date, its structured metadata) and what it refuses to do with
input it cannot represent (a batch in raw mode). Two are request-routing
defects (a `question` that skips the cache, a stringified array that skips the
raw guard), two are date-coverage gaps (crawl/extract, redirect metadata), and
two are structured-metadata fidelity gaps (nested microdata, fact
representation).

## Baseline (verified this session)

- `git log -1` → `e1e49b4`; `git status --porcelain` clean.
- `npm run status` → version 2026.11.11 (latest tag `v2026.11.07`), **243 unpushed commits, oldest 4.9 d**, 3 open roadmap items.
- `npm run check` → **PASS** (full, 22 gates, 166.8 s).
- `npm run check-loop-artifacts` → 0 errors, one pre-existing warning (`2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:** line`). Warning only, out of scope (C-8).
- `plan-gate preflight` → 10/10 targets exist and are tracked, 7/7 REQs resolve, 0 external paths, plan sha256 `937a26e6…` at the reviewed revision.

## Predicates re-verified by reading the code this session

| Finding | Current code | What is wrong |
|---|---|---|
| F-R4-C-4 | The crawl branch returns its envelope at `src/index.ts:1298` and the extract branch at `:1361`; `effectiveDetectDate` is computed at `:1189` but neither branch reads it. `detect_date` is accepted and silently ignored by both early branches. |
| F-R4-C-6 | `detectPageDate` (`src/index.ts:879-902`) returns header evidence if any, then issues the metadata GET only when `head.status < 300 \|\| head.status >= 400` (`:890`). **Only the 3xx case is a gap**: a 405 satisfies `>= 400`, so the metadata GET is issued today. A redirected URL never reaches meta/JSON-LD/`<time>` evidence. |
| F-R4-C-5 | The KB read-through is guarded by `!crawl && !extract && !question` (`src/index.ts:1204`). A question request pays an outbound fetch even when a fresh copy of the same text is stored, though REQ-021g scopes the cache to "the requested URL", not to a request shape. |
| F-R4-D-4 | `rawRequestError(params.url, …)` runs in the handler at `src/index.ts:1993`, before `doFetchPage` coerces the input (`:1149`, via `coerceStringArray`). `rawRequestError` tests `Array.isArray(url)` only (`src/structured-output.ts:157-162`), so a JSON-array **string** passes the guard and then runs as a batch. |
| F-R4-C-11 | `extractStructured` collects microdata with `$(el).find("[itemprop]")` (`src/extract.ts:38-45`), which matches itemprop descendants of nested `itemscope` items and attributes them to the outer item. The outer `$("[itemscope]").each` already visits each nested item, so the entry exists — only the *attribution* is wrong. |
| F-R4-E-2 | `wikipediaFacts` concatenates infobox and table rows (`src/structured-fact.ts:372`) and `factFromRows(kind, rows, "wikipedia", url)` names one source for both (`:373`). `InfoboxRow` (`src/lib/infobox.ts:10-13`) carries no origin, so the resolved fact cannot say which representation it came from, as REQ-021i requires. |

Seams read this session: `fetchPageContent`/`fetchPageContentInner` return shape (`src/index.ts:914-999` — `{slug, content, truncated, elapsed}`, **no headers**), `detectDocumentDate` (`src/datetime.ts:123-132`), `fetchFollowRedirects` (`src/lib/url-guard.ts:185-210`, re-guards every hop), `coerceStringArray` (`src/batch.ts:65-102`), `fullContentEnvelope` (`src/index.ts:1102-1134`), the matched-passage envelope (`:1564-1602`), `cacheHitPayload` + the cache-hit envelope (`:1211-1234`), the crawl and extract fetch calls (`:1260`, `:1329` — both `cleanHtml: false`, so `fetched.content` is raw HTML), `collectInfoboxRows`/`collectTableRows`/`parseInfobox`/`parseTables` (`src/lib/infobox.ts:83-133`), `factFromRows` (`src/structured-fact.ts:323-364`), `envelopeOutputSchema` (`src/output-schema.ts:10`, `z.looseObject`), and the stub harness (`src/lib/stub-provider.ts` — `pageBody`, `pageHeaders`, and a `requests` counter, **200 for every method**; `src/fetch-page-extraction.test.ts` — spawned server, `page()`, `fetchPage()`, `waitForStored()`, the bespoke redirect-chain server at `:375`, and the second-config pattern at `:476-491`).

**Callers of `detectPageDate` (two, not one).** The plain fetch path
(`src/index.ts:1548`) and `search_web` deep reading (`:750`, gated by
`deep.detect_date`). D2 changes the function's redirect behaviour, so deep
reading also gains a metadata GET on a redirected page — bounded by the same
hop cap. That consequence is stated in D2 and asserted by the deep-read suite,
not left implicit.

**Reachability (verified, not assumed).** Both crawl and extract fetch with
`cleanHtml: false`, so `fetched.content` on those paths is the **raw HTML** the
metadata parser needs — the date can be derived with no additional request. The
cache-hit path is reachable through the harness by fetching a page once
(auto-index) and awaiting `waitForStored`, then fetching the same URL again. A
redirected page is served by the file's existing bespoke redirect server
(`src/fetch-page-extraction.test.ts:375`); the shared stub answers 200 for every
method, so no 405 case is claimed.

## Done bar

**Done bar:** F-R4-C-4, F-R4-C-5, F-R4-C-6, F-R4-C-11, F-R4-D-4, and F-R4-E-2 are fixed and marked `Resolved` in the worklist with a one-line summary; every behavior change ships a test that fails on the unmodified source and passes on the final tree (the red result is recorded in `tasks.md`); specifically: a crawl with `detect_date` reports a date on every crawled page whose **document metadata** carries one, an extract request reports the same evidence on its envelope, and neither path adds an outbound request (the date comes from the already-fetched raw HTML, bounded to the same 200 000 characters the plain path parses) — a page whose only date is a `Last-Modified` header reports none on those paths, and that limitation is stated in the same sentence of the README, the CHANGELOG bullet, the worklist summary, and D-121; a URL whose HEAD redirects now yields document-metadata evidence, with each hop still passing the SSRF guard, and `search_web` deep reading keeps working under the same change; a `question` against a URL with a fresh KB copy returns `provider: "knowledge_base"`, `meta.cache: "hit"`, ranked passages with `passages_returned` and `match_quality`, and issues no outbound request, while a zero-passage hit returns the full-content envelope with the same cache metadata; `raw: true` with `url` given as a JSON-array string returns a REQ-002 `invalid_input` error, as does an empty array, rather than a batch; nested microdata properties are not attributed to the parent item (the flat entry list already exists; the attribution is what changes); a `wikipedia` fact resolved from a table row carries the table representation and one resolved from an infobox carries the infobox representation, with `source` still `"wikipedia"`; the register census is re-derived from the file and its four cells plus the roadmap-mapping line agree with the new dispositions; `ROADMAP.md` no longer carries the section; `CHANGELOG.md` carries one bullet under the existing `## 2026.11.11` heading; the increment record carries plan, tasks, and an AAR ending `LOOP PAUSED` or `LOOP OPEN`.

**Non-closure rule:** a fix that needs a new dependency, a change to the cache
freshness policy, an added outbound request on the crawl path, or a
response-schema breaking change stops that slice. Shipped slices are recorded
in `CHANGELOG.md`, the unshipped rows stay scheduled on a successor
`ROADMAP.md` section, and the AAR ends `LOOP OPEN`.

## Decisions

- **D1 — A crawl or extract date comes from the document already in hand.**
  Both branches hold `fetched.content` as raw HTML, so each slices it to
  200 000 characters (the bound the plain path already uses at
  `src/index.ts:893`) and calls `detectDocumentDate(html)` once per document,
  mapping the result through the shared helper of D1a. **Header evidence is not
  consulted on these paths** — the renderer layer returns a body only
  (`fetchPageContent`'s return type carries no headers), and widening that
  return shape would touch every renderer and the hedge/fallback consumers for
  one field. The limitation is recorded as D-121 and stated in the README,
  the CHANGELOG bullet, and the worklist summary.
  - **Alternative rejected:** a per-page `detectPageDate` call — a crawl would
    triple its egress (F-R4-C-7 accepted three requests per *single* fetch as a
    P3 cost; multiplying that by `crawl_max_pages` is a regression, not a fix).
  - **Alternative rejected:** threading response headers out of
    `fetchPageContent`. It buys header evidence at the price of changing a
    five-renderer seam and the hedge/fallback paths that consume it; the
    document metadata is the evidence the finding actually names.
  - **Alternative rejected:** parsing the full uncapped HTML. The crawl fetches
    with `Number.MAX_SAFE_INTEGER` (`:1260`), so an unbounded cheerio parse per
    page would repeat that cost `crawl_max_pages` times; the 200 000-character
    slice matches the plain path's existing bound.
  - Consequence: for a crawl, the date sits on each page object (beside its
    `url`, `depth`, and truncation state) and the per-page auto-index carries
    `source_updated_at` for modified evidence only, matching the plain path
    (F-R4-C-2).
- **D1a — One date-to-metadata helper.** The three inline modified/published
  mappings (`src/index.ts:1552-1556`, and the two added by D1) collapse into a
  single local `dateMetaFrom(detected)` so a publication date can never be
  relabelled `last_updated` on one path and carried correctly on another.
- **D2 — Metadata evidence is consulted after any HEAD, through the guarded
  redirect walk.** `detectPageDate` keeps the HEAD first (header evidence is
  strongest and one cheap request), then, when the HEAD produced no date,
  fetches the document through `fetchFollowRedirects(url, allowPrivate, fetch,
  config.output.max_redirect_hops)` and parses the body. The current
  `head.status < 300 || >= 400` condition disappears: a 3xx no longer
  suppresses the metadata read (today's 405/4xx behaviour is unchanged, because
  the walk's non-ok response still fails into the existing `catch` that returns
  `undefined`), and every hop is re-guarded by REQ-021a.
  - **Alternative rejected:** following `Location` by hand — it re-implements
    the guard that `fetchFollowRedirects` already applies and would be the one
    unguarded hop in the codebase.
  - **Alternative rejected:** patching only the status condition to include
    3xx. A manual-redirect GET of a 3xx returns an empty body, so the metadata
    would still be unreadable; the walk is what makes the evidence reachable.
  - Consequence: `search_web` deep reading (the second caller, `:750`) also
    gains one metadata GET on a redirected result page, bounded by the same hop
    cap. That suite injects a stubbed `detectDate` (`src/deep-search.test.ts:109`),
    so it pins the contract, not the walk; the redirect walk itself is proven
    through the fetch path, and the deep-read consequence is recorded as
    accepted rather than separately driven. The crawl path is **not** affected
    — it never calls `detectPageDate`.
- **D3 — The cache serves a question too, and the hit still answers it.** The
  read-through guard becomes `!crawl && !extract` (plus the existing config and
  KB conditions). On a hit with a `question`, the cached text is ranked by the
  same `rankPassages` used for a fresh page; a matched hit returns the
  matched-passage envelope shape (`extraction_mode: "content"`, `snippets`,
  `top_score`, `passages_returned`, `match_quality`) with `provider:
  "knowledge_base"` and the existing cache metadata (`cache: "hit"`,
  `cache_age_ms`); a zero-passage hit returns `fullContentEnvelope` with the
  same cache metadata. A plain hit keeps today's envelope unchanged. The
  matched-passage envelope is extracted into one local `passageEnvelope(...)`
  builder used by the fresh path (`:1564-1588`), the fallback path
  (`:1484-1508`), and the cache hit, so the same shape cannot drift into three
  copies — the same argument as D1a.
  - **Alternative rejected:** serving the cached full text to a question
    request — it would report `matched` passages it did not rank, or drop the
    question from the response entirely.
  - **Alternative rejected:** leaving `question` out of the cache but
    documenting it — REQ-021g is scoped to the URL and reports the hit; an
    bypass is the non-conformance the finding names.
  - Consequence: REQ-021b and REQ-021g are satisfied in the same response, and
    a cached question costs no egress.
- **D4 — The raw guard judges the coerced request, and names its own error.**
  `rawRequestError` coerces `url` with `coerceStringArray(url)` (non-strict) and
  then: on a coercion `error` — an empty `[]`, or an array with a non-string or
  empty element — returns that error's message (surfaced by the handler as
  `invalid_input` with the guard's remediation); on more than one value, returns
  the existing single-URL message; on exactly one value, returns `undefined` and
  lets `doFetchPage` run its strict coercion. A string that is not a valid JSON
  array is a single URL to this helper (`src/batch.ts:81-101`), so it stays a
  single-URL request here and is judged later by `doFetchPage`; the guard
  reclassifies nothing.
  - **Alternative rejected:** coercing in the tool handler and passing the
    result down. The guard is the only consumer that needs the coerced shape,
    and a handler-level pre-parse would duplicate `doFetchPage`'s strict
    syntax handling.
  - Consequence: `rawRequestError` gains a dependency on `batch.ts` — a
    same-layer module, already imported by `index.ts`; no cycle.
- **D5 — A microdata property belongs to its nearest `itemscope` ancestor.**
  The inner scan keeps a property only when
  `$(child).closest("[itemscope]")` is the element being visited. Each nested
  item is already visited by the outer `$("[itemscope]").each`, so the entry
  list is unchanged and only the attribution changes. First-value-per-property
  and link-value behaviour are unchanged (F-R4-C-14 stays `Closed-P3`).
  - **Alternative rejected:** recursing into nested items and nesting them in
    the parent entry — the response shape is a flat array today, and a nested
    shape would be a schema change for one finding.
  - Consequence: a page with an author card inside a product item reports the
    card's properties on the card's entry instead of on the product's.
- **D6 — A wikipedia fact names the representation it resolved from,
  additively.** `InfoboxRow` gains a **required** `origin: "infobox" | "table"`.
  The three constructors take it as an explicit parameter —
  `cellsToRow(origin, cells)`, `rowFromElement(origin, $, el)`,
  `rowsFromElement(origin, $, el, header)` — and each public collector passes
  its own kind (`collectInfoboxRows` → `"infobox"`, `collectTableRows` →
  `"table"`), so no row can be constructed untagged. `factFromRows` carries the
  winning row's origin onto the fact as `source_representation` (and onto
  `FactEnrichment`) while `source` stays `"wikipedia"`. The required field
  updates the `toContainEqual({ key, value })` assertions in
  `src/lib/infobox.test.ts:34,49,55-57` to include `origin`.
  - **Alternative rejected:** an optional field — it lets a caller receive an
    untagged row and pushes the decision to every consumer.
  - **Alternative rejected:** widening `source` to `wikipedia_infobox` /
    `wikipedia_table`. It changes a value the fact title and existing tests key
    on, and it loses the knowledge-record-vs-prose distinction REQ-021i uses
    `source` for.
  - Consequence: when the same value appears in both an infobox and a table,
    the infobox wins because it is collected first; the fact is `resolved`, not
    `ambiguous`, and the recorded representation is `infobox`.
- **D7 — One REQ sentence pair, one README clause, one decision record.**
  REQ-021c gains two scope sentences — a crawl reports the date on each fetched
  page, an extract reports it on the response — with
  `// @implements REQ-021c crawl-date` and `// @implements REQ-021c extract-date`
  tags in the driving test file. The README's date sentence
  (`README.md:271`) gains the corresponding clause, including the
  document-metadata-only scope, so the next `npm run prep` satisfies the
  spec→README binding instead of failing it. D-121 records the header-evidence
  limitation as a standing decision, and the worklist summary cites it.
  Everything else is conformance to a body that already states the obligation
  (REQ-021g for D3, REQ-021j for D4, REQ-021i for D6, REQ-021c for D2).
  Appendix B counts are measured before commit (C-5).
- **D8 — Commit series.** Six commits, each `typecheck`-clean and green on the
  suites it touches, in the convention order spec+source → source → source →
  source → source → docs:

  | # | Commit | Contents |
  |---|---|---|
  | 1 | `fix(fetch): honor detect_date on the crawl and extract paths, and read metadata after a redirect` | `infobroker.md` (REQ-021c), `src/index.ts` (D1, D1a, D2, the `detect_date` description), `src/fetch-page-extraction.test.ts` (crawl date, extract date, redirect date, clause tags), `src/deep-search.test.ts` if the deep path needs a case |
  | 2 | `fix(fetch): answer a question from a fresh knowledge-base copy` | `src/index.ts` (D3, `passageEnvelope`), `src/fetch-page-extraction.test.ts` (two cache-hit cases) |
  | 3 | `fix(fetch): refuse a stringified URL array in raw mode` | `src/structured-output.ts` (D4), `src/structured-output.test.ts`, `src/fetch-page-extraction.test.ts` (handler case) |
  | 4 | `fix(extract): keep nested microdata items distinct` | `src/extract.ts` (D5), `src/extract.test.ts` |
  | 5 | `fix(facts): name the representation a wikipedia fact resolved from` | `src/lib/infobox.ts`, `src/structured-fact.ts`, `src/types.ts` (D6), `src/lib/infobox.test.ts`, `src/structured-fact.test.ts` |
  | 6 | `docs(roadmap): resolve the fetch fidelity findings and retire the section` | `README.md`, `DECISIONS.md` (D-121), `CHANGELOG.md`, `ROADMAP.md`, `worklist.md` (six rows + census), the increment record |

  Commit 1 carries the REQ change and its clause-tagged tests together, which is
  what C-5 requires and what `AGENTS.md` § Spec Authoring asks ("update the
  corresponding REQ in the same commit"). This is six commits, so the grouping
  is printed to the user before the series runs.
- **D9 — No push.** Publication stays user-authorized. The 243-commit, 4.9 d
  backlog is recorded in the AAR.

## Slice map

| Slice | Findings | Size | Files | Commit |
|---|---|---|---|---|
| A — Date reach | F-R4-C-4, F-R4-C-6 | M | `src/index.ts` (`detectPageDate`, crawl page, extract envelope, `dateMetaFrom`, the `detect_date` description), `infobroker.md` (REQ-021c) | 1 |
| B — Cache parity | F-R4-C-5 | S | `src/index.ts` (cache read-through, question hit, `passageEnvelope`) | 2 |
| C — Raw guard | F-R4-D-4 | S | `src/structured-output.ts` (`rawRequestError`) | 3 |
| D1 — Microdata | F-R4-C-11 | S | `src/extract.ts` | 4 |
| D2 — Fact representation | F-R4-E-2 | M | `src/lib/infobox.ts`, `src/structured-fact.ts`, `src/types.ts` | 5 |

Tests are committed with the slice they prove (Phase 1 red evidence is
uncommitted and recorded in `tasks.md`); there is no separate evidence commit.

## Blast radius

**Production (six TS modules).** `src/index.ts` (the date helper, the
`detectPageDate` metadata walk, the crawl page date and per-page auto-index
date, the extract envelope date, the cache guard, the question hit,
`passageEnvelope`, and the `detect_date` parameter description),
`src/structured-output.ts` (`rawRequestError`), `src/extract.ts` (the microdata
inner scan), `src/lib/infobox.ts` (`origin` on `InfoboxRow`, its three
constructors, and both collectors), `src/structured-fact.ts` (the
representation on the fact and the enrichment), `src/types.ts`
(`source_representation` on `StructuredFact`).

**Shared surfaces touched by consequence.** `search_web` deep reading calls
`detectPageDate` (`src/index.ts:750`) and therefore inherits D2's redirect
walk; `src/deep-search.test.ts` is run, and a case is added if none covers a
redirected deep-read page. `envelopeOutputSchema` is `z.looseObject`
(`src/output-schema.ts:10`), so every added field is accepted without a schema
edit (C-1).

**Tool-schema surface.** `fetch_page`'s `detect_date` description gains the
crawl/extract scope in commit 1. `crawl`, `extract`, and `raw` need no
description change — their contracts are unchanged. `src/tool-surface.test.ts`
is the check that the parameter set and defaults do not drift.

**Tests.** New cases in `src/fetch-page-extraction.test.ts` (crawl date, extract
date, redirect metadata date, the question cache hit and its zero-passage
fallback, the raw array-string refusal). Edited:
`src/structured-output.test.ts` (the stringified-array and empty-array cases
beside the existing guard test at `:139`), `src/extract.test.ts` (nested-item
attribution), `src/structured-fact.test.ts` (representation from a table row and
from an infobox row), `src/lib/infobox.test.ts` (`origin` in the existing
`toContainEqual` assertions). Run-only: `src/fetch-cache.test.ts`,
`src/datetime.test.ts`, `src/deep-search.test.ts`, `src/tool-surface.test.ts`,
`src/batch.test.ts`.

**Documentation and bookkeeping.** `infobroker.md` (REQ-021c, two sentences with
clause tags), `README.md:271` (the date sentence gains the crawl/extract scope
and the metadata-only caveat), `DECISIONS.md` (D-121), `CHANGELOG.md` (one
bullet under the existing `## 2026.11.11` heading; `version-sync` asserts the
top entry's version equals `package.json`, so no new heading and no
`package.json` change), `ROADMAP.md` (retire the section), `worklist.md` (six
`Resolved` summaries plus the re-derived census), and
`docs/plans/2026-11-14-fetch-fidelity-remediation/{plan,tasks,aar}.md`.

**Explicitly out of scope.** F-R4-C-14 (first value per property, link-valued
properties — `Closed-P3`), F-R4-C-7 (three-request cost of date detection —
`Closed-P3`), the R5 corroboration section and the calibration item (separate
roadmap sections with their own triggers), every R6–R9 row, and the
`check-loop-artifacts` warning for `2026-11-10-r6-encryption-capacity-remediation`
(C-8).

## Phases and steps

### Phase 0 — Scaffold and baseline

0. Keep the increment directory carrying `plan.md`, `tasks.md`, and an in-progress `aar.md` whose final line is `LOOP OPEN`.
1. Re-confirm the baseline if execution starts on a different HEAD: `npm run check` un-piped, recording exit status, gate count, and wall time. **Red-baseline branch:** a failure caused by this increment's artifacts is fixed by step 0; a pre-existing failure is fixed as its own commit and Phase 0 restarts; a failure on the `fetch_page` surface stops the increment with `LOOP OPEN`.
2. Seam audit in `tasks.md`: enumerate **both** `detectPageDate` callers (`:750`, `:1548`) and the callers of `detectDocumentDate`, `fetchFollowRedirects`, `rawRequestError`, `collectInfoboxRows`, `collectTableRows`, `factFromRows`; confirm which existing tests assert the fields being added (`source_representation`, per-page `last_updated`/`published_date`, the cache-hit envelope); confirm `src/deep-search.test.ts` covers a redirected result page.
3. Authoring pre-check: measure REQ-021c against Appendix B (≤800 chars, ≤8 sentences, ≤8 SHALL clauses) after the D7 sentences; confirm no sibling REQ (021b, 021g, 021i, 021j) contradicts the planned shapes; record the numbers in `tasks.md`.
4. Census baseline: run `docs/plans/2026-11-14-register-reconciliation/evidence/census.ts` on the current tree and record its four disposition cells, so step 16 can compare before and after.

### Phase 1 — Failing evidence first

5. Add one test per finding and run them **before** any production edit; record the failure text in `tasks.md`.
   - `src/fetch-page-extraction.test.ts`: (a) a crawl of a page carrying `og:updated_time` reports that date on the crawled page, a publication-only page reports `published_date` and never `last_updated`, and the stub served exactly one request per attempted page (D1, C-2); (b) an extract of the same page reports the identical evidence; (c) a page behind a 302 (the file's bespoke redirect server) reports document-metadata evidence (D2); (d) a question against a stored URL — a **second** spawned server whose `fetch.cache.kb_read` is `true` (the shared `beforeAll` config sets it `false`; the `:476-491` pattern) — returns `provider: "knowledge_base"`, `cache: "hit"`, ranked passages, and leaves `requests` unchanged (D3); (e) the same hit on text sharing no word with the question returns the full-content envelope with cache metadata (D3); (f) `raw: true` with `url: "[\"http://…/page/1\",\"http://…/page/2\"]"` returns `invalid_input` (D4).
   - `src/structured-output.test.ts`: `rawRequestError("[…two items…]", false, false)` matches `/single URL/`; `rawRequestError("[]", false, false)` returns the empty-array coercion message; a single-URL string and an unparseable bracketed string both stay `undefined` (D4).
   - `src/extract.test.ts`: an outer item with a nested `itemscope` reports the nested item's `itemprop` values on the nested entry and not on the outer entry (D5).
   - `src/structured-fact.test.ts` / `src/lib/infobox.test.ts`: a `wikitable` hit carries `source_representation: "table"`, an `infobox` hit carries `"infobox"`, both keep `source: "wikipedia"`, and the same value in both forms resolves once (D6).
6. Record every red result; a test that passes unmodified is either mis-aimed or the behavior already holds, and either is recorded before any source edit.

### Phase 2 — Fixes, in dependency order

7. **Slice A.** Add `dateMetaFrom`; rename nothing in `datetime.ts`. `src/index.ts`: after each crawl page's policy check, slice `fetched.content` to 200 000 characters, map `detectDocumentDate` into the page object and the per-page auto-index date; add the same mapping to the extract envelope; replace the inline mapping at `:1552` with the helper; extend the `detect_date` parameter description to name the crawl and extract paths. Rework `detectPageDate` per D2 and check the deep-read caller. `infobroker.md`: the D7 sentences; clause tags in the driving test file.
8. **Slice B.** `src/index.ts`: extract `passageEnvelope`, relax the cache guard to `!crawl && !extract`, then branch the hit on `question` per D3.
9. **Slice C.** `src/structured-output.ts`: coerce inside `rawRequestError` per D4.
10. **Slice D1.** `src/extract.ts`: nearest-ancestor filter per D5.
11. **Slice D2.** `src/lib/infobox.ts` (required `origin` through the constructors and collectors), `src/structured-fact.ts` and `src/types.ts` (`source_representation`) per D6; update the `toContainEqual` literals in `src/lib/infobox.test.ts`.
12. Fill in any remaining behavior the Phase 1 tests expose. A failing expectation is a real defect and is fixed, not weakened.

### Phase 3 — Verification and documentation

13. Run the targeted suites: `fetch-page-extraction`, `structured-output`, `extract`, `structured-fact`, `infobox`, `fetch-cache`, `datetime`, `deep-search`, `batch`, `tool-surface`. Record counts.
14. Run `npm run typecheck`, then `npm run check:fast`, then `npm run check` (full). A gate failure is repaired inside this increment; an out-of-scope failure becomes an AAR note.
15. Run `npm run validate-spec`, `npm run check-intent-citations`, and `npm run validate-readme`: REQ-021c changed, so its clause tags must resolve and the Appendix B counts must pass, and the README must still validate.
16. `README.md:271`: add the crawl/extract scope and the document-metadata caveat to the existing date sentence (D7).
17. `DECISIONS.md`: add D-121 recording why header evidence is unavailable on the crawl and extract paths and that document metadata is the accepted evidence there.
18. `CHANGELOG.md`: one bullet under the existing `## 2026.11.11` heading naming the crawl/extract date reach and its metadata-only scope, the redirect metadata read, the question cache hit, the raw array refusal, the nested-microdata attribution, the fact representation, and the census re-derivation — with REQ IDs and the tests that pin them.
19. `ROADMAP.md`: remove the section; run `npm run check-roadmap`.
20. `worklist.md`: mark the six rows `Resolved` with a one-line summary each, following the F-R2-1 row's form. The F-R4-C-4 summary cites D-121; the F-R4-E-2 summary names `source_representation`. Then re-run `evidence/census.ts` and update the `Disposition census` and `Roadmap mapping` cells (`worklist.md:585,588`) to the new counts, and the same figures in the `## 2026.11.11` CHANGELOG entry this increment appends to.
21. Finish `aar.md` with dispositions, verification counts, the pass log against the declared cap, the 243-commit/4.9 d backlog note (D9), and a terminal `LOOP PAUSED` or `LOOP OPEN`.
22. `npm run session:close`, print the six-commit grouping (D8), then run the series. Stop and report rather than commit a failing tree.

## Conditions

- **C-1** — every added field (per-page `last_updated`/`published_date`, the extract date trio, `source_representation`) is accepted by `envelopeOutputSchema`, which is `z.looseObject` (`src/output-schema.ts:10`); no declared output schema is narrowed and no schema edit is expected. `src/tool-surface.test.ts` (parameter set and defaults) and `src/structured-output.test.ts` are the check.
- **C-2** — the crawl date adds **no** outbound request: the test asserts the stub served exactly one request per attempted page, so a per-page HEAD or metadata GET would fail the count (D1). The date parse is bounded to 200 000 characters, the plain path's existing bound.
- **C-3** — every fetch test pins `renderer: "native_fetch"`, `fetch.allow_private_urls: true`, an isolated KB path, `TMPDIR`, and `INFOBROKER_CONFIG_LOCAL`; no test reads the operator's real KB, quota file, or config layer, and no test reaches the network.
- **C-4** — the cache-hit cases run on a **second** spawned server whose `fetch.cache.kb_read` is `true` (the shared `beforeAll` sets it `false`); the hit is produced by the real auto-index path (fetch, `waitForStored`, second call), not by writing a KB row directly.
- **C-5** — REQ-021c's Appendix B counts are measured after the D7 sentences before commit, and the `crawl-date` / `extract-date` clause tags land in the same commit as the REQ change (commit 1), per D8.
- **C-6** — the spec→README binding is satisfied in-increment: `README.md:271` gains the crawl/extract scope and the metadata-only caveat in the docs commit, and `npm run validate-readme` passes. If the binding check still fails during a later `npm run prep`, the AAR records it rather than the plan claiming otherwise.
- **C-7** — no new dependency and no new module beyond the six listed in the blast radius.
- **C-8** — the `check-loop-artifacts` warning for `2026-11-10-r6-encryption-capacity-remediation` is recorded, not fixed.
- **C-9** — independence: one cold pass ran and returned `independent-review FAILED.`; its 3 Blockers, 7 Majors, and 6 Nits are applied in this revision. One targeted diff re-review remains within the declared cap; if it cannot run, the AAR records `NOT_RUN` and the plan does not claim approval.
- **C-10** — the crawl/extract header-evidence gap is a standing limitation recorded as D-121 and cited by the worklist summary, not a silent omission.
- **C-11** — the fact representation is additive: `source` stays `"wikipedia"` for every wikipedia fact, so no existing ordering, title, or test key changes.
- **C-12** — D4's coercion path reuses `coerceStringArray` and introduces no second URL syntax rule; the guard's own error message is surfaced as `invalid_input`, and a non-array string is never reclassified by the guard.
- **C-13** — the deep-read caller is checked, not assumed: `src/deep-search.test.ts` stubs `detectDate` (`:109`), so it pins the contract only; the D2 consequence there (one extra metadata GET on a redirected result page) is recorded as accepted, and the walk is proven through the fetch path.
- **C-14** — the census is re-derived from the file by `evidence/census.ts` after the six dispositions; hand-edited counts are not accepted.

## Rollback

Every edit is a source-level behavior change plus test additions and one REQ
sentence. Reverting the six commits restores the prior tree; the KB store,
credential pool, and quota file are untouched, so a downgrade reads prior state
safely. No provider contract, schema migration, or dependency is involved.

## Verification summary

| Claim | How it is proven |
|---|---|
| A crawl reports a date per crawled page with no extra egress | `fetch-page-extraction.test.ts` crawl case plus the one-request-per-page assertion (C-2) |
| An extract reports the same date evidence | `fetch-page-extraction.test.ts` extract case |
| A redirected page yields document-metadata evidence | `fetch-page-extraction.test.ts` redirect case (C-13 records that the deep-read suite stubs `detectDate`) |
| A question is answered from a fresh KB copy with no egress | `fetch-page-extraction.test.ts` cache-hit case on the `kb_read: true` server (C-4) |
| A zero-passage cache hit still reports the hit | `fetch-page-extraction.test.ts` full-content fallback case |
| Raw mode refuses a stringified array and an empty array | `structured-output.test.ts` guard cases and the handler case |
| Nested microdata is not attributed to the parent | `extract.test.ts` nested-item case |
| A fact names its representation | `structured-fact.test.ts` and `lib/infobox.test.ts` cases |
| The register census matches the new dispositions | `evidence/census.ts` re-run in step 20 (C-14) |
| Nothing else regressed | `npm run check` (22 gates), `npm run validate-spec`, `npm run validate-readme`, `npm run check-intent-citations` |
