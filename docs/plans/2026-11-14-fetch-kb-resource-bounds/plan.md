# Plan — Fetch and KB resource bounds

**Status:** revision 3 — cold pass `independent-review FAILED.` (2 Critical / 6 Major / 8 Minor / 4 Nit) and one diff re-review (`FAILED.`, 2 Major + 1 Minor + 2 Nits); every finding is dispositioned in this revision. The standard-depth re-review cap is reached, so this revision is presented with conditions rather than a third review · **Date:** 2026-11-14
**Depth:** standard (eight existing production modules, one new library module, five provider files, three REQ bodies, one README section, reversible edits; no destructive, credential, schema, or publish surface)
**Review independence:** self pass plus one cold pass; this revision is the diff re-review of that pass
**Review cap:** 2 review passes (self + one cold), plus at most one diff re-review; used 2, cap reached
**Risk accepted:** no passing cold review — the re-review cap was reached with all 20 findings dispositioned in revision 3 — authorized by maintainer (user message, 2026-11-14)
**Rollback cost:** 1 on a 0–2 scale (0 = pure addition, 1 = reversible edit, 2 = destructive). No state-format change, no new dependency, no config key rename.
**Roadmap item:** `ROADMAP.md:17-23` § Fetch and KB resource bounds (the first open section, so first in priority order). The section retires to `CHANGELOG.md` when this increment closes.
**Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md` — F-R4-B-1 (`:700`), F-R4-C-8 (`:714`), F-R6-C-1 (`:811`), F-R6-E-4 (`:824`), all four `Scheduled-roadmap` / P2.

**Done bar:** the four findings are `Resolved` in the register with a driving
test each; `npm run typecheck`, `npm run validate-spec`, `npm run validate-readme`,
`npm run test`, and `npm run test-debate-club` pass; the roadmap section is
removed; the CHANGELOG carries one entry. The AAR is held at `LOOP OPEN` until
the full `npm run check` is green, then closed to `LOOP PAUSED` and
`check-loop-artifacts` is re-run on the flip.

## Why this section

The roadmap is ordered top-first and this is the first open section
(`ROADMAP.md:17`). Its trigger is "start with a broad-query memory or latency
report, or the next increment that touches the KB store" — this increment is
the KB-store increment, and the same session touches the fetch path. The
section's close condition is a bounded-store test, which change A supplies.

All four rows are **P2** and every one is a bound, not a feature: an unbounded
accumulation (A), an under-counting cap (B), an un-cancelled race (C), and an
unvalidated config name that silently disables decay and expiry (D).

## Findings in scope

| ID | One-line predicate (from the register) | Roadmap wording |
|---|---|---|
| F-R6-E-4 | `sqliteSearch` accumulates every matching chunk before slicing to `maxResults` | "Bound `sqliteSearch` … before it slices" |
| F-R4-C-8 | The page cap bounds returned pages, not outbound fetches; refused/unfetchable hops do not consume it | "make the crawl page cap count outbound fetches rather than returned pages" |
| F-R4-B-1 | Once the hedge deadline fires, every renderer runs and none is cancelled; losers keep spending quota and recording stats | "Cancel hedge losers once the deadline fires" |
| F-R6-C-1 | `freshness.default_tier` is only type-checked; a name with no tier never decays or expires | "Validate `freshness.default_tier` against the known tier names" |

## Baseline (verified this session)

- `git log -1` → `1ad3ee2`; `npm run status` → version 2026.11.11 (latest tag `v2026.11.07`), **207 unpushed commits, oldest 4.7 d**, 5 open roadmap items.
- `npm run check:fast` → **PASS** (19 gates, 28.3 s), run before this increment directory existed. The directory now carries the `**Review cap:**` lines that `check-loop-artifacts` requires of increments dated 2026-11-14 or later (`scripts/lib/loop-artifacts.ts:21-22,83-120`); `plan.md` opens its value with a count and `aar.md` records `used <n> passes`.
- The previous increment's AAR ends `LOOP PAUSED`, so no increment is open ahead of this one.
- Full `npm run check` (network + pack + Arena) has not been run this session; it runs once on the final tree, after the AAR.

## Predicates re-verified by reading the code this session

| Finding | Current code | What is wrong |
|---|---|---|
| F-R6-E-4 | `sqliteSearch` pushes one result object per matching chunk (`src/kb.ts:563-582`, push at `:570`), then sorts the whole array (`:604`) and slices (`:605`). Capacity is `actualMax = min(maxResults, kb.max_results)` (`:560`); `kb.max_results` is validated ≥1 (`src/config.ts:997`). | Heap and sort cost grow with the number of *matches*, not with `actualMax`. A broad query over an oversize store holds one `KbSearchResult` per matching chunk at once. |
| F-R4-C-8 | Loop guard is `while (queue.length > 0 && pages.length < maxPages)` (`src/index.ts:1223`); `pages.push` only on an accepted fetch (`:1250`); a refused hop `continue`s without consuming budget (`:1237`), as do a renderer miss (`:1241`) and a policy refusal (`:1246`); `maxPages = config.fetch.crawl_max_pages ?? 10` (`:1217`, shipped default 10 at `config.json:267`). | The cap bounds *returned* pages. A page linking to many 404s or refused origins issues an unbounded number of outbound requests before 10 pages are returned. |
| F-R4-B-1 | Hedged fetch branch (`src/index.ts:1012-1040`): the primary starts at `:1023`, the deadline race at `:1024`, `raceFirstSuccess` at `:1032`. No cancellation handle exists, and `attempt()` (`:936-1007`) records quota/latency/stats on success (`:985-989`) with no abort check. `raceFirstSuccess` resolves on the winner and drops the other tasks (`src/hedge.ts:56-144`, commit at `:72`). | Every losing renderer runs to completion: the outbound request, its body read, `increment()` quota spend, `latency.track`, `recordProviderSuccess`, and both attempt records all happen after the winner has served. |
| F-R6-C-1 | Config validation only checks `typeof kb.freshness.default_tier === "string"` (`src/config.ts:1045-1046`). `classifyFreshness` returns `default_tier` verbatim (`src/kb.ts:304`, `:321`); ingest falls back to it (`:694`); `computeFreshnessScore` returns `1` when `tiers[tier]` is missing (`:324-331`, called at `:572`); tier expiry skips a chunk with no tier definition (`:1247-1249`). The classifier can also emit `ephemeral`/`recent`/`evergreen`/`stable` (`:308-318`), which a user layer need not define. | A typo (`"stabel"`) or a classifier-emitted name absent from `tiers` yields a chunk that never decays and never expires, and no gate catches it. |

## Requirement text this plan is measured against

Measured with the validator's own rule — prose excludes the `_Check:_` tail
(`scripts/validate-spec.ts:246-266`); limits are ≤800 characters, ≤8 sentences,
≤8 `SHALL`, one paragraph (`scripts/validate-spec.ts:255-280`).

**REQ-021** (`infobroker.md:267-268`) — current prose **768** chars, 3 sentences, 4 `SHALL`, 16 backtick tokens (the tool-signature exception).
Proposed prose **797** chars, 3 sentences, 4 `SHALL`, 16 backticks. Only sentence 2 changes: the trailing clause becomes
"returning the first successful render, preferring the primary within a configurable grace window and cancelling losing renderers".
This is where renderer cancellation belongs: REQ-021 owns the renderer race, and the change implements cancellation only for renderers.

> **Consequence for REQ-031:** it is **not** amended. The cold pass (C2) showed that a cancellation clause in REQ-031 would bind provider fallback (`search_web`), which this increment deliberately leaves alone (`src/index.ts:795-830`). REQ-031 stays byte-identical.

**REQ-066** (`infobroker.md:585-586`) — current prose **493** chars, 6 sentences, **6** `SHALL`.
Proposed **592** chars, 7 sentences, **7** `SHALL`: one sentence is inserted — "A content tier the configuration does not define SHALL be resolved to the configured default tier." Without it, the expiry change (D) would contradict REQ-066's "content whose freshness tier defines no expiry SHALL remain … indefinitely" (cold pass M2).

**REQ-074** (`infobroker.md:594-595`) — current prose **564** chars, 5 sentences, 5 `SHALL`.
Proposed **665** chars, 6 sentences, 6 `SHALL`: the current fourth sentence ("Content for which the classification mechanism produces no determination SHALL be assigned a configurable default tier.") becomes —
"Content for which the classification mechanism produces no determination SHALL be assigned a configurable default tier that names a defined tier. A classification that resolves to an undefined tier SHALL use the default."
"Configurable" is retained (cold pass n3). Together with the validation rule in §Design D, this makes the default tier **required** whenever `tiers` is present, so a resolution target always exists (re-review N2).

No REQ change for F-R6-E-4: the change is behavior-preserving (identical result list, smaller working set).

## Design

### A — Bounded top-K selection in `sqliteSearch` (F-R6-E-4)

New library module `src/lib/bounded-rank.ts` (lib role, header comment, no
shebang per `AGENTS.md` § Script Discipline):

```
class BoundedRank<T> {
  constructor(capacity: number, compare: (a: T, b: T) => number) // >0 means a ranks first
  offer(value: T): void      // retains at most `capacity`, min-heap of the current best
  get size(): number         // never exceeds capacity
  values(): T[]              // descending by compare, stable on ties (insertion order)
}
```

`sqliteSearch` replaces `results.push(...)` (`src/kb.ts:570`) with
`ranker.offer(...)` and `results.sort(...).slice(...)` (`:604-605`) with
`ranker.values()`. The comparator is
`(a, b) => b.score * b.freshness_score - a.score * a.freshness_score` — the
same expression the current sort uses at `:604` — and it reads the **unchanged**
result objects: `score` stays the raw `combinedScore` (`:571`) because
KB-first sufficiency consumes it (`src/index.ts:404`). Nothing about the object
shape changes, so the returned array is byte-identical for every store. Ties
break on insertion index, matching V8's stable sort.

- **Alternative rejected:** sort-then-slice with periodic pruning — unbounded between prunes and loses mid-scan ordering guarantees.
- **Alternative rejected:** SQL-side `ORDER BY`/`LIMIT` — the score is computed in JS from vector and keyword signals, so the store cannot rank; it would also change the store seam (`src/kb-store.ts`).
- Capacity is never 0 in practice: `kb.max_results` is validated ≥1 (`src/config.ts:997`), and `BoundedRank` with capacity 0 returns `[]` anyway.
- The lazily built lexical `prefilter` (`src/kb.ts:584-590`) also holds one entry per chunk. That is a cached index rebuilt only on model change, and bounding it is a different design. Recorded as out of scope, not as fixed.

### B — Crawl cap counts outbound attempts (F-R4-C-8)

In `src/index.ts:1216-1288`:
1. Add `let attempts = 0;` beside `pages`.
2. Change the loop guard to `while (queue.length > 0 && attempts < maxPages)`.
3. Increment `attempts` immediately after `visited.add(cur.url)` and before the
   fetch, so a refused hop (`:1237`), a renderer miss (`:1241`), and a
   policy-refused page (`:1246`) all consume budget.
4. Add `attempts` to `meta` beside `pages`, `max_pages`, `max_depth`
   (`:1280-1288`).

`crawl_max_pages` keeps its name and its 1-and-up validation
(`src/config.ts:907-908`); only its meaning narrows from "pages returned" to
"hops attempted". The response still lists only accepted pages, so
`pages ≤ attempts ≤ maxPages`.

- **Alternative rejected:** a second config key for attempts — two caps over one loop invite a configuration where the attempt cap is smaller and the page cap becomes dead.
- **Alternative rejected:** counting only successful outbound requests — that reproduces the finding, because a 404 is an outbound request.

### C — Cancel hedge losers (F-R4-B-1)

Full cancellation (user decision). Five edits:

1. **`src/hedge.ts`** — `RaceOptions` gains
   `signals?: ReadonlyArray<{ slug: string; signal: AbortSignal }>`. On
   `commit(r)` (`:72`) every listed signal except `r.slug` is aborted; on
   exhaustion (`:79`) every listed signal is aborted. A race without `signals`
   behaves exactly as today.
2. **`src/index.ts:1012-1040`** — create one `AbortController` per renderer
   before the hedge, start the primary with its signal, and pass the pairs as
   `signals` plus each loser's signal into its `attempt()` call. `attempt`
   (`:936`) gains `signal?: AbortSignal` and checks it:
   - **first line of the function**, before the `inCooldown` branch
     (`:938-941`), so an already-cancelled loser cannot record a `cooldown`
     attempt (cold pass M6);
   - again after `throttle(slug)`, before starting the call;
   - before any accounting (`increment`, `latency.track`,
     `recordProviderSuccess`, `sessionStats.recordAttempt`, `recordAttempt`);
   - in `catch`, rethrow an `SsrRefusalError` first (REQ-021a keeps its distinct
     code even when a refusal races the abort), then treat any other abort as
     not-a-failure: return `null` before `classifyFailure`, cooldown, and error
     recording.
   The primary-wins path (`:1025-1027`) needs no abort — the losers have not
   started. The sequential non-hedged path (`:1042`) is unchanged.
3. **`src/fetch-fallback.ts`** — `export function isCancellation(error: unknown): boolean`
   (true for an `AbortError` / aborted-signal reason), tested beside
   `classifyFailure` (`:73`).
4. **`src/http.ts`** — `InfobrokerFetchOptions` accepts `signal?: AbortSignal`
   (it currently `Omit`s `signal` from `RequestInit`, `:7-9`), and the request
   uses `AbortSignal.any([AbortSignal.timeout(timeout), signal])` when a signal
   is supplied (`:32`). Node ≥24 is declared (`package.json:112-113`) and
   `AbortSignal.any` is already used at `src/corroborate.ts:1012`.
5. **Renderer seam** — `src/types.ts:540` becomes
   `fetchPage?(url: string, signal?: AbortSignal): Promise<string>`; the five
   implementations pass it to `infobrokerFetch`: `jina.ts:8`,
   `wikipedia.ts:73`, `arxiv.ts:50`, `internet_archive.ts:9`,
   `stack_exchange.ts:48`.
   The native path needs no new `fetchFollowRedirects` parameter: `FetchLike`
   (`src/lib/url-guard.ts:175-177`) declares its init as
   `{ redirect?: "manual"; headers?: Record<string,string> }`, so this change
   **widens that type to accept `signal?: AbortSignal`**, and `src/index.ts`
   passes a signal-bound wrapper —
   `(u, init) => fetch(u, { ...init, signal })` — instead of `fetch` directly.
   That keeps the six-parameter signature untouched (cold pass n4) and makes
   the abort take effect on the next hop by rejection from the fetch itself.

- **Alternative rejected (user decision):** cooperative-only — abort the accounting but let the request finish. It leaves the socket and body read alive and misreports provider usage.
- **Explicit non-goal:** the `search_web` hedge at `src/index.ts:795-830` has the same shape. Cancelling it needs a signal on every provider's `search()`; the finding does not name it. Recorded in the AAR, not scheduled, and REQ-031 is not amended (C2).
- **Residual:** `withTimeout` (`src/lib/timeout.ts:30`) does not abort its work on timeout. Unchanged; the timeout already bounds the wait and the task then fails per REQ-035.

### D — Resolve the default freshness tier against the defined tiers (F-R6-C-1)

`src/config.ts` (beside `:1045`): when `kb.freshness.tiers` is an object, the
`default_tier` **must be present** and must satisfy
`Object.hasOwn(tiers, default_tier)`; otherwise push
`kb.freshness.default_tier must name a defined freshness tier` (a present
non-string value keeps its existing error). Requiring it whenever `tiers`
exists is what guarantees a resolution target (re-review N2): a tier set
without a default leaves every undefined name unresolvable.

`src/kb.ts`: one resolver —
`resolveTier(name?: string): string` returns `name` when `tiers` defines it,
else `default_tier` when defined, else `name` unchanged — used at **four**
sites: `classifyFreshness` (`:304`, `:321`), `computeFreshnessScore` (`:326`,
i.e. the score itself, so an unknown stored tier *decays* by the default tier
rather than passing through with score `1`), and the expiry scan (`:1247`, so
it also *expires* by the default tier). Under a validated config the resolver
always yields a defined tier; the existing `!tiers || !tiers[tier]` guards
(`:326`, `:1248`) stay as safety nets for a store read before configuration is
loaded, and are unreachable otherwise.

- Ingest (`:694`) keeps its explicit caller-supplied `freshnessTier` verbatim; only the *absent* value resolves through the default. An explicit tier that the configuration does not define is therefore not silently coerced (cold pass m8).
- **Alternative rejected:** require the five built-in tier names in every config — it would break the custom-tier reload test (`src/config.test.ts:957-1017`) and REQ-074 only requires *a* configurable default.
- Behavior change (intended, and now stated in REQ-066): a chunk stored under an undefined tier decays and expires by the default tier instead of living forever. Report content is unaffected (`source_type` guard, REQ-083).

### E — README reflects the contract (spec→README binding)

Two REQ bodies change, so `README.md` must change in the same commit
(AGENTS.md § README Governance; enforced at `scripts/push-pipeline.sh:1066-1074`).
Two truthful edits, each tied to `fetch_page` (cold pass m5):

1. §Content Extraction (`README.md:249-272`, currently **231 words**, budget
   350): append — "A crawl is bounded by configurable page-count and depth
   caps; the page-count cap counts outbound attempts, so a page full of dead
   links cannot multiply requests." Expect ≈ **262 words**.
2. §Hedged fallback (`README.md:790-809`, currently **173 words**, not under
   the §3 budget): append — "When a `fetch_page` renderer race settles, the
   losing renderer is cancelled, so it makes no further request and spends no
   quota." Expect ≈ **193 words**.

Two other sections mention hedging or freshness (`README.md:319-320`
modality of a hedged *source*; `README.md:357` a freshness tier per deep-read
page). Neither makes a crawl-cap, renderer-cancellation, or tier-validation
claim, so neither is edited (cold pass m6).

## Blast radius

| File | Change | Size |
|---|---|---|
| `infobroker.md` | REQ-021, REQ-066, REQ-074 bodies as quoted (REQ-031 untouched) | S |
| `README.md` | one sentence in §Content Extraction and one in §Hedged fallback | S |
| `src/lib/bounded-rank.ts` | new bounded ranker | M |
| `src/kb.ts` | top-K wiring; `resolveTier` in classify, score, expiry; ingest default only | M |
| `src/index.ts` | crawl attempt cap + `meta.attempts`; hedge controllers and abort checks in `attempt` | M |
| `src/hedge.ts` | `RaceOptions.signals` and loser abort | S |
| `src/http.ts` | accept and compose a caller `signal` | S |
| `src/types.ts` | `fetchPage` optional signal | S |
| `src/lib/url-guard.ts` | `FetchLike` init widened with `signal?` (signature untouched) | S |
| `src/fetch-fallback.ts` | `isCancellation` | S |
| `src/providers/{jina,wikipedia,arxiv,internet_archive,stack_exchange}.ts` | pass the signal to `infobrokerFetch` | S |
| `src/config.ts` | `default_tier` membership check | S |
| `src/bounded-rank.test.ts` | new: bound, ordering equivalence, tie stability | M |
| `src/kb-search-bound.test.ts` | new: bounded store returns the same ranking as a brute-force reference | M |
| `src/fetch-page-extraction.test.ts` | crawl attempt-cap test against the loopback stub (existing spawned-server suite) | M |
| `src/hedge.test.ts` | loser abort on win; all abort on exhaustion; no-signal path unchanged | S |
| `src/fetch-fallback.test.ts` | abort is not a provider failure | S |
| `src/config.test.ts` | reject an undefined `default_tier`; accept every defined one | S |
| `src/kb.test.ts` | unknown stored tier decays and expires by the default tier; classifier-emitted undefined tier falls back | M |
| `debate-club/src/mcp-contract.test.ts` | existing crawl test re-run as a regression (no fixture change) | — |
| `ROADMAP.md` | remove the section | S |
| `CHANGELOG.md` | one entry | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | four rows → `Resolved` with evidence; census block recounted | S |

No Arena fixture changes, so the replay fixture hash is untouched. `config.json`
is unchanged: `crawl_max_pages` keeps its name and validation; only its meaning
narrows, which REQ-021d and the README now state.

## Commit series

One commit per concern; `npm run typecheck` after each. The full `npm run check`
runs once, on the staged commit-6 tree, before commit 6 is made.

| # | Commit | Gate after it |
|---|---|---|
| 1 | `docs(spec): state the crawl attempt cap, renderer cancellation, and tier resolution contract` (REQ-021/066/074 + the two README sentences) | `npm run validate-spec`, `npm run validate-readme` |
| 2 | `perf(kb): bound search to a top-K selection` (A) | `npx vitest run src/bounded-rank.test.ts src/kb-search-bound.test.ts` |
| 3 | `fix(fetch): count outbound crawl attempts against the page cap` (B) | `npx vitest run src/fetch-page-extraction.test.ts` |
| 4 | `fix(fetch): cancel hedge losers when the race settles` (C) | `npx vitest run src/hedge.test.ts src/fetch-fallback.test.ts` |
| 5 | `fix(kb): validate the default freshness tier and resolve undefined tiers` (D) | `npx vitest run src/config.test.ts src/kb.test.ts` |
| 6 | `docs(roadmap): resolve the fetch and KB resource bounds section` (ROADMAP, CHANGELOG, register rows + census, AAR) | `npm run check` on the staged tree, then the token flip + `npm run check-loop-artifacts`, then commit |

**Close order for commit 6** (cold pass M3): stage its content with `aar.md`
carrying `LOOP OPEN` and the dispositions → run `npm run check` on that tree →
on green, flip the token to `LOOP PAUSED` and re-run `npm run check-loop-artifacts`
→ commit 6. A red full check leaves the AAR at `LOOP OPEN`, records the failing
gate, and makes no commit 6. The AAR therefore never claims a gate that has not
run.

If commit 1 lands and the code commits are dropped, the spec asserts a contract
the code does not meet — so the series runs in one session, in order.

## Edge cases and rollback

| Mode | Handling |
|---|---|
| Store smaller than `capacity` | `BoundedRank` retains everything and `values()` equals today's sort. |
| Equal scores | Tie broken on insertion index, matching the current stable sort; the equivalence test pins it. |
| Crawl with a broken link on the only page | The hop consumes budget; `pages` stays small; the response is still `[OK]` and reports `attempts`. |
| Crawl where every link fails | The loop ends by the attempt cap, not by error (REQ-021d "stop without error"). |
| A renderer ignores the signal | It finishes as today; the pre-accounting abort check still suppresses quota and stats. |
| Abort mid-`throttle` or before `inCooldown` | The early checks return `null` without a provider call or a cooldown record. |
| Abort races an SSRF refusal | The refusal is rethrown first, per REQ-021a. |
| User layer sets `default_tier` to an undefined name | Config validation rejects it; an invalid user layer follows REQ-113 (shipped defaults, no rewrite). |
| Rollback | Each commit is a reversible edit; revert it. No migration, no deleted data, no published artifact. |

## Verification

1. **Red run first:** A and D test-first in `src/`; C test-first in `src/hedge.test.ts`; B in `src/fetch-page-extraction.test.ts` — the spawned-server suite already starts the real server against `startStubProvider` (`:88-103`, stub started by the `page()` helper at `:109-114`) and already exercises `crawl: true` (`:242-264`), so B needs no Arena fixture (cold pass M5).
2. **B satisfiability:** the suite's existing `beforeAll` server config
   (`src/fetch-page-extraction.test.ts:88-103`) is **extended**, not replaced —
   `fetch: { allow_private_urls: true, cache: { kb_read: false, kb_max_age_hours: 24 }, crawl_max_pages: 4 }`
   — because dropping `cache` would let KB reads answer the crawl hops and zero
   `stub.requests` (re-review Minor). The page body links to 8 paths that fall
   through to the stub's 404 branch (`src/lib/stub-provider.ts:105-106`) and
   then 8 `/page/N` links. **Pre-fix:** 12 stub requests (start + 8 dead + 3
   good) and 4 pages returned. **Post-fix:** 4 stub requests (start + 3 dead)
   and 1 page, `meta.attempts === 4`. `stub.requests` (`src/lib/stub-provider.ts:114-116`,
   incremented at `:54`) is the assertion, so "outbound fetches" is measured
   directly, not inferred (cold pass M4).
3. **C satisfiability:** `raceFirstSuccess` is pure and already unit-tested with short real sleeps (`src/hedge.test.ts:81-120`, which uses `sleep(5/20/120)`, not fake timers). The new cases assert the loser's signal is aborted, the winner's is untouched, every signal is aborted on exhaustion, and the no-`signals` path is unchanged.
4. **D satisfiability:** the test drives an ingest under a config whose `tiers` omit the chunk's stored tier, then asserts a decayed `freshness_score` **and** expiry by the default tier — both after `computeFreshnessScore` resolves the tier. A second case pins the guard: a config with no `tiers` at all still reports score `1` and removes nothing.
5. **Gate dry-run:** no new gate. `npm run validate-spec` and
   `npm run validate-readme` at commit 1; `npm run check` (full) on the staged
   commit-6 tree, before the commit, followed by `npm run check-loop-artifacts`
   after the AAR token flip.
6. **Register coupling:** the four rows, the register's disposition census (`worklist.md:584-588`), and the roadmap section are updated in commit 6 together. The census is not parsed by a gate; the recount is manual and recorded in the AAR.
7. **Undone if red:** each commit reverts independently; a failing full `npm run check` stops the series and leaves the AAR at `LOOP OPEN` (AGENTS.md § Agent Operating Routine).

**Unverified here:** the full `npm run check` (network, pack, Arena) has not run
this session. Its result is recorded in the AAR when the increment executes.

## Out of scope

- The lexical `prefilter` cache's per-chunk memory (A's adjacent cost) — a different design; recorded in the AAR.
- The `search_web` hedge (`src/index.ts:795-830`) — same defect shape, no finding, needs a signal on every provider `search()`.
- `withTimeout` not aborting its work — REQ-035 already bounds the wait; recorded.
- Every other open register row (F-R4-A-2, A-3, B-3, C-3…C-6, C-10, C-11, D-4, E-2, E-3, F-R6-C-3, D-3, E-2, E-3, and the R5/R7/R8/R9 rows) and the other four roadmap sections.

## Cold-pass dispositions

| Finding | Disposition |
|---|---|
| C1 (D's decay half unimplemented) | Fixed: `computeFreshnessScore` now resolves the tier, so both decay and expiry are covered; the test asserts both. |
| C2 (REQ-031 mandates `search_web` cancellation) | Fixed: REQ-031 is not amended; the clause moved to REQ-021, which owns renderer dispatch. |
| M1 (comparator can change `score`) | Fixed: comparator stated verbatim; `score` stays raw and unchanged. |
| M2 (REQ-066 contradiction) | Fixed: REQ-066 amended with the tier-resolution sentence. |
| M3 (AAR gate / ordering / baseline) | Fixed: **close order** stated — AAR staged at `LOOP OPEN`, full check on that tree, token flip, `check-loop-artifacts` re-run, then commit 6; baseline claim reworded. |
| N2 (unresolvable tier after the C1 fix) | Fixed: `default_tier` is required whenever `tiers` is present, so the resolver always has a target; the `!def` guards stay as pre-config safety nets only. |
| Re-review Minor (B config replaces `fetch`) | Fixed: the existing `fetch` block is extended, `cache` preserved. |
| Re-review nits (stub line cites; SHALL counts) | Fixed: 404 branch `:105-106`, counter `:114-116`, `page()` at `:109-114`; REQ-066 current 6 `SHALL`, REQ-074 current 564 chars / 5 sentences / 5 `SHALL` → 665 / 6 / 6. |
| M4 (B red-run arithmetic) | Fixed: pre-fix 12 requests / 4 pages, post-fix 4 requests / 1 page, asserted on `stub.requests`. |
| M5 (B venue) | Fixed: B moves to `src/fetch-page-extraction.test.ts`; the Arena crawl test is a regression. |
| M6 (early cooldown record) | Fixed: abort check is the first line of `attempt`. |
| m1 (baselines) | Fixed: 768 / 493 / 565 measured, proposals 797 / 592 / ~686. |
| m2 (line drift) | Fixed: `actualMax :560`, `pages.push :1250`, `:1237/:1241/:1246`, `meta :1280-1288`, accounting `:985-989`, `hedge.ts:56-144`. |
| m3 (fake timers) | Fixed: real short sleeps. |
| m4 (`FetchLike` init) | Fixed: type widening stated; signal-bound wrapper; abort is a rejection from the next hop. |
| m5 (README overclaim) | Fixed: the sentence names `fetch_page`. |
| m6 (README grep claim) | Fixed: the two other mentions are named and justified. |
| m7 (`fetch-page-extraction.test.ts` missing) | Fixed: in the blast radius and the B step. |
| m8 (explicit ingest tier coerced) | Fixed: ingest's explicit tier is left verbatim. |
| n1 (backtick-limit citation) | Fixed: the limit citation now names the mechanical-limit block only. |
| n2 (`max_results` ≤ 0) | Fixed: capacity ≥1 follows from `src/config.ts:997`; the `0` case is stated separately. |
| n3 ("configured" vs "configurable") | Fixed: "configurable" retained. |
| n4 (positional signal param) | Fixed: the wrapper approach leaves the signature untouched. |

## Evidence

- `ROADMAP.md:17-23`; `docs/plans/2026-11-09-full-review-sweep/worklist.md:700,714,811,824,584-588`.
- Read this session: `src/kb.ts:300-340,540-610,690-700,1240-1255`; `src/index.ts:930-1045,1210-1290`; `src/hedge.ts:1-144`; `src/http.ts:1-55`; `src/types.ts:540`; `src/lib/url-guard.ts:175-212`; `src/lib/timeout.ts:1-45`; `src/config.ts:900-915,990-1000,1025-1050`; `src/fetch-fallback.ts:60-80`; `src/providers/jina.ts:1-40`, `wikipedia.ts:65-90`; `infobroker.md:267-268,585-586,594-595`; `config.json:260-270,405-415`; `src/config.test.ts:955-1017`; `src/hedge.test.ts:1-120`; `src/fetch-page-extraction.test.ts:1-92,235-275`; `src/lib/stub-provider.ts:1-252`; `debate-club/src/mcp-contract.test.ts:260-300`; `debate-club/scripts/preload.mjs:1-20`; `scripts/validate-spec.ts:240-280`; `scripts/lib/loop-artifacts.ts:21-22,83-120`; `CHANGELOG.md:1-40`; `package.json:111-113`.
- No `src/index.ts` unit-import harness exists; the spawned-server suites (`src/fetch-page-extraction.test.ts`, `src/dispatch-orchestration.test.ts`) drive the real handler, which is why B lives there and C is proven in `src/hedge.ts` plus `src/fetch-fallback.ts`.
