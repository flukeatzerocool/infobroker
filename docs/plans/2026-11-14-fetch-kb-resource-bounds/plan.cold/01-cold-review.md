# Cold review — plan revision 1

**Reviewer:** cold subagent, no authoring context · **Plan sha256:** `2ce28354f48469172110943df72239059690eb3ac0dd45f2d5ab0144eec66bf2` · **HEAD:** `1ad3ee2`
**Verdict:** `independent-review FAILED.` — 2 Critical, 6 Major, 8 Minor, 4 Nit

## Critical

- **C1** D's acceptance test cannot pass under D's own design — the decay half of F-R6-C-1 is never implemented: `computeFreshnessScore` keeps its missing-tier → 1 guard and was not in the resolver's site list.
- **C2** The proposed REQ-031 body mandates cancellation the plan explicitly refuses to implement for `search_web`.

## Major

- **M1** A's comparator instruction points at the wrong line and can silently change the returned `score`, breaking the byte-identical claim.
- **M2** D contradicts REQ-066 ("a tier that defines no expiry remains indefinitely") without amending it.
- **M3** The AAR gate cannot pass at commit 6 as sequenced; the baseline `check:fast` claim predates the increment directory.
- **M4** B's red-run criterion is arithmetically impossible: pre-fix the crawl returns exactly `maxPages`, never more; the fixture counts were inconsistent.
- **M5** The evidence basis for placing B in the Arena is false in substance: `src/fetch-page-extraction.test.ts` already spawns the real server and exercises `crawl: true`.
- **M6** Aborted hedge losers can still record an attempt, because the cooldown branch runs before the planned post-throttle check.

## Minor

- **m1** Baseline REQ measurements wrong (proposals still pass).
- **m2** Cited `file:line` drift across `src/kb.ts`, `src/index.ts`, `src/hedge.ts`.
- **m3** "Already unit-tested under fake timers" is false; the tests use real sleeps.
- **m4** `FetchLike` does not already accept a `RequestInit`; the abort-mid-redirect mechanism was unspecified.
- **m5** The README hedge sentence overclaims for `search_web`.
- **m6** The README grep claim is contradicted by `README.md:319-320` and `:357`.
- **m7** Blast radius omits `src/fetch-page-extraction.test.ts`.
- **m8** `resolveTier` at ingest silently coerces explicit caller tiers.

## Nit

- **n1** Misattributed backtick-limit citation.
- **n2** `max_results <= 0` "unchanged" claim unverified.
- **n3** "configurable" → "configured" wording drift.
- **n4** A trailing positional `signal` in `fetchFollowRedirects` forces awkward call sites.

## Limitation

The five stages ran in one cold context (nesting subagents was unavailable to the
reviewer). There was no authoring conversation and no reliance on sidecar
conclusions; host-injected `AGENTS.md` weakened isolation slightly.
