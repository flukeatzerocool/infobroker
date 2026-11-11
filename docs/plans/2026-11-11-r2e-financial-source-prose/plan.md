# Plan — R2e financial source and prose reconciliation

**Status:** draft (reviewed, awaiting execution approval) · **Date:** 2026-11-11 · **Depth:** standard
**Review independence:** fresh — self pass, then a cold pass in a fresh context (2 Blockers, 7 Majors, 8 Nits), one targeted diff re-review that PASSED with 2 conditions (C-1, C-2); the follow-up changes were condition-level or text corrections only. Cold report `/tmp/opencode/r2e-cold.md` (`f883e57e…`); re-review `/tmp/opencode/r2e-plan.diff`, 10/10 reads.
**Rollback cost:** 1 — one provider module and its test, spec prose in six places, README prose in five places, one bundled reference line, and bookkeeping. No config change, no state format, no schema, no credential, no dependency.
**Roadmap item:** `ROADMAP.md` § R2e financial source and prose reconciliation (the section is retired to `CHANGELOG.md` when this increment closes)
**Predecessor:** `3ea4cdf` (R2d close; its AAR names `§ R2e` as the next item)

## Why this section

`§ R2e` is now the first section in `ROADMAP.md`, and the ordering rule is top
section first. Its trigger ("start after R2a ships") is met: R2a closed at
`289c909`, and R2b, R2c, and R2d closed after it (`625e5ba`, `ec95eef`).

The section carries three P1 register rows and one P3 row that the section's
own close condition names. They share one concern — the specification and the
provider surface still describe a financial chain the code does not implement —
so they ship together as five verifiable slices: an economic-indicator source,
the §5.3 interface sketch and its dispatch claim, the §A.5 SearXNG claim, the
README's echo of that claim, and the bundled reference's echo of it.

## Baseline (verified this session)

- `git log -1` → `3ea4cdf`; `git status --porcelain` was empty when the baseline
  was taken (before the increment record was created).
- `npm run status` → version `2026.11.7`, **21 open roadmap items**, **78 unpushed commits, oldest 46.8 h** (fires the AAR trigger; publication stays with the user).
- `npm run check` → **PASS** (full, 22 gates, 116.6 s, run record for `3ea4cdf`).
- One pre-existing warning: `check-loop-artifacts` reports `2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:** line`. Warning only; out of scope.
- Network probes run today (advisory, not a gate): the World Bank Indicators endpoint
  `https://api.worldbank.org/v2/country/WLD/indicator/FP.CPI.TOTL.ZG?format=json&per_page=3&date=2017:2026`
  returned a two-element envelope with per-year observations, and
  `https://api.worldbank.org/v2/country?format=json&per_page=400` returned all
  296 country/aggregate records on one page. The indicator catalog
  (`/v2/indicator`) is 29,544 rows over 5,909 pages and accepts no text filter,
  which rules out catalog-wide keyword search (D3).
- Register rows re-read at `docs/plans/2026-11-09-full-review-sweep/worklist.md`:
  F-R2-36 (P1), F-R2-38 (P1), F-R2-41 (P1), all `Scheduled-roadmap`; F-R2-42
  (P3) `Closed-P3`.

## Predicates re-verified by reading the code this session

| Finding | Current code | What is wrong |
|---|---|---|
| F-R2-36 | `world_bank` is one of the two `financial` providers (`config.json:179,185-193`), sits in the financial chain (`config.json:254`), and queries the Documents & Reports index (`src/providers/world_bank.ts:7,9-33`) | REQ-095 requires the financial chain to include "one economic-indicator source". A document index is not an indicator series, so the clause has no implementing provider, and the citation in `src/providers/new-providers.test.ts:1` covers only the document path. |
| F-R2-38 | The `Provider` interface has `capabilities: string[]`, no `rateLimit`, and `health()` returning `status: string` (`src/types.ts:524-533`); limits live in `ProviderConfig.rate_limit` (`src/types.ts:53`) and are enforced by the shared throttle (`src/index.ts:463-486`); `capabilities` is shape-checked with a token allow-list for `generic_http` only (`src/config.ts:464-478`) and reported (`src/index.ts:1490,1571`), but never read for routing | §5.3's sketch (`infobroker.md:731-742`) declares `rateLimit` on the interface and narrows both unions, and `:752-753` claims a provider whose capability list includes `web_search` serves `general_web`, while the chain is static configuration (`config.json:245-259`). The same false claim appears in the §1 glossary (`:157`). |
| F-R2-41 | `searxng` is configured `query_forwarding: "third_party"` with a note that upstream engines receive queries (`config.json:215-219`); the generated auth reference marks it self-hosted (`skills/infobroker/references/provider-auth.md:33`) | §A.5 (`infobroker.md:1497`) says "Full privacy — all queries stay on user's machine". Self-hosting changes who receives the query first, not whether it leaves the network. The same claim is repeated in the README (five sites) and in `skills/infobroker/references/config-tune.md:97` ("only your instance sees the query"). |
| F-R2-42 | `src/providers/searxng.ts:22` issues `GET ${baseUrl}/search?…` | §A.5 says the client calls `POST /search?format=json`. §6.3's table (`:820`) is already correct, so the two spec statements disagree. |

Four supporting facts, read this session:

- `src/providers/new-providers.test.ts:13-16` builds `mockFetch` from the
  request URL and already imports `world_bank` (`:11`), so a two-endpoint
  provider needs no new mock harness.
- `src/provider-status.test.ts:169` freezes `world_bank: [true, true, true]`
  against the config, not against the endpoint; `health()` keeps its current
  Documents & Reports probe, so no provider-status surface changes.
- The README repeats the §A.5 claim at `README.md:205,473,498,499,801`, including
  "only your own SearXNG instance sees your queries" — the same defect in the
  user-facing surface, which the README governance rule makes part of this
  change. The bundled `config-tune.md` repeats it at `:97`.
- The chain is ordered `sec_edgar`, `world_bank`, `duckduckgo`
  (`config.json:254`), and `sec_edgar` runs a full-text filing query for any
  query (`src/providers/sec_edgar.ts:18-33`). Whether an indicator query such as
  "US GDP" reaches `world_bank` in production depends on whether EDGAR returns
  hits for it; no test asserts that today, and this plan measures it (D9).

## Decisions

- **D1 — `world_bank` becomes indicator-first with the document index as a
  fallback.** The module resolves the query to a country and a known indicator;
  when both resolve it queries
  `https://api.worldbank.org/v2/country/{iso3}/indicator/{id}`, and otherwise it
  keeps today's Documents & Reports request unchanged.
  **Alternative rejected:** a pure replacement — it drops the document coverage
  that the §A.2 catalog sentence and the current test describe, for a clause
  that asks only for the indicator source to exist.
  **Alternative rejected:** a second `world_bank_indicators` provider module —
  a new registry entry, dispatch edit, README row, auth-reference regeneration,
  and provider-status fixture for a clause one provider already satisfies.
  **Alternative rejected:** DBnomics, which does offer series search but is a
  third-party reseller with no World Bank alignment and a two-call series
  resolution; REQ-095 asks for a zero-config indicator source, not a new
  aggregator relationship.
- **D2 — Country resolution reads the `/v2/country` list (`per_page=400`) on
  the indicator path, defaulting to `WLD` when the query names no place.** The
  list is one 296-row page (~30 KB) fetched with the same `infobrokerFetch` and
  `providerSlug: "world_bank"` as every other call, so REQ-071 identification
  and the provider's 15 s timeout apply. Matching rules, in precedence order:
  (1) a country name matched case-insensitively as whole words, longest name
  first; (2) an ISO-3 code matched **case-sensitively** as whole words;
  (3) an ISO-2 code matched **case-sensitively** as whole words, because the
  ISO-2 set contains common English words (`IN`, `IT`, `AT`, `TO`, `NO`, `BE`,
  `AS`, `US`). Earliest position in the query breaks a tie within a tier. No
  match selects `WLD`. When the country request fails or returns an unusable
  payload, the provider falls back to the document path rather than answering a
  geography-bound query with world aggregates.
  **No process cache:** a module-level cache is hidden cross-request state, it
  couples test cases through mock ordering, and it buys one request on a
  low-volume path.
  **Alternative rejected:** a static country table — it drifts from the API and
  silently misses countries.
  **Alternative rejected:** the `all` country code — it returns every country's
  value for the indicator and cannot answer one query.
- **D3 — Indicator resolution is a deterministic alias table with word-boundary
  matching, longest alias first, falling back to the document path.** Seed set:
  `gdp growth`, `gdp per capita`, `gdp`, `inflation`, `unemployment`,
  `population`, `life expectancy`, `government debt`, `poverty`, `co2 emissions`,
  `interest rate`, `exports` (World Bank codes recorded in the module). Query
  words are matched case-insensitively on `\b`, so `GDPR` does not match `gdp`.
  **Alternative rejected:** catalog keyword search — the catalog is 5,909 pages
  and ignores a text filter (baseline probe), so it cannot be walked inside a
  provider call.
- **D4 — The indicator result is a normalized structured fact.** The request
  spans the last ten calendar years (`date=<year-9>:<year>`, `per_page=10`);
  tests compute the window from the same clock rather than hardcoding it. One
  result per non-null observation year, newest first: title
  `"<Country> — <Indicator> (<year>)"`, url
  `https://data.worldbank.org/indicator/<id>?locations=<ISO3>`, snippet
  `"<formatted value> · <year> · World Bank indicator"`, `source_type`
  `structured_fact`, and no `published_date` (a year is not an ISO date, so
  stamping December 31 would fabricate one). The raw object carries no `date`
  key, because `normalize` would read it as `published_date`. Values format with
  `Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })` so the snippet is
  stable across runs.
- **D5 — §5.3 states the interface the code has.** Drop `rateLimit` from the
  sketch and state that limits are configuration enforced by the shared
  throttle (REQ-030); type `capabilities` as `string[]` with the configured
  token list in prose; type `health()` as returning a connectivity status
  string; make `options` optional on `search` and include the optional
  `lookupDoi` member (`src/types.ts:529-532`). Replace the
  `web_search`-serves-`general_web` sentence in §5.3 and in the §1 glossary
  with the authoritative rule: chain membership comes from the `dispatch`
  configuration (§7.2), and capability tokens are declarative metadata that
  validation and reporting read.
  **Alternative rejected:** widening the code to match the sketch
  (`rateLimit` on the interface, a capability→chain derivation) — it would move
  rate limiting out of one owner and make dispatch a function of a token list,
  contradicting REQ-030 and REQ-014.
- **D6 — §A.2, §6.3, and §A.5 describe the shipped requests.** The World Bank
  catalog entry (§6.3 `:834`) and the §A.2 detail entry (`:1473`) name the
  Indicators endpoint and the document fallback. The §6.3 SearXNG row (`:820`)
  already says `GET /search?format=json` and is verified, not edited; §A.5's
  SearXNG entry says GET, describes the self-hosted instance as forwarding to
  its configured upstream engines, and stops claiming the queries stay on the
  user's machine.
- **D7 — The README and the bundled reference say the same thing as the spec.**
  The five README sites (`:205,473,498,499,801`) are corrected with varied
  wording — repetition would trip `validate-readme`'s near-duplicate warning —
  and the provider table's SearXNG row becomes "Self-hosted" with no privacy
  superlative. `skills/infobroker/references/config-tune.md:97` gets the same
  correction.
- **D8 — F-R2-42's disposition moves from `Closed-P3` to resolved.** The roadmap
  close condition names it, and this increment corrects the prose it describes,
  so leaving it `Closed-P3` would make the trigger unmeetable by construction.
  The `Resolved` line records the prose fix, not a code change. F-R2-39 and
  F-R2-40 stay `Closed-P3`; their prose is not in this section's scope.
- **D9 — The chain-order question is measured, not assumed, and a preemption
  finding becomes a roadmap item.** `sec_edgar` precedes `world_bank` in the
  financial chain (`config.json:254`) and runs a filing query for every query
  it receives (`src/providers/sec_edgar.ts:18-33`), so a live `search_web` call
  for "US GDP" may never reach the new indicator path. Step 8a probes that call
  and records which provider served it. If EDGAR preempts indicator queries, the
  increment still resolves F-R2-36 (the chain now *contains* an indicator
  source, which is what REQ-095 requires) and files `## Financial chain
  query-level routing` in `ROADMAP.md` with a trigger naming that probe; the
  AAR states the clause is met structurally until that item closes. Reordering
  the shipped chain here is rejected: `world_bank` before `sec_edgar` would let
  document hits preempt filings queries.

## Blast radius

| File | Change | Size |
|---|---|---|
| `src/providers/world_bank.ts` | Country-list request, alias table, indicator request, result mapping; document path retained as fallback; `health()` stays on the Documents & Reports probe, unchanged | M |
| `src/providers/new-providers.test.ts` | Indicator-path cases (parse, country, world default, alias precedence, null filtering, HTTP failure, country-list failure), document fallback retained | M |
| `infobroker.md` | §1 glossary line, §5.3 sketch and dispatch prose, §6.3 World Bank row, §A.2 World Bank entry, §A.5 SearXNG entry | M |
| `README.md` | Five privacy claims corrected (varied wording); provider-table SearXNG row | S |
| `skills/infobroker/references/config-tune.md` | SearXNG privacy claim and its consequence sentence | S |
| `package.json`, `package-lock.json`, `server.json`, `AGENTS.md`, `src/index.ts` (McpServer version), spec/README version stamps | `version.ts bump` output only | S |
| `CHANGELOG.md` | One entry under the seeded `2026.11.11` heading | S |
| `ROADMAP.md` | R2e section removed; conditional D9 successor item | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | Four register rows to `Resolved` | S |
| `docs/plans/2026-11-11-r2e-financial-source-prose/{plan,tasks,aar}.md` | Increment record | S |

No config change. `config.json` keeps `world_bank` at the same slug, tier,
capabilities, and chain position.

## Steps

1. **Baseline reconfirm** on the execution HEAD: `git log -1`,
   `git status --porcelain`, `npm run check` (record the gate count and time).
2. **Red tests first**, in `src/providers/new-providers.test.ts`:
   a. an indicator query (`"US GDP"`) requests
      `/v2/country/USA/indicator/NY.GDP.MKTP.CD` and returns one result per
      non-null year with the title, url, and snippet shape from D4;
   b. `"world inflation"` resolves `WLD`;
   c. `"gdp growth"` selects `NY.GDP.MKTP.KD.ZG`, not `NY.GDP.MKTP.CD`
      (longest alias wins);
   d. a null-value observation is dropped;
   e. a non-OK response throws `RetryableError`;
   f. an unrecognized query (`"10-K filings"`) still calls the document
      endpoint (the existing test keeps this assertion);
   g. a failing country-list request falls back to the document endpoint;
   h. `"inflation in Germany"` resolves `DEU` through the country name while
      `"tell us about inflation"` resolves `WLD` (the lowercase word "us" does
      not match the ISO-2 code `US`).
   Run the suite and record the red result in `tasks.md`.
3. **Implement** `src/providers/world_bank.ts` per D1–D4. Keep the module's
   header citations (`REQ-020 REQ-070 REQ-071`), add `REQ-095`, and leave
   `health()` on the existing Documents & Reports probe.
4. **Green targeted suite**: `world_bank` cases plus
   `src/provider-status.test.ts` and `src/task-type.test.ts` (the `financial`
   classification signals are unchanged; re-run confirms no coupling).
5. **Spec prose** per D5/D6: §1 glossary, §5.3 sketch and following paragraph,
   §6.3 World Bank row (`:834`; the SearXNG row `:820` is verified, not
   edited), §A.2 World Bank entry, §A.5 SearXNG entry. Then
   `npm run validate-spec` (no REQ body changes, so no clause tags are required).
6. **README and bundled reference** per D7: the five README sites, then
   `skills/infobroker/references/config-tune.md:97`. Then
   `npm run validate-readme` and a `grep -n "privacy" README.md` pass to confirm
   no survivor.
7. **Commit the content slices** once steps 2–6 are green, and before the
   version bump, so every commit is internally version-consistent at
   `2026.11.7` (C-1): run `npm run typecheck` and `npm run check` on the tree,
   then commit
   a. `docs(spec): describe the indicator source and the real provider
      interface` (`infobroker.md`);
   b. `fix(providers): source financial indicators from the World Bank API`
      (`src/providers/world_bank.ts`, `src/providers/new-providers.test.ts`);
   c. `docs(readme): stop claiming SearXNG keeps queries local` (`README.md`,
      `skills/infobroker/references/config-tune.md`).
8. **Version and changelog**: `npx tsx scripts/version.ts bump` (CalVer
   `2026.11.11`), fill the seeded heading, and write one entry naming the
   indicator source and the prose corrections. Then `npm run version-sync`.
9. **Relay the register**: F-R2-36, F-R2-38, F-R2-41, and F-R2-42 to `Resolved`
   with one-line summaries in `worklist.md`.
9a. **Reachability probe (advisory).** Call `search_web` with "US GDP" against
    the shipped chain and record which provider served the result in `aar.md`.
    If the probe cannot run (network, quota, or provider failure), record
    `probe unavailable` in `aar.md`; the AAR then states reachability was not
    measured rather than implying it was (C-2). Apply D9's conditional roadmap
    item only when the probe shows preemption.
10. **Retire the roadmap section**: remove `## R2e …` from `ROADMAP.md`; if the
    D9 probe shows EDGAR preemption, add the successor section in the same edit.
    Run `npm run check-roadmap`.
11. **Final gates on the final tree**: `npm run typecheck`,
    `npm run check:fast`, `npm run check`, `npm run test`,
    `npm run validate-spec`, `npm run validate-readme`, `npm run version-sync`.
12. **Increment record**: `tasks.md` ticked with the red and green evidence,
    `aar.md` finalised with dispositions, the probe outcome, and a terminal
    token.
13. **Release commit**:
    d. `docs(release): record the R2e close` (`CHANGELOG.md`, `ROADMAP.md`,
       `worklist.md`, version stamps, increment record).

## Conditions carried into build-review

- **C-1** — The content slices are committed before the version bump, so each
  commit is internally version-consistent; verify `version-sync` passes on the
  tree at each of (a)–(c) and that no version-stamped file appears in those
  commits.
- **C-2** — `aar.md` records the D9 probe outcome explicitly, including
  `probe unavailable`; the structural-compliance statement must not be mistaken
  for measured reachability.

## Done bar

**Done bar:** F-R2-36, F-R2-38, F-R2-41, and F-R2-42 are `Resolved` in the sweep
worklist with a one-line summary; `world_bank` returns economic-indicator series
from `api.worldbank.org/v2/country/{iso3}/indicator/{id}` for a recognized
indicator query, with one result per non-null year and a `data.worldbank.org`
url, and an unrecognized query still reaches the document index; the alias table
prefers `gdp growth` over `gdp`; a country name matched case-insensitively, or
an uppercase ISO-3/ISO-2 code, selects the location, `WLD` is used when none is
named, and a failed country-list request falls back to the document path; the
provider test suite fails on the unmodified module (red result in `tasks.md`)
and passes on the final tree; §5.3 no longer declares `rateLimit`, narrows
either union, claims `web_search` determines `general_web`, or omits
`lookupDoi`, and the §1 glossary agrees; §A.2 and the §6.3 World Bank row
describe the indicator endpoint and the document fallback, the §6.3 SearXNG row
still says GET, and §A.5 no longer claims queries stay on the user's machine;
no README site, and no `config-tune.md` line, repeats that claim; `ROADMAP.md`
no longer carries the R2e section, and carries D9's successor item when the
reachability probe shows EDGAR preemption; `CHANGELOG.md` carries one entry
under `2026.11.11`; the increment record carries plan, tasks, and an AAR ending
`LOOP PAUSED` or `LOOP OPEN`; `npm run typecheck`, `npm run check:fast`,
`npm run check`, `npm run validate-spec`, `npm run validate-readme`, and
`npm run version-sync` exit 0 on the final tree.

**Non-closure rule.** A fix that needs a config change, a second provider
module, a new dependency, or a catalog-wide indicator search stops the
increment: the provider slice ships as-is, the prose slices still land, the
remaining register row stays in a successor roadmap section, and the AAR ends
`LOOP OPEN`.

## Verification

| Criterion | How |
|---|---|
| Indicator path works | `new-providers.test.ts` cases (a)–(e) |
| Document path preserved | case (f), existing assertion retained |
| Degradation and country matching | cases (g) and (h) |
| Reachability in the shipped chain | advisory `search_web` probe recorded in `aar.md` (D9) |
| No new provider/config surface | `git diff --stat` review at step 3: `config.json` untouched |
| Spec truthfulness | `npm run validate-spec`; manual re-read of §5.3 and §A.5 against `src/types.ts` and `config.json` |
| README truthfulness | `npm run validate-readme` (structure, numeric claims, table) plus `grep -n "privacy" README.md` and `grep -n -i "searxng" skills/infobroker/references/config-tune.md` reviewed line by line |
| Version/CHANGELOG agreement | `npm run version-sync` |
| Roadmap admission rule | `npm run check-roadmap` |
| Whole tree | `npm run check` |
| Live behavior (advisory) | one `curl` against a recognized indicator and one against the document endpoint; no gate depends on network |

## Edge cases and risks

- **Country list fetch fails or returns garbage** → the provider falls back to
  the document path; test 3g covers the failure branch.
- **ISO-2 ambiguity** (`IN`, `IT`, `AT`, `TO`, `NO`, `BE`, `AS`, `US`) → codes
  match only in uppercase and only as whole words; a lowercase "us" in prose
  never selects the United States. Test 3h covers both directions.
- **Recognized indicator, zero or all-null series** → empty array; the chain
  advances to `duckduckgo` per REQ-031. An empty indicator result must not fall
  through to the document path, because that would return unrelated documents
  for a recognized indicator query.
- **Malformed envelope** (missing `[0]`/`[1]`, non-array) → empty array, not a
  throw, matching the existing provider style for parseable-but-unexpected
  payloads.
- **Two countries in one query** → first match wins; recorded in the module
  comment. Splitting a comparison query into a multi-country series is not in
  this clause.
- **Alias false positive** (`GDPR`, `surface area`) → `\b` matching plus
  longest-first ordering; `surface area` is not in the alias set.
- **Two outbound requests per indicator query** (country list, then series) →
  sequential, inside the provider's configured 15 s timeout; the per-provider
  throttle remains at attempt granularity, unchanged by this increment.
- **Spec line drift** → steps 5 and 6 are prose edits guided by the quoted
  sentences, not by line numbers; the line numbers above are the planning
  baseline.
- **Version bump footgun** → `version.ts bump` rewrites every enumerated
  reference; `version-sync` is the check. No manual version edits.

## Out of scope

- F-R2-39 and F-R2-40, which stay `Closed-P3` (D8).
- The §A.5 "274 search backends" figure, which is a separate catalog-accuracy
  concern and not in this section.
- Reordering or splitting the financial dispatch chain; D9 routes that to a
  roadmap item when the probe shows preemption.
- Any new provider, dispatch chain, or config key.
- The pre-existing `check-loop-artifacts` warning on the R6 encryption
  increment.
