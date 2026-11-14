# Cold plan review — hermetic fetch seams

Reviewer: `review` subagent (independent-review cold pass, no authoring context)
Plan sha256: 356ee9917cfea910a8111b43b77cc961e7b8d7e71979b279888e2e2383f794a6
Plan sha256 (v1, reviewed): `bff9967a676d21abe39d74db0443ab840ee3e71df93f24e5199bd52d83f63017`
Depth: standard · Stages: 1, 2, 3, 5 (Stage 4 not triggered — no author edits during the pass) · Reads: 39/40

Written by the parent session from the reviewer's report body. The reviewer
dispatch had no write tool, so it reported the body and the parent transcribed it
verbatim below.

## Premise verification

- **Premise 1 — CONFIRMED in mechanism.** `JINA_BASE` is a module constant
  (`src/providers/jina.ts:6`), composed at `:9` and reused by `health` at `:22`.
  `getEnvVar` is a plain `process.env` read (`src/config.ts:1129-1132`).
  `providers.jina` carries no `url_env`/`auth_env` (`config.json:18-26`), so
  `providerUsable`'s `urlPresent: !p.url_env || …` (`src/config.ts:1179`) does not
  gate it, and `resolveProvider` ignores `enabled` (`src/providers/index.ts:69-74`).
  `writeHermeticConfig` builds the child env from `scrubCredentials(process.env)`,
  which strips only `*_API_KEY(S)`, so an `INFOBROKER_JINA_URL` set by the test
  reaches the spawned server. Challenge detection sits at `src/index.ts:983-990`
  before the content branch. Mechanism works.
- **Premise 2 — CONFIRMED.** The protocol test at `src/lib/url-guard.ts:94-96`
  precedes the `allowPrivate` test at `:97`, so a non-HTTP target is refused under
  `allow_private_urls: true`. `fetchFollowRedirects` re-guards each hop at
  `:203-205`. The crawl pins `["native_fetch"]` (`src/index.ts:1260`); the refusal
  is rethrown at `:1006`, survives `retryWithBackoff` (`src/retry.ts:53`) and
  `withTimeout` (`src/lib/timeout.ts:38-49`), and the crawl catch audits `cur.url`
  and continues (`src/index.ts:1264-1266`). `audit()` is `appendFileSync`
  (`src/audit-log.ts:47`), so there is no read-after-write race. The register row's
  own premise is wrong: `worklist.md:709` says refusal is "gated solely by
  `allowPrivate` (`url-guard.ts:97-98,123-136`)", omitting `:94-96`. The plan's
  correction is right.

## Blocker

1. **[design]** Done bar 3 / `tasks.md:22` (both renderers answer the challenge →
   error with `cause: anti_bot`) is not hermetic as written. An exhausted chain on
   a plain `fetch_page` falls into `resolveFetchFallback` (`src/index.ts:1402-1425`),
   which for any non-DOI URL unconditionally calls `fetchContent(url,
   ["internet_archive"])` (`src/fetch-fallback.ts:281`). `fetchPageContent`/`attempt`
   never consult `enabled` (`src/index.ts:956-960`) and `resolveProvider` ignores it
   (`src/providers/index.ts:69-74`), so the real archive.org is contacted with a
   15 s provider timeout. That contradicts the plan's own "offline and
   deterministically" claim and puts a network call inside `check:fast`. Case B
   cannot bypass the fallback via `extract: true` either — the extract path pins
   `["native_fetch"]` (`src/index.ts:1329`) and never exercises the jina chain.
   **Must change:** name an explicit bypass for the fallback, or drop Case B from
   the done bar.

## Majors

1. **[clarity]** `infobroker.md` scope is stated four incompatible ways: updated in
   the same commit, "`infobroker.md` is not edited", listed among files carrying the
   broadened meaning, and listed under "Not touched"; `tasks.md:40` says edit it.
   State one scope.
2. **[design]** The fall-through is not isolated from the hedge race. With two
   renderers and hedging enabled (`src/index.ts:1027-1064`), `provider: native_fetch`
   plus "exactly one reader request" is satisfiable by a hedge win in which jina is
   aborted as a loser and its challenge is never classified. The mutation proof then
   goes green, and the instruction to use *small* `output.hedge_*` values increases
   that probability. **Must change:** set `output.hedge_enabled: false` for this
   case so the sequential loop at `src/index.ts:1066-1070` runs, and assert the
   anti-bot failure is recorded.
3. **[design]** No trailing-slash rule for the new production surface. `fetchPage`
   composes `${JINA_BASE}${url}` (`src/providers/jina.ts:9`); the task specifies only
   `getEnvVar("jina","_URL") ?? "https://r.jina.ai/"`, so an override without a
   trailing `/` yields `http://host:PORThttp://…`. This variable is being advertised
   in `README.md:525`/`AGENTS.md`. Decide normalization in D1.
4. **[design]** D2's textual basis is thin. REQ-021a's body (`infobroker.md:271`)
   states only address-class refusal plus redirect re-application; the protocol
   branch (`src/lib/url-guard.ts:94-96`) is not a REQ-021a statement. Calling it
   "the protocol half of REQ-021a" and closing `F-R4-C-3` on it invites a challenge
   that the clause was driven by an unstated branch. Name the guard function's
   protocol branch explicitly and cite REQ-021h's unsupported-protocol clause as
   the textual anchor.
5. **[design]** Conflicting location for the config change: `tasks.md:28` says
   "Enable `fileLogs: true` in the file's isolated config" (the module-level
   `beforeAll` config, shared by every existing case), while `tasks.md:19` and the
   plan say each new case builds its own spawned server. Name which, and say whether
   existing cases gain a log sink.

## Nits

1. **[clarity]** "Three findings' worth of missing evidence" while two findings are
   named.
2. **[clarity]** "4 work items → 3": the § Hermetic seam section has three bullets
   and counts as one roadmap item, so the phrase reads as a bullet count.
3. **[design]** "exactly one reader request" needs a path-scoped counter: the stub
   exposes only a total `requests`, and `detect_page_date` issues its own request to
   the page (`src/index.ts:1548`).
4. **[design]** Done bar 3's `cause: anti_bot` depends on `failureTaxonomy`
   selecting anti_bot when every recorded failure is anti_bot — asserted, not
   established in the plan.
5. **[clarity]** The `urlPresent` expression is cited as "inside `isOperational`";
   it is computed in `providerUsable` (`src/config.ts:1179`) and passed to
   `isOperational` (`:1168-1171`).

## Unknowns

- `infobroker.md:823` and `:845-847` were not read; the claim that they state the
  endpoint as a fixed URL is unverified. (Parent verified after the pass: `:823`
  tabulates `Jina Reader | https://r.jina.ai/ | Append URL to path, returns
  Markdown`; `:845-847` repeats the fixed-URL rule. Confirmed.)
- `failureTaxonomy`'s cause selection for an all-anti_bot failure set was not read
  (Nit 4). Moot after the Case B removal.
- The internet_archive provider's exact behaviour on a loopback URL was not read;
  the finding concerns the outbound call, not its result.

## Coverage deviation (recorded by the reviewer)

Stage 2 surfaced Major 1 (self-contradiction) rather than a garbled paraphrase, so
the run was not stopped at Stage 2; Stages 3 and 5 ran in the same dispatch to
report the design Blockers. No author edits were made, so Stage 4 was not
triggered. The reviewer's inherited context included project `AGENTS.md` and user
instructions it was not handed — recorded per the skill's inherited-instructions
rule; it does not change the findings, which rest on file:line evidence.

## Verdict

`independent-review FAILED.` — 1 Blocker, 5 Majors, 5 Nits.

## Diff re-review (second and final pass)

Reviewed artifact: the revised plan, sha256
`6c463231a5021aa6b0d82b8fab4b411335c6b2fabcaf701725bdf55666b7f` (5/10 reads).
Scope: changed lines only, per the re-review protocol.

`independent-review passed.`

- Blocker 1 — resolved (Case B removed; no dangling reference; `check-gate-coverage`
  stays green because REQ-021f yields `orBranches: 0` under
  `detectClauseCoverage`, so the single `renderer-fallthrough` tag satisfies
  `evaluateClauseCoverage`).
- Majors 1–5 — resolved.
- Nits 1–5 — resolved.
- New Blocker / Major: none.
- New Nits (all three applied after the pass, none structural):
  1. `infobroker.md:290` → `:292` for REQ-021h's unsupported-protocol sentence.
  2. Done bar 6 now names the protocol-test-removal mutation, matching
     `tasks.md` 3.5a and the mutation log.
  3. `cache.kb_read: false` → `fetch.cache.kb_read: false` (the bare form would be
     rejected by `assertKnownOptions`).

The final plan on disk (sha256
`356ee9917cfea910a8111b43b77cc961e7b8d7e71979b279888e2e2383f794a6`) differs from
the re-reviewed artifact only by those three nit corrections.

