# AAR — Fetch and KB resource bounds

**Increment:** `docs/plans/2026-11-14-fetch-kb-resource-bounds`
**Status:** complete · **Terminal token:** `LOOP PAUSED`
**Review cap:** 2 review passes (self + one cold); used 2 passes, plus the diff re-review of the cold pass
**Risk accepted:** no passing cold review — the re-review cap was reached with all 20 findings dispositioned in revision 3 — authorized by maintainer (user message, 2026-11-14)

## Baseline

- Predecessor `1ad3ee2`; clean tree; `npm run check:fast` PASS (19 gates, 28.3 s) before the increment directory existed; 207 unpushed commits, oldest 4.7 d.
- `npm run check` (full, 22 gates) → **PASS**, 159.1 s, run on the staged commit-6 tree.

## Trigger and scope

Roadmap § Fetch and KB resource bounds (the first open section). Four P2 rows:
F-R6-E-4, F-R4-C-8, F-R4-B-1, F-R6-C-1. No other register row was in scope; the
other four roadmap sections are untouched.

## Findings and dispositions

| Finding | Disposition | Evidence |
|---|---|---|
| F-R6-E-4 (P2) | Resolved in-session | `BoundedRank` retains at most `max_results` with the same comparator; ranking unchanged including ties (`src/lib/bounded-rank.ts`, `src/kb.ts:563-610`; `src/bounded-rank.test.ts`, `src/kb-search-bound.test.ts`) |
| F-R4-C-8 (P2) | Resolved in-session | Attempt budget consumed before every fetch; `meta.attempts` reported; crawl test asserts 4 requests / 1 page under a 4-attempt cap (`src/index.ts`; `src/fetch-page-extraction.test.ts` `crawl attempt cap`) |
| F-R4-B-1 (P2) | Resolved in-session | Per-renderer `AbortController`; losers aborted on settle; abort is not classified, cooled down, or recorded; signal threaded through `infobrokerFetch` and five provider `fetchPage` implementations (`src/hedge.ts`, `src/index.ts`, `src/http.ts`, `src/types.ts`, `src/lib/url-guard.ts`, `src/providers/*`; `src/hedge.test.ts` `hedge cancellation`, `src/fetch-fallback.test.ts`) |
| F-R6-C-1 (P2) | Resolved in-session | `default_tier` must name a defined tier and is required when tiers exist; undefined stored/classified tiers resolve to the default in scoring and expiry (`src/config.ts`, `src/kb.ts`; `src/config.test.ts` `freshness default tier validation`, `src/kb-tier-resolution.test.ts`) |
| F-M1-2 register census offset | **Scheduled** (pre-existing) | The census recorded `Resolved 13` while 15 rows carry an exact `Resolved` disposition. This increment adjusted the counts by its own four-row delta (13→17, 165→161, 74→70) and did not re-derive them. The drift belongs to `ROADMAP.md` § Full-review register reconciliation. |

## Deviations from the approved plan

1. **`RaceOptions.signals` carries `AbortController`, not `AbortSignal`.** An `AbortSignal` has no `abort()` method, so the plan's stated shape could not cancel anything. The hedge owns no controller creation; `src/index.ts` builds the map and passes `{ slug, controller }`. Same behavior, one type narrower than planned.
2. **The crawl test uses `startStubProvider({ mode: "missing" })`.** The plan assumed unknown paths always 404; the stub's default `ok` mode answers any non-`/page/` path with a 200 JSON body, which made the first run return 4 pages. `missing` gives the intended dead-link shape.
3. **`createToolMetrics`/README numbers.** The README §Content Extraction section is 267 words after the edit (plan expected ≈262) and §Hedged fallback 194 (≈193); both are within budget.
4. **REQ-031 was not amended** (cold pass C2). The cancellation clause sits in REQ-021, which owns renderer dispatch. `search_web`'s hedge is untouched and no longer covered by a claim.

## Conditions from the plan gate

- **C-1** — close order honored: the AAR was staged, the full `npm run check` ran on that tree, the token was flipped, and `check-loop-artifacts` re-ran. Config validation rejects a tiers block with no `default_tier` (`src/config.test.ts` third case in `freshness default tier validation`).
- **C-2** — `npm run validate-spec` PASS after the REQ edits; measured prose: REQ-021 797 chars / 3 sentences, REQ-066 592 / 7, REQ-074 665 / 6, all within the mechanical limits.

## New observations (not fixed)

| Item | Class | Disposition |
|---|---|---|
| `search_web`'s hedge still has no cancellation (same shape as F-R4-B-1) | P3 | Recorded, not scheduled. Needs a signal on every provider `search()`; no finding names it. |
| `withTimeout` does not abort its work on timeout | P3 | Recorded. The timeout bounds the wait and the task fails per REQ-035; aborting would need the same seam again. |
| The lexical `prefilter` still holds one entry per chunk | P3 | Recorded. It is a cached index, not a per-query accumulation; bounding it is a different design. |
| The register's disposition census was already offset (15 exact rows vs 13 recorded) | P2 | Scheduled on `ROADMAP.md` § Full-review register reconciliation; this increment only shifted the counts by four. |

## Gate results

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS after every commit |
| `npm run validate-spec` | PASS (142 REQs, 0 uncited) |
| `npm run validate-readme` | PASS (0 errors, 0 warnings) |
| `npm run test` | PASS (131 files, 1565 tests) |
| `npm run test-debate-club` | PASS (inside the full run) |
| `npm run check` (full) | PASS, 22 gates, 159.1 s |

## Loop status

`LOOP PAUSED` — gates green, four findings resolved, no open P0/P1 beyond what
is scheduled on `ROADMAP.md`. The next increment comes from `ROADMAP.md` § KB
migration preservation decision or a direct user request.
