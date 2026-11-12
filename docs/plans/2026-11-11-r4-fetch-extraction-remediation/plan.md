# Plan — R4 `fetch_page` extraction and date remediation

**Status:** draft, awaiting plan review and user approval · **Date:** 2026-11-11 · **Depth:** standard (three production modules, one shared test harness, reversible behavior edits, no destructive or publish surface)
**Review independence:** fresh — one cold pass (5 stages: 1 Blocker, 6 Major, 5 Nit; all resolved) plus one targeted 3/5 diff re-review that returned `independent-review passed.` with 3 clarity nits, applied as condition-level edits after the passing pass (C-15).
**Rollback cost:** 1 — source-level behavior edits in `src/datetime.ts`, `src/index.ts`, `src/batch.ts`, plus test harness and tests. No state-format change, no schema or credential change, no new dependency.
**Roadmap item:** `ROADMAP.md` § R4 fetch-page extraction remediation (retired to `CHANGELOG.md` when this increment closes)
**Predecessor:** `eab0f23` (R3 close; its AAR names `## R4 fetch-page extraction remediation` as the next scheduled work)
**Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md` § Finding register (F-R4-C-2, F-R4-D-1, F-R4-D-3, F-R4-C-9)

## Why this section

R4 extraction is the first section in `ROADMAP.md`, and the ordering rule is
top section first. Its trigger ("start after chunk R5 closes") is met: chunks
R5 through R9 and M1 all carry closed AARs, and the R1–R9 program is closed
(`worklist.md:595-604`). The section names four rows: three P1 evidence and
contract defects in `fetch_page` extraction, and one P2 truncation gap that
the R4 chunk deferred twice before it was re-targeted (`F-M1-3`).

The four rows share one surface — what a successful `fetch_page` response
reports about *how* it extracted the page and *what date* it found. They are
grouped into two slices: the date classification (F-R4-C-2) and the
extraction metadata across the no-match, plain, batch, crawl, and extract
branches (F-R4-D-1, F-R4-D-3, F-R4-C-9).

## Baseline (verified this session)

- `git log -1` → `eab0f23`; `git status --porcelain` clean except the untracked increment directory this plan creates.
- `npm run status` → version 2026.11.11 (tag `v2026.11.07`), **92 unpushed commits, oldest 2.1 d**, 19 open roadmap items.
- `npm run check` → **PASS** (full, 22 gates, 153.4 s).
- One pre-existing warning: `check-loop-artifacts` reports `2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:** line`. Warning only; out of scope (C-8).

## Predicates re-verified by reading the code this session

| Finding | Current code | What is wrong |
|---|---|---|
| F-R4-D-1 (P1) | The main no-match return (`src/index.ts:1453-1472`) emits `extraction_mode: "full_content"` and a note but no `passages_returned` or `match_quality`; the fallback no-match return (`:1375-1395`) emits neither field, no `question`, and no `extraction_mode` | REQ-021b requires `passages_returned` and a `match_quality` band on every response; the two no-match branches under-report and disagree with each other. |
| F-R4-D-1 (P1, batch leg) | `mergeItems` reads `env.snippets` and `env.top_score` only (`src/batch.ts:212-225`) | A no-match fetch item reports no passage count or band, so REQ-021k's "report the number of ranked passages retained" is unmet for exactly the zero-passage case. |
| F-R4-C-2 (P1) | `article:published_time` (`src/datetime.ts:39`), `meta[name=date]`, `dc.date`, `citation_date` (`:40-42`), and JSON-LD `datePublished` (`:64-65`) are returned with `confidence: "high"`, and `index.ts:1419-1421` labels whatever comes back `last_updated` | A publication date is not a last-updated date; the response states a fact the evidence does not support (REQ-021c "omit rather than guess"). |
| F-R4-D-3 (P1) | The plain non-question envelope (`src/index.ts:1475-1491`) carries no `extraction_mode`, no `passages_returned`, and no top-level `url`; the raw handler spreads that envelope into `structuredContent` (`:1877-1880`) | REQ-021j requires raw mode to expose status, provider, URL, extraction mode, passage count, and truncation state through the structured object. |
| F-R4-C-9 (P2) | Crawl slices each page with `text.slice(0, effectiveMax)` (`src/index.ts:1181`); extract slices the stripped text the same way (`:1253`) | Neither path calls `maybeTruncate`, so a clipped page carries no `truncated` flag or `output_path`, contrary to REQ-004. |

Seams read this session: `maybeTruncate` (`src/truncate.ts:16-33`), `matchQuality` (`src/rerank.ts:18-25`), `rankPassages`/`splitPassages`/`rankDocs` (`src/rerank.ts:35-64,97-100`; `src/embed.ts:520-527`, which filters `score > 0`), `fetchPageContent`'s own truncation (`src/index.ts:960`), `detectPageDate` (`src/index.ts:867-888`), the stub `/page/N` route (`src/lib/stub-provider.ts:55-63`), `writeHermeticConfig` (`:179-240`), the spawned-server harness (`src/dispatch-orchestration.test.ts:39-110`), and the raw handler (`src/index.ts:1855-1882`).

**Reachability of the no-match branch (verified).** `rankPassages` returns `scorePassages(...).slice(0, topk)`, and `rankDocs` drops every candidate with `score <= 0`. A multi-sentence page yields at least one passage for any question, so the branch is **not** reachable by "a question with no shared words". It is reachable deterministically through the other limb REQ-021b names — *unreadable content*: `htmlToText` of a page with an empty body returns `""` (`src/lib/html.ts:9-16`), `fetchPageContent` accepts it as a successful render (no empty-content guard exists), `splitPassages("")` returns `[]`, and both no-match returns then execute. The Phase 1 fixture is that empty-body page, not a low-overlap one. Adding a top-score gate that converts a low score into "no match" is a mode-selection change no R4 row asks for; it is recorded as out of scope.

## Done bar

**Done bar:** F-R4-D-1, F-R4-D-3, F-R4-C-2, and F-R4-C-9 are fixed and marked `Resolved` in the worklist with a one-line summary; F-R4-D-2 and F-R4-D-5, whose predicates live in files this increment already edits, are resolved by the same evidence with no extra code path; every behavior change ships a test that fails on the unmodified source and passes on the final tree (the red result is recorded in `tasks.md`); specifically: both no-match branches return the same shape — `meta.passages_returned: 0`, `meta.match_quality: "none"`, `extraction_mode: "full_content"`, and the note — from one shared builder, proven through the live handler with an empty-body page (the deterministic unreadable-content case) and guaranteed for the fallback branch by construction, and a batch of that response reports the same per input; a plain non-question fetch reports `extraction_mode`, `passages_returned: 0`, and a top-level `url`, so a raw fetch's `structuredContent` carries every field REQ-021j names, proven through the live handler rather than a synthetic envelope; publication-only page evidence produces `published_date` with its source and confidence and never `last_updated`, modified-date evidence still produces `last_updated` at high confidence and wins over publication evidence on a page carrying both, and only modified evidence is stored as a KB source date; an ambiguous `<time datetime>` is reported as a low-confidence publication date; a clipped crawl page and a clipped extract response each carry `truncated: true` and exactly one `output_path` under the isolated `TMPDIR`, with no orphan file left by the renderer layer; `ROADMAP.md` no longer carries the R4 extraction section; `CHANGELOG.md` carries one bullet under the existing `## 2026.11.11` heading; the increment record carries plan, tasks, and an AAR ending `LOOP PAUSED` or `LOOP OPEN`.

**Non-closure rule:** a fix that needs a response-schema breaking change, a date-storage format change, a new dependency, or a production module beyond `datetime.ts`, `index.ts`, and `batch.ts` stops that slice. Shipped slices are recorded in `CHANGELOG.md`, the unshipped rows stay scheduled on a successor `ROADMAP.md` section, and the AAR ends `LOOP OPEN`.

## Decisions

- **D1 — Both no-match branches call one builder, and the band is derived, not written.** The fallback no-match return (`index.ts:1375-1395`) and the main no-match return (`:1453-1472`) both delegate to a single local `fullContentPayload(...)` builder in `index.ts` carrying `question` (omitted when the request had none), `extraction_mode: "full_content"`, the note, and — under `meta`, matching both matched-passage paths (`index.ts:1367-1368`, `:1444-1448`) — `passages_returned` and `match_quality`. The band comes from `matchQuality(undefined, 0)` so "none" cannot drift from `rerank.ts`. The fallback branch's shape is then guaranteed by construction, and the handler test proves the builder through the main path. **Alternative rejected:** hardcoding `"none"` at both sites — two literals that must agree with `matchQuality`'s zero-passage rule forever.
  - **Reachability (verified, not assumed):** the branch is reached by an empty-body page — `htmlToText` returns `""`, `splitPassages("")` returns `[]`, and no empty-content guard rejects the render. This is REQ-021b's "content was unreadable" limb. A low score does **not** reach the branch (`rankDocs` keeps every `score > 0` candidate); turning a low score into "no match" is a mode-selection change outside this section and is recorded as such.
- **D1a — Batch metadata prefers the envelope's reported counts.** `mergeItems` reads `meta.passages_returned` and `meta.match_quality` when the item's envelope reports them, and keeps today's `snippets`/`top_score` derivation as the fallback for `search_web` and deep results. A zero-passage fetch item therefore reports `passages_returned: 0, match_quality: "none"` rather than omitting both.
  - Consequence: per-input metadata for a plain (no-question) fetch also reports `passages_returned: 0`; that is accurate under REQ-021k ("when those apply" — zero passages retained applies).
- **D2 — Date evidence is classified as modification or publication; only modification can be `last_updated`.** `DetectedDate` gains `kind: "modified" | "published"` and `detectUpdatedAt` is renamed `detectDocumentDate` (the old name promises a narrower fact than the function now decides). The selector list is split into two ordered lists and evaluated modified-first, so precedence is explicit rather than incidental: modified — the `last-modified` header, `article:modified_time`, `og:updated_time`, JSON-LD `dateModified` → `kind: "modified"`, `confidence: "high"`; published — `article:published_time`, `meta[name=date]`, `dc.date`, `citation_date`, JSON-LD `datePublished` → `kind: "published"`, `confidence: "medium"`. A page carrying both (e.g. `article:published_time` **and** `og:updated_time`) therefore reports its modification date, which is what the header-first, modified-first premise requires — today's single ordered list happens to place `og:updated_time` after the published selectors, so this is a stated change, not a preserved behaviour. `time[datetime]` → `kind: "published"`, `confidence: "low"` — a second stated change: today it reports `medium` (`src/datetime.ts:86`). The element states a document date but not which one, so the lowest confidence band carries that ambiguity rather than dropping the only date a page offers. `index.ts` maps by kind: modified → `{ last_updated, date_source, date_confidence }`, published → `{ published_date, date_source, date_confidence }`, on both the result and the envelope. KB auto-index stores `source_updated_at` only for modified evidence; a publication date is omitted rather than stored as an update date (REQ-021c, REQ-060).
  - **Alternative rejected:** keep the field as `last_updated` at `confidence: "medium"`. The label is the defect — the value does not answer "when was this last updated", so lowering confidence still reports an unsupported fact.
  - **Alternative rejected:** fall back to a publication date when no modification date exists. That is the same guess with a different name.
  - **Alternative rejected:** dropping `time[datetime]` evidence entirely. An omitted date cannot be distinguished from a page with no date, and the confidence vocabulary already expresses weak evidence; the alternative is recorded so a later reviewer can reverse it without re-deriving the trade-off.
  - Consequence: a page that publishes only a publication date no longer populates `last_updated` (or the KB source date). This is the REQ-021c "omit rather than guess" branch, and it is asserted in the new test.
- **D3 — Truncation happens once, on the text the caller sees.** `fetchPageContent` already calls `maybeTruncate(content, maxChars)` (`src/index.ts:960`) and returns the resulting object; crawl and extract currently pass `effectiveMax` into it, discard the result, and slice the derived text again. Both call sites (`:1160` crawl, `:1216` extract) pass an uncapped bound (`Number.MAX_SAFE_INTEGER`) instead, so the renderer layer writes no intermediate raw-HTML file, and each derived text is bounded exactly once: a crawl page's `stripHtml` output and the extract's `stripHtml` output. Each clipped unit gets its own `truncated: true` and `output_path` — on the page object for a crawl, on the envelope for extract (the trio the plain path already uses). The crawl envelope also gains `truncated: true`, a `truncation_hint`, and `meta.truncated_pages` (a count) when any page clipped, but no top-level `output_path`, because a crawl has no single full document.
  - **Alternative rejected:** reusing the renderer layer's truncation file. It holds raw HTML, not the text the caller received, and the snippet would carry a note written for a different body.
  - **Alternative rejected:** concatenating crawl pages into one file for a single top-level `output_path` — it invents a document the caller did not request and breaks REQ-021d's per-page contract.
  - Consequence: one clipped page maps to one file; REQ-004's `output_path` is satisfied per clipped page; the worklist summary and CHANGELOG entry state that the crawl's truncation paths are the page objects (C-5).
- **D4 — The plain envelope carries the raw-mode metadata REQ-021j names.** The plain non-question return (`index.ts:1475-1491`) gains `url`, `extraction_mode: "content"`, `passages_returned: 0`, and `match_quality: "none"`. Raw mode's existing spread of the envelope into `structuredContent` then exposes status, provider, URL, extraction mode, passage count, and truncation state without a second code path. REQ-021j is the obligation for `url`, `extraction_mode`, and the passage count; REQ-021b is question-scoped, so `match_quality: "none"` on a plain fetch is carried for uniformity with the question path and the batch metadata rather than by requirement. `truncated`/`output_path` stay conditional: absence is the not-truncated state, consistent with REQ-004, and recorded in the worklist summary (C-10).
  - **Alternative rejected:** teaching the raw handler to synthesize the missing fields — it would report extraction facts the extraction path does not produce, and the batch path would still receive the incomplete envelope.
- **D5 — One hermetic fetch harness, extended rather than duplicated.** `src/lib/stub-provider.ts` gains optional `pageBody` and `pageHeaders` on the existing `/page/N` route (keeping the current default body and search behaviour intact), and `writeHermeticConfig` gains a `fetch?: Record<string, unknown>` merge hook. A new `src/fetch-page-extraction.test.ts` spawns the real server with `renderer: "native_fetch"`, `fetch.allow_private_urls: true`, `fetch.cache.kb_read: false`, and the isolated KB/TMPDIR the R3 convention already uses. **Alternative rejected:** a separate page server helper — the stub already serves `/page/N` and is what the deep-read tests use, so a second server would duplicate lifecycle code.
- **D6 — Slices and commit series.** Four commits, each `typecheck`-clean and green on its own tests, so no commit carries a failing suite: (1) `test(harness): serve configurable pages from the stub provider` — `pageBody`/`pageHeaders`/`fetch` hook only, no assertions on unshipped behaviour; (2) `fix(datetime): classify publication and modification evidence separately` — `src/datetime.ts`, `src/index.ts` date mapping, and `src/datetime.test.ts` (D2); (3) `fix(fetch): complete extraction metadata and bound crawl and extract output` — the two no-match returns and shared builder, the plain envelope, `src/batch.ts`, the crawl/extract truncation, and their tests in `src/fetch-page-extraction.test.ts`, `src/batch.test.ts`, `src/rerank.test.ts` (D1, D1a, D3, D4); (4) `docs(roadmap): resolve the R4 extraction findings and retire the section` — `CHANGELOG.md`, `ROADMAP.md`, `worklist.md`, and the increment record. The Phase 1 red run is uncommitted evidence recorded in `tasks.md`; each commit's staged tree passes `typecheck` and the suites it touches, and the final tree runs the full gate. Slices B and C share the new handler-test file, which is why they form one commit.
- **D7 — No push.** Publication stays user-authorized. The 2.1 d, 92-commit backlog is recorded in the AAR; it is not published by this increment.

## Slice map

| Slice | Findings | Files |
|---|---|---|
| A — Date classification | F-R4-C-2 | `src/datetime.ts`, `src/index.ts` (`detectPageDate`, `dateMeta`, KB auto-index) |
| B — Extraction metadata | F-R4-D-1, F-R4-D-3, F-R4-D-5 (evidence) | `src/index.ts` (both no-match branches, plain envelope), `src/batch.ts` |
| C — Truncation | F-R4-C-9 | `src/index.ts` (crawl page, extract response) |
| D — Evidence | all four | `src/lib/stub-provider.ts`, `src/fetch-page-extraction.test.ts`, `src/datetime.test.ts`, `src/batch.test.ts`, `src/rerank.test.ts` (F-R4-D-2) |

## Blast radius

**Production (3 TS modules).** `src/datetime.ts` (evidence kind, rename, split selector lists and confidence), `src/index.ts` (`detectPageDate`, date-to-metadata mapping, KB auto-index date, the shared no-match builder used by both no-match returns, plain envelope, uncapped render bound on the crawl and extract paths, crawl page and extract truncation), `src/batch.ts` (reported passage count and band).

**Tests.** New: `src/fetch-page-extraction.test.ts` (spawned-server handler cases for the no-match shape, the plain/raw metadata, the date mapping, and crawl/extract truncation). Edited: `src/lib/stub-provider.ts` (configurable page body and headers, `fetch` config hook), `src/datetime.test.ts` (kind and confidence per evidence source, mixed-evidence precedence, ambiguous `time[datetime]`), `src/batch.test.ts` (zero-passage per-input metadata), `src/rerank.test.ts` (replace the two vacuous no-match assertions with a real empty-result assertion, F-R4-D-2). Run-only: `src/structured-output.test.ts`, `src/fetch-cache.test.ts`, `src/fetch-fallback.test.ts`, `src/tool-surface.test.ts`, `src/truncate.test.ts`.

**Documentation and bookkeeping.** `CHANGELOG.md` (one bullet under the existing `## 2026.11.11` heading; `version-sync` asserts the top entry's version equals `package.json`, so no new heading and no `package.json` change), `ROADMAP.md` (retire the section), `worklist.md` (six dispositions: the four named rows plus D-2 and D-5), `docs/plans/2026-11-11-r4-fetch-extraction-remediation/{plan,tasks,aar}.md`. `README.md` stays unchanged: no tool parameter, description, provider, or REQ body changes, so `npm run validate-readme` is the check rather than an edit.

**Explicitly out of scope.** The R4 classification section (F-R4-B-2, E-1, A-1) and contract section (F-1, F-4, F-3), which are separate roadmap items with their own triggers; every R5, R7, R8, R9 row; F-R4-D-4 (a JSON-encoded array string bypasses the raw single-URL guard — a coercion-order behavior change on a different surface); F-R4-D-6 (already closed P3); and the R6 `check-loop-artifacts` warning (C-8).

**Recorded, not fixed — roadmap coverage gap.** The register still shows `Scheduled-roadmap` on rows no roadmap section owns: F-R4-B-1, B-3, C-3, C-4, C-5, C-6, C-8, C-10, C-11, D-4, E-2, and E-3. This plan does not invent a section for them; the AAR records the gap against the roadmap admission rule (`AGENTS.md` § Review-Loop Governance) for the user to schedule or close.

## Phases and steps

### Phase 0 — Scaffold and baseline

0. Keep the increment directory carrying `plan.md`, `tasks.md`, and an in-progress `aar.md` whose final line is `LOOP OPEN`.
1. Re-confirm the baseline if execution starts on a different HEAD: `npm run check` un-piped, recording exit status, gate count, and wall time. **Red-baseline branch:** a failure caused by this increment's artifacts is fixed by step 0; a pre-existing failure is fixed as its own commit and Phase 0 restarts; a failure on the `fetch_page` surface stops the increment with `LOOP OPEN`.
2. Seam audit in `tasks.md`: enumerate callers of `detectUpdatedAt`/`detectDocumentDate`, `matchQuality`, `maybeTruncate`, and `mergeItems`, and confirm which existing tests already assert the fields being added (`extraction_mode`, `passages_returned`, `match_quality`, `published_date`, `output_path`).
3. Authoring pre-check: grep for sibling REQs binding the same response fields (REQ-003 `published_date`, REQ-021b/k, REQ-021j, REQ-004, REQ-060) and confirm none conflicts with the planned shape. Record the result in `tasks.md`.

### Phase 1 — Failing evidence first

4. Extend the harness (`src/lib/stub-provider.ts`) with `pageBody`, `pageHeaders`, and the `fetch` config hook, then add one test per finding and run them **before** any production edit; record the failure text in `tasks.md`.
   - `src/datetime.test.ts`: a page with only `article:published_time` (and separately only `datePublished`) returns `kind: "published"`, `confidence: "medium"`; a page with `article:published_time` **and** `og:updated_time` returns the modification date (mixed-evidence precedence); a page with only `<time datetime>` returns `kind: "published"`, `confidence: "low"`; `dateModified` still returns `kind: "modified"`; the existing modified-evidence cases keep passing.
   - `src/fetch-page-extraction.test.ts`: (a) a `question` against an empty-body page (the deterministic unreadable-content case — `htmlToText` yields `""`) returns `extraction_mode: "full_content"`, `meta.passages_returned: 0`, `meta.match_quality: "none"`, and the note; the fallback no-match branch is covered by the shared builder (D1) and recorded as construction-verified rather than handler-probed; (b) a plain fetch returns `extraction_mode`, `passages_returned: 0`, and a top-level `url`, and the same call with `raw: true` exposes those fields in `structuredContent` (this is F-R4-D-5's missing evidence); (c) a plain fetch whose page carries only a publication date returns `published_date` with source and confidence and no `last_updated`; (d) a crawl with a page longer than `max_length` reports `truncated: true` and one `output_path` on the page and the envelope; (e) an extract with `max_length` below the page length reports `truncated: true` and `output_path`; (f) the `output_path` files are the only truncation files written for those calls — the renderer layer wrote none.
   - `src/batch.test.ts`: an array request whose item is a no-match fetch reports `passages_returned: 0` and `match_quality: "none"` in `meta.per_query`.
   - `src/rerank.test.ts`: replace `ranked.length >= 0` / `top.length <= 1` with an assertion that empty content yields zero passages (F-R4-D-2).
5. Record every red result; a test that passes unmodified is either mis-aimed or the behavior already holds, and either is recorded before any source edit.

### Phase 2 — Fixes, in dependency order

6. **Slice A.** `src/datetime.ts`: add `kind`, rename to `detectDocumentDate`, split the selector list into a modified list and a published list (modified evaluated first), set confidence per source, and update the header comment. `src/index.ts`: rename the call site, type `detectPageDate`'s return to carry `kind`, map modified → `last_updated` and published → `published_date` in `dateMeta`, and gate the KB auto-index `source_updated_at` on modified evidence (D2).
7. **Slice B.** `src/index.ts`: extract the `fullContentPayload` builder, route both no-match returns through it, and complete the plain envelope (D1, D4). `src/batch.ts`: prefer `meta.passages_returned` and `meta.match_quality` (D1a).
8. **Slice C.** `src/index.ts`: pass an uncapped bound to `fetchPageContent` on the crawl and extract paths, route the derived text through `maybeTruncate` once, and add the page-level and envelope-level truncation fields (D3).
9. Fill in any remaining behavior the Phase 1 tests expose. A failing expectation is a real defect and is fixed, not weakened.

### Phase 3 — Verification and documentation

10. Run the targeted suites: `datetime`, `batch`, `rerank`, `fetch-page-extraction`, `structured-output`, `fetch-cache`, `fetch-fallback`, `truncate`, `tool-surface`. Record counts.
11. Run `npm run typecheck`, then `npm run check:fast`, then `npm run check` (full). A gate failure is repaired inside this increment; an out-of-scope failure becomes an AAR cross-chunk note.
12. Run `npm run validate-spec` and `npm run check-intent-citations`: no REQ body changes are planned, so the check is that nothing new is required; a newly required named clause tag lands in the same commit (C-4).
13. `CHANGELOG.md`: one bullet under the existing `## 2026.11.11` heading (the `version-sync` gate requires the top entry's version to equal `package.json`; no new heading, no `package.json` edit) naming the date-evidence split, the no-match metadata, the plain/raw metadata, the batch per-input metadata, and the crawl/extract truncation, with REQ IDs and the tests that pin them.
14. `ROADMAP.md`: remove the R4 extraction section. Run `npm run check-roadmap`.
15. `worklist.md`: mark F-R4-D-1, F-R4-D-3, F-R4-C-2, F-R4-C-9, F-R4-D-2, and F-R4-D-5 `Resolved` with a one-line summary, following the F-R2-1 row's form. The F-R4-C-9 summary names the crawl's per-page truncation paths (C-5); the F-R4-D-3 summary names the conditional `truncated` field (C-10). Reword the `F-M1-3` row (`worklist.md:894`), whose Resolved text points at "the R4 extraction remediation section and its trigger", to name the increment directory instead of the retired section.
16. Finish `aar.md` with dispositions, verification counts, the 92-commit/2.1 d backlog note (D7), the roadmap coverage gap, cross-chunk notes, and a terminal `LOOP PAUSED` or `LOOP OPEN`.
17. `npm run session:close`, then the commit series (D6). Stop and report rather than commit a failing tree.

## Conditions

- **C-1** — every added field (`published_date`, `extraction_mode`, `passages_returned`, `match_quality`, `url`, `output_path`, `meta.truncated_pages`) is additive; no existing declared output schema may be narrowed. `tool-surface.test.ts` and `structured-output.test.ts` are the check.
- **C-2** — truncation tests write under the hermetic `TMPDIR` and never into the operator's real `trunc-*` directory; each `output_path` is asserted to exist and be mode-0600 readable.
- **C-3** — every fetch test pins `renderer: "native_fetch"`, `fetch.allow_private_urls: true`, `fetch.cache.kb_read: false`, an isolated KB path, `TMPDIR`, and `INFOBROKER_CONFIG_LOCAL`; no test reads the operator's real KB, quota file, or config layer, and no test reaches the network.
- **C-4** — no REQ body change is planned. If one becomes necessary, its Appendix B counts (≤800 chars, ≤8 sentences, ≤8 SHALL clauses, ≤5 backtick tokens) are measured before commit, and any new `or`-joined branch gets a named clause tag in the same commit.
- **C-5** — the crawl's per-page `output_path` is the REQ-004 carrier; the worklist summary, CHANGELOG entry, and AAR each state that a crawl has no single full-document file.
- **C-6** — no new dependency and no new module beyond `src/datetime.ts`, `src/index.ts`, `src/batch.ts`, and the test harness.
- **C-7** — independence: this draft is a self pass. A cold pass runs before approval; if one cannot be created, the AAR records `NOT_RUN` and the plan does not claim `independence: fresh`.
- **C-8** — the `check-loop-artifacts` warning for `2026-11-10-r6-encryption-capacity-remediation` is recorded, not fixed.
- **C-9** — the roadmap coverage gap (twelve `Scheduled-roadmap` R4 rows with no owning section) is recorded in the AAR and reported to the user; this increment does not create a roadmap section on the user's behalf.
- **C-10** — `truncated: false` is not emitted; absent means not truncated, per REQ-004. The worklist summary and CHANGELOG entry state the convention.
- **C-11** — the date rename must not change a modified-evidence result: `last-modified`, `article:modified_time`, `og:updated_time`, and `dateModified` keep their current date value and `high` confidence. `datetime.test.ts` pins both sides of the split.
- **C-12** — mixed evidence resolves modified-first: a page carrying both a publication and a modification timestamp reports the modification date under `last_updated`, and the published date is not also emitted. `datetime.test.ts` pins the pair.
- **C-13** — one clipped unit maps to one truncation file: the crawl and extract paths pass an uncapped bound to `fetchPageContent`, so no intermediate raw-HTML file is written; the test asserts the `output_path` set equals the clipped-page set.
- **C-14** — the `time[datetime]` classification ships with its own test and a `low` confidence; if the reviewer or the user prefers omission, that is a one-line change and the alternative is recorded in D2.
- **C-15** — the three post-pass cold-review nits are exactly: the builder's conditional `question`, the `meta` placement of `passages_returned`/`match_quality` in the done bar and tests, and the `time[datetime]` `medium` → `low` delta called out in D2. `build-review` confirms nothing else changed between the passing artifact and this stamped one.

## Rollback

Every edit is a source-level behavior change plus test-harness options. Reverting the four commits restores the prior tree; the KB store, credential pool, and quota file are untouched, so a downgrade reads prior state safely. No provider contract, schema migration, or dependency is involved.

## Verification summary
| Claim | How it is proven |
|---|---|
| Both no-match branches report zero passages and a `none` band | `fetch-page-extraction.test.ts` handler case on the empty-body page; the fallback branch shares the builder (construction + `typecheck`) |
| A batch of a no-match fetch reports the same per input | `batch.test.ts` `meta.per_query` |
| A raw plain fetch exposes URL, mode, and passage count | `fetch-page-extraction.test.ts` over the live handler with `raw: true` |
| A publication date is never reported as `last_updated` | `datetime.test.ts` kind/confidence cases plus the handler case for the envelope field |
| Modified evidence wins on a page carrying both | `datetime.test.ts` mixed-evidence case (C-12) |
| Modified-date evidence still drives `last_updated` | existing `datetime.test.ts` cases, renamed call site |
| Only modified evidence is stored as a KB source date | `fetch-page-extraction.test.ts` asserting the indexed document omits `source_updated_at` for a publication-only page |
| Clipped crawl and extract responses carry truncation metadata | `fetch-page-extraction.test.ts` with a page longer than `max_length`, under the isolated `TMPDIR` |
| One clipped unit maps to one truncation file | `fetch-page-extraction.test.ts` asserting the `output_path` set (C-13) |
| Nothing else regressed | `npm run check` (22 gates), `npm run validate-spec`, `npm run check-intent-citations` |
