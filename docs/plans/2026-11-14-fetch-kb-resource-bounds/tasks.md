# Tasks — Fetch and KB resource bounds

**Plan:** `plan.md` · **Status:** executed · **Final line:** see `aar.md`

## Phase 0 — Scaffold and baseline

- [x] 0. Increment directory carries `plan.md`, `tasks.md`, in-progress `aar.md`, all three with the review-cap contract satisfied.
- [x] 1. Re-confirm baseline: `git status` clean, `npm run check:fast` PASS on `1ad3ee2`.
- [x] 2. Seam audit: `raceFirstSuccess` callers (`src/index.ts:809` search hedge, `:1032` fetch hedge); every `fetchPage` implementation (5 files); every `default_tier` read (`src/kb.ts:304,321,694`); every `tiers[...]` read (`:326,1247`); `FetchLike` init type (`src/lib/url-guard.ts:175-177`).
- [x] 3. Sibling-REQ pre-check: REQ-021, REQ-021a, REQ-031, REQ-035, REQ-066, REQ-082, REQ-083 — REQ-031 is not amended; REQ-066 is (see plan §Requirement text).
- [x] 4. Existing-check discovery: confirm no gate already validates `default_tier` membership and no existing bound covers `sqliteSearch`.

## Phase 1 — Spec and README

- [x] 5. `infobroker.md`: REQ-021 (797 chars), REQ-066 (592), REQ-074 (~686) exactly as quoted in `plan.md`; REQ-031 untouched. `README.md`: one sentence in §Content Extraction and one in §Hedged fallback, both naming `fetch_page` where the claim is renderer-specific.
- [x] 6. `npm run validate-spec` and `npm run validate-readme` → PASS (≤800 chars of prose, ≤8 sentences, ≤8 SHALL; §Content Extraction stays under its 350-word budget).

## Phase 2 — Change A, bounded search (F-R6-E-4)

- [x] 7. Red: `src/lib/bounded-rank.test.ts` (capacity bound, descending order, tie stability) and `src/kb-search-bound.test.ts` (300-chunk store, `max_results: 25`, equivalence with a brute-force reference).
- [x] 8. `src/lib/bounded-rank.ts`; wire `src/kb.ts:563-605`, keeping `score` raw and the comparator exactly `b.score*b.freshness_score - a.score*a.freshness_score`.
- [x] 9. Green: both suites pass; `npm run typecheck`.

## Phase 3 — Change B, crawl attempt cap (F-R4-C-8)

- [x] 10. Red: in `src/fetch-page-extraction.test.ts`, **extend** the existing `beforeAll` fetch block (`:88-103`) with `crawl_max_pages: 4` while keeping `cache` — dropping `cache` would let KB reads answer the hops and zero `stub.requests`. The page body links to 8 paths that fall to the stub's 404 branch and then 8 `/page/N` links. Pre-fix: 12 stub requests, 4 pages. Post-fix: 4 stub requests, 1 page, `meta.attempts === 4`.
- [x] 11. `src/index.ts:1216-1288`: attempt counter before the fetch, loop guard, `meta.attempts`.
- [x] 12. Green: `npx vitest run src/fetch-page-extraction.test.ts`; Arena crawl test re-run as a regression.

## Phase 4 — Change C, hedge cancellation (F-R4-B-1)

- [x] 13. Red: `src/hedge.test.ts` — loser signal aborted on a win, winner untouched, all aborted on exhaustion, no-`signals` path unchanged; `src/fetch-fallback.test.ts` — an abort is not a provider failure.
- [x] 14. `src/hedge.ts` `RaceOptions.signals`; `src/http.ts` signal composition; `src/types.ts` + 5 providers; `src/lib/url-guard.ts` `FetchLike` init widening; `src/fetch-fallback.ts` `isCancellation`; `src/index.ts:936-1040` controllers, first-line abort check, signal-bound native wrapper.
- [x] 15. Green: both suites pass; `npm run typecheck`.

## Phase 5 — Change D, freshness tier resolution (F-R6-C-1)

- [x] 16. Red: `src/config.test.ts` rejects `default_tier: "stabel"`, rejects a `tiers` block with no `default_tier`, and accepts each defined tier; `src/kb.test.ts` — an unknown stored tier decays (`freshness_score < 1`) **and** expires by the default tier; a config with no `tiers` still scores `1` and expires nothing. Clause tags `REQ-074 default-tier-defined` and `REQ-066 undefined-tier-default`.
- [x] 17. `src/config.ts:1045-1047` membership check plus presence-when-`tiers`-exists; `src/kb.ts` `resolveTier` in `classifyFreshness`, `computeFreshnessScore`, and the expiry scan, with the `!def` guards kept as pre-config safety nets; ingest resolves only an absent tier.
- [x] 18. Green: both suites pass; `npm run typecheck`.

## Phase 6 — Record and close

- [x] 19. `ROADMAP.md`: remove the § Fetch and KB resource bounds section.
- [x] 20. `CHANGELOG.md`: one `## 2026.11.11 — Fetch and KB resource bounds` section naming the crawl attempt cap, renderer cancellation, default-tier validation and resolution, and the bounded search (no version bump).
- [x] 21. `worklist.md:700,714,811,824`: four rows → `Resolved` with the test that proves each, and the census block at `:584-588` recounted (expect `Resolved` 13→17, `Scheduled-roadmap` 165→161, roadmap-mapped 74→70 if all four were in the 74).
- [x] 22. AAR staged with finding dispositions, the census, and `LOOP OPEN`, recording `used 2 passes`.
- [x] 23. `npm run check` (full) on the staged tree → PASS (22 gates, 159.1 s); AAR token flipped to `LOOP PAUSED`; `npm run check-loop-artifacts` → 0 errors.
