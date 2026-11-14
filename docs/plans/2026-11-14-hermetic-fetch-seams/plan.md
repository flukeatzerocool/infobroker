# Plan — Hermetic seams for the fetch-renderer chain and the crawl guard

**Status:** plan-review passed (standard, cold pass + diff re-review) · **Date:** 2026-11-14
**Depth:** standard — one provider file, one test-helper option, two test suites, docs and register rows; no schema, credential, or migration surface
**Review independence:** fresh — cold pass plus one diff re-review, five stages in a cold context, no authoring context; report `plan.cold/report.md`
**Rollback cost:** 1 — a commit revert removes an optional endpoint override and tests; the shipped default endpoint is unchanged
**Roadmap item:** `ROADMAP.md` § Hermetic seam for the fetch-renderer chain and the crawl guard (retire on close)
**Predecessor:** `a904207` (handler evidence rows close, tracker re-scope)
**Findings:** `F-R4-B-3` (`worklist.md:702`), `F-R4-C-3` remaining per-hop clause (`worklist.md:709`)

## Scope

Two register rows' worth of missing evidence, one production change. Two clauses
have no driving test: REQ-021f's "continue to the next renderer" (a two-renderer
fall-through cannot be driven because `src/providers/jina.ts:6` hardcodes the
reader endpoint) and REQ-021d's "applied at every hop including each redirect"
(a loopback hop is never refused while `fetch.allow_private_urls` is true).

The increment adds an endpoint override so the first clause is driven on the real
handler against a loopback reader stub, and drives the second at the existing
guard seam without adding one — a hop that redirects to a non-HTTP URL is refused
by the guard's protocol branch even when private targets are permitted. Both
register rows then close with file and line.

Not in scope: any change to which renderers ship or how they are ordered, the
`native_fetch` fallback taxonomy (REQ-021h), the hedging algorithm, the crawl's
page/depth caps (already driven), the resolver-injection seams themselves (both
`withGuardedTarget` and `fetchFollowRedirects` already take a resolver), and the
blocked reduced-heap row `F-R6-E-3`.

**Out of scope by evidence, stated so it is not assumed:** REQ-021f's
exhausted-chain half ("or a failure per REQ-002 when every renderer is
exhausted") is *not* re-driven here. An exhausted `fetch_page` chain enters
`resolveFetchFallback`, which contacts the archive provider for any non-DOI URL
(`src/index.ts:1402-1425`, `src/fetch-fallback.ts:281`); that path cannot be made
hermetic from this increment, so the clause is left with its existing REQ-021h
taxonomy unit coverage and named in the register note rather than approximated.

## Baseline (verified this session)

- `git log -1` → `a904207`; working tree clean.
- `npm run status` → 228 unpushed commits, oldest 4.8 d, version `2026.11.11`
  (latest tag `v2026.11.07`), 4 open roadmap items, last pipeline run 2026-11-07.
- `npm run check` → **PASS**, 22 gates, 159.4 s (run recorded for `a904207`).
  `npm run check-loop-artifacts` reports 0 errors and 1 pre-existing warning
  (`2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:**`).
- The 4.8 d unpushed backlog is past the 24 h AAR trigger in AGENTS; it is noted
  here and handled at session close, not folded into this increment.

### Why this item and not the one above it

`ROADMAP.md` is priority-ordered, and § Missing test evidence across R4–R6 is
first — but its own start trigger is unmet: it opens "when the read path is stable
at a reduced heap and a payload fits the gate budget", and the 2026-11-14 probe
measured neither (1 of 6 `get` runs died with a V8 heap trace; one sequential cycle
hung past 15 min; two of three payload builds exceeded the 20 s budget). Drafting
work against a trigger that has not fired would re-run a blocked probe. § Hermetic
seam is the first item whose work is executable, and § Full-review register
reconciliation (also unblocked) is the follow-on, not this increment.

### Evidence read this session

| Claim | Evidence |
|---|---|
| The Jina endpoint is a module constant with no override | `src/providers/jina.ts:6` (`JINA_BASE`), composed at `:9`, reused by `health` at `:22` |
| The endpoint-override convention already exists | `src/config.ts:1129` `getEnvVar(slug, "_URL")`; `src/providers/searxng.ts:11-14` reads `INFOBROKER_SEARXNG_URL` |
| No provider carries a base-URL config key | `grep base_url src config.json` → no match; `providers.jina` has no `url_env` (`config.json:18-26`) |
| A declared `url_env` would make the variable required and drop Jina from every chain | `src/config.ts:1179` — `urlPresent: !p.url_env \|\| Boolean(process.env[p.url_env])`, computed in `providerUsable` and passed to `isOperational` (`:1168-1171`) |
| `fetch_page`'s shipped renderer chain is Jina then native | `config.json:259` → `"content_fetch": ["jina", "native_fetch"]` |
| Challenge fall-through is implemented and records an anti-bot failure | `src/index.ts:983-990` |
| With hedging off, renderers are tried in order | `src/index.ts:1066-1070`; hedging gate at `:1027` |
| A hedge win does not require the primary's challenge to be classified | `src/hedge.ts:118-123` — an empty (`null`) result is filed as a failure, so a hedge win can hide the classification order |
| A safety refusal is never swallowed as a renderer failure | `src/index.ts:1006` — `if (e instanceof SsrRefusalError) throw e;` |
| The crawl already skips a refused hop, audits it, and continues | `src/index.ts:1261-1269` (the audit names `cur.url`) |
| The guard refuses a non-HTTP target regardless of `allowPrivate` | `src/lib/url-guard.ts:94-96` — the protocol test precedes the private-host test at `:97` |
| Redirects are re-guarded hop by hop | `src/lib/url-guard.ts:203-205` |
| Both guard seams already accept an injected resolver | `src/lib/fetch-target.ts:12-19`; `src/lib/url-guard.ts:185-192` |
| Retries and timeouts do not swallow a refusal | `src/retry.ts:53`; `src/lib/timeout.ts:38-49` |
| A loopback stub, including a redirect chain, is the established fixture | `src/fetch-page-extraction.test.ts:365-396` |
| The isolated config disables every provider but searxng/native and pins every chain | `src/lib/stub-provider.ts:235`, `:259` |
| The credential scrub leaves `INFOBROKER_*_URL` intact for the child | `src/lib/stub-provider.ts` `scrubCredentials` (only `*_API_KEY(S)` are dropped) |
| The spec states the reader endpoint as a fixed URL | `infobroker.md:823`, `:845-847` |
| The endpoint is documented as a deployment variable | `README.md:525` |

## Decision

**D1 — The reader endpoint becomes an environment override, defaulting to today's
constant, normalized to a trailing slash.** `jinaBaseUrl()` returns the normalized
`getEnvVar("jina", "_URL")` when set and `https://r.jina.ai/` otherwise, and both
`fetchPage` and `health` read it. Normalization appends `/` when absent, because
`fetchPage` composes `${base}${url}` — without it an override yields
`http://host:PORTHTTP://…`, and this variable is being advertised to users. This is
the documented `INFOBROKER_<NAME>_URL` convention (`README.md:525`), the same
shape `searxng` already uses, and it serves a real deployment need — pointing the
Jina-compatible renderer at a private reader service. The `url_env` config field is
deliberately *not* set: that field marks a variable as required, and
`providerUsable` would then report Jina unusable whenever the override is absent,
removing it from every shipped fetch chain.

- Rejected: a `providers.jina.base_url` config key — a renderer endpoint is a
  deployment concern, not user configuration, and the key would need a schema
  addition, a hot-reload answer, and a README table row for no added capability.
- Rejected: reading `process.env` directly in the provider — `getEnvVar` is the
  one naming rule for provider variables.
- Rejected: a test-only `INFOBROKER_TEST_*` hook — a production surface that
  exists only for tests is exactly what the register row complained about.

The provider slug, its position in the chain, and the shipped default are all
unchanged, so no sibling contract moves: REQ-021 names `jina` as the primary
renderer (`infobroker.md:268`) and the chain entry stays `config.json:259`. The
descriptive endpoint note in `infobroker.md` §6.3–6.4 (`:823`, `:845-847`) is
updated in the same commit, because it states the endpoint as a fixed URL — this
is a provider-notes sentence, not a REQ body, so no REQ is re-measured. A wrong
override cannot disable fetching: a reader endpoint that fails or answers a
challenge is skipped by the chain and the request still returns from
`native_fetch`.

**D2 — The crawl guard needs no production seam; the guard's protocol branch is
the injected refusal.** A crawl hop that answers `302` with a non-HTTP `Location`
is refused inside `fetchFollowRedirects` by `assertPublicUrl` even with
`allow_private_urls: true`, because the protocol test at `src/lib/url-guard.ts:94-96`
does not consult that flag; the refusal reaches the crawl's existing
`SsrRefusalError` branch, which audits and skips the hop without failing the
crawl. This drives the clause's own words — "applied at every hop including each
redirect" — on the real handler, offline and deterministically.

Anchor and scope of the claim, stated precisely so it is not read as a branch the
spec does not contain: REQ-021a's body (`infobroker.md:271`) states the
address-class refusal and the per-redirect re-application, and does *not* state a
protocol rule. The refusal the test observes is therefore the guard's protocol
branch, which REQ-021h's "an unsupported protocol SHALL NOT justify private
targets" (`infobroker.md:292`) bounds; the address-class branch it guards is proven
separately at the unit seam (`src/lib/url-guard.test.ts`). The register note will
name which branch drove the clause, so the evidence is not read as covering the
private-address branch under `allow_private_urls`.

- Rejected: threading an injected resolver from the handler into the crawl's
  `fetchPageContent` call. The tests spawn the server (`src/fetch-page-extraction.test.ts:39`),
  so an injected resolver would have to cross the process boundary through a
  config key or env var that exists only to make a test refuse a hop.
- Rejected: a `.invalid` redirect (DNS failure is also refused under
  `allow_private_urls`) — it depends on the runner's resolver latency and failure
  shape, which is not deterministic the way a scheme mismatch is.
- Rejected: extracting the crawl loop into an injectable module — a larger
  refactor of the handler for no guarantee the redirect hop does not already
  demonstrate. If the redirect proof turns out not to satisfy the clause, the
  increment narrows and reports rather than adding the seam (C-3).

**D3 — The fall-through is driven on the real handler with hedging off.** A
loopback stub answers the reader path (`/<encoded target>`, any path beginning
`/http`) with an anti-bot challenge body and the page path with real content; the
case's own spawned server sets `enable: ["jina"]`,
`chains.content_fetch: ["jina", "native_fetch"]`, `fetch.allow_private_urls: true`,
`fetch.cache.kb_read: false`, `output.hedge_enabled: false`, and the request passes
`detect_date: false`. Hedging is disabled deliberately: with hedging on, a hedge
win satisfies "served by native_fetch" without the challenge ever being
classified (`src/hedge.ts:118-123`), which would make the mutation proof vacuous.
With hedging off the sequential loop (`src/index.ts:1066-1070`) runs Jina first, so
a challenge that is not detected is served as content and the case fails.

Assertions: the stub's reader-path counter is exactly 1, the response reports
`provider: "native_fetch"`, and the content is the page body, not the challenge
text. The challenge fixture is asserted to satisfy `isBotChallenge` in the test
itself, so it cannot rot into a case that passes because nothing was a challenge.

**D4 — One test-helper option.** `writeHermeticConfig` gains `enable?: string[]`,
which re-enables the named providers after the loop that disables everything but
`searxng`/`native_fetch` (`src/lib/stub-provider.ts:235`) and rejects an unknown
slug. No other helper change: the reader stub and the crawl hop server are built
inline in the test file, matching the existing redirect-chain fixture.

**D5 — Two suites, no contract change.** The fall-through case lives in
`src/fetch-page-extraction.test.ts` with its own stub and its own spawned server;
the crawl case uses that file's shared server, whose `beforeAll` config gains
`fileLogs: true` so the audit trail is readable (no existing case asserts on the
absence of a sink). A new `src/providers/jina.test.ts` covers the endpoint default,
normalization, and override. REQ-021d and REQ-021f already state both driven
behaviors, so no REQ body is edited.

## Blast radius

- `src/providers/jina.ts` — `jinaBaseUrl()` (env read, default, normalization),
  used by `fetchPage` and `health`.
- `src/lib/stub-provider.ts` — the `enable` option and its key-set entry.
- `src/fetch-page-extraction.test.ts` — one per-case spawned fall-through test with
  its inline reader stub, the crawl refusal test with its inline hop server,
  `fileLogs: true` on the shared config, and two clause tags.
- `src/providers/jina.test.ts` — new; default endpoint, trailing-slash
  normalization, override honoured, `health` base.
- `infobroker.md` §6.3–6.4 — one provider-notes sentence naming the override (no
  REQ body touched, no re-measurement, generated auth reference unchanged).
- `README.md:525` and the `AGENTS.md` env table — the variable is documented
  generically already; both name the broadened meaning.
- `CHANGELOG.md`, `DECISIONS.md` (one record for D1–D2), `ROADMAP.md` (section
  retired), `docs/plans/2026-11-09-full-review-sweep/worklist.md` (two rows).
- Not touched: `src/index.ts`, `src/lib/url-guard.ts`, `src/lib/fetch-target.ts`,
  `config.json`, and every REQ body in `infobroker.md`.

## Done bar

**Done bar:** All of the following hold on the final tree:

1. `jinaBaseUrl()` returns `https://r.jina.ai/` with the variable unset, and an
   override both with and without a trailing `/` composes `${base}${target}` into
   one well-formed request URL; `fetchPage` and `health` both use it.
2. With `INFOBROKER_JINA_URL` pointing at a loopback stub whose reader path
   returns an `isBotChallenge`-positive body, `fetch_page` (hedging disabled,
   `detect_date: false`) returns `status: "ok"` with `provider: "native_fetch"`,
   the page's content rather than the challenge text, and exactly one request on
   the stub's reader path.
3. With `fetch.allow_private_urls: true`, a crawl over a start page linking to a
   redirect-to-`ftp:` hop and a good hop returns `status: "ok"` with the start
   page and the good hop, omits the refused hop, reports `attempts: 3` and
   `pages: 2`, and the audit log carries `network_target_refused` for the refused
   *hop* URL (the crawl audits the hop, not the redirect target).
4. `F-R4-B-3` reads `Resolved` in `worklist.md`, naming the test and line and
   noting that the exhausted-chain half of REQ-021f is not re-driven; the
   remaining per-hop clause of `F-R4-C-3` reads `Resolved` the same way, naming
   the guard branch that refused the hop and keeping its page-cap/depth-cap
   history.
5. `ROADMAP.md` no longer carries the § Hermetic seam section (4 roadmap sections →
   3, `## Non-goals` excluded from the count) and `CHANGELOG.md` carries one entry
   naming both findings.
6. Each new assertion fails under a recorded source mutation — the endpoint
   override removed, the endpoint normalization removed, the challenge null-return
   removed, the guard's protocol test removed, and the crawl's `SsrRefusalError`
   skip removed — and passes on the restored tree.
7. `npm run validate-spec` and `npm run check-gate-coverage` exit 0; the new tags
   resolve to the tests that drive their clauses.
8. `npm run check:fast` exits 0 on the final tree; `npm run check` (full) is run
   as the pre-push gate.
9. `docs/plans/2026-11-14-hermetic-fetch-seams/` carries `plan.md`, `tasks.md`,
   the cold report under `plan.cold/`, and an `aar.md` ending `LOOP PAUSED` or
   `LOOP OPEN`.

**Review cap:** 2 passes (the plan gate, and the post-build AAR review). A third dispatch needs user authorization recorded in the AAR.

## Conditions

- **C-1** — an assertion that fails on the unmodified tree exposes a real defect;
  fix the defect and amend the plan, never weaken the assertion to green.
- **C-2** — if any case reaches the network, the case is wrong: the isolated
  config plus the stub must account for every outbound request, including date
  detection and the archive fallback. Stop and fix the case rather than tolerating
  a live call inside `check:fast`.
- **C-3** — if the redirect refusal does not drive the per-hop clause (the
  refusal surfaces as a generic failure rather than a guard refusal, or the crawl
  does not continue), the increment stops and reports the clause unproven rather
  than substituting a proxy or a test-only seam.
- **C-4** — `npm run check` (full) is the pre-push gate; if the registry-backed
  `audit` cannot run, `check:fast` plus `test-debate-club` are the terminal gates
  and the AAR says so.
