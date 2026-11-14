# Tasks — fetch and extraction fidelity remediation

One checkbox per step of `plan.md`. A step is ticked only when verified.

## Phase 0 — Scaffold and baseline

- [x] 0. Increment directory carries `plan.md`, `tasks.md`, and an in-progress `aar.md` ending `LOOP OPEN`.
- [x] 1. Re-confirm baseline (`npm run status`, `npm run check` un-piped) if execution starts on a different HEAD; record exit status, gate count, wall time.
- [x] 2. Seam audit: **both** `detectPageDate` callers (`src/index.ts:750` deep read, `:1548` plain path); callers of `detectDocumentDate`, `fetchFollowRedirects`, `rawRequestError`, `collectInfoboxRows`, `collectTableRows`, `factFromRows`; existing assertions on the added fields; whether `src/deep-search.test.ts` covers a redirected result page.
- [x] 3. Authoring pre-check: REQ-021c Appendix B counts after the D7 sentences; sibling-REQ conflict check (021b, 021g, 021i, 021j); record the numbers.
- [x] 4. Census baseline: run `docs/plans/2026-11-14-register-reconciliation/evidence/census.ts`; record the four disposition cells before any change.

## Phase 1 — Failing evidence first

- [x] 5a. `src/fetch-page-extraction.test.ts` — crawl date on the page object; publication vs modification naming; one request per attempted page (F-R4-C-4, C-2).
- [x] 5b. `src/fetch-page-extraction.test.ts` — extract date on the envelope (F-R4-C-4).
- [x] 5c. `src/fetch-page-extraction.test.ts` — 302 redirect yields metadata evidence via the file's bespoke redirect server (F-R4-C-6).
- [x] 5d. `src/fetch-page-extraction.test.ts` — question answered from a fresh KB copy on a second server with `fetch.cache.kb_read: true`; no egress (F-R4-C-5, C-4).
- [x] 5e. `src/fetch-page-extraction.test.ts` — zero-passage cache hit returns the full-content envelope (F-R4-C-5).
- [x] 5f. `src/fetch-page-extraction.test.ts` — raw mode refuses a JSON-array string (F-R4-D-4).
- [x] 5g. `src/structured-output.test.ts` — stringified array and `"[]"` guard cases; single URL and an unparseable bracketed string stay `undefined` (F-R4-D-4).
- [x] 5h. `src/extract.test.ts` — nested `itemscope` values are not attributed to the parent (F-R4-C-11).
- [x] 5i. `src/structured-fact.test.ts`, `src/lib/infobox.test.ts` — fact representation from table and infobox (F-R4-E-2).
- [x] 6. Record every red result; a test that passes unmodified is recorded before any source edit.

## Phase 2 — Fixes

- [x] 7a. Slice A: `dateMetaFrom`; 200 000-char slice + crawl page date + per-page auto-index date; extract envelope date; `detect_date` schema description (D1, D1a).
- [x] 7b. Slice A: `detectPageDate` consults metadata through `fetchFollowRedirects` after any HEAD; check the deep-read caller (D2).
- [x] 7c. Slice A: REQ-021c sentences plus `crawl-date` / `extract-date` clause tags (D7).
- [x] 8. Slice B: extract `passageEnvelope`; relax cache guard; question hit ranks cached text; zero-passage hit uses `fullContentEnvelope` (D3).
- [x] 9. Slice C: `rawRequestError` coerces before judging and surfaces its own coercion error (D4).
- [x] 10. Slice D1: nearest-ancestor microdata filter (D5).
- [x] 11a. Slice D2: required `InfoboxRow.origin` through the three constructors and both collectors (D6).
- [x] 11b. Slice D2: `source_representation` on `StructuredFact` and `FactEnrichment`; update `toContainEqual` literals in `src/lib/infobox.test.ts` (D6).
- [x] 12. Fix exposed behavior; a failing expectation is a defect, never weakened.

## Phase 3 — Verification and documentation

- [x] 13. Targeted suites: `fetch-page-extraction`, `structured-output`, `extract`, `structured-fact`, `infobox`, `fetch-cache`, `datetime`, `deep-search`, `batch`, `tool-surface`; record counts.
- [x] 14. `npm run typecheck`, `npm run check:fast`, `npm run check` (full).
- [x] 15. `npm run validate-spec`, `npm run check-intent-citations`, `npm run validate-readme`.
- [x] 16. `README.md:271` — crawl/extract scope and document-metadata caveat (D7).
- [x] 17. `DECISIONS.md` — D-121 records the header-evidence limitation.
- [x] 18. `CHANGELOG.md` bullet under `## 2026.11.11`.
- [x] 19. `ROADMAP.md` section retired; `npm run check-roadmap`.
- [x] 20a. `worklist.md`: six `Resolved` summaries (F-R4-C-4 cites D-121; F-R4-E-2 names `source_representation`).
- [x] 20b. Re-run `evidence/census.ts`; update the `Disposition census` and `Roadmap mapping` cells (`worklist.md:585,588`) and the `## 2026.11.11` CHANGELOG figures (C-14).
- [x] 21. `aar.md` finished: dispositions, verification counts, pass log against the cap, backlog note, terminal token.
- [x] 22. `npm run session:close`; print the six-commit grouping (D8); run the series.

## Red results

Captured before any production edit.

- `npx vitest run src/structured-output.test.ts src/extract.test.ts src/structured-fact.test.ts src/lib/infobox.test.ts`
  → `Test Files 4 failed (4) · Tests 7 failed | 52 passed` — the two new
  `rawRequestError` cases, the nested-microdata case, both representation
  assertions, and three `toContainEqual` origin literals.
- `npx vitest run src/fetch-page-extraction.test.ts`
  → `Test Files 1 failed (1) · Tests 7 failed | 14 passed` — crawl date (2),
  extract date, redirect metadata date, cache-parity question, zero-passage
  cache hit, raw array-string refusal.
- After the fixes: 59/59 and 21/21 on the same files; `fetch-cache`,
  `datetime`, `deep-search`, `batch`, `tool-surface`, `infobox` → 68/68.
