# Plan — R2c-i provider status surface

**Status:** draft 2026-11-11 (revision 4) · **Depth:** standard
**Roadmap item:** `ROADMAP.md` § R2c provider status and inspection, first
bullet — split into R2c-i (this increment) and R2c-ii (D1)
**Predecessor:** `8954ccb` (`docs(roadmap): retire R2b-ii and record the
write-ordering close`)
**Review independence:** cold pass **complete and FAILED** on revision 2 —
5 blockers, 13 majors, 10 nits, 4/5 stages, report at
`review/cold-b206ecb.md` (sha256 recorded in the AAR). Revision 3 corrected
every blocker, every major except M6 (refuted with evidence), and every nit.
The single permitted targeted re-review then returned **one new blocker**:
revision 3's `optional-absent` class merged "no key configured" with "keys
present but all unusable", which is exactly the case where the pre-change
predicate returns false — so the frozen equivalence table could never be green
and the implied flip would have changed dispatch eligibility. Revision 4
adopts the reviewer's option (a): the classes now preserve the old truth table
exactly, and only the *reason* changes for an all-unusable pool. That was the
last review pass under the cap; no further pass runs.
**Review artifact:** the stamp copies these exact bytes to
`~/.local/state/opencode/plans/<repo-key>/<plan-id>.md` and records the
`sha256`; the cold report is the hashed review artifact.

## Review-loop cap

Per `ROADMAP.md` § Review-loop convergence the cap is stated here rather than
left to judgement: **one cold pass at standard depth, plus at most one
targeted re-review of the lines it changed.** Both ran. The re-review returned
one blocker (R1 below), which revision 4 fixes. The cap is now reached: no
further review pass runs, and the residual risk is the user's decision, not an
agent judgement.

## Review dispositions

| Finding | Disposition |
|---|---|
| B1 rollback/commit cardinality | Fixed — one cardinality (two commits) in § Rollback, § Commit series, and § Phases |
| B2 Phase 1 imports Phase 2 symbols | Fixed — Phase 1 lands additive exports plus the verbatim move; the red tests then load |
| B3 spec commit red on `validate-spec` | Fixed — spec, tags, and source land in one commit; the fork is removed |
| B4 REQ-013 tag inventory | Fixed — amended enumerations quoted, each branch mapped to one tag, `exhausted` kept as an extra |
| B5 F-R2-21 with no work item | Fixed — named in DB-1 and Phase 1 step 2b |
| M1 "only response delta" | Fixed — filter membership is named as a second delta |
| M2 DB-8 vs DB-4 | Fixed — DB-8 now scopes to the health action and the spec action's fields, and defers the list delta to DB-2/DB-4 |
| M3 equivalence table vs itself | Fixed — compared against a frozen expectation table recorded in Phase 1 |
| M4 cooling-down evidence | Fixed — a `markKeyRateLimited` case in DB-1 and Phase 1 |
| M5 missing `REQ-024a` citation step | Fixed — Phase 2 step adds the module header citation |
| M6 `generate-privacy` unverified | **Refuted** — `package.json:68` defines it; `scripts/validate-spec.ts:409-420` checks the reference's freshness. Re-verified this session |
| M7 three decisions, two IDs | Fixed — D-100, D-101, D-102 |
| M8 dangling § R2c references | Fixed — both the § R2b-iii bullet (`:19`) and its trigger are updated; the close condition is preserved verbatim |
| M9 key-pool state isolation | Fixed — C-7 covers `INFOBROKER_KEYPOOL_STATE` and `resetKeyPoolStateForTests()` |
| M10 dispatch regression | Fixed — DB-1 names the dispatch suites as the regression guard; dispatch is out of *change* scope, not out of *verification* |
| M11 verbatim move vs D2 | Fixed — Phase 1 states exactly what moves, what is added, and what Phase 2 deletes |
| M12 optional-credential ambiguity | Amended in revision 4 — the reason applies to any all-unusable pool; the optional exemption is the zero-key case only (R1) |
| M13 `C-indep` premise | Fixed — `C-indep` is withdrawn; the cold pass ran and the cap governs |
| N1-N10 | Fixed; N8 is governed by precedent (entries accumulate under the current `## 2026.11.7 — <title>` section, which the release step retitles) |
| R1 (re-review) optional-key flip | Fixed — `optional-absent` means *zero keys configured*; `unusable` covers a present-but-unusable pool for both required and optional credentials, so `providerUsable` is unchanged and only the reason moves |
| R-nit 1 reason count | Fixed — five reasons everywhere (missing key, missing URL, disabled, credentials unavailable, exhausted) |
| R-nit 2 moved-copy wording | Fixed — Phase 2 replaces the interim body in `src/provider-status.ts`; `src/index.ts` keeps only the call site |
| R-nit 3 pool-case red placement | Fixed — the `no_api_key`→`credentials_unavailable` red belongs to the reason table, not the frozen boolean table |
| R-nit 4 citation site | Fixed — C-4 cites § Blast radius and Phase 1 step 1 |
| R-nit 5 bullet quoting | Fixed — "the clause now reads", not the whole bullet |

## Baseline (verified this session)

- `git log -1` → `8954ccb`; working tree clean at baseline (`git status
  --porcelain` empty; the increment directory is now untracked).
- `npm run status` → version 2026.11.7, 24 open roadmap items, 67 unpushed
  commits (oldest 40.5 h), last pipeline run 2026-11-07. The 40.5 h backlog is
  an AAR trigger under AGENTS.md; it is reported, not this increment's work.
- `npm run check` → **PASS** (full, 22 gates, 120.0 s, recorded for `8954ccb`).
  The only finding is the pre-existing `check-loop-artifacts` warning for
  `2026-11-10-r6-encryption-capacity-remediation` (no `**Done bar:**`).

## Why this item, and why split

§ R2b-iii sorts first but its trigger ("start after § R2c and § R8 settle the
rows it asserts") is unsatisfied. § R2c's trigger ("start after R2a ships")
was satisfied at `289c909`. R2c carries eight findings across the list,
health, and spec actions. This increment takes the five that share the list
row and its assessment — F-R2-9 (the row's reason vocabulary), F-R2-12 (the
privacy posture the row reports), F-R2-19 and F-R2-21 (the status/reason legs
the row exposes), and F-R2-20 (the row filter) — and schedules F-R2-22,
F-R2-23, and F-R2-24 as § R2c-ii (D1). F-R2-19 is included because its
producers are the same assessment; F-R2-12 because the posture is a list-row
field. § R2b-iii needs F-R2-9's row, so it unblocks after this increment.

## Findings in scope

| Finding | Severity | Disposition target |
|---|---|---|
| F-R2-9 | P2 | `Resolved` — the per-field reason half; the status half was fixed by R2a |
| F-R2-12 | P1 | `Resolved` |
| F-R2-19 | P1 | `Resolved` — the legs are produced by the provider `health()` contract and asserted at the assessment boundary; the probe *wiring* is § R2c-ii (DB-3) |
| F-R2-20 | P1 | `Resolved` |
| F-R2-21 | P2 | `Resolved` — evidence is DB-1's reason table and Phase 1 step 2b |

Deferred to § R2c-ii: F-R2-22, F-R2-23, F-R2-24. F-R2-7 stays under § R2b-iii.

## Predicates re-verified this session

- **P1 (F-R2-9).** `providerInactiveReason` (`src/index.ts:1422-1427`) can
  return only `disabled`, `no_url`, `no_api_key`. An `auth_env` pool that is
  defined but entirely unusable reaches `providerUsable` false at `:1424`
  (predicate `src/config.ts:1111-1122`, key-pool branch `:1117-1119`) and is
  then labelled `no_api_key`. `keyPoolStatus` (`src/key-pool.ts:250-263`)
  already reports per-key `{index, available, reason}` with `reason` ∈
  `rejected` | `cooldown`; the row emits it only when `pool.length > 1`
  (`src/index.ts:1497`).
- **P2 (F-R2-20).** The `status` filter (`src/index.ts:1463-1465`) selects
  `providerUsable && !quota.exhausted`, while the row's reported `status` is
  `assessProviderStatus` (`:1476`), which returns `degraded` on quota warning
  (`:1437`) or over-threshold latency (`:1439`). A degraded row therefore
  passes the "active" filter. `doSpecHealth` already filters on assessed
  `=== "active"` (`:1595`), so the list is the outlier.
- **P3 (F-R2-12).** `requires_account` is `override ?? tier === "keyed_http"`
  (`src/privacy.ts:47`). Shipped `config.json`: `core` is `free_http` with a
  required `auth_env` and no `auth_optional`, so the generated reference says
  `core | free_http | origin provider | unknown | none | no`
  (`skills/infobroker/references/provider-privacy.md:10`).
  `semantic_scholar`, `stack_exchange`, `github` carry optional keys; `exa`,
  `tavily`, `yep` are keyed; `searxng` is self-hosted with no key.
- **P4 (F-R2-19).** `src/health-status.test.ts:1` tags `REQ-013
  latency-threshold`, `REQ-013 partial-results`, `REQ-013 exhausted`, `REQ-013
  quota-warning`. There is no `missing-key` or `unreachable` tag, and the
  index-level assessment is private, so neither inactive leg is asserted.
  `detectClauseRequirements` counts five branches in REQ-013's parenthesized
  enumerations: `(missing key or unreachable)` = 2 and `(latency …, <third
  leg>, or quota at the warning threshold)` = 3. `exhausted` is **not** a
  branch — it comes from the outer status list — but the tag exists today and
  is kept (D6).
- **P5 (F-R2-19, producer audit).** Providers already produce both inactive
  legs: `inactive` on transport failure, `degraded` on a non-2xx probe
  (`src/providers/arxiv.ts:66-73`; `generic-http.ts:153-170`; the same shape
  in the other provider modules). The **partial-results** leg has no distinct
  producer — a non-2xx probe is reported `degraded`, which is not partiality.
  Batch partiality is a per-input signal owned by REQ-021k.
- **P6 (F-R2-22, deferred).** `authOk = providerUsable(providerSlug, config)`
  (`src/index.ts:1525`) is false when `enabled` is false, and the probe is
  gated on `authOk && registeredProvider` (`:1530`), so no probe occurs today.
  What remains — explicit refusal, quota-first status precedence, and a test —
  is § R2c-ii.
- **P7 (F-R2-24, deferred).** `total_requests_served: latency.total()`
  (`:1631`) counts provider samples (`src/latency.ts:42`); tool invocations are
  counted per tool in `toolMetrics.snapshot()` (`:1632`) and never summed.
- **P8 (F-R2-23, deferred).** `providerLastError` / `providerLastSuccess` are
  module-level maps (`src/index.ts:80-81`), written at `:528`, `:884`, and the
  probe catch at `:1542`; unreachable from a unit test.
- **P9 (surface).** `envelopeOutputSchema` is `z.looseObject`
  (`src/output-schema.ts:10`), so a new `inactive_reason` value needs no
  schema change. The `status` enum is `["active", "all"]`
  (`src/index.ts:1833`). `src/index.ts:1` carries the `REQ-024a` citation.
- **P10 (feasibility of the integration test).** `makeIsolatedConfig`
  (`src/lib/test-isolation.ts:19-56`) returns `{root, env}` with `TMPDIR`
  redirected under `root`, and that `env` is what the spawned child receives
  (`src/structured-output.test.ts:151-160`). `INFOBROKER_QUOTA_STATE` is a
  declared seam (`src/quota.ts:26-30`). `sanitizeQuotaState` requires **both**
  `daily` and `monthly` counters with a parseable `resetAt`
  (`src/quota.ts:58-66`); `checkQuota` sets `warning` at ≥80 % of either cap
  and `exhausted` at the cap (`:192-193`). Quota state is keyed by provider
  slug (`QuotaState.providers`, `:12-14`). A spawned stdio client already
  exists (`src/structured-output.test.ts:151-190`).
- **P11 (credential classes, for D2/D3).** The pre-change predicate
  (`src/config.ts:1111-1122`) is: not enabled → unusable; declared `url_env`
  missing from the environment → unusable; declared `auth_env` with **zero**
  keys → `auth_optional === true`; declared `auth_env` with **at least one**
  key → `hasUsableKeyForEnv` (`src/key-pool.ts:219-224`), which is false when
  every key is rejected or cooling down — **with no optional exemption on that
  branch**. Key detail for D2: an optional-key provider whose keys are all
  rejected is `providerUsable === false` today, so preserving the truth table
  means it stays unusable; the optional exemption applies only to the
  zero-key case.

## Done bar

**Done bar:** every clause below holds on the final tree, each with the evidence named in § Verification summary.

- **DB-1** The reason vocabulary is complete and correct, and the
  `providerUsable` truth table is preserved exactly. A declared pool with at
  least one key and no usable key — all rejected, or all cooling down, whether
  the credential is required or optional — reports `status: "inactive"` with
  `inactive_reason: "credentials_unavailable"` and emits the `key_pool` row so
  the cause is visible even for a single key. (Today that case reports
  `inactive` + `no_api_key`, so only the reason changes.) An optional
  credential with **no key configured** stays operable and reports `active`.
  No key at all on a required provider reports `no_api_key`; a missing URL env
  reports `no_url`; `enabled: false` reports `disabled`; an exhausted quota
  reports `exhausted`, which takes precedence over every configuration reason
  (today's behavior), so the `disabled` case is asserted with quota remaining.
  A degraded row carries no reason. `classifyCredential` is asserted against a
  **frozen expectation table** recorded in Phase 1 from the pre-change
  `providerUsable` (all shipped providers × three env fixtures ×
  enabled/url-disabled variants), so the delegation is proven
  behavior-preserving against the old predicate, not against itself. The
  existing dispatch suites (`src/config.test.ts`, `src/key-pool.test.ts`) run
  as the chain-selection regression. **F-R2-21's evidence is this reason
  table** (all five non-active reasons asserted: missing key, missing URL,
  disabled, unavailable credential pool, exhausted). Red before: Phase 1 moves
  the existing predicate into the module verbatim, so the pool expectation is
  a real observed failure.
- **DB-2** `inspect_providers action=list` with `status: "active"` excludes
  every row whose reported `status` is not `active` and includes every active
  row. Evidence: a spawned-server test in `src/provider-list.test.ts` that
  seeds `INFOBROKER_QUOTA_STATE` with **both** counters for an enabled
  provider — `daily.count` at 80 % of its cap (using the cap read from
  `config.json`), `monthly.count` at 0 — both with a future `resetAt`, then
  asserts (a) the unfiltered list reports that provider `degraded` and (b) the
  filtered list omits it. Red before: the degraded row is returned under the
  filter today. State is seeded under the isolated root and never touches real
  user state.
- **DB-3** REQ-013's five branch tags — `missing-key`, `unreachable`,
  `latency-threshold`, `provider-degraded`, `quota-warning` — each have a
  test; the existing `exhausted` tag stays as an extra assertion for the outer
  status; the `partial-results` tag is replaced (D6). This is a **unit-level
  branch test at the assessment boundary**: `unreachable` drives an `inactive`
  base, `provider-degraded` drives a `degraded` base. The probes that produce
  those values are real (`src/providers/arxiv.ts:66-73`), but the
  probe-to-assessment wiring lives in `doProviderHealth`, which the
  non-closure rule keeps in § R2c-ii; § R2c-ii therefore carries the
  end-to-end health-action evidence. Recorded honestly: this clause proves the
  assessment consumes the five legs, not that the health action drives a live
  probe into them. `src/health-status.ts`'s header and leg comments (`:3-4`,
  `:30`) and the test title at `src/health-status.test.ts:28` are updated.
  Red before: the two inactive tags do not exist; the new cases are new
  evidence, not observed failures.
- **DB-4** Privacy: `core`, `exa`, `tavily`, and `yep` report
  `requires_account: true`; `semantic_scholar`, `stack_exchange`, `github`,
  `searxng`, and every keyless provider report `false`; an explicit provider
  override still wins. Evidence: `src/privacy.test.ts` cases plus a
  regenerated `skills/infobroker/references/provider-privacy.md` committed in
  the same change, with `npm run validate-spec`'s freshness check
  (`scripts/validate-spec.ts:409-420`) green and `npm run generate-privacy`
  (`package.json:68`) as the generator.
- **DB-5** REQ-013, REQ-024a, and REQ-129 carry the amendments in D6, measured
  against Appendix B before and after (limit 800 characters, ≤8 sentences, ≤8
  SHALL clauses, ≤5 backtick tokens outside the signature exception). The
  §Glossary "Provider status" row and the §7 provider-module sentence agree
  with the amended REQ-013. `npm run validate-spec` passes with the clause tags
  in the same commit.
- **DB-6** `ROADMAP.md` § R2c is replaced by § R2c-ii carrying F-R2-22,
  F-R2-23, F-R2-24 and a `**Trigger:**` line ("start after R2c-i ships; close
  when F-R2-22, F-R2-23, and F-R2-24 are `Resolved`"). § R2b-iii is updated in
  **both** places that name § R2c: the bullet clause (`:19`) now reads
  "coordinating the `inspect_providers` status row (F-R2-9, delivered by
  R2c-i)" while its "key-pool row shape settled by § R8" clause is unchanged,
  and the
  trigger reads "start after the R2c status surface ships and § R8 settles the
  rows it asserts"; its close condition ("close when F-R2-7 is `Resolved`" and
  the supersession sentence) is preserved verbatim. The increment's own label
  is R2c-i and appears in the CHANGELOG entry, the AAR, and this directory; the
  roadmap carries only open work, so no § R2c-i heading exists after the split.
  `worklist.md` marks the five findings `Resolved 2026-11-11` with refreshed
  anchors and corrects the stale per-REQ summary prose at rows 148 (REQ-013),
  151 (REQ-129), and 168 (REQ-024a); rows 169 (F-R2-22), 170 (F-R2-24), and
  639 (F-R2-23) describe deferred behavior and stay as written.
  `AGENTS.md`'s canonical clause-tag example (`:313-314`) changes from
  `partial-results` to `provider-degraded`. `CHANGELOG.md` gains one entry
  under the current `## 2026.11.7 — <title>` section (the convention the R2a
  and R2b-ii entries already follow; the release step retitles it).
  `DECISIONS.md` gains D-100 (partial-results narrowing), D-101 (optional-key
  account rule and the required-vs-optional reason boundary), and D-102
  (single-key cooldown visibility through `key_pool`). `README.md` is updated
  where it describes the list filter or the privacy reference, and
  `npm run generate-privacy` regenerates the reference. `check-roadmap`,
  `check-non-goals`, `validate-readme`, and `check-loop-artifacts` pass.
- **DB-7** `npm run typecheck`, `npm run validate-spec`,
  `npm run check-gate-coverage`, `npm run check-intent-citations`, and
  `npm run check` exit 0 on the tree that ships.
- **DB-8** No other tool, no `config.json` value, no fixture, and no key-pool
  state format changes. The **health action is untouched**. The **spec
  action's reported fields are unchanged** — its `active_provider_count` still
  counts assessed-active providers, asserted through the spawned test — even
  though its code path now calls the shared assessment. The **list action
  changes exactly as DB-1, DB-2, and DB-4 specify**: the reason value for an
  all-unusable pool, the `key_pool` row for a single unavailable key, filter
  membership, and `requires_account`. Audited by `git diff --stat` plus
  `git status --porcelain` against § Blast radius before any bookkeeping edit.

**Non-closure rule.** The increment stops, the AAR ends `LOOP OPEN`, and the
surviving item returns to § R2c-ii if it needs: any change to `providerUsable`'s
exported signature, a `config.json` or fixture edit, a new tool parameter, a
change to the key-pool row *shape*, any edit to `doProviderHealth`, or any
production edit outside the files named in § Blast radius.

## Decisions

- **D1 — split R2c.** This increment closes the list row; § R2c-ii inherits
  the health probe and spec counts. *Alternative rejected:* one eight-finding
  increment touching the list, health, and spec actions plus `tool-metrics.ts`
  and a new provider-history module — the combined scope is what § Review-loop
  convergence asks a plan to avoid. *Consequence:* the roadmap and both
  § R2b-iii references are edited in the same closing commit (DB-6).
- **D2 — one classification function, one assessment module.**
  `classifyCredential(slug, provider)` lives in `src/config.ts`, beside
  `providerUsable`, and returns one of:

  | class | meaning | operates |
  |---|---|---|
  | `none` | no `auth_env` declared | yes (no credential needed) |
  | `usable` | a usable key (required or optional credential) | yes |
  | `optional-absent` | optional credential, **zero** keys configured | yes (keyless use is the declared intent) |
  | `absent` | required credential, zero keys configured | no |
  | `unusable` | keys present, all rejected or cooling down (required **or** optional) | no |

  `providerUsable` becomes a thin wrapper: `enabled && urlPresent &&
  class ∈ {none, usable, optional-absent}` — exactly the truth table of
  `src/config.ts:1111-1122`, including the fact that the optional exemption
  applies only to the zero-key case. An optional-key provider whose configured
  keys are all rejected stays unusable, as it is today. New
  `src/provider-status.ts` exports `assessProvider(input)` over
  `{enabled, urlPresent, credential, probeStatus?, quotaExhausted,
  quotaWarning, avgLatencyMs?, degradedLatencyMs?}`, deriving `baseStatus`
  from `enabled`/`urlPresent`/`credential` (or from `probeStatus` when the
  health action supplies one in R2c-ii) and delegating the status leg to
  `resolveHealthStatus`. It also exports
  `selectActiveRows<T extends { status: string }>(rows: T[]): T[]` and
  `keyPoolRow(pool: Array<{index: number; available: boolean; reason?: string}>):
  Array<{index: number; available: boolean; reason?: string}> | undefined`.
  Reason precedence: `exhausted` (when the assessed status is `exhausted`),
  then `disabled`, `no_url`, `no_api_key`, `credentials_unavailable`. A
  `degraded` row carries no `inactive_reason`. *Alternative rejected:* passing
  `baseStatus` in from the handler — it lets a row report `active` with a
  reason. *Consequence:* `src/config.ts` joins the blast radius; the frozen
  table in DB-1 is the guard.
- **D3 — new reason value `credentials_unavailable`.** It is emitted whenever
  `credential === "unusable"` — keys present, none usable — whether the
  credential is required or optional, because in both cases the provider is
  inactive today and only the reason was wrong (P11). The optional exempt
  case is the zero-key one, which stays `active` and carries no reason. The
  transient and permanent causes are both covered by the same reason because
  the per-key row explains them: `keyPoolRow` returns the row when
  `pool.length > 1` **or any key is unavailable**, so a single-key cooldown or
  rejection is visible. The row's *shape* is unchanged
  (`{index, available, reason}`), so § R2b-iii still asserts it. REQ-024a
  names an unavailable credential pool among its distinguishing causes.
  *Rejected:* reusing `no_api_key`, reusing `exhausted`, and a second
  `credentials_cooling_down` value (doubles the vocabulary for a case the
  per-key row already explains).
- **D4 — `requires_account` means "needed to operate".** Derivation:
  `override ?? (auth_env declared && auth_optional !== true)`. REQ-129 gains
  "to operate". CORE and the keyed tier become `required`; providers with an
  optional key keep `none`, because they work anonymously. *Alternative
  rejected:* key presence — it would document `semantic_scholar`,
  `stack_exchange`, and `github` as account-required when they are not.
- **D5 — the filter consumes the reported status.** Build the full row list,
  then filter with `selectActiveRows`, matching REQ-024a and the spec action.
  Disagreement between the filter and the row becomes impossible by
  construction.
- **D6 — REQ-013's dead "partial results" leg is replaced, not faked.** The
  amended body enumerations and the tag map:

  > `active`, `inactive` (missing key or unreachable), `degraded` (latency
  > above a configurable threshold, a provider that reports itself degraded, or
  > quota at the warning threshold), or `exhausted` (quota consumed, REQ-034)

  | Branch (detector) | Tag |
  |---|---|
  | missing key | `REQ-013 missing-key` (new) |
  | unreachable | `REQ-013 unreachable` (new) |
  | latency above a threshold | `REQ-013 latency-threshold` (exists) |
  | a provider that reports itself degraded | `REQ-013 provider-degraded` (renamed from `partial-results`) |
  | quota at the warning threshold | `REQ-013 quota-warning` (exists) |
  | *not a branch* — the outer `exhausted` status | `REQ-013 exhausted` (exists, kept) |

  *Alternative rejected:* inventing a partial-results producer — a partial
  batch is a per-input outcome (REQ-021k), and a provider-level flag would be
  fabricated from a non-2xx probe, which the spec already calls `degraded`.
  *Fixed wording, measured in Phase 0 and recorded in the AAR:*
  - REQ-013 — `partial results` → `a provider that reports itself degraded`
    (current body 381 characters; expected ~406).
  - REQ-024a — `a provider disabled by configuration, and quota exhaustion` →
    `a provider disabled by configuration, an unavailable credential pool, and
    quota exhaustion` (current 495).
  - REQ-129 — `requires an account or key,` → `requires an account or key to
    operate,` (current 640).
  After the amend REQ-024a's sentence enumerates five causes: a missing API
  key, a missing endpoint URL, a disabled provider, an unavailable credential
  pool, and quota exhaustion.
- **D7 — no new tool parameter, no removed field, no schema change.**
  `status` keeps `["active", "all"]`; `inactive_reason` gains one value;
  `envelopeOutputSchema` is loose.
- **D8 — the integration test seeds quota, not latency.** A degraded row is
  produced deterministically by a seeded quota counter at 80 % of the daily
  cap, which `checkQuota` turns into `warning` and the assessment into
  `degraded`. Seeding latency would require live samples, which a spawned
  server cannot produce offline. Both counters are seeded because
  `sanitizeQuotaState` discards a counter pair with a missing half.

## Blast radius

**Production (5 files).**
- `src/config.ts` — S: `classifyCredential` added; `providerUsable` becomes a
  thin wrapper (exported signature unchanged).
- `src/provider-status.ts` — **new**, S: `assessProvider`, reason
  classification, `selectActiveRows`, `keyPoolRow`; header carries
  `// @implements REQ-013 REQ-024a`.
- `src/index.ts` — M: `providerInactiveReason` removed, `assessProviderStatus`
  replaced by the shared assessment, `doListProviders` builds rows then
  filters, `doSpecHealth` uses the shared assessment, `key_pool` emission via
  `keyPoolRow`, the `REQ-024a` citation moves with the logic.
- `src/privacy.ts` — S: one derivation expression.
- `src/health-status.ts` — comments only (`:3-4`, `:30`).

**Spec (1 file, three REQs + two prose sites).** `infobroker.md` — REQ-013,
REQ-024a, REQ-129, the §Glossary "Provider status" row (`:158`), and the §7
provider-module sentence (`:747-749`).

**Generated (1 file).** `skills/infobroker/references/provider-privacy.md`
(`npm run generate-privacy`, `package.json:68`).

**Tests (4 files).** `src/provider-status.test.ts` (new; DB-1, DB-3, the
frozen equivalence table), `src/provider-list.test.ts` (new; DB-2 and DB-8's
count regression through a spawned server), `src/privacy.test.ts` (DB-4),
`src/health-status.test.ts` (tag and title rename for DB-3).

**Documentation and bookkeeping (7 paths).** `README.md`, `DECISIONS.md`,
`CHANGELOG.md`, `ROADMAP.md`, `AGENTS.md` (clause-tag example), `worklist.md`,
and this increment directory (including `review/cold-b206ecb.md`).

**Checked, not edited.** `debate-club/src/mcp-contract.test.ts:389-420` (its
list length, inline-fallback, and count expectations must stay true — Phase 0
step 4), `src/tool-surface.test.ts`, `src/intent-citations.test.ts`,
`scripts/lib/provider-privacy.ts`.

**Out of change scope; in verification scope.** `src/config.test.ts`,
`src/key-pool.test.ts`, and the dispatch/task-type suites, run as the
`providerUsable` regression (DB-1).

**Explicitly out of scope.** `doProviderHealth` and the spec counts
(F-R2-22/23/24 → § R2c-ii), the key-pool state format, every fixture,
`config.json`, `scripts/validate-spec.ts`, and the spawned-server key-safety
harness (R2b-iii).

## Phases and steps

### Phase 0 — Discovery (no edits)

1. Confirm the baseline, the clean tree, and the recorded `npm run check`
   result; capture the frozen `providerUsable` truth table (all shipped
   providers × {no keys, one usable key, all keys rejected} × {enabled,
   disabled, URL env present/absent}) into `tasks.md` before any code change.
2. Re-confirm P1-P11; a mismatch stops the increment rather than moving the
   plan.
3. Sibling-REQ sweep: `inactive_reason`, `requires_account`, and every REQ
   citing REQ-024/REQ-024a/REQ-129; a conflicting normative sentence stops the
   increment. Confirm no fixture pins the list row (grep is empty as of this
   session; re-confirm).
4. Record what the surface sites pin: `src/tool-surface.test.ts:110`,
   `src/intent-citations.test.ts` citations, `debate-club/src/mcp-contract.test.ts:389-420`
   (unfiltered list length = `provider_count`, `native_fetch` marked,
   `active_provider_count ≤ enabled_provider_count`), and
   `scripts/lib/provider-privacy.ts` (regenerate only).
5. Confirm the quota-seed path: the test provider slug, its daily and monthly
   caps from `config.json`, seed counts, and a future `resetAt` accepted by
   `sanitizeCounter`.
6. Measure the three REQ bodies before the amend and count the amended wording
   against Appendix B.
7. Choose the README passages (the privacy reference around `:289-290` and
   `:663-665`, plus any `status` filter sentence).
8. Confirm `DECISIONS.md`'s highest ID is D-099 (allocating D-100 to D-102) and
   that no existing decision covers the optional-key question.
9. Confirm `docs/plans/<dir>` is trackable (`git check-ignore` exits 1).

### Phase 1 — Additive skeleton, then failing evidence

1. `src/provider-status.ts` created with `classifyCredential`'s caller-side
   input type, `selectActiveRows`, and `keyPoolRow`; `providerInactiveReason`
   moved **verbatim** from `src/index.ts` as the interim reason function;
   `src/index.ts` imports it. Behavioral seam unchanged: the suite must stay
   green. `classifyCredential` itself is added in `src/config.ts` in this
   phase (D2), tested but not yet wired into `providerUsable`.
2. Write `src/provider-status.test.ts`:
   - 2a. the frozen equivalence table (boolean rows; all green from the start,
     kept as the delegation guard) and the DB-1 reason table, in which the
     pool case fails with `no_api_key` — the red observation;
   - 2b. the F-R2-21 rows — all five non-active reasons;
   - 2c. `selectActiveRows` and `keyPoolRow` (including the single-key
     cooldown/rejected emission);
   - 2d. the DB-3 five branch tags and the optional-credential cases: zero
     keys → `active`, all keys rejected → `inactive` +
     `credentials_unavailable` (M12, R1).
   The file loads because every symbol exists after step 1.
3. Write `src/provider-list.test.ts` (DB-2, the DB-8 count assertion) and
   record the observed failure: the filtered list still contains the degraded
   row.
4. Write the `src/privacy.test.ts` cases for DB-4 and record which fail.
5. Record every pre-fix result in `tasks.md`, marking a case that is green
   before the fix as regression evidence with its reason (C-1).

### Phase 2 — Fix

1. `src/config.ts`: wire `providerUsable` to `classifyCredential`.
2. `src/provider-status.ts`: implement `assessProvider` (D2 input and reason
   precedence), replacing the interim `providerInactiveReason` body created in
   Phase 1; `src/index.ts` keeps only the import and its call site.
3. `src/index.ts`: build the assessment input per provider; remove
   `assessProviderStatus` in favour of the shared call in both
   `doListProviders` and `doSpecHealth`; build rows then `selectActiveRows`;
   route `key_pool` through `keyPoolRow`.
4. `src/privacy.ts`: the D4 derivation.
5. `src/health-status.ts`: comment corrections.
6. `infobroker.md`: the D6 amendments, glossary, and §7 sentences.
7. `npm run generate-privacy`; stage the regenerated reference.
8. Re-run every touched suite; every Phase 1 red case passes, and the frozen
   equivalence table is green.

### Phase 3 — Verification and documentation

1. Audit `git diff --stat` and `git status --porcelain` against § Blast radius
   before any bookkeeping edit (DB-8, C-3).
2. Targeted suites: `provider-status`, `provider-list`, `privacy`,
   `health-status`, `key-pool`, `config`, plus the dispatch/task-type suites.
3. `npm run typecheck`, `npm run validate-spec`,
   `npm run check-gate-coverage`, `npm run check-intent-citations`.
4. `README.md`: the chosen passages; `npm run validate-readme`.
5. `DECISIONS.md`: D-100, D-101, D-102.
6. `CHANGELOG.md`: one entry under the current `## 2026.11.7 — <title>`
   section.
7. `ROADMAP.md`: replace § R2c with § R2c-ii; update both § R2b-iii references
   and preserve its close condition; `npm run check-roadmap` and
   `npm run check-non-goals`.
8. `worklist.md`: five findings to `Resolved 2026-11-11`, refreshed anchors,
   stale summary prose at rows 148/151/168 corrected; rows 169/170/639
   untouched.
9. `AGENTS.md`: clause-tag example.
10. `aar.md`: the DB-clause-to-evidence table and the LOOP token; `tasks.md`
    fully ticked.
11. Final `npm run check` and `npm run check-loop-artifacts` on the shipping
    tree.

### Phase 4 — Commit series

Two commits. The spec amendment, its clause tags, and the source they assert
are one atomic unit: `AGENTS.md` requires the tags in the same commit as the
REQ change and requires `validate-spec` to pass, and the tags live in the test
files the source makes green. The generated reference is derived from the same
source. This is the "genuinely atomic" exception to the ~300-line guideline,
recorded here rather than discovered at commit time.

1. **Spec, source, tests, generated reference.** `infobroker.md`,
   `src/config.ts`, `src/provider-status.ts`, `src/index.ts`, `src/privacy.ts`,
   `src/health-status.ts`, the four test files,
   `skills/infobroker/references/provider-privacy.md`. Gate:
   `npm run typecheck`, `npm run validate-spec`, the targeted suites.
2. **Documentation and record.** `README.md`, `DECISIONS.md`, `CHANGELOG.md`,
   `ROADMAP.md`, `AGENTS.md`, `worklist.md`, this plan directory. Gate:
   `npm run check` on the tree to ship.

## Conditions

- **C-1** Pre-fix results are recorded as observed. A case already green is
  kept as regression evidence with its reason in `tasks.md`.
- **C-2** No `config.json` value, fixture, spec validator, or other tool is
  edited. A hit stops the increment.
- **C-3** The non-closure rule is audited by Phase 3 step 1 before bookkeeping.
- **C-4** The clause tags are part of the deliverable: `REQ-013 missing-key`,
  `REQ-013 unreachable`, `REQ-013 provider-degraded`, `REQ-013
  latency-threshold`, `REQ-013 quota-warning`, plus the retained `REQ-013
  exhausted`, in `src/provider-status.test.ts` / `src/health-status.test.ts`;
  `REQ-024a` on `src/provider-status.ts`'s header (created in Phase 1 step 1;
  the header is specified in § Blast radius).
- **C-5** The cold pass ran once (revision 2) and the single targeted
  re-review ran once (revision 3). Both are spent; revision 4's corrections
  are not re-reviewed, and the cap is now a user decision rather than another
  pass.
- **C-6** Trust boundary: every premise in this plan is `repo`; no step
  consumes web, user, or tool output.
- **C-7** The spawned test writes only inside the isolated root
  (`makeIsolatedConfig`), including `INFOBROKER_QUOTA_STATE`; the unit test
  isolates key-pool state with `INFOBROKER_KEYPOOL_STATE` plus
  `resetKeyPoolStateForTests()` between cases. Both must pass
  `src/test-isolation.test.ts`'s guard.

## User impact

A provider whose declared credential pool is present but entirely rejected or
cooling down now says so (`credentials_unavailable`, with the per-key row even
for a single key) instead of claiming no API key is configured — for a required
and an optional credential alike, because both are inactive today; a provider
with an optional credential and **no key configured** keeps working keyless and
does not gain that reason. `inspect_providers action=list`
with `status: "active"` returns exactly the rows it reports as active, so a
degraded provider no longer appears in an "active" list. The generated privacy
reference stops listing CORE — and every provider that requires a credential —
as requiring no account, while optional-key providers stay account-free. No
restart, no migration, no new parameter. The only new field value is one
`inactive_reason`; the other deltas are filter membership, the corrected
`requires_account` value, and a `key_pool` row that now appears when a single
configured key is unavailable (the field already exists). No existing value or
field is removed.

## Rollback

Revert **both** commits in reverse order: first the documentation and record
commit, then the spec + source + tests + generated-reference commit. That
restores the pre-change tree exactly — the spec sentences, the source, the
tests, the regenerated privacy reference, the roadmap sections, and the ledger
rows all revert together. No persisted state, schema, wire format, or
credential format changes, so a revert needs no data migration and no restart.

## Verification summary

| Clause | How it is verified |
|---|---|
| DB-1 | `provider-status.test.ts` — reason table (required/optional, rejected/cooling, precedence), frozen `providerUsable` table; pool case red before the fix; `config`/`key-pool` dispatch suites as regression |
| DB-2 | `provider-list.test.ts` — both quota counters seeded, spawned list with and without the filter; red before |
| DB-3 | `provider-status.test.ts` + `health-status.test.ts` — five branch tags plus the retained `exhausted` tag, inactive and degraded bases |
| DB-4 | `privacy.test.ts` — provider table with overrides; regenerated reference; `validate-spec` freshness check |
| DB-5 | `infobroker.md` diff; measured bodies in `tasks.md`; `validate-spec` |
| DB-6 | roadmap, worklist, changelog, decisions, AGENTS, README diffs; `check-roadmap`, `check-non-goals`, `validate-readme`, `check-loop-artifacts` |
| DB-7 | `typecheck`, `validate-spec`, `check-gate-coverage`, `check-intent-citations`, `npm run check` |
| DB-8 | `git diff --stat`/`git status --porcelain` audit (Phase 3 step 1); `provider-list.test.ts` count assertion |
