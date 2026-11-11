# Worklist — full-repository review sweep

Cross-session tracker for `ROADMAP.md` § Full-repository review sweep. One row
per chunk in the status board; one verdict row per in-scope REQ when a chunk
runs. A chunk is closed only when its findings are dispositioned and its exit
evidence is recorded.

Bootstrap: `plan.md` (2026-11-09). Update this file at each chunk close; do not
restart the enumeration from scratch.

## How a chunk closes

1. Surface enumerated with `file:line` anchors.
2. Plan reviewed at standard depth with a fresh-context cold pass, then stamped.
3. Review run with `code-review` (and `drift-report` for a document surface).
4. Every in-scope REQ has a verdict — `holds`, `finding:<ID>`, or
   `deferred:<chunk>` only when the predicate lands wholly in a later chunk —
   and every chunk-owned prose surface has a prose verdict row
   (`| Surface | Verdict | Predicate |`).
5. Every finding has an ID, a `file:line` or `spec:line` predicate, a
   P-severity, and a terminal disposition: fixed · `Scheduled-roadmap` ·
   `Closed-P3` · `Deferred-by-user`.
6. Zero open P0 remains. A P0 that cannot be fixed inside the session stops the
   chunk and lands as `LOOP OPEN` naming it.
7. Exit evidence run un-piped and its exit status recorded.
8. AAR written; roadmap trigger advanced to the next chunk; split commits.

## Decisions (user-approved 2026-11-09)

- **D1 — Fix policy.** P0 fixed in-session (bounded), P1 scheduled on
  `ROADMAP.md`, P2 fixed only on a demonstrated failure, P3 record-and-close.
- **D2 — Chunk map.** R1–R9 plus M1. A chunk that cannot close in one session
  splits by a recorded amendment to this worklist; the coverage invariant must
  still hold.
- **D3 — Findings home.** This file carries the verdict tables and the finding
  register; each chunk's `aar.md` carries the terminal dispositions.
- **D4 — Plan depth.** Standard; deep only for a chunk that touches release,
  credentials, or schema migration.
- **D5 — Coverage.** §1–§3, §4, §5–§10, and Appendices A–E. Whole repo.
- **D11 — Prose ownership split (2026-11-09, R1 cold pass).** §1 goals and the
  §3 invariants are reviewed by the chunk that owns their behavior, not by R1
  as a block. R1 keeps §3 SR-009 (determinism in schemas and error contracts)
  and §6.1–§6.2. The ownership table below is the authority; a prose defect is
  filed once, under its owner.

## Calibration rules (apply before the first verdict)

These come from the Holonovel sweep's recorded mistakes and from Infobroker's
own gate shapes.

1. **Classify citation kind first.** Read the REQ's `_Check:_` before judging a
   missing `@implements`. G3-only REQs are verified by a deterministic gate or
   artifact check, not by a test; 13 of the 142 REQs are in this class. Only a
   G1 REQ with no citation and no exemption is a traceability finding.
2. **A citation is not evidence.** A literal `@implements REQ-NNN` proves the
   REQ was named, not that the test exercises the behavior. Open the test and
   read the assertion.
3. **No family inheritance.** Infobroker cites each REQ individually; there is
   no `spec/audit/req-coverage.md` family register. `REQ-020a` needs its own
   row and its own evidence.
4. **`check-gate-coverage` is existence-only.** It proves *a* citation exists.
   A test that asserts a narrower claim than the REQ is the primary finding
   class this sweep exists to find.
5. **Clause tags.** A REQ with an `or`-joined status branch or a "when …
   declares" conditional needs a named clause tag per branch, per AGENTS.md and
   `src/clause-coverage.ts`; a bare `@implements` does not satisfy it.
6. **Gate assertion vs REQ text.** A green gate that asserts less than the REQ
   states is a finding, not a pass. Read the gate's assertion, not its name.
7. **Artifact-exempt REQs.** `validate-spec` reports 15 artifact-exempt REQs;
   verify the artifact check itself, not a test that does not exist.

## Coverage invariant — exact REQ lists

Counts sum to 142. Each ID belongs to exactly one chunk.

### Prose ownership (§1 goals and §3 invariants)

The §4 REQ partition is below. The mission and invariants are split here so a
prose defect is filed once, under the chunk that owns the behavior.

| Prose unit | Owner |
|---|---|
| §1 preamble and North Star paragraph | R9 |
| §1 goal 1 (free first, privacy) | R2 |
| §1 goal 2 (upgrade path) | R2 |
| §1 goal 3 (provider intelligence) | R3 |
| §1 goal 4 (truth by iteration) | R5 |
| §1 goal 5 (writing pipeline) | R7 |
| §1 goal 6 (knowledge persistence) | R6 |
| §2 failure modes | R8 |
| §3 SR-001 outbound by design | R2 |
| §3 SR-002 single user | R8 |
| §3 SR-003 keys never surfaced | R8 |
| §3 SR-004 zero-config works | R2 |
| §3 SR-005 standalone provider modules | R2 |
| §3 SR-006 config hot-reload | R2 |
| §3 SR-007 quota persists | R8 |
| §3 SR-008 corroboration bounded | R5 |
| §3 SR-009 determinism in schemas/error contracts | R1 |
| §3 SR-010 server-side validation before outbound | R2 |
| §3 SR-011 contracts not implementations | R9 |
| §3 SR-012 red-team every REQ | R9 |
| §6.1 Tool naming | R1 |
| §6.2 Output format | R1 |

### R1 — Contracts and envelope (6)

`REQ-001` `REQ-002` `REQ-003` `REQ-004` `REQ-073` `REQ-079`

Spec: §3 SR-009, §4.1, §6.1–6.2.
Code: `src/index.ts` envelope/dispatch, `ok()`, `instrumentTool`, the
`search_web` suggest/expand return paths, `src/error-envelope.ts`,
`src/output-schema.ts`, `src/structured-output.ts`, `src/truncate.ts`,
`src/verbosity.ts`, `src/normalizer.ts`, `src/types.ts`.

#### R1 verdict table (2026-11-09)

| Surface | Verdict | Predicate |
|---|---|---|
| REQ-001 Status Prefix Contract | `holds` | 7/7 tools declare `outputSchema`; live stdio check on all 7 returned `structuredContent` deep-equal to `parseEnvelopeObject(text)` (`src/structured-output.test.ts:168`; R1 cross-tool run) |
| REQ-002 Error Taxonomy | `holds` | `err()` includes code/message/provider/remediation; `chainExhaustion` prefers `rate_limited`; `access_blocked`/`network_error`/`internal_error` call sites present (`src/error-envelope.ts:11`; `src/error-envelope.test.ts`) |
| REQ-003 Result Format Normalization | `holds` | every search provider calls `normalize()`; scholarly fields additive; generic-http `original_source` declared by `field_map` (`src/providers/generic-http.test.ts:111`) |
| REQ-004 Truncation | `finding:F-R1-2` | KB cache-hit path sets `truncated: true` with no `output_path`, no full file, no in-band note (`src/index.ts:1037`); other paths comply (`src/truncate.ts:16`) |
| REQ-073 Minimum Viable Result | `finding:F-R1-3` | discard works, but invalid rows still consume the requested `max_results` budget (`.slice(0, maxResults)` after `normalize`, `src/index.ts:505`) |
| REQ-079 Output Verbosity | `finding:F-R1-1` | compact applies only through `ok()`; `fetch_page`, `inspect_providers`, `manage_kb`, `reload_config` build envelopes directly |
| §3 SR-009 determinism | `holds` | schemas and error envelopes are deterministic; no wall-clock in the contract surface |
| §6.1 Tool naming | `holds` | seven `infobroker_*` snake_case names; live `tools/list` matches |
| §6.2 Output format | `holds` | live envelopes carry status/provider/results/meta; `[OK]`/`[ERROR]` prefix present |

### R2 — Config, providers, resilience (25)
`REQ-010` `REQ-011` `REQ-013` `REQ-014` `REQ-015` `REQ-129` `REQ-104`
`REQ-030` `REQ-031` `REQ-031a` `REQ-032` `REQ-033` `REQ-034` `REQ-035`
`REQ-036` `REQ-037` `REQ-038` `REQ-040` `REQ-070` `REQ-071` `REQ-095`
`REQ-024` `REQ-024a` `REQ-024b` `REQ-024c`

Spec: §4.2, §4.3 (REQ-024 family), §4.4, §4.5, §4.6, §5.3, §6.3, §7.1–7.3, App A.
Code: `src/config*`, `src/key-pool.ts`, `src/rate-limiter.ts`, `src/quota.ts`,
`src/retry.ts`, `src/cooldown.ts`, `src/health-status.ts`, `src/providers/`.

#### R2 verdict table (2026-11-09)

Reviewed at deep depth; split not triggered (8 clusters, 26 carrying tests, 247 tests green). Live evidence: purpose-written stdio probes (`/tmp/opencode/r2-probe/`) with an isolated `TMPDIR` and temp config layer.

| Surface | Verdict | Predicate |
|---|---|---|
| REQ-010 Config File | `finding:F-R2-4` | resolution, precedence, and three-way discovery hold (`src/config.ts:107-153`; `config-path.test.ts:36-80`); defaults-inheritance and update-preservation clauses have no asserting test (`src/config.ts:319-331`), and `rate_limit`/`auth_env` types are not enforced |
| REQ-011 API Key Safety | `holds` | missing-key, optional-key, and no-leak clauses asserted through a spawned server (`src/key-safety-action.test.ts`); key material never reaches config/output/errors/logs/health (`src/key-pool.ts:130-140`, `src/index.ts:1467-1492`); the manifest test asserts the declared env-var names (`server-manifest.test.ts:51-62`) |
| REQ-013 Provider Discovery | `finding:F-R2-19` | all five branches produced and asserted at the assessment boundary (`src/provider-status.ts:44-77`; `src/provider-status.test.ts:1`); the dead partial-results leg is replaced by the provider-reported leg (D-100); probe-to-assessment wiring remains § R2c-ii |
| REQ-014 Generic HTTP Tier | `holds` | config-defined tier with endpoint/auth/probe/mapping and the same validation on load and reload (`src/providers/generic-http.ts:87-168`; `src/config.ts:483-514`, `:992-997`) |
| REQ-015 Provider Removal | `finding:F-R2-14` | dispatch, recommendations, and `search_web` skip a disabled provider (`src/config.ts:1023`; `src/index.ts:417-421`), but `verify_claims.providers` bypasses the enabled check (`src/corroborate.ts:566-571`) |
| REQ-129 Provider Privacy Posture | `finding:F-R2-12` | posture derived from config with overrides, `unknown` only for `retains_query`, live list reports it, generated doc is gated (`src/privacy.ts:40-51`; `src/index.ts:1497`; `scripts/validate-spec.ts:409`); `requires_account` derives from the declared credential, so CORE is documented `required` and optional-key providers stay `none` (D-101) |
| REQ-104 Key-Pool Rotation | `finding:F-R2-8` | pool honored by keyed providers (`src/key-pool.ts:150-221`); CORE and generic_http are filtered as pool-satisfied (`src/config.ts:1025-1030`) but read only the single-key variable; an empty pool still reports `active` |
| REQ-030 Per-Provider Throttling | `finding:F-R2-30` | per-slug interval + jitter hold and are tested (`src/rate-limiter.ts:40-65`); `throttle()` runs once outside `retryWithBackoff`, so retries skip the minimum interval (`src/index.ts:492-509`; `src/retry.ts:46-55`) |
| REQ-031 Fallback Chain | `finding:F-R2-31` | priority, hedging, depth, and cross-provider advancement hold; an explicit `provider` is prepended before the auth filter (`src/index.ts:415-416`), and a fully quota-exhausted chain falls through to empty success instead of exhaustion (`:478-490` → `:773`) |
| REQ-031a Cross-task fallback | `holds` | `general_web` retried before exhaustion, attempted providers excluded (`src/chain.ts:95-103`; `src/index.ts:739-747`; `chain.test.ts:69-81`) |
| REQ-032 Retry Policy | `finding:F-R2-33` | retry/backoff/count configurable and tested for 429/5xx; timeouts are not classified retryable (`src/retry.ts:60-66`) |
| REQ-033 Persistent Quota | `finding:F-R2-32` | counters persist to the §10.1 file and reset on schedule; writes are debounced 30 s with a `beforeExit` flush only, and no signal handler flushes on SIGTERM/SIGINT (`src/quota.ts:32,83-99`), so a restart can lose the window; reset applies a 30 s grace |
| REQ-034 Quota Warning | `finding:F-R2-26` | 80%/100% logic implemented (`src/quota.ts:193`; `src/health-status.ts:22-25`); no test asserts the boundary, the `quota_warning` field, or the 100% skip (the 034 citation stubs the predicate) |
| REQ-035 Request Timeout | `finding:F-R2-33` | every call is bounded and the timeout advances the chain (`src/lib/timeout.ts:17-37`; `src/index.ts:505-509`); "treated as a transient failure" is not honored because the timeout error is not retryable |
| REQ-036 Latency Window | `finding:F-R2-27` | one hard-coded count window; only its size is configurable, and the per-sample timestamps are written and evicted but never read (`src/latency.ts:15,29-33`) |
| REQ-037 Config Validation | `finding:F-R2-1` | rejection classes hold except the missing-required-field branch, which is untested; a non-object `providers` layer crashed startup before validation (fixed in-session) |
| REQ-038 Rate-Limit Cooldown | `finding:F-R2-34` | cooldown, skip-without-call, expiry, quota-untouched, and reporting hold (`src/index.ts:469-475`; `cooldown.test.ts`); a rate-limited `fetch_page` omits `retry_after_ms` (`src/fetch-fallback.ts:139-144`) |
| REQ-040 Configuration Reload | `finding:F-R2-2` | reload, reject, backup, validate, and rollback hold and retention was probed live; a patch merges over the startup snapshot rather than the on-disk layer (`src/config.ts:308`), so a concurrent external edit is overwritten |
| REQ-070 Provider Registration | `holds` | single `PROVIDERS` map resolves search/health/fetch independent of handlers; disabled backends registered but dropped from dispatch (`src/providers/index.ts:32-80`) |
| REQ-071 Outbound Identification | `holds` | one identifier applied on every transport (`src/http.ts:27-30`; `src/lib/url-guard.ts:190`; `http.test.ts:27`); duplicates the literal in three places (F-R2-17) |
| REQ-095 Financial Task Type | `finding:F-R2-36` | `financial` classifies and the chain is zero-config with a filings source (`config.json:254`; `src/providers/sec_edgar.ts`); `world_bank` queries Documents & Reports, not an indicator series, so the economic-indicator clause has no provider |
| REQ-024 `inspect_providers` | `holds` | action enum, optional provider, health-requires-provider error path, and envelope all live-verified (`src/index.ts:1825-1853`) |
| REQ-024a list action | `finding:F-R2-20` | all fields, five non-active reasons, and `inline_fallback` hold live; the `status:"active"` filter selects on the reported status (`selectActiveRows`), so a degraded row never appears under it (`src/index.ts:1473-1516`; `src/provider-status.ts:79-83`; `src/provider-list.test.ts`) |
| REQ-024b health action | `holds` | live status, latency, quota, daily counters, and history timestamps hold live; a config-disabled provider is not probed and reports `inactive` + `inactive_reason: "disabled"` (`src/index.ts`; `src/provider-health.ts`; `provider-health-action.test.ts`) |
| REQ-024c spec action | `holds` | build identity, 26/22/21 counts excluding inline fallback, uptime, state paths, and the KB block all hold live; `total_requests_served` counts tool requests (`src/tool-metrics.ts`; `provider-health-action.test.ts`), and `last_spec_review` is boot time, which REQ-024c does not bind (F-R2-25, `Closed-P3`) |

#### R2 prose verdict table (2026-11-09)

| Surface | Verdict | Predicate |
|---|---|---|
| §1 goal 1 free-first/privacy | `holds` | every default dispatch slug is builtin/free_http; posture derived per provider (`config.json:245-259`; `privacy.ts:32-42`) |
| §1 goal 2 upgrade path | `holds` | keyed and self-hosted providers ship disabled and additive (`config.json:193-234`) |
| SR-001 KB derivative | `holds` | `kb` optional; shipped KB empty (`src/types.ts:195`; `check-shipped-kb-empty`) |
| SR-004 zero-config works | `holds` | all named providers present with the stated tiers/auth |
| SR-005 standalone modules | `holds` | registry mapping, no handler change (`src/providers/index.ts:32-80`) |
| SR-006 hot reload | `holds` | `reloadConfig` + SIGHUP (`src/config.ts:992`; `src/index.ts:2578-2591`) |
| SR-010 server-side validation | `holds` | zod input schemas plus a URL guard before any fetch (`src/index.ts:1708-1727`, `:990-997`) |
| §5.3 plugin interface | `finding:F-R2-38` | `rateLimit` is declared on the interface but no live provider implements it (limits live in `ProviderConfig`); capabilities/health unions are wider in `src/types.ts`; "web_search capability serves general_web" is contradicted by static dispatch (`config.json:245-259`) |
| §6.3 provider API conventions | `finding:F-R2-39` | endpoint bases match; DuckDuckGo's "3s minimum interval" is 4 s + jitter in config (`config.json:12`) |
| §7.1 task types | `holds` | 15 table rows = 15 dispatch keys; classification deferred to R3 (D18) |
| §7.2 dispatch table | `holds` | row-for-row match with `config.json:245-259` |
| §7.3 deprioritization | `finding:F-R2-40` | demotion and cooldown exclusion hold; prose says ">80%", code demotes at ≥80% (`src/quota.ts:193`) |
| §A.1–A.7 catalog | `finding:F-R2-41` | every listed provider matches tier/auth/endpoint and no configured provider is missing except `native_fetch`; SearXNG is described as "Full privacy" while config and the generated reference mark it third-party forwarding; "POST /search" is a GET in `src/providers/searxng.ts:22` |

### R3 — `search_web` (14)

`REQ-020` `REQ-020a` `REQ-020b` `REQ-020c` `REQ-020d` `REQ-020e` `REQ-020f`
`REQ-020g` `REQ-020h` `REQ-020i` `REQ-124` `REQ-127` `REQ-128` `REQ-028`

Spec: §4.3 (those IDs), §7.4.
Code: `src/chain.ts`, `src/task-type.ts`, `src/intent-citations.ts`,
`src/dedup.ts`, `src/source-quality.ts`, `src/batch.ts`, `src/batch-run.ts`,
`src/expand.ts`, `src/research.ts`, `src/deep-search.ts`, `src/analysis.ts`,
`src/rerank.ts`, `src/language.ts`, `src/query.ts`, plus the `search_web`
handler in `src/index.ts`.

#### R3 verdict table (2026-11-09)

Reviewed at standard depth; split not triggered (6 clusters, ~40 predicates, 2 clusters needed a live probe). Evidence: 18 carrying test files / 201 tests PASS; debate-club Arena 36 tests PASS; isolated stdio probes (`/tmp/r3-probe-*`) for suggest, expand, `ignored_params`, and provider+priority precedence.

| Surface | Verdict | Predicate |
|---|---|---|
| REQ-020 | `finding:F-R3-14` | schema, 18 parameters, defaults, array/merge, provenance, `max_results` hold (`tool-surface.test.ts:187-235`; `batch.test.ts:67-73`); a 6th+ input and duplicate inputs are silently dropped so `meta.per_query` can be shorter than the caller's array (`src/batch.ts:73`; `src/index.ts:250`) |
| REQ-020a | `finding:F-R3-1` | classification, override, confidence floor, quota demotion, and serving-provider reporting hold (`task-type.test.ts:35-120`; `chain.test.ts:86`); an explicit `provider` is discarded by `priority:"privacy"`/`"free_only"` — live probe asked `marginalia` with `priority:"privacy"` and was served by `duckduckgo` (`src/index.ts:415-429`; `src/chain.ts:45-62`) |
| REQ-020b | `finding:F-R3-6` | live suggest returns title-only strings from a suggestion provider (`src/index.ts:269-293`); no behavior test asserts ordering, fallback to a second suggestion provider, or the error path (only `embed.test.ts:1` names the REQ); `url:""` and hardcoded `provider`/`fallback_used` (F-R3-7, F-R3-8) |
| REQ-020c | `finding:F-R3-2` | privacy, free_only, quality, and serving-provider identification hold (`chain.test.ts:21-53`); the `speed` comparator returns `1` when both latencies are zero (`src/chain.ts:63-70`), so config priority order is not retained for unmeasured providers and the comparator is not antisymmetric |
| REQ-020d | `finding:F-R3-3` | the normal path reports unsupported parameters (`ignored_params:["time_range"]` live; `chain.test.ts:99-147`); the KB-first success path returns before parsing and omits `ignored_params` (`src/index.ts:388-396`); `safe_search:"strict"` is not reported (F-R3-4) |
| REQ-020e | `finding:F-R3-9` | expand returns deduplicated title-only strings with the no-provider fallback (`expand.test.ts`); the response reports `provider:"duckduckgo"` regardless of the serving provider (`src/index.ts:312`); relatedness ordering is unasserted (F-R3-10) |
| REQ-020f | `finding:F-R3-22` | per-variant search, grouping, provenance, configured bounds, and the no-fetchable-page variant hold (`research.test.ts`); `deriveResearchVariants` feeds empty suggestions, so a keyword-form query yields one variant, not multiple (`src/research.ts:28-30`; `src/expand.ts:24-35`); the response is never truncated per REQ-004 (F-R3-23) |
| REQ-020g | `finding:F-R3-15` | collapse, semantic ordering, and zero-weight ordering hold (`dedup.test.ts:16-77`); reconciliation runs after the `maxResults` slice with no top-up, so collapse can reduce distinct results below the requested maximum (`src/index.ts:509,:594-604`); contributing providers are not merged (F-R3-16); the no-embedding path returns input order (F-R3-17) |
| REQ-020h | `finding:F-R3-18` | external ordering, quality weights, zero weight, blocklist exclusion + count, case-insensitive subdomain matching hold (`source-quality.test.ts:30-74`; `dedup.test.ts:49-77`); KB-first recall returns before reconciliation and blend appends KB rows after ordering, so stored hits bypass the source-quality order (`src/index.ts:386-396,:609-610`) |
| REQ-020i | `finding:F-R3-5` | partial success, per-input status/provider, and batch error-on-all-fail hold (`batch-run.test.ts:22-75`); the all-fail envelope drops `meta.per_query` and the per-input errors (`src/batch.ts:239-241`); a deep element's ranked-passage count is read from the wrong field (F-R3-26) |
| REQ-124 | `finding:F-R3-13` | operators parse and stay ordinary text when malformed; unsupported operators are computed (`query.test.ts:6-26`; live `ignored_operators`/`ignored_params`); loss is reported in `meta.ignored_operators`, a sibling of the REQ-020d `meta.ignored_params`, and the KB-first path reports neither (`src/index.ts:675,:694`); branch tags and unrecognized-operator pass-through are unasserted (F-R3-11, F-R3-12) |
| REQ-127 | `finding:F-R3-28` | analysis shape, bounds, clusters-without-removal, timeline/undated, and in-process computation hold (`analysis.test.ts`; Arena `mcp-contract.test.ts:131-147`); analysis is attached with empty sections instead of omitted on zero-result paths (`src/index.ts:680,:697`); batch analysis reflects only the first query (F-R3-27) |
| REQ-128 | `finding:F-R3-20` | Unicode tokenization, Latin stability, n-gram segmentation, and language routing hold (`embed.test.ts:40-51`; `chain.test.ts:151-155`); only the serving provider's language reaches `ignored_params`, so providers in the chain that cannot honor the language are not reported (`src/chain.ts:34`; `src/index.ts:691`); the no-eligible-provider fallback is untested (F-R3-21) |
| REQ-028 | `finding:F-R3-24` | top-page fetch, REQ-021b ranking reuse, scores, span anchors, snippet fallback, and the page bound hold (`deep-search.test.ts:28-72`; `rerank.test.ts:40-72`); the whole deep branch is gated on `!compactMode`, so `deep:true` silently returns plain results under compact verbosity (`src/index.ts:618`); the unfetchable-page branch has no tag (F-R3-25) |
| §7.4 Priority Routing | `finding:F-R3-1` | privacy, free_only, and quality rows match `selectChain`, and privacy falls back to the task chain when empty (`chain.test.ts:21-53`); the explicit-provider precedence row is violated (live probe above); the speed tie-order clause is not honored (F-R3-2) |

#### R3 prose verdict table (2026-11-10, M1 reconciliation)

Recorded at the program close: the ownership table (`worklist.md:86`) assigns §1 goal 3 to R3, while R3's D28 recorded §7.4 only (`docs/plans/2026-11-09-full-review-r3/plan.md:33`). The row is written from R3's recorded REQ verdicts, not from a new review (F-M1-1).

| Surface | Verdict | Predicate |
|---|---|---|
| §1 goal 3 provider intelligence | `finding:F-R2-27` | capability, quota, and provider selection hold (`worklist.md:209` REQ-020a classification/override/quota demotion; `:211` REQ-020c priority routing; `:216` REQ-020h source quality); the latency leg now holds through the configurable strategy and time window (`src/latency.ts`; resolved 2026-11-11) |

### R4 — `fetch_page` (12)

`REQ-021` `REQ-021a` `REQ-021b` `REQ-021c` `REQ-021d` `REQ-021e` `REQ-021f`
`REQ-021g` `REQ-021h` `REQ-021i` `REQ-021j` `REQ-021k`

Spec: §4.3 (those IDs), §6.4.
Code: `src/fetch-fallback.ts`, `src/extract.ts`, `src/providers/jina.ts`,
`src/preservation.ts`, `src/modality.ts`, `src/http.ts`, `src/truncate.ts`,
`src/structured-fact.ts`, plus the `fetch_page` handler in `src/index.ts`.

**Phase 1 enumeration (2026-11-10).** 64 distinct implementation anchors
(`grep -n 'REQ-021'` across the 17 reviewed source files), spread across
clusters A–F; three clusters (B, C, D) need a loopback probe. D35 split:
**not triggered** (64 ≤ 120; 3 < 4 clusters). Tracker drift recorded:
`preservation.ts` (REQ-122) and `modality.ts` (REQ-026h) are R5-owned and read
as evidence only; `fetch-cache.ts`, `datetime.ts`, `lib/url-guard.ts`,
`lib/bot-challenge.ts`, `lib/html.ts`, `hedge.ts` are the reviewed R4 modules
the original code line omitted.

#### R4 verdict table (2026-11-10)

Reviewed at standard depth; split not triggered (64 anchors, 3 clusters probed). Evidence: 18 carrying test files / 229 tests PASS; Arena 37 tests PASS (new crawl regression); six fresh-context cluster reviews; outbound probe not run (D38 prefers deterministic replay).

| Surface | Verdict | Predicate |
|---|---|---|
| REQ-021 `fetch_page` | `finding:F-R4-F-1` | live schema carries every REQ-021 parameter and the array cap and the behavior half holds (hedge race with `hedge_grace_ms`, array concurrency, per-result provider); `renderer` advertises `jina` in prose but declares no schema default (`src/index.ts:1772`), and no gate asserts the G0 parameter contract (F-R4-F-2) |
| REQ-021a network-target safety | `finding:F-R4-A-1` | string guard and resolved guard refuse private/metadata targets, per-hop and per-redirect re-guard holds, opt-out and distinct `network_target_refused` live (`src/lib/url-guard.ts:97,193-205`; `src/index.ts:1011-1019`; Arena `:244`); only one semantic clause tag exists and the G3 detector cannot see REQ-021a's branch list (`url-guard.test.ts:1`; `clause-coverage.ts:23-34`) |
| REQ-021b question extraction | `finding:F-R4-D-1` | sentence splitting, ranking, scores, extraction mode, bands, and per-item retention hold (`rerank.test.ts`, `batch.test.ts:136`); the no-match/full-content branch omits `passages_returned` and `match_quality` (`src/index.ts:1362-1381`; `batch.ts:216`) |
| REQ-021c date detection | `finding:F-R4-C-2` | header/meta/jsonld/time-tag evidence with source and confidence, omit-when-absent hold (`datetime.ts:93-103`); `article:published_time`/`datePublished` are returned as `last_updated` with high confidence (`datetime.ts:39,64-65` → `index.ts:1327-1330`), a guess the REQ forbids |
| REQ-021d bounded crawl | `finding:F-R4-C-1` | per-hop and per-redirect guard, cap-stops-without-error hold; the crawl fed HTML-to-text output to `extractLinks`, so recursion never ran and only the start page returned (`src/index.ts:1071,1098`) — **fixed in-session** and covered by Arena `fetch_page crawl follows same-origin links`; outbound fetches still bound pages, not fetches (F-R4-C-8) |
| REQ-021e structured extraction | `finding:F-R4-C-11` | distinct `extracted` field, none-found note, non-mutation hold (`extract.ts:13-52`, `index.ts:1153-1166`); nested `itemscope` is flattened into the parent item (`extract.ts:38-45`) |
| REQ-021f anti-bot fall-through | `finding:F-R4-B-2` | challenge detection and chain fall-through implemented (`index.ts:849-859`, `bot-challenge.ts`); a page whose title merely contains "captcha" is a false positive because `/captcha/i` is a strong marker with no length guard (`bot-challenge.ts:15,59`), and the fall-through clause has no driving test (F-R4-B-3) |
| REQ-021g knowledge-base cache | `finding:F-R4-C-5` | fresh-copy-before-network, hit metadata, stale fall-through, configurable age hold (`index.ts:1020-1053`, `fetch-cache.ts:26-34`); a `question` request bypasses the cache entirely (`index.ts:1022`) |
| REQ-021h source fallback | `holds` | seven-way classification with 402-vs-403/451 split, DOI→open-access→archive ordering, metadata-only note, original-URL preservation, unsupported-protocol clause (`fetch-fallback.ts:62-266`; Arena `:545-625`); P3 gaps F-R4-B-6/B-7 recorded |
| REQ-021i structured facts | `finding:F-R4-E-1` | value/display, unit, source, property/key, status, facts-before-prose, no inference hold (`structured-fact.ts`; `structured-fact.test.ts`); `area` and `elevation` are absent from the classification signals so those queries never emit a fact (`task-type.ts:78-96`, `index.ts:1674`) |
| REQ-021j raw-text mode | `finding:F-R4-D-3` | plain unprefixed text, top passage in question mode, invalid-combination error hold (`structured-output.ts:120-155`, `index.ts:1811-1815`); the default non-question raw envelope omits `extraction_mode` and passage count (`index.ts:1384-1399`), and a JSON-array string bypasses the single-URL guard (F-R4-D-4) |
| REQ-021k batch item metadata | `holds` | each `meta.per_query` item names input, provider, status, `url` echo for HTTP(S), `passages_returned`, truncation state, alongside merged results (`batch.test.ts:255-299`; `batch.ts:195-236`); tag advisory F-R4-D-7 |
| §6.4 Jina Reader | `finding:F-R4-F-4` | endpoint `https://r.jina.ai/` matches (`providers/jina.ts:6`); the prose says fallback happens only on 429/error to native HTTP, contradicting REQ-021's race and REQ-021f's challenge fall-through (`infobroker.md:837-838`) |

### R5 — Corroboration and citations (15)

`REQ-026` `REQ-026a` `REQ-026b` `REQ-026c` `REQ-026d` `REQ-026e` `REQ-026f`
`REQ-026g` `REQ-026h` `REQ-121` `REQ-122` `REQ-123` `REQ-130` `REQ-027`
`REQ-027a`

Spec: §1 goal 4, §3 SR-008, §4.3 (those IDs), §5.5, §8.1–§8.3.
Code: `src/corroborate.ts`, `src/calibration.ts`, `src/source-family.ts`,
`src/cite.ts`, `src/bibtex.ts`, `src/preservation.ts`, `src/span.ts`,
`src/modality.ts`, `src/retrieval-benchmark.ts`,
`scripts/calibrate-confidence.ts`, `test-fixtures/{calibration,retrieval}`,
plus the `verify_claims`/`get_citations` handler regions in `src/index.ts`.
(`src/structured-fact.ts` is R4-owned and read as evidence only.)

**Phase 1 enumeration (2026-11-09).** 94 de-duplicated anchors across clusters
A–G; three clusters (A, C, D) are probe-dependent. D42 split:
**not triggered** (94 ≤ 120; 3 < 4 clusters). Tracker drift recorded:
the R5 `Code:` line omitted `preservation.ts`, `modality.ts`, `span.ts`,
`retrieval-benchmark.ts`, `scripts/calibrate-confidence.ts`, and both fixture
directories, and listed R4-owned `structured-fact.ts`; the `Spec:` line and
coverage row omitted §1 goal 4 and §3 SR-008; `worklist.md:282` (R6) still
lists `retrieval-benchmark.ts`. Correction happens at chunk close (step 21).

#### R5 verdict table (2026-11-09)

Reviewed at standard depth; split not triggered (94 anchors, 3 probe-dependent clusters). Evidence: 12 carrying test files / 165 tests PASS; Arena 3 files / 37 tests PASS; seven fresh-context cluster reviews; loopback probe not run in this session (the batch-shape legs are covered by `corroborate.test.ts:1098-1257`, and the plan permits `NOT_RUN` only for unservable legs — recorded as a process note in the AAR).

| Surface | Verdict | Predicate |
|---|---|---|
| REQ-026 `verify_claims` | `finding:F-R5-A-2` | G0 schema carries all six parameters with the stated defaults (`src/index.ts:1861-1868`); the confirmation gate is a fixed `confidence >= 0.5`, not `confidence_threshold`, so a 0.7 finding is reported `confirmed` at T=0.8 (`src/corroborate.ts:306-312`; `corroborate.test.ts:407-427`) while the tool description promises below-threshold findings are unverified (`src/index.ts:1861`) |
| REQ-026a source authority | `finding:F-R5-B-5` | weights configurable and applied (`src/corroborate.ts:538,376-378`; `config.json:340-352`); equal-count ordering proven at unit level (`corroborate.test.ts:191-209`), but no test drives `reconcileClaims`/`corroborate` with weights, so the wiring is static-only (D44) |
| REQ-026b claim attribution | `finding:F-R5-A-1` | per-source claim text and positive overlap hold (`src/corroborate.ts:216-228`); `jaccardSimilarity` keeps every token longer than two characters with no stopword filter, so a shared "the"/"and" attributes an unrelated page (`src/corroborate.ts:101-113`) |
| REQ-026c source preservation | `finding:F-R5-C-1` | archive reference, concurrency cap 4 and failure tolerance hold (`src/corroborate.ts:922-965`); the archive is gated on `corroboration.archive_sources`, not `preservation.enabled`, and ships false while preservation ships true (`src/corroborate.ts:793`; `config.json:336,420`) |
| REQ-026d provenance record | `finding:F-R5-C-6` | version, iteration limit, threshold, config hash and per-source fields present, dropped only in compact (`src/corroborate.ts:823-846`; `src/index.ts:1946`); per-source-type contribution is global across findings with no finding attribution (`src/corroborate.ts:803-809,833-843`) |
| REQ-026e KB recall | `finding:F-R5-D-1` | recall before external search, capped, original URLs, fail-open hold (`src/corroborate.ts:619-633`); KB hits are reconciled indistinguishably from external ones, so two KB hits can reach `confirmed` with no external source (`src/corroborate.ts:226-228,306-322`) |
| REQ-026f reconciliation | `holds` | clustering by similarity plus explicit conflict, contested with perspectives, never confirmed across conflict (`src/corroborate.ts:267-323`; `corroborate.test.ts:236-258,372-383`) |
| REQ-026g batch claims | `finding:F-R5-A-4` | order, collapse with all indices, unsourced-as-unverified, shared budget hold (`corroborate.test.ts:1098-1257`); the dual-input rejection, empty-list rejection and `max_batch_claims` bound live only in the handler and are untested (`src/index.ts:1900-1913`) |
| REQ-026h span and modality | `holds` | modality on every source, span omitted when unfound, configurable lexicon, score-neutral (`src/corroborate.ts:177-186`; `span.test.ts`, `modality.test.ts`, `corroborate.test.ts:1259-1309`) |
| REQ-121 source families | `finding:F-R5-B-1` | canonical URL, same-domain and near-duplicate long text collapse, threshold configurable (`src/source-family.ts:26-155`; `source-family.test.ts:8-44`); the 20-token gate means short republished snippets never collapse, and the test enshrines it (`src/source-family.ts:88-90`; `source-family.test.ts:34-40`) |
| REQ-122 snapshots | `finding:F-R5-C-3` | snippet/document basis, policy gate, byte bound and truncation reporting hold for `verify_claims` (`src/corroborate.ts:849-899`); the deep-reading path calls `snapshotSource` and discards the result, reporting no hash or freshness tier (`src/index.ts:647-655`). P0 F-R5-C-2 (basis mislabeled on fetch failure) fixed in-session |
| REQ-123 calibration | `finding:F-R5-B-3` | cap applies only to secondary-only findings; Brier and reliability exist over a committed gold set (`calibration.test.ts:6-34`; `scripts/calibrate-confidence.ts`); the disable path has no test and the tool ignores configured `secondary_only_cap` (`src/calibration.ts:39`; `scripts/calibrate-confidence.ts:71-75`) |
| REQ-130 retrieval benchmark | `finding:F-R5-F-1` | committed corpus, precision/recall/MRR/nDCG, determinism with fixed k=5, baseline floor at `npm run test`, distinct from the gold set (`src/retrieval-benchmark.ts:66-125`); `rankedUrls` swallows every reconciler error and scores the raw order, so a broken reconciler passes (`src/retrieval-benchmark.ts:99-106`) |
| REQ-027 `get_citations` | `holds` | G0 schema `query` required, `max_results` default 8 max 30 (`src/index.ts:2488-2491`); fields, `@misc` fallback, keyless chain (`src/cite.ts:90-102`; `src/bibtex.ts:43-54`; `cite.test.ts:225-235`) |
| REQ-027a source aggregation | `finding:F-R5-E-3` | chain sweep, per-provider status, DOI/title dedup, zero-result and exhaustion shapes hold (`src/cite.ts:141-204`; `src/index.ts:2512-2551`; Arena `:267-287`); compact verbosity drops `meta` and therefore the per-provider status and zero-result diagnostic (REQ-027a is unconditional) (`src/index.ts:2536-2551`) |

#### R5 prose verdict table (2026-11-09)

| Surface | Verdict | Predicate |
|---|---|---|
| §1 goal 4 truth by iteration | `holds` | multi-pass loop, agreement/contradiction, gap refinement (`infobroker.md:32` → `src/corroborate.ts:647-760,252-324`) |
| §3 SR-008 corroboration bounded | `holds` | `max_iterations` capped at 10 and the 30-call budget reserved before dispatch (`infobroker.md:92` → `src/corroborate.ts:528-531,638-642`) |
| §5.5 corroboration quality | `holds` | exits within `max_iterations`; schema/handler, provider-interface and chain-non-empty bullets are gate-backed (`typecheck`, `tool-surface.test.ts`, `config.json` chains) (`infobroker.md:765-775`) |
| §8.1 algorithm | `finding:F-R5-G-4` | seeding, phases, caps, three-source slice and synthesis match (`infobroker.md:914-992` → `src/corroborate.ts:601-704,774-791`); the agreement map's `red` is `confidence < 0.5`, the 0.5–threshold band is `yellow`, and unsourced findings are excluded rather than red (`:396-417,786-791`); contested findings also take the dominant cluster's confidence rather than `low` (F-R5-G-3) |
| §8.2 confidence scoring | `finding:F-R5-G-1` | ladder, threshold effect, authority scaling, similarity threshold and semantic grouping hold; the independence definition says "different registrable domains" while code counts source families by canonical URL and text overlap (`infobroker.md:1013-1015` → `src/corroborate.ts:350-367`; `src/source-family.ts:93-100`); the calibration cap is unmentioned (F-R5-G-2) |
| §8.3 iteration limits | `finding:F-R5-G-6` | defaults, caps, budget, first-pass bounds, concurrency and kb_recall match; `partial` is set whenever any finding is below threshold, not only when a limit is reached (`infobroker.md:1035` → `src/corroborate.ts:819-822`) |



### R6 — Knowledge base (29)

`REQ-060` `REQ-060a` `REQ-060b` `REQ-060c` `REQ-060d` `REQ-060e` `REQ-060f`
`REQ-060g` `REQ-060h` `REQ-060i` `REQ-064` `REQ-065` `REQ-066` `REQ-067`
`REQ-072` `REQ-074` `REQ-075` `REQ-076` `REQ-076a` `REQ-082` `REQ-083`
`REQ-084` `REQ-085` `REQ-086` `REQ-087` `REQ-108` `REQ-109` `REQ-110`
`REQ-103`

Spec: §4.9, §1 goal 6 (knowledge persistence).
Code: `src/kb*.ts`, `src/embed.ts`; the `manage_kb` registration/handler and the
auto-index call sites in `src/index.ts` (`:586,588,662,1095,1242,1333,1926`);
the `kb` block in `config.json` (`:393-418`).
(R5 owns `src/retrieval-benchmark.ts`; removed from this line at the R5
close, 2026-11-09.)

**Phase 1 enumeration (2026-11-09).** 86 distinct anchors (70 across nine
modules, 16 in `src/index.ts`); probe-dependent clusters B, C, E (3 < 4).
D50 split: **not triggered** (86 ≤ 120; 3 < 4 clusters). Detail:
`docs/plans/2026-11-09-full-review-r6/phase1-enumeration.md`. Tracker drift
recorded: the code line omits the `manage_kb` handler, auto-index hooks, and
the config `kb` block; the coverage row omits §1 goal 6; the R8 line names a
nonexistent `src/kb-hardening.ts`; the status board merges R6 and R7.

#### R6 verdict table (2026-11-09)

Reviewed at standard depth; split not triggered (86 anchors, 3 probe-dependent
clusters). Evidence: 20 carrying test files / 322 tests PASS; Arena 3 files /
37 tests PASS; isolated module probe (`/tmp/opencode/r6-probe-script/probe.ts`)
legs (a)–(d) and constrained-heap leg (g) PASS; cross-tool stdio probe
(`probe-cross.ts`) legs (e)–(f) PASS.

| Surface | Verdict | Predicate |
|---|---|---|
| REQ-060 `manage_kb` | `finding:F-R6-A-1` | live schema carries the nine-action enum and A/E envelope (`check-intent-citations.ts:165`, Arena); advertised `max_results` default 8/max 50 and the unconfigured/invalid-KB REQ-002 error are unasserted (`src/index.ts:2058-2060`) |
| REQ-060a search | `finding:F-R6-A-1` | fields/ranking and empty-store zero results hold (`kb.test.ts:261-279`; probe a); the advertised defaults are unasserted |
| REQ-060b ingest | `finding:F-R6-A-2` | chunks/receipt/destination hold (`kb.test.ts:300-311`; Arena; probe b); a caller `source_url` is discarded for text-only ingest (`src/index.ts:2236-2243`), and the receipt-only-KB/at-least-one-input branches are handler-only |
| REQ-060c stats | `finding:F-R6-A-4` | `chunk_count`/size/model/events asserted (`kb.test.ts:113-118`, `kb-sqlite.test.ts:89-95`); per-collection counts and `last_ingestion`-after-ingest unasserted |
| REQ-060d delete | `finding:F-R6-A-4` | count removal holds (`kb.test.ts:313-327`); "require at least one filter" static-only (`src/index.ts:2352-2354`) |
| REQ-060e list | `finding:F-R6-A-4` | presence asserted, newest-first order and `chunk_count` unasserted (`kb.test.ts:147-165`) |
| REQ-060f get | `finding:F-R6-A-4` | reassembly asserted with `toContain`, order and no-document error unasserted (`kb.test.ts:167-184`) |
| REQ-060g encryption | `holds` | keygen refusal, verify, backup, status, rekey tested (`kb-encryption-tools.test.ts:91-185`; `kb-claims.test.ts:263-274`); probe c shows status reachable while locked |
| REQ-060h claims | `finding:F-R6-A-5` | newest-first/filters/cap hold (`kb-claims.test.ts:167-195`); the tool-level locked-store error mapping is static-only (`src/index.ts:2065-2069`) |
| REQ-060i verify_report | `finding:F-R6-A-6` | verified/drift/unverifiable/missing demonstrated (`kb-report-receipt.test.ts:150-337`; probe d); `stale=true` and the document-basis source-absent branch unasserted |
| REQ-064 auto-index | `finding:F-R6-B-1` | observed by `src/kb-auto-index.test.ts` (toggle, synchronous return, deferred ingest, swallowed failure) and `debate-club/src/kb-auto-index.test.ts` (search, fetch, verify hooks) |
| REQ-065 collections | `finding:F-R6-B-2` | explicit>env>config>literal is distinguishable: the config default is `config-col` and an empty-string default reaches the literal tier (`kb.test.ts:237-258`) |
| REQ-066 expiry | `finding:F-R6-B-3` | startup removal, interval removal, tier-not-`source_type`, indefinite tiers, and no-error-event are asserted (`kb-hardening.test.ts:46-150`) |
| REQ-067 config | `finding:F-R6-B-4` | field list and numeric bounds hold; the absent-config error is asserted by `debate-club/src/kb-contract.test.ts:131-143`, the invalid-user-layer fallback by `src/config.test.ts:614-625`, and reload reaches the KB seam (`src/config.test.ts` KB reload describe; `debate-club/src/kb-contract.test.ts` reload test). REQ-067 now names the effective configuration and defers an invalid layer to REQ-113 |
| REQ-072 dedup | `finding:F-R6-B-5` | same-URL replacement holds (probe b); meaning-equivalence covers every content class within the same class and collection, the best match wins, a collapse records its basis as an event, and a match is refused when the bodies' identifying names, dates, or numbers differ (`src/kb.test.ts` dedup describe; `src/kb-dedup-bound.test.ts`; `resolveMeaningIdentity` and `chunkBody` in `src/kb.ts`; `identityTokens` in `src/embed.ts`) |
| REQ-083 reports | `finding:F-R6-B-6` | retention is `source_type`-guarded, so tier expiry keeps a report (`src/kb-hardening.test.ts` report-retention test), and receipt revisions are monotonic with a distinct predecessor (`src/kb-report-receipt.test.ts` revision-chain describe; `kbPutReportReceipt` in `src/kb.ts`) |
| REQ-087 source dates | `holds` | store/report/omit/preserve-on-reingest asserted (`kb.test.ts:199-220`) |
| REQ-074 freshness | `finding:F-R6-C-2` | tier labels only (`kb.test.ts:371-379`); decay/expiry and hot reload static-only |
| REQ-075 decay | `finding:F-R6-C-3` | score presence and ordering on equal freshness only (`kb.test.ts:67-73`); decay reduction and zero-decay exemption unasserted |
| REQ-076 KB-first | `finding:F-R6-C-4` | probe hit/miss and unit freshness fields; the below-threshold fall-through is now asserted (default mode reports `miss`) in `debate-club/src/kb-retrieval.test.ts`; the unconfigured-KB bypass stays static-only |
| REQ-076a blend | `finding:F-R6-C-6` | **Resolved 2026-11-10** — a blend keeps sub-threshold cached rows, the default mode still gates on the thresholds, and deep/research report `not_applicable` (`debate-club/src/kb-retrieval.test.ts`) |
| REQ-082 consistency | `holds` | earlier content stays retrievable and model change reconciles with an event (`kb.test.ts:76-111`; `kb-model.test.ts:63-112`) |
| REQ-103 local embedding | `finding:F-R6-C-7` | **Resolved 2026-11-10** — the degradation event carries a remediation naming the configured reference and fallback, and `stats` reports `model_available: false` (`src/kb-model.test.ts` Embedding-model degradation describe) |
| REQ-084 encryption | `finding:F-R6-D-3` | lock/refusal/secret-change/readable-when-disabled tested; handler refusal, `stats.encryption`, and key-source precedence static-only |
| REQ-085 preservation | `finding:F-R6-D-2` | newer legacy JSON refused byte-unchanged and unreadable path errors hold; the SQLite header now carries the format marker and a newer store is refused before any read-write open (`src/kb-sqlite.ts:32-71,105-131`) |
| REQ-086 transitions | `finding:F-R6-D-1` | enable/disable/rekey lossless for chunks/claims/receipts and event history; `resealAll` re-seals readable events and preserves unreadable ones (`src/kb-sqlite.ts:702-808,407-423`) |
| REQ-108 capacity | `finding:F-R6-E-1` | probe proves heap-bounded search/list/get/stats (49.4 MB store, 32 MB heap); corrupt live SQLite yields only a lock error with no backup/empty-store recovery (`src/kb.ts:416-424`) |
| REQ-109 claim ledger | `finding:F-R6-F-1` | rows/edges/retrieval time/sealing tested; every finding is now persisted, so an unsourced batch claim is a zero-edge record (`debate-club/src/kb-ledger.test.ts`), and the retrieval time lives in the sealed payload (empty clear column; D-096 covers a never-transitioned store) |
| REQ-110 receipts | `finding:F-R6-F-4` | manifest/digest/dedup/bounds/sealing tested; an unlabelled source is stamped with the ingest instant, so the manifest always carries a retrieval time (`src/kb-report-receipt.test.ts`) |

#### R6 prose verdict table (2026-11-09)

| Surface | Verdict | Predicate |
|---|---|---|
| §1 goal 6 knowledge persistence | `holds` | search results and fetched pages auto-index (`src/index.ts:586,588,1333`), `verify_claims` findings persist (`:1926`), KB-first retrieval replaces external search (probe e), and an unconfigured KB leaves search working (`isKbConfigured()` guard; probe f) |

### R7 — Client artifacts and reporting (17)

`REQ-050` `REQ-051` `REQ-052` `REQ-053` `REQ-054` `REQ-107` `REQ-088`
`REQ-114` `REQ-115` `REQ-117` `REQ-116` `REQ-125` `REQ-118` `REQ-119`
`REQ-120` `REQ-120a` `REQ-126`

Spec: §1 goal 5, §4.7, §10.2–10.3, App D (group 7).
Code: `instructions/search-preferences.md`, `skills/{infobroker,analysis-loop,summarization,technical-writing,proofreading,translation}/` (six `SKILL.md` files plus 16 reference files), `README.md`, `src/lib/report-{manifest,render,delta,export}.ts`, `src/lib/watchlist.ts`, `src/intent-citations.ts`, `scripts/{validate-readme,validate-report,render-report,check-report-fixtures,check-intent-citations,monitor-delta,monitor-watchlist}.ts`, `test-fixtures/reports/` (including `delta/`).
Reading list: 7 carrying tests (`report-contract`, `report-modality`, `report-render`, `monitor-delta`, `report-export`, `watchlist`, `intent-citations`) plus `scripts/monitor-watchlist.test.ts`; gates `validate-spec` (:576-760), `check-report-fixtures`, `check-intent-citations`, `validate-readme`, `check-skill-harness`.

#### R7 verdict table (2026-11-09)

Reviewed at standard depth; split not triggered (34 distinct anchors, 1 probe-dependent cluster E). Evidence: 7 carrying test files / 60 tests PASS plus the new `monitor-watchlist.test.ts` / 3 tests PASS; Arena 3 files / 37 tests PASS; offline probes (a)–(e) PASS.

| Surface | Verdict | Predicate |
|---|---|---|
| REQ-050 `search-preferences.md` | `finding:F-R7-A-1` | static: the file states KB-first recall, external fallback, and the `manage_kb` reservation (`instructions/search-preferences.md:17-22`); gate: `scripts/validate-spec.ts:580-585` asserts only a KB token and warns, so the content clauses can be deleted without failing |
| REQ-051 Orchestrator Skill | `finding:F-R7-A-2` | static: two pipelines, escalation, manifest, quality gate, and archive present (`skills/infobroker/SKILL.md:69-167`); gate: `validate-spec.ts:589-596` warns on the KB phase and errors only on a completion-token clause REQ-051 does not state |
| REQ-052 Bundled Skills | `holds` | static/gate: four pipeline skills referenced by name and `workflows.md` cited (`SKILL.md:83-102,150-158`; `validate-spec.ts:688-696`); P3 gate-presence note F-R7-B-6 |
| REQ-053 Pipeline Reference | `finding:F-R7-A-5` | static: five artifacts present; `journeys.md` maps intent and tools but not a recovery procedure per journey (`journeys.md:10-50`); gate checks presence + Mermaid only (`validate-spec.ts:699-709`, F-R7-A-6) |
| REQ-088 Gated-Analysis Selection | `finding:F-R7-B-2` | static/gate: eight techniques each with Fit/Method/Output and a selection mechanism (`techniques.md:30-139`; `SKILL.md:188-210`); no technique is mapped to a family and the gate counts headings (`validate-spec.ts:726-729`) |
| REQ-115 Confidence Model | `finding:F-R7-B-1` | test/gate: three labels, lexicon, and independent grades hold (`confidence.md:8-69`); the analysis skill assigns a fourth label, `No confidence` (`skills/analysis-loop/SKILL.md:180`) |
| REQ-114 Report Manifest | `finding:F-R7-C-5` | gate: fixtures reject shape, audience, placement, and confidence vocabulary; `manifest-likelihood` and `manifest-verdict` have no fixture or test (`report-manifest.ts:306-310`) |
| REQ-116 Report Quality Gate | `finding:F-R7-C-1` | test/gate: skeleton, unresolved citation, uncited finding, and attribution branches hold; `register-url` is emitted at `report-manifest.ts:413-415` with no fixture or asserting test |
| REQ-118 Provenance and Grading | `finding:F-R7-C-3` | test/gate: dates, grades, DOI, as-of, handling, and supersession hold; the `undeterminable` publication-date branch has no positive or negative fixture (`report-manifest.ts:438-440`) |
| REQ-119 Shape-Aware Contract | `finding:F-R7-C-2` | static/test: the Literature Review block is enforced; `SHAPE_BLOCKS["Fact-Check"]` is empty (`report-manifest.ts:136-137`) while `report-template.md:125-136` defines a verdict table, so a non-conforming Fact-Check report validates (`good-report.md`) |
| REQ-120 Delivery Verification | `finding:F-R7-D-1` | static/gate: re-verify-before-gate, batch claims, and post-translation ordering hold (`validate-spec.ts:597-606`); `pipeline-map.md:62` defines the TAIL without TRANSLATE, contradicting SKILL.md |
| REQ-120a Archive Tail | `finding:F-R7-D-2` | static/gate: ARCHIVE names sources and `meta.report_id` and gates the token (`validate-spec.ts:609-620`); `workflows.md:60-70` places ARCHIVE before POLISH/TRANSLATE/REVALIDATE |
| REQ-117 Monitoring Baseline/Delta | `finding:F-R7-E-1` | static: `report-delta.ts:24-85` is a pure Markdown diff — no receipt baseline, no `verify_report` revalidation, no source drift/unverifiable set; probe (a) confirms only id-set source diffing |
| REQ-125 Watchlist Runner | `finding:F-R7-E-4` | test: parse/due/diff hold (`src/lib/watchlist.test.ts`); a failed `verify_claims` was recorded `ok` — **fixed in-session** and covered by `scripts/monitor-watchlist.test.ts`; dry-run unobserved (F-R7-E-5) |
| REQ-126 Report Export | `finding:F-R7-F-2` | test/static: JSON/CSV/HTML coverage and field presence hold (`report-export.test.ts`); the library exports do not enforce validation and discard `validation.ok` (`report-export.ts:34-56`) |
| REQ-054 User Documentation | `finding:F-R7-G-3` | static/gate: setup, snippet, pipeline overview, and add-provider sections hold; the provider-enable instruction points at the shipped `config.json` instead of the user layer (`README.md:476-477` vs `:516-522`) |
| REQ-107 Routing Citations | `finding:F-R7-G-2` | gate: tool/operation resolution, coverage, and gate failure on unresolved hold; a renamed **bare** tool in a skill file is ignored (`intent-citations.ts:89-96`), so the acceptance criterion fails for that shape |

#### R7 prose verdict table (2026-11-09)

| Surface | Verdict | Predicate |
|---|---|---|
| §1 goal 5 writing pipeline | `holds` | `infobroker.md:33` matches the six shipped skills and the orchestrator routing (`SKILL.md:46-67`) |
| §10.2 client integration | `holds` | both snippets match the shipped entry points (`package.json:7-9,36`; `bin/infobroker.js:2`) |
| §10.3 what replaces what | `finding:F-R7-G-4` | `infobroker.md:1430` lists seven `manage_kb` actions but omits the live `claims` and `verify_report` (`src/index.ts:1980`) |
| Appendix D group 7 | `holds` | `infobroker.md:1788` lists exactly the 17 R7 REQs and gate G3 |

### R8 — Deployment, state, security (15)

`REQ-042` `REQ-043` `REQ-105` `REQ-111` `REQ-111a` `REQ-112` `REQ-113`
`REQ-091` `REQ-096` `REQ-097` `REQ-098` `REQ-099` `REQ-100` `REQ-101`
`REQ-102`

Spec: §2, §3 SR-002/SR-003/SR-007, §4.10, §4.11, §5.1–5.2, §5.4, §10.1, App E.
Code: `src/config-migrations.ts` (path/patch logic lives in `src/config.ts`),
`src/update-check.ts`, `src/state-health.ts`, `src/audit-log.ts`,
`src/content-policy.ts`, `src/call-log.ts`, `src/session-stats.ts`,
`src/lib/atomic-write.ts`, `src/lib/sanitize-error.ts`, `src/cooldown.ts`,
`src/quota.ts`, `src/key-pool.ts`, `src/kb-crypto.ts` and `src/kb-sqlite.ts`
(KB hardening: startup resilience, artifact predicates — read as key-material
and state-permission evidence), the notice/`spec`/migration/key-material
regions of `src/index.ts`, `scripts/validate-spec.ts`,
`scripts/lib/gate-manifest.ts`, `scripts/check-pack.ts`,
`scripts/check-shipped-kb-empty.ts`, `server.json`, `glama.json`, `.githooks/`.

#### R8 verdict table (2026-11-10)

Reviewed at deep depth; split **not triggered** (90 distinct anchors; two
probe-dependent clusters B and C, below the four-cluster threshold —
`docs/plans/2026-11-10-full-review-r8/phase1-enumeration.md`). Evidence:
15 carrying test files / 163 tests PASS; Arena 3 files / 37 tests PASS; committed
probe harness `docs/plans/2026-11-10-full-review-r8/probe.ts` with transcript
`probe-log.md` — legs a1, a2, b1, b2, c, d-available, d-current, e-flag,
e-block, e-off, f-audit, f-confinement, f-corrupt-state, g all PASS.

| Surface | Verdict | Predicate |
|---|---|---|
| REQ-042 Source Distribution | `holds` | gate: `check-shipped-kb-empty` asserts no KB directory/artifact and that `kb.storage_path` and `kb.reports_dir` resolve outside the tree; `check-pack` denylists `config.local.json`, `knowledge-base/`, and `.sqlite*`; quota state lives in `$TMPDIR` (§10.1) |
| REQ-043 Update Preservation | `finding:F-R8-A-1` | static: the user layer (XDG), KB store, reports, and quota all live outside the tree, but **no test simulates an update**; §2 F11's "G1 update-preservation tests guard the guarantee" has no carrier (searched `src/**/*.test.ts` for update/preservation assertions — none) |
| REQ-105 User-layer migration | `holds` | test: `src/config.test.ts:528` (migrate + backup), `:627` (auto-migrate at startup); `src/config-migrations.test.ts:91` (unknown keys retained), `:106-118` (atomic write + 0600 backup); probe:c, probe:g (version stamped, `kb.store_backend` removed, unknown key retained, backup written) |
| REQ-111 State health | `holds` | test: `src/state-health.test.ts:117-205` (record fields, notices, ordering, `config_invalid_startup`, `provider_cooldown`); probe:a1 (clean start, no `notices` key), probe:a2 (`config_key_unrecognized` on a tool response); initialization instructions emitted at `src/index.ts:1655`; computation is local-only |
| REQ-111a Call record | `finding:F-R8-C-1` | test: `src/call-log.test.ts:51` (no query/content), `:69,:85` (0600), `:116` (rotation); `src/session-stats.test.ts:26-35` (session summary counts); probe:a2 shows a notice on a response, but **no test or probe drives a provider cooldown to the response-level notice** — that clause is static-only |
| REQ-112 Update check | `holds` | test: `src/update-check.test.ts:63` (no request when disabled), `:95` (fresh cache short-circuits), status mapping; probe:d-available, probe:d-current report through `state_health.update` from a pre-seeded cache; live fetch `NOT_RUN` per D73 |
| REQ-113 Invalid user layer | `holds` | test: `src/config.test.ts:573` (invalid layer → shipped defaults, no write), `:583`, `:597`; probe:b1 (layer byte-identical, failure reported), probe:b2 (corrected `reload_config` activates) |
| REQ-091 Registry distribution | `holds` (live `NOT_RUN`) | gate: `scripts/validate-spec.ts:842-869` asserts `server.json`/`glama.json` presence and version parity with `package.json`, stdio transport; `check-pack`; publication itself `NOT_RUN` per D73 |
| REQ-096 Security model | `finding:F-R8-D-1` | gate: `scripts/validate-spec.ts:923-945` asserts §E, both OWASP mappings, and a reference to each security REQ; the "security requirement traceable to a gate" clause is not asserted — the check is reference presence, not gate traceability |
| REQ-097 Content policy | `holds` | test: `src/content-policy.test.ts` clause tags `policy-flag`, `policy-strict`, `policy-external-fallback` (modes, audit write, external fallback); probe:e-flag (`content_policy:{flagged,mode}`), probe:e-block (`content_policy_flagged` error), probe:e-off |
| REQ-098 Audit trail | `holds` | test: `src/audit-log.test.ts:48` (timestamped, 0600), `:62` (append-only), `:74` (control-character forging), `:85` (write failure never blocks); probe:f-audit (7 events, mode 0600). Restart survival rests on append semantics, not a restart test (noted) |
| REQ-099 Key confinement | `finding:F-R8-F-2` | test: `src/kb-encryption-tools.test.ts:171` (outside `keys_dir` refused), probe:f-confinement (refusal, nothing created); the "designated directory SHALL be created with owner-only permissions when absent" clause has no assertion |
| REQ-100 State-file hardening | `finding:F-R8-F-1` | test: `src/key-pool.test.ts:92` (0700 state dir), `:105` (malformed state reset), `src/quota.test.ts:26,:41` (poisoned counters reset); probe:f-corrupt-state. The "refuse to read or write state in a directory it does not own" branch exists (`src/key-pool.ts:63`) but is untested |
| REQ-101 Dependency gate | `holds` | gate: `scripts/validate-spec.ts:947-970` asserts the `audit` gate exists in the manifest and runs from `check`; `scripts/lib/gate-manifest.ts` |
| REQ-102 Exceptional hygiene | `holds` | test: `src/lib/sanitize-error.test.ts` (absolute paths, stack frames, credential shapes, ordinary messages); Arena negative paths; probe:f-confinement returns a redacted path |

#### R8 prose verdict table (2026-11-10)

| Surface | Verdict | Predicate |
|---|---|---|
| §2 F1–F10, F12 | `holds` | each failure mode names a mitigation that exists in code (chain advance, normalizer, G0 gate, quota skip, iteration cap, KB recovery, config validation); drift-report found no contradiction |
| §2 F11 Update overwrites user state | `finding:F-R8-A-1` | the mitigation claim is true structurally (paths outside the tree) but its "G1 update-preservation tests guard the guarantee" sentence is false — no such test exists |
| §3 SR-002 Single user | `holds` | stdio transport, no auth surface, owner-only state (`src/index.ts` entry, REQ-100 gates) |
| §3 SR-003 Keys never surfaced | `holds` | config/health/errors expose names only (R2 evidence F-R2-7); key material read by path and never returned (`src/kb-crypto.ts`) |
| §3 SR-007 Quota persists | `holds` | `src/quota.test.ts:56` (valid counters preserved), state path in `$TMPDIR` (§10.1) |
| §5.1 Language/runtime | `holds` | TypeScript, Node 24+, `tsx` entry, zod, undici — matches `package.json` |
| §5.2 Layered architecture | `holds` | tool layer, provider map, KB layer, and the inline `native_fetch` note match the code |
| §5.4 Build phases | `holds` | phases 1–9 are all present, including generated auth reference and the KB phase; `validate-spec` gates item 7's artifact |
| §10.1 Project files | `holds` | shipped inventory matches the tree; user-owned inventory matches REQ-043 paths, including `call-log.jsonl` |
| Appendix E | `holds` | trust boundary, threat actors, both OWASP mappings, residual risks present; `validate-spec:923-945` gates them |

### R9 — Spec integrity and tool quality (9)

`REQ-055` `REQ-077` `REQ-078` `REQ-080` `REQ-081` `REQ-089` `REQ-090`
`REQ-092` `REQ-106`

Spec: §1 preamble and North Star, §3 SR-011/SR-012, §3 Terminology, §4.3 (089/090/092/106), §4.8, §9.1–9.5, App B–C.
Code: `src/tdqs.ts`, `src/clause-coverage.ts`, `src/lib/feature-taxonomy.ts`,
`src/intent-citations.ts` (evidence only — REQ-107 is R7's), `src/tool-surface.test.ts`
(there is no `src/tool-surface.ts`), the tool-registration literals and the
`spec`-action token-footprint region of `src/index.ts`, `scripts/validate-spec.ts`,
`scripts/check-tdqs.ts`, `scripts/check-intent-citations.ts`,
`scripts/check-gate-coverage.ts`, `scripts/check-gate-table.ts`, and
`debate-club/src/mcp-contract.test.ts` (carries REQ-081).

#### R9 verdict table (2026-11-10)

Reviewed at standard depth; split **not triggered** (34 distinct code anchors —
below the 120 threshold — and zero probe-dependent clusters, since every REQ
resolves to a gate, a test, or a file-presence artifact). Evidence: baseline
`npm run check` PASS (full, 51.7 s); carrying tests 5 files / 56 tests PASS;
Arena 3 files / 37 tests PASS; `check:fast` PASS (19.7 s); TDQS report over the
seven live tools.

| Surface | Verdict | Predicate |
|---|---|---|
| REQ-055 Spec-code traceability | `finding:F-R9-A-1` | gate: `scripts/validate-spec.ts:128-155` (every §4 REQ cited, artifact/meta/waiver aware), `:161-176` (every `src/` file cited), `:321-370` (clause guard); the guard delegates to `src/clause-coverage.ts:68-73`, which passes any REQ with ≥2 tags whenever it has ≥2 "or" branches — a REQ with three or more branches passes on two tags, while AGENTS.md requires one tag per branch |
| REQ-077 REQ manifest | `holds` | gate: `scripts/validate-spec.ts:427-457` asserts both directions (body→manifest, manifest→body) and `:464` resolves every REQ token in the spec to the manifest |
| REQ-078 Feature taxonomy | `finding:F-R9-C-1` | gate: `scripts/validate-spec.ts:534-555` asserts presence only — every tool and every REQ appears, but "exactly one feature area" is not asserted, and the §D gate column is unchecked: group 6 claims `G0` (`infobroker.md:1787`) while its REQs carry G0+G1 and G1+G3 (`:1211-1214`). The README link is gated (`scripts/validate-readme.ts:412`) |
| REQ-080 Tool default consistency | `finding:F-R9-C-2` | gate: `scripts/validate-spec.ts:764-800` — check A scans `config.X ?? <digit>` in four files only; check B reconciles exactly two defaults (`search_web` and `manage_kb` `max_results`). `fetch_page.max_length` (`src/index.ts:1773`), `verify_claims.max_iterations`/`confidence_threshold` (`:1865-1866`), and `get_citations.max_results` (`:2490`) are unverified, and no config-vs-tool limit pair beyond `max_results` is reconciled |
| REQ-081 Token footprint | `finding:F-R9-C-3` | live: `src/index.ts:1596-1618` derives `tool_schema_bytes` from the live registration and `median_response_bytes` from the bounded `responseBytes` window (`:82,150-160`); Arena `debate-club/src/mcp-contract.test.ts:386-391` asserts only presence, `>0`, and `>=0` — the "derived … rather than static literals" clause is unasserted, so a hardcoded number would pass |
| REQ-089 Tool-definition quality | `finding:F-R9-B-3` | gate: `scripts/validate-spec.ts:809-838` and live test `src/tool-surface.test.ts:140-205` assert purpose, when-to/when-not plus an alternative, `[OK]`/`[ERROR]`, annotation presence, parameter descriptions, and coupling notes; descriptions do disclose state effects, external calls, rate limits, auth, and destructive operations (e.g. `src/index.ts:1707,1824,1978`), but no assertion exercises the REQ's behavioral-consequence clause — the evidence is static-only |
| REQ-090 Tool naming convention | `holds` | live test: `src/tool-surface.test.ts:120-137` asserts the seven-slug surface, the `verb_noun` shape, and a known operation verb; the static gate (`scripts/validate-spec.ts:812-820`) keys every block on `infobroker_<slug>` |
| REQ-092 Tool-definition quality bar | `finding:F-R9-B-3` | gate: the conformance gate **exists** (`scripts/validate-spec.ts:803-840` static bar + `scripts/check-tdqs.ts` structural layer) and fails on a departing definition; what it enforces is the structural subset of the REQ-089 bar, so the quality-bar clause is co-extensive with F-R9-B-3 |
| REQ-106 TDQS 1.2 conformance | `finding:F-R9-B-1` | gate: `scripts/check-tdqs.ts:118-135` reports per-tool `invocationCost`, `definitionBytes`, `schemaDescriptionCoverage`, depth, and unions, and gates structural violations; **no server-side report** of parameter counts, description coverage, invocation cost, or definition size exists — `inspect_providers spec` reports tool-schema bytes and median response only (`src/index.ts:1613-1618`), and `paramCount` (`src/tdqs.ts:270`) is computed but never emitted |
| REQ-106 TDQS 1.2 conformance | `finding:F-R9-B-2` | gate: the annotation-contradiction branch is report-only — `src/tdqs.ts:424-438` labels the candidates as heuristic and `scripts/check-tdqs.ts:134` fails only on `structuralViolations`, so a description that contradicts its annotations passes the gate although the REQ places that clause inside the layer the gate SHALL enforce |

#### R9 prose verdict table (2026-11-10)

| Surface | Verdict | Predicate |
|---|---|---|
| §1 preamble and North Star | `holds` | goal-by-goal evidence is in the closed chunks (R2 goals 1–2, R3 goal 3, R5 goal 4, R6 goal 6, R7 goal 5); the North Star's "doesn't collect secrets, cultivate sources, or pick sides" matches the provider-tier and audit model (R8); no drift found |
| §3 SR-011 Contracts, not implementations | `holds` | the rule's own tests are enforced partly mechanically (parameter types, standalone `Default:`, backtick catalogues, `REQ-body hygiene` at `scripts/validate-spec.ts:200-320`) and partly by review; the text claims gate enforcement only for "a verification gate catches a deviation", which holds |
| §3 SR-012 Red-team every REQ | `holds` | self-describing authoring discipline that explicitly attaches no `_Check:_`; the spec does not claim a mechanical carrier, so no contradiction |
| §3 Terminology | `holds` | spot-checked the load-bearing terms: provider status maps to `REQ-013` (R2), freshness tier and chunk to `REQ-060`/`REQ-065` (R6), verdict and agreement map to `REQ-026`/§8.2 (R5), routing priority to `REQ-020c` (R3); no stale definition found |
| §9.1 G0 MCP conformance | `holds` | handshake, `tools/list`, and `tools/call` are exercised live by `src/structured-output.test.ts:180-225`, `src/tool-surface.test.ts:84-104`, and `debate-club/src/client.ts:146-152`; invalid params return `invalid_input` envelopes (`debate-club/src/mcp-contract.test.ts:163,340,352,634`); protocol negotiation is SDK-provided by `McpServer` and observed by every handshake |
| §9.2 G1 integration tests | `holds` | every named scenario resolves to a carrying test or gate; the fixture bullet matches `scripts/push-pipeline.sh:982` and `test-fixtures/fixtures-meta.json` (90-day cadence). The update-preservation bullet has no carrier, but that is F-R8-A-1's (R8, open) and is not re-filed (D80) |
| §9.3 G2 live smoke tests | `finding:F-R9-D-2` | prose: the section advertises live endpoint runs with key-skip semantics, but no shipped script or package task implements G2 (searched `scripts/`, `package.json`, and the gate manifest — `check-fixtures` is the only live-adjacent task); the section is marked optional, so this is informational |
| §9.4 G3 spec validation gate | `holds` | every named gate exists in `scripts/lib/gate-manifest.ts` (`validate-spec` `:41`, `check-tdqs` `:73`, `check-intent-citations` `:78`, `check-gate-coverage` `:90`, `check-gate-table` `:135`) and `check-gate-table` reconciles the AGENTS table; the REQ-053/051/052 artifact checks are implemented in `validate-spec` |
| §9.5 REQ Manifest | `holds` | the table's own integrity is gated bidirectionally (`scripts/validate-spec.ts:427-464`); a manifest-table defect that violated REQ-077 would be filed there (D84), and none was found |
| Appendix B REQ authoring conventions | `holds` | the stated mechanical limits are exactly the ones `scripts/validate-spec.ts:200-320` enforces (800 chars, 8 sentences, 8 SHALL, one paragraph, 5 backticks, ID form, no standalone `Default:`), and the judgment dimensions are warnings as the appendix says |
| Appendix C SDD discipline | `finding:F-R9-D-1` | the preamble claims "every rule is enforceable by G3 (§9.4)", but C.4 (update-after-change), C.9 (release discipline), and C.10 (CHANGELOG/REQ provenance) have no G3 carrier — `scripts/validate-spec.ts` never reads `CHANGELOG.md`, and C.9 is enforced by the push pipeline instead; the preamble overstates G3's reach |


### M1 — Machine evidence

No REQ ownership. Runs the full suite, `check-pack`, debate-club Arena, TDQS,
intent citations, report fixtures, and the fixture-freshness check; records exit
status and any new evidence.

#### M1 machine-evidence record (2026-11-10)

HEAD `deab019`, version 2026.11.7, tree clean except this increment's directory.
Gating legs are exit-status evidence; informational legs record their parsed
result because their exit code is always 0.

| Leg | Status | Result |
|---|---|---|
| `npm run check` (full) | **exit 0**, 51.2 s | 22 gates PASS; `vitest` 106 files / 1101 tests; Arena 3 / 37; `check-pack` 358 files; `audit` exit 0 with 4 low advisories |
| `npm run check-pack` | exit 0 | 358 files, 392746 bytes, 7 tools |
| `npm run test-debate-club` | exit 0 | 3 files / 37 tests |
| `npm run audit` | exit 0 | 4 low-severity advisories (no high/critical) |
| `npm run check-tdqs -- --report` | informational | 7 tools, 0 shadow candidates, 0 contradiction candidates, 0 violations |
| `npm run check-gate-coverage -- --report` | informational | 118 G1 REQs: 117 cited, 1 exempt, 0 waived, 0 uncovered |
| `npm run check-fixtures -- --now=2026-11-10` | informational | 8 fixtures, 0 stale (max 78 days of a 90-day cadence) |
| Other fast gates (inside the full run) | exit 0 each | typecheck, version-sync, validate-spec, validate-readme, check-roadmap, check-non-goals, check-report-fixtures, check-script-discipline, check-tdqs, check-intent-citations, check-harness-expectations, check-gate-coverage, check-skill-harness, test, test-push-pipeline, check-shipped-kb-empty, check-gate-table, check-loop-artifacts, typecheck:scripts — the runner stops at the first failure, so completing the run proves each exited 0 |

#### M1 reconciliation (2026-11-10)

| Check | Result |
|---|---|
| §4 REQ verdict rows | 143 rows over **142 distinct IDs**; 0 missing from the §9.5 manifest, 0 extra. `REQ-106` carries two rows by design. One qualified cell, `REQ-091` = `holds` (live `NOT_RUN`), is the recorded live-publication caveat, not a gap |
| Finding closure | 272 register rows, 272 distinct IDs; all **119** `finding:<ID>` citations in verdict tables resolve to a register row |
| Severity census | P0 4 (all `Resolved`), P1 81, P2 97, P3 90 |
| Disposition census | `Resolved` 10, `Scheduled-roadmap` 168, `Closed-P3` 93, `Deferred-R1` 1; 0 `Deferred-by-user` |
| Open P0 | **0** |
| Prose units | 22/22 ownership units now carry a row (the §1 goal 3 row was added at this close, F-M1-1); every chunk `Spec:` line's sections are represented by a prose row or that chunk's REQ rows |
| Roadmap mapping | 74 rows name their ID in a `ROADMAP.md` section; 42 (R2 27 + R3 15) are covered only by that section's chunk-register trigger; 52 (R4 18, R5 27 + 1 malformed, R6 6) have no roadmap home — census recorded under F-M1-2. `F-R5-B-8` was unparseable (unescaped pipe characters inside its formula) and was repaired |
| Chunk closure | R1–R9 closed with verdict tables, register blocks, and terminal AAR tokens; M1 closed by this record |

## Status board

| Chunk | Spec | REQs | Status | Next trigger |
|---|---|---|---|---|
| R1 | §3 SR-009, §4.1, §6.1–6.2 | 6 | **closed 2026-11-09** | R2 |
| R2 | §4.2, §4.3 (024 family), §4.4–4.6, §5.3, §6.3, §7.1–7.3, App A | 25 | **closed 2026-11-09** | R3 |
| R3 | §4.3 (020 family, 124, 127, 128, 028), §7.4 | 14 | **closed 2026-11-09** | R4 |
| R4 | §4.3 (021 family), §6.4 | 12 | **closed 2026-11-10** | R5 |
| R5 | §1 goal 4, §3 SR-008, §4.3 (026 family, 121–123, 130, 027), §5.5, §8.1–8.3 | 15 | **closed 2026-11-09** | R6 |
| R6 | §1 goal 6, §4.9 | 29 | **closed 2026-11-09** | R7 |
| R7 | §1 goal 5, §4.7, §10.2–10.3, App D | 17 | **closed 2026-11-09** | R8 |
| R8 | §2, §4.10–4.11, §5.1–5.2, §5.4, §10.1, App E | 15 | **closed 2026-11-10** | R9 |
| R9 | §1 preamble/North Star, §3 SR-011/SR-012, §3 terminology, §4.3 (089/090/092/106), §4.8, §9, App B–C | 9 | **closed 2026-11-10** | M1 |
| M1 | all | — | **closed 2026-11-10** | — (program closed; roadmap item retired) |

## Finding register

Empty at program start. Each chunk appends its rows here when it closes; the
AAR carries the terminal disposition and the roadmap entry names the scheduled
work.

| ID | Chunk | Predicate | Severity | Disposition |
|---|---|---|---|---|
| F-R1-1 | R1 | Compact verbosity applies only through `ok()`; `fetch_page`, `inspect_providers`, `manage_kb`, `reload_config` bypass it (`src/index.ts:103`, `:1142`–`:1390`, `:1490`–`:1590`, `:2046`–`:2290`) | P1 | **Resolved 2026-11-09** — `compactEnvelope` at `finalizeToolResult` |
| F-R1-2 | R1 | KB cache-hit truncation sets `truncated: true` with no `output_path`, full file, or in-band note (`src/index.ts:1037`) | P1 | **Resolved 2026-11-09** — `cacheHitPayload` |
| F-R1-3 | R1 | Invalid normalized results consume the requested `max_results`; `.slice(0, maxResults)` after `normalize` (`src/index.ts:505`) | P1 | **Resolved 2026-11-09** — `requestLimit` headroom |
| F-R2-1 | R2 | A non-object `providers` value in the user layer crashes startup with a raw `TypeError` before validation (`src/config.ts:223,325`) | P0 | **Resolved 2026-11-09** — shape guard in `applyDefaults`, recovery wraps `loadConfigFromDisk`, regression test |
| F-R2-2 | R2 | `reload_config` patch merges over the startup layer snapshot, overwriting an external edit made while running (`src/config.ts:308`) | P1 | **Resolved 2026-11-11** — patch and migration read the on-disk layer (`config.ts:285`, `:352`); every write backs up the bytes read via `backupBytes` (`lib/atomic-write.ts:76`); `null` in a patch removes a key, which is the config-level unset route (D-099); fresh-read, backup, and removal tests in `config-patch.test.ts` and `config-migrations.test.ts` |
| F-R2-3 | R2 | `auth_env`/`url_env`/`auth_optional` types are unvalidated; a non-string `auth_env` throws in `getDispatchChain` (`src/config.ts:1025`) | P1 | **Resolved 2026-11-11** — three shape rules in `validateConfig` (`config.ts`, `auth_env`/`url_env` non-empty string, `auth_optional` boolean, `null` rejected); message names slug and field only; 12 rejection cases, recovery, reload, and no-leak tests |
| F-R2-4 | R2 | REQ-010 defaults-inheritance and update-preservation clauses have no asserting test (`src/config.ts:319-331`) | P2 | `Closed-P3` |
| F-R2-5 | R2 | REQ-037 "missing required provider fields" rejection branch is untested (`src/config.ts:385-415`) | P2 | `Closed-P3` |
| F-R2-6 | R2 | REQ-040 invalid-reload retention unasserted; the test only expects a throw (`src/config.test.ts:593`) | P2 | `Closed-P3` |
| F-R2-7 | R2 | REQ-011 citation asserts `server.json` env-var names only; no leak/optional-key/missing-key assertion (`src/server-manifest.test.ts:51-62`) | P2 | **Resolved 2026-11-11** — spawned key-safety suite (`src/key-safety-action.test.ts`) asserts the missing-key (`no_api_key`) and optional-key rows, a rejected-pool row with the F-R2-9 shape, and a sentinel sweep over responses, audit/call logs, config layers, and key-pool state |
| F-R2-8 | R2 | REQ-104 pool is advertised for every required-auth tier but honored only by keyed providers; CORE/generic_http read one variable (`src/config.ts:1025-1030`; `src/providers/core.ts:10-14`) | P1 | **Resolved 2026-11-10** — pool lookup by declared env name; CORE and generic_http rotate per request and record 401/403/429 (`config.test.ts`, `core.test.ts`, `generic-http.test.ts`) |
| F-R2-9 | R2 | An exhausted key pool is still reported `active`/`auth_ok: true` (`src/index.ts:1410-1420`) | P2 | **Resolved 2026-11-11** — an all-unusable declared pool reports `inactive` + `credentials_unavailable`, and `key_pool` appears for a single unavailable key (`src/provider-status.ts`; `src/key-pool.ts:250-263`; `provider-status.test.ts`) |
| F-R2-10 | R2 | REQ-104 restart-persistence test only reloads malformed state, never a valid rejection/cooldown (`src/key-pool.test.ts:83-113`) | P3 | `Closed-P3` |
| F-R2-11 | R2 | REQ-104's three WHEN branches carry no clause tags (`src/key-pool.test.ts:1`) | P3 | `Closed-P3` |
| F-R2-12 | R2 | REQ-129 `requires_account` derives from tier only; CORE (required key) is documented `none` (`src/privacy.ts:47`) | P1 | **Resolved 2026-11-11** — derives from the declared credential with the tier as fallback; CORE documents `required` (`src/privacy.ts:40-51`; `skills/infobroker/references/provider-privacy.md:10`; `privacy.test.ts`) |
| F-R2-13 | R2 | REQ-129 posture `unknown` is reachable only for `retains_query` (`src/privacy.ts:46`) | P3 | `Closed-P3` |
| F-R2-14 | R2 | `verify_claims.providers` bypasses the disabled-provider rule (`src/corroborate.ts:566-571`) | P1 | **Resolved 2026-11-10** — the explicit list is filtered by the shared predicate; an all-unusable list is `invalid_input` (`corroborate.test.ts`) |
| F-R2-15 | R2 | Disabled-provider exclusion has no test for dispatch or `search_web` (`src/config.ts:1023`; `src/index.ts:417-421`) | P2 | **Resolved 2026-11-11** — `getDispatchChain` omits a config-disabled provider and a spawned `search_web` makes zero outbound calls to it while the enabled chain-mate serves (`src/config.test.ts`; `src/dispatch-orchestration.test.ts`) |
| F-R2-16 | R2 | REQ-014 "added without source changes" is never tested end-to-end (`src/config.test.ts:175-191`, `:301-306`) | P3 | `Closed-P3` |
| F-R2-17 | R2 | REQ-071 identifier literal is duplicated in three places and caller-overridable (`src/providers/duckduckgo.ts:83`; `src/corroborate.ts:933`; `src/lib/url-guard.ts:190`) | P3 | `Closed-P3` |
| F-R2-18 | R2 | Credential-pool variables are absent from `server.json` and `provider-auth.md` (`server.json:21-45`) | P3 | `Closed-P3` |
| F-R2-19 | R2 | REQ-013 `inactive` legs carry no tag or test; `degraded`(partial results) has no producer (`src/health-status.ts:19-41`; `health-status.test.ts:28-37`) | P1 | **Resolved 2026-11-11** — five branch tags and tests at the assessment boundary; the provider-reported leg replaces partial results (D-100); probe wiring stays § R2c-ii |
| F-R2-20 | R2 | `status:"active"` filter returns rows whose reported status is `degraded` (`src/index.ts:1458-1471`) | P1 | **Resolved 2026-11-11** — `selectActiveRows` filters on the reported status; spawned quota-seeded test goes red on the old filter (`src/provider-status.ts:79-83`; `provider-list.test.ts`) |
| F-R2-21 | R2 | REQ-024a's four non-active reasons are unasserted (`src/index.ts:1417-1421`) | P2 | **Resolved 2026-11-11** — all five non-active reasons asserted in the assessment table (`provider-status.test.ts` describes "assessProvider (REQ-013)") |
| F-R2-22 | R2 | `inspect_providers` health probes a config-disabled provider and can report it active (`src/index.ts:1520-1533`) | P1 | **Resolved 2026-11-11** — the probe gate is `isOperational` plus a registered target, so a disabled provider is never probed; the report is `inactive` + `inactive_reason: "disabled"` (`src/config.ts:1127-1145`; `src/provider-health.ts`; `provider-health-action.test.ts`) |
| F-R2-23 | R2 | REQ-024b `last_error`/`last_success` are untested and process-local (`src/index.ts:1567-1572`) | P2 | **Resolved 2026-11-11** — history extracted to `src/provider-history.ts` with a reset seam and asserted end-to-end through a loopback stub; REQ-024b now says "since server start" (`provider-history.test.ts`; `provider-health.test.ts`; `provider-health-action.test.ts`) |
| F-R2-24 | R2 | REQ-024c `total_requests_served` counts provider samples, not server requests (`src/index.ts:1626`) | P1 | **Resolved 2026-11-11** — `toolMetrics.totalCalls()` counts tool requests; the spec action reports it and provider samples no longer leak in (`src/tool-metrics.ts:56-59`; `provider-health-action.test.ts`) |
| F-R2-25 | R2 | `last_spec_review` reports server boot time (`src/index.ts:67,1633`) | P3 | `Closed-P3` |
| F-R2-26 | R2 | REQ-034's citation stubs the predicate; the 0.8 boundary, `quota_warning`, and 100% skip are unasserted (`src/chain.test.ts:84-97`) | P2 | **Resolved 2026-11-11** — 79/80/100 are asserted against the real predicate and a provider at 100% receives zero outbound calls while a healthy mate serves (`src/quota.test.ts`; `src/dispatch-orchestration.test.ts`). The row's `quota_warning`-unasserted clause was stale: `provider-list.test.ts:122` already asserts it |
| F-R2-27 | R2 | REQ-036 implements a count window only; no configurable strategy or time window (`src/latency.ts:15,29-33`) | P1 | **Resolved 2026-11-11** — `output.latency_window_strategy` (count/time/both) and `latency_window_ms` are declared, validated, and applied on both the write and read paths; an idle read drops aged samples (`src/latency.ts`; `src/config.ts`; `latency.test.ts`; `config.test.ts`) |
| F-R2-28 | R2 | Retries bypass the per-provider throttle; `throttle()` sits outside `retryWithBackoff` (`src/index.ts:492-509`) | P1 | **Resolved 2026-11-10** — throttle inside the retried closure at all five sites, outside the timeout race (`corroborate.test.ts`, `cite.test.ts`, Arena) |
| F-R2-29 | R2 | An explicit `provider` is prepended before the auth filter (`src/index.ts:415-416`) | P1 | **Resolved 2026-11-10** — the prepend is gated on the shared predicate; an unauthenticated explicit provider falls through per REQ-020a (Arena) |
| F-R2-30 | R2 | A fully quota-exhausted chain returns empty success, not exhaustion (`src/index.ts:478-490` → `:773`) | P1 | **Resolved 2026-11-11** — the quota skip sets `lastError`, so a fully spent chain and an exhausted-plus-empty chain return `all_providers_exhausted` with `quota_exhausted`; an all-empty chain still returns `no_results: true` (`src/index.ts`; `src/dispatch-orchestration.test.ts`) |
| F-R2-31 | R2 | Timeouts are not retryable, so REQ-035's transient-failure leg is not honored (`src/retry.ts:60-66`) | P1 | **Resolved 2026-11-10** — `TimeoutError` is retryable (`retry.test.ts`) |
| F-R2-32 | R2 | Quota writes are debounced 30 s with a `beforeExit` flush only; SIGTERM/SIGINT loses the window (`src/quota.ts:32,83-99`) | P1 | **Resolved 2026-11-11** — one-shot SIGTERM/SIGINT handlers flush, remove themselves, and re-raise the signal; a spawned test asserts the increment is on disk after both signals (`src/quota.ts`; `quota.test.ts`) |
| F-R2-33 | R2 | Quota reset applies a 30 s grace and has no reset test (`src/quota.ts:113-115`) | P2 | **Resolved 2026-11-11** — the grace is removed and the reset is exact; tests pin one second either side for the daily and monthly legs (`src/quota.ts`; `quota.test.ts`) |
| F-R2-34 | R2 | A rate-limited `fetch_page` omits `retry_after_ms` (`src/fetch-fallback.ts:139-144`) | P1 | **Resolved 2026-11-11** — the taxonomy derives the field from the live cooldown registry and both `fetch_page` call sites merge it into `details` (`src/fetch-fallback.ts`; `src/index.ts`; `fetch-fallback.test.ts`) |
| F-R2-35 | R2 | Dispatch orchestration (hedge switch, cross-task order, all-empty vs all-error, cooldown skip) has no integration test | P2 | **Resolved 2026-11-11** — spawned suite covers hedge on/off, cross-task order, all-error vs all-empty, and a cooldown skip with zero new outbound calls (`src/dispatch-orchestration.test.ts`) |
| F-R2-36 | R2 | The financial chain has no economic-indicator source; `world_bank` queries Documents & Reports (`src/providers/world_bank.ts:7`) | P1 | `Scheduled-roadmap` |
| F-R2-37 | R2 | REQ-095 citations overstate coverage (routing and zero-config unasserted) (`src/providers/github.test.ts:1`) | P3 | `Closed-P3` |
| F-R2-38 | R2 | §5.3 declares `rateLimit` on the provider interface (unimplemented), widens capability/health unions, and claims `web_search` serves `general_web` contrary to static dispatch (`infobroker.md:731,750-751`) | P1 | `Scheduled-roadmap` |
| F-R2-39 | R2 | §6.3 DuckDuckGo "3s minimum interval" vs 4 s + jitter in config (`infobroker.md:807` → `config.json:12`) | P3 | `Closed-P3` |
| F-R2-40 | R2 | §7.3 ">80%" vs the code's ≥80% demotion boundary (`infobroker.md:889` → `src/quota.ts:193`) | P3 | `Closed-P3` |
| F-R2-41 | R2 | §A.5 says SearXNG gives "Full privacy" while config and the generated reference mark it third-party forwarding (`infobroker.md:1495`) | P1 | `Scheduled-roadmap` |
| F-R2-42 | R2 | §A.5 says the client POSTs `/search`; the module issues GET (`src/providers/searxng.ts:22`) | P3 | `Closed-P3` |
| F-R2-43 | R2 | The catalog omits the configured, enabled `native_fetch` provider (`config.json:235-242`) | P3 | `Closed-P3` |
| F-R2-44 | R2 | Tracker drift: the R2 spec column omitted §4.3 and the R8 code line named a nonexistent `src/config-path.ts` (`worklist.md:200,224`) | P3 | **Resolved 2026-11-09** |
| F-R2-45 | R2 | `quota_remaining` serializes as `null` for uncapped providers (`src/quota.ts:196,201`) | P3 | `Closed-P3` |
| F-R2-46 | R2 | `resells` is overloaded between `original_source` (D-034) and the privacy surface (`config.json:116,125,134`) | P3 | `Closed-P3` |
| F-R2-47 | R2 | Key-pool state uses a 32-bit FNV-1a identifier (`src/key-pool.ts:132-143`); state-file threat model is R8's | P3 | `Closed-P3` |
| F-R2-48 | R2 | A failed reload clears the startup issue, so `state_health.startup_error` stops reporting the fallback (`src/config.ts:170`); R8 surface | P3 | `Closed-P3` |
| F-R3-1 | R3 | An explicit `provider` is discarded by `priority:"privacy"`/`"free_only"` — live probe asked `marginalia` + `privacy` and was served by `duckduckgo` (`src/index.ts:415-429`; `src/chain.ts:45-62`) | P1 | `Scheduled-roadmap` |
| F-R3-2 | R3 | The `speed` comparator returns `1` when both latencies are zero, so unmeasured providers do not retain configuration order and the comparator is not antisymmetric (`src/chain.ts:63-70`) | P2 | `Scheduled-roadmap` |
| F-R3-3 | R3 | The KB-first success path returns before task-type resolution and query parsing, omitting `task_type`, `ignored_params`, and `ignored_operators` (`src/index.ts:388-396` vs `:408,:443,:671,:675`) | P1 | `Scheduled-roadmap` |
| F-R3-4 | R3 | `safe_search:"strict"` is silently dropped by providers without safe-search support but never listed in `ignored_params` (`src/chain.ts:31`) | P3 | `Closed-P3` |
| F-R3-5 | R3 | The all-fail batch envelope returns only `firstError` with no `meta.per_query` and no per-input errors (`src/batch.ts:239-241`) | P1 | `Scheduled-roadmap` |
| F-R3-6 | R3 | Suggest-mode behavior (relatedness order, fallback to a second suggestion provider, all-fail error) has no test; the only citation is `embed.test.ts:1` (`src/index.ts:269-293`) | P2 | `Closed-P3` |
| F-R3-7 | R3 | Suggest and expand results carry `url:""` instead of omitting the URL field (`src/index.ts:286,:313`) | P3 | `Closed-P3` |
| F-R3-8 | R3 | Suggest failure reports hardcoded `provider:"duckduckgo"` and `fallback_used:false` regardless of the actual fallback (`src/index.ts:287,:293`) | P3 | `Closed-P3` |
| F-R3-9 | R3 | Expand reports `provider:"duckduckgo"` regardless of which suggestion provider served (`src/index.ts:312`) | P3 | `Closed-P3` |
| F-R3-10 | R3 | Expansion relatedness ordering is unasserted; the test covers membership, first-element retention, and the cap only (`src/expand.ts:49-54`; `expand.test.ts`) | P2 | `Closed-P3` |
| F-R3-11 | R3 | REQ-124's ignored-operator and unrecognized-operator branches carry no named clause tags (`src/query.test.ts:1`) | P3 | `Closed-P3` |
| F-R3-12 | R3 | An unrecognized operator's pass-through as ordinary text is unasserted; the test covers malformed operators only (`src/query.test.ts:15-20`; `src/query.ts:37-38`) | P3 | `Closed-P3` |
| F-R3-13 | R3 | Operator loss is reported in `meta.ignored_operators`, a sibling of the REQ-020d `meta.ignored_params`; the REQ does not name a separate key (`src/index.ts:675,:694`) | P3 | `Closed-P3` |
| F-R3-14 | R3 | Batch input capping and duplicate collapsing silently shorten the caller's array without reporting it (`src/batch.ts:73`; `src/index.ts:250`) | P3 | `Closed-P3` |
| F-R3-15 | R3 | Reconciliation runs after the `maxResults` slice with no top-up, so content collapse can reduce distinct results below the caller's requested maximum (`src/index.ts:509,:594-604`) | P1 | `Scheduled-roadmap` |
| F-R3-16 | R3 | `mergeProvenance` never merges the contributing provider slugs; the representative keeps one `provider` string (`src/dedup.ts:17-21`; `src/types.ts:37`) | P1 | `Scheduled-roadmap` |
| F-R3-17 | R3 | With no embedding capability the reconciler returns input order unranked rather than a non-semantic ranking (`src/dedup.ts:44-49`) | P2 | `Scheduled-roadmap` |
| F-R3-18 | R3 | KB-first recall returns before reconciliation and blend appends KB rows after ordering, so stored hits bypass source-quality ordering (`src/index.ts:386-396,:609-610`) | P1 | `Scheduled-roadmap` |
| F-R3-19 | R3 | An invalid source-quality pattern is ignored but unasserted; the test covers a malformed URL only (`src/source-quality.ts:10-17`) | P3 | `Closed-P3` |
| F-R3-20 | R3 | Only the serving provider's language reaches `ignored_params`; providers in the chain that cannot honor the language are not reported (`src/chain.ts:34`; `src/index.ts:691`) | P2 | `Scheduled-roadmap` |
| F-R3-21 | R3 | The no-eligible-language-provider fallback has no test and no clause tag (`src/chain.ts:116`) | P2 | `Closed-P3` |
| F-R3-22 | R3 | `deriveResearchVariants` feeds empty suggestions, so a keyword-form query yields one variant instead of multiple (`src/research.ts:28-30`; `src/expand.ts:24-35`) | P1 | `Scheduled-roadmap` |
| F-R3-23 | R3 | The `search_web` response, including the research compile, is never subject to REQ-004 truncation; `maybeTruncate` runs only on fetched content (`src/index.ts:871,:1284`) | P1 | `Scheduled-roadmap` |
| F-R3-24 | R3 | The whole deep-reading branch is gated on `!compactMode`, so `deep:true` (and research's deep pass) silently returns plain results under compact verbosity (`src/index.ts:618`) | P1 | `Scheduled-roadmap` |
| F-R3-25 | R3 | The REQ-028 unfetchable-page branch has no named clause tag (`src/deep-search.test.ts:1`) | P3 | `Closed-P3` |
| F-R3-26 | R3 | A deep batch element's ranked-passage count is read from top-level `snippets`, which `search_web` deep never sets, so `per_query.passages_returned` is absent (`src/batch.ts:203`; `src/deep-search.ts:12`) | P2 | `Scheduled-roadmap` |
| F-R3-27 | R3 | Batch analysis is carried from the first successful query only, so it describes a subset of the merged results (`src/batch.ts:289`) | P2 | `Scheduled-roadmap` |
| F-R3-28 | R3 | Analysis is attached with empty sections instead of omitted when the result set is empty after policy refusal or blocklist filtering (`src/index.ts:680,:697`) | P1 | `Scheduled-roadmap` |
| F-R3-29 | R3 | Topic/entity ordering and cluster-retention assertions are weaker than REQ-127; the cluster test cannot detect a dropped result (`analysis.test.ts:44-73`) | P3 | `Closed-P3` |
| F-R3-30 | R3 | `analysis.enabled` is configured and validated but read nowhere; setting it false does not disable analysis (outside REQ-127's letter) (`config.json:290`; `src/config.ts:870`) | P3 | `Closed-P3` |
| F-R4-A-1 | R4 | REQ-021a's branch list has only one semantic clause tag and `clause-coverage.ts` cannot see unparenthesized or-lists (`src/lib/url-guard.test.ts:1`; `src/clause-coverage.ts:23-34`) | P1 | `Scheduled-roadmap` |
| F-R4-A-2 | R4 | The resolved-address guard runs only on the native path; a non-native renderer receives a hostname that passed the string check (`src/index.ts:840,1011`) | P2 | `Scheduled-roadmap` |
| F-R4-A-3 | R4 | The configurable hop cap has no end-to-end assertion; `url-guard.test.ts:164` passes a literal and no test checks `src/index.ts:834` plumbing | P2 | `Scheduled-roadmap` |
| F-R4-A-4 | R4 | The hedge branch catches a primary error and returns null, so a hedged native refusal can lose the distinct refusal code (`src/index.ts:912-920`) | P3 | `Closed-P3` |
| F-R4-A-5 | R4 | `src/http.ts` is an unguarded fetch primitive; safety depends on callers (`src/http.ts:12-55`) | P3 | `Closed-P3` |
| F-R4-B-1 | R4 | Once the hedge deadline fires, every renderer runs and none is cancelled; losers keep spending quota and recording stats (`src/index.ts:913-916`; `src/hedge.ts:100-103`) | P2 | `Scheduled-roadmap` |
| F-R4-B-2 | R4 | `/captcha/i` is a strong title marker with no length guard, so an article titled "...CAPTCHA..." is discarded as anti-bot (`src/lib/bot-challenge.ts:15,59`) | P1 | `Scheduled-roadmap` |
| F-R4-B-3 | R4 | REQ-021f's "continue to the next renderer" clause has no driving test; the green gate covers detection only (`src/lib/bot-challenge.test.ts:1`) | P2 | `Scheduled-roadmap` |
| F-R4-B-4 | R4 | The hedge deadline timer is never cleared when the primary wins (`src/index.ts:905`) | P3 | `Closed-P3` |
| F-R4-B-5 | R4 | A JSON-encoded array longer than five is silently truncated with no per-input record (`src/batch.ts:47-49,73`) | P3 | `Closed-P3` |
| F-R4-B-6 | R4 | A challenge served as HTTP 403 through native_fetch is classified `access_restricted`, not `anti_bot` (`src/index.ts:852`; `src/fetch-fallback.ts:62-71`) | P3 | `Closed-P3` |
| F-R4-B-7 | R4 | The `anti_bot`, connectivity, and unknown classification branches carry no named clause tag (`src/fetch-fallback.ts:1`) | P3 | `Closed-P3` |
| F-R4-C-1 | R4 | The crawl fed HTML-to-text output to `extractLinks`, so recursion never ran and a crawl returned only the start page (`src/index.ts:1071,1098`) | **P0** | **Resolved 2026-11-10** — raw HTML is fetched for link discovery; Arena crawl regression added |
| F-R4-C-2 | R4 | `article:published_time`/`datePublished` are emitted as `last_updated` with high confidence (`src/datetime.ts:39,64-65` → `src/index.ts:1327-1330`) | P1 | `Scheduled-roadmap` |
| F-R4-C-3 | R4 | REQ-021d's page-cap, depth-cap, and per-hop-guard clauses had no driving test; the citation exercised helpers only (`src/extract.test.ts:1,37-49`) | P2 | `Scheduled-roadmap` |
| F-R4-C-4 | R4 | `detect_date` is ignored on the crawl and extract paths, which return before the date is computed (`src/index.ts:1105,1155` vs `:1327`) | P2 | `Scheduled-roadmap` |
| F-R4-C-5 | R4 | A `question` request bypasses a fresh KB copy though the cache holds the same text (`src/index.ts:1022`) | P2 | `Scheduled-roadmap` |
| F-R4-C-6 | R4 | Metadata date detection is skipped when HEAD redirects or returns 405, so meta/jsonld/time-tag evidence is not consulted (`src/index.ts:791`) | P2 | `Scheduled-roadmap` |
| F-R4-C-7 | R4 | Date detection is on by default and issues its own HEAD plus a second GET, so a plain fetch costs three outbound requests (`config.json:266`; `src/index.ts:780-803`) | P3 | `Closed-P3` |
| F-R4-C-8 | R4 | The page cap bounds returned pages, not outbound fetches; refused/unfetchable hops do not consume the cap (`src/index.ts:1065,1081-1086`) | P2 | `Scheduled-roadmap` |
| F-R4-C-9 | R4 | Crawl and extract use a raw `text.slice` instead of `maybeTruncate`, so truncation metadata is absent (REQ-004) (`src/index.ts:1092,1163`) | P2 | `Scheduled-roadmap` |
| F-R4-C-10 | R4 | REQ-021d/021e/021g branch tests carry bare tags with no named clause tag (`src/extract.test.ts:1`; `src/fetch-cache.test.ts:1`) | P2 | `Scheduled-roadmap` |
| F-R4-C-11 | R4 | Nested microdata is flattened into the parent item, misattributing properties (`src/extract.ts:38-45`) | P2 | `Scheduled-roadmap` |
| F-R4-C-12 | R4 | `detect_date:false` still returns a cached date on a cache hit (`src/index.ts:1030-1032`) | P3 | `Closed-P3` |
| F-R4-C-13 | R4 | Crawl page titles are the hostname, so pages from one origin are indistinguishable (`src/index.ts:1091,1095`) | P3 | `Closed-P3` |
| F-R4-C-14 | R4 | Microdata keeps only the first value per property and drops link-valued properties (`src/extract.ts:43-44`) | P3 | `Closed-P3` |
| F-R4-D-1 | R4 | The no-match/full-content response omits `passages_returned` and `match_quality` (`src/index.ts:1362-1381`; `src/batch.ts:216`) | P1 | `Scheduled-roadmap` |
| F-R4-D-2 | R4 | Two no-match tests assert vacuously (`ranked.length >= 0`, `top.length <= 1`) and never assert the empty result (`src/rerank.test.ts:44-60`) | P2 | `Scheduled-roadmap` |
| F-R4-D-3 | R4 | The default non-question raw envelope omits `extraction_mode` and passage count though REQ-021j requires them in `structuredContent` (`src/index.ts:1384-1399,1814`) | P1 | `Scheduled-roadmap` |
| F-R4-D-4 | R4 | `rawRequestError` checks `Array.isArray` before the JSON-array string is coerced, so a stringified array runs as a batch in raw mode (`src/structured-output.ts:120-125` vs `src/index.ts:967,976`) | P2 | `Scheduled-roadmap` |
| F-R4-D-5 | R4 | No test drives a successful raw fetch through the handler; the plain-text test uses a synthetic envelope (`src/structured-output.test.ts:86-100,200-228`) | P2 | `Scheduled-roadmap` |
| F-R4-D-6 | R4 | The no-match note is shared with unreadable content, conflating two REQ-021b cases (`src/index.ts:1373`) | P3 | `Closed-P3` |
| F-R4-D-7 | R4 | The batch truncation test sits outside the REQ-021k tagged block (`src/batch.test.ts:225-239`) | P3 | `Closed-P3` |
| F-R4-E-1 | R4 | `area` and `elevation` are absent from the `structured_fact` signals, so those measurable attributes never classify and emit no fact (`src/task-type.ts:78-96`; `src/index.ts:1674`) | P1 | `Scheduled-roadmap` |
| F-R4-E-2 | R4 | The fact source names only `wikidata`/`wikipedia`; an infobox-derived and a table-derived fact are indistinguishable (`src/structured-fact.ts:356-373`) | P2 | `Scheduled-roadmap` |
| F-R4-E-3 | R4 | Status-branch tags are missing and `clause-coverage.ts` registers only the token immediately after the REQ ID (`src/structured-fact.test.ts:1`; `src/clause-coverage.ts:39-52`) | P2 | `Scheduled-roadmap` |
| F-R4-E-4 | R4 | The classification clause is untagged in `task-type.test.ts:55-67` and no test asserts classify→enrich end-to-end (`src/structured-fact.test.ts:462-477` sets the type by hand) | P2 | `Scheduled-roadmap` |
| F-R4-E-5 | R4 | Wikipedia facts never carry `as_of`; only Wikidata P585 does (`src/structured-fact.ts:323-364` vs `:208-213`) | P3 | `Closed-P3` |
| F-R4-E-6 | R4 | Array queries are exempt from structured-fact enrichment (`src/index.ts:1664`) | P3 | `Closed-P3` |
| F-R4-F-1 | R4 | `renderer` advertises `jina` in prose but declares no schema default (`src/index.ts:1772` vs `infobroker.md:268`) | P1 | `Scheduled-roadmap` |
| F-R4-F-2 | R4 | `tool-surface.test.ts` checks descriptions and `outputSchema` but never the REQ-021 parameter set, defaults, or array cap (`src/tool-surface.test.ts:173-210`) | P2 | `Scheduled-roadmap` |
| F-R4-F-3 | R4 | REQ-021's G0 parameter enumeration omits the advertised `raw` parameter that REQ-021j mandates (`infobroker.md:268`; `src/index.ts:1780`) | P2 | `Scheduled-roadmap` |
| F-R4-F-4 | R4 | §6.4 says fallback happens only on Jina 429/error to native HTTP, contradicting the race and challenge fall-through (`infobroker.md:837-838`) | P1 | `Scheduled-roadmap` |
| F-R4-F-5 | R4 | The `url` array branch has `.max(5)` but no `.min(1)`, so `url: []` is schema-valid (`src/index.ts:1771`) | P3 | `Closed-P3` |

| F-R5-A-1 | R5 | `jaccardSimilarity` keeps every token longer than two characters with no stopword filter, so a shared "the"/"and" attributes an unrelated result to a claim, violating REQ-026b's unrelated-SHALL-NOT clause (`src/corroborate.ts:101-113,225-228`) | P1 | `Scheduled-roadmap` |
| F-R5-A-2 | R5 | The confirmation gate is a fixed `confidence >= 0.5`, not `confidence_threshold`; a 0.7 finding is reported `confirmed` at T=0.8 while the tool description promises below-threshold findings are unverified (`src/corroborate.ts:306-312`; `src/index.ts:1861`; `corroborate.test.ts:407-427`) | P1 | `Scheduled-roadmap` |
| F-R5-A-3 | R5 | `priority:"privacy"` replaces a caller's `providers` allowlist with the privacy chain (re-admitting non-operational providers); `priority:"quality"` is a no-op (`src/corroborate.ts:447-449,566-570`) | P2 | `Scheduled-roadmap` |
| F-R5-A-4 | R5 | REQ-026g's dual-input rejection, empty-list rejection and `max_batch_claims` bound live only in the handler and are untested (`src/index.ts:1900-1913`) | P2 | `Scheduled-roadmap` |
| F-R5-A-5 | R5 | Agreement-map classification has no positive test (green at/above threshold, yellow in the 0.5–threshold band) (`src/corroborate.ts:406-414`) | P2 | `Scheduled-roadmap` |
| F-R5-A-6 | R5 | Clause tags missing for REQ-026b's unrelated-SHALL-NOT leg and REQ-026g's dual-input/config-bound legs (`corroborate.test.ts:1,1061-1069`) | P3 | `Closed-P3` |
| F-R5-A-7 | R5 | Paraphrase grouping is evidenced only by high lexical overlap; no synonym-level paraphrase case (`src/corroborate.ts:270-286`) | P3 | `Closed-P3` |
| F-R5-A-8 | R5 | `src/corroborate.ts:1` header omits `REQ-026f` though the file implements reconciliation (`src/corroborate.ts:1` vs `corroborate.test.ts:1`) | P3 | `Closed-P3` |
| F-R5-B-1 | R5 | The 20-token gate means short republished snippets never collapse into one family, and the test enshrines the non-collapse despite REQ-121's "republish substantially the same text" (`src/source-family.ts:88-90,132-138`; `source-family.test.ts:34-40`) | P1 | `Scheduled-roadmap` |
| F-R5-B-2 | R5 | Named clause tags absent for REQ-121's canonical-URL/near-duplicate legs, REQ-123's cap/measure/disable legs and REQ-026a's authoritative-vs-generic leg (`source-family.test.ts:1`; `calibration.test.ts:1`; `corroborate.test.ts:1`) | P3 | `Closed-P3` |
| F-R5-B-3 | R5 | REQ-123's disableability clause is untested: nothing asserts `capConfidence(...,{enabled:false})` or that config `calibration.enabled:false` reaches a finding (`src/calibration.ts:39`; `calibration.test.ts:5-34`) | P2 | `Scheduled-roadmap` |
| F-R5-B-4 | R5 | REQ-121's "each finding SHALL report its family count" is static-only: `family_count` is written and spread but never asserted on a finding (`src/corroborate.ts:259,779-783`) | P2 | `Scheduled-roadmap` |
| F-R5-B-5 | R5 | Authority weights and calibration options are never exercised through `reconcileClaims`; a mis-wired argument at any of the four call sites would pass the suite (`corroborate.test.ts:128-384`; `src/corroborate.ts:538-544,628,695,745`) | P2 | `Scheduled-roadmap` |
| F-R5-B-6 | R5 | The calibration tool hardcodes `{enabled:true}` and never reads `secondary_only_cap`, so its Brier score and curve can diverge from the server's configured correction (`scripts/calibrate-confidence.ts:71-75`; `config.json:339`) | P2 | `Scheduled-roadmap` |
| F-R5-B-7 | R5 | The calibration measurement never runs in a gate: no `calibrat*` package script and no calibration gate in the manifest (`package.json`; `scripts/lib/gate-manifest.ts`) | P3 | `Closed-P3` |
| F-R5-B-8 | R5 | `textSimilarity` divides by the smaller token set (asymmetric containment), so a snippet contained in a long article merges into that article's family (`src/source-family.ts:69-76`) | P2 | `Scheduled-roadmap` |
| F-R5-B-9 | R5 | Shipped `web_search:0.7` turns the two-family base 0.7 into 0.49, below the confirm gate, contradicting the §8.2 ladder example and untested at reconcile level (`src/corroborate.ts:371-378`; `config.json:351`) | P2 | `Scheduled-roadmap` |
| F-R5-B-10 | R5 | `family_similarity_threshold` configurability is unproven: the only explicit pass is the default 0.9 (`source-family.test.ts:19`) | P2 | `Scheduled-roadmap` |
| F-R5-B-11 | R5 | `reliabilityCurve` bands are half-open and `brierScore([])` returns 0, presenting no data as perfect calibration (`src/calibration.ts:45-72`) | P3 | `Closed-P3` |
| F-R5-B-12 | R5 | Per-family authority uses only the first source's `source_type`, so an untyped first member neutralizes a typed family (`src/corroborate.ts:350-365`) | P3 | `Closed-P3` |
| F-R5-C-1 | R5 | Archiving is gated on `corroboration.archive_sources` instead of `preservation.enabled`; shipped preservation-on plus archive-off means the preservation-enabled default never archives (`src/corroborate.ts:793`; `config.json:336,420`) | P1 | `Scheduled-roadmap` |
| F-R5-C-2 | R5 | Snapshot basis was chosen by whether a fetcher existed, not whether the fetch succeeded, so a failed fetch stored the snippet while reporting `basis:"document"` (`src/corroborate.ts:866-886`) | **P0** | **Resolved 2026-11-09** — basis follows the stored text; regression test `REQ-122 snippet-basis-on-fetch-failure` |
| F-R5-C-3 | R5 | Deep reading calls `snapshotSource` and discards the result, reporting neither snapshot hash nor freshness tier alongside the live URL (`src/index.ts:647-655`) | P1 | `Scheduled-roadmap` |
| F-R5-C-4 | R5 | Sources with a pre-existing `content_sha256` are skipped: no snapshot stored and no basis/truncation fields, so a hash can appear without a graded snapshot (`src/corroborate.ts:859`) | P2 | `Scheduled-roadmap` |
| F-R5-C-5 | R5 | `provenance.sources[]` omits `snapshot_tier` although REQ-122 requires the freshness tier alongside the live URL (`src/corroborate.ts:833-843`) | P2 | `Scheduled-roadmap` |
| F-R5-C-6 | R5 | Per-source-type contribution is global across findings and the flat `provenance.sources[]` carries no finding index (`src/corroborate.ts:803-809,833-843`) | P2 | `Scheduled-roadmap` |
| F-R5-C-7 | R5 | REQ-122's document-vs-snippet and truncated-copy branches carry no named clause tags (`preservation.test.ts:1`) | P2 | `Scheduled-roadmap` |
| F-R5-C-8 | R5 | Archive and snapshot are awaited inline, so preservation can delay the response (`src/corroborate.ts:793-799,922-923`) | P2 | `Scheduled-roadmap` |
| F-R5-C-9 | R5 | A test named "does not archive when source preservation is disabled" never disables preservation; it only omits `archive_sources` (`corroborate.test.ts:683-707`) | P3 | `Closed-P3` |
| F-R5-D-1 | R5 | KB recalls are reconciled indistinguishably from external sources, so two KB hits can reach `confirmed` with no external corroboration, violating REQ-026e's KB-alone clause (`src/corroborate.ts:619-633,226-228,306-322`) | P1 | `Scheduled-roadmap` |
| F-R5-D-2 | R5 | The KB-alone test is tautological: `providers_used` never contains KB slugs, and no KB-only finding is exercised (`corroborate.test.ts:848-869`) | P2 | `Scheduled-roadmap` |
| F-R5-D-3 | R5 | REQ-026e's uninitialized/disabled/failing branches carry no named clause tags (`corroborate.test.ts:1`) | P3 | `Closed-P3` |
| F-R5-D-4 | R5 | The KB result cap is untested (no assertion on the `kbSearch` limit or truncation) (`corroborate.test.ts:468-486`) | P2 | `Scheduled-roadmap` |
| F-R5-D-5 | R5 | KB original-source-URL propagation is asserted only by count, never by value (`corroborate.test.ts:484-485,866-868`) | P2 | `Scheduled-roadmap` |
| F-R5-D-6 | R5 | Recall-before-external-search ordering has no assertion; a reorder would pass (`corroborate.test.ts:468-486`) | P2 | `Scheduled-roadmap` |
| F-R5-D-7 | R5 | The failing-KB `catch` is never exercised (`src/corroborate.ts:629-631`) | P2 | `Scheduled-roadmap` |
| F-R5-E-1 | R5 | The academic chain is truncated to `output.fallback_depth`, so providers past that index are neither attempted nor reported (`src/cite.ts:148`; `config.json:358`) | P2 | `Scheduled-roadmap` |
| F-R5-E-2 | R5 | Dedup namespaces are disjoint (`doi:` vs `title:`), so a DOI-bearing and a title-only reference for the same work never merge (`src/cite.ts:115-139`) | P2 | `Scheduled-roadmap` |
| F-R5-E-3 | R5 | Compact verbosity drops `meta`, removing the per-provider status and the zero-result provider list that REQ-027a requires unconditionally (`src/index.ts:2536-2551`) | P1 | `Scheduled-roadmap` |
| F-R5-E-4 | R5 | REQ-027a's zero-result and all-exhausted branches carry no named clause tags (`cite.test.ts:1`) | P2 | `Scheduled-roadmap` |
| F-R5-E-5 | R5 | `escapeLatex` escapes the braces of its own `\textbackslash{}` replacement, rendering an extra `{}` (`src/bibtex.ts:14-18`) | P3 | `Closed-P3` |
| F-R5-E-6 | R5 | CORE carries the academic capability but is absent from the academic dispatch chain (`config.json:101-108` vs `:251`) | P3 | `Closed-P3` |
| F-R5-E-7 | R5 | `allFailed` is true when every provider is skipped, so `all_providers_exhausted` is reported where nothing was attempted (`src/cite.ts:194-195`) | P3 | `Closed-P3` |
| F-R5-F-1 | R5 | `rankedUrls` swallows every reconciler error and scores the raw order, so a broken reconciler passes the suite (`src/retrieval-benchmark.ts:99-106`) | P2 | `Scheduled-roadmap` |
| F-R5-F-2 | R5 | The regression floor compares only the four reconciled aggregates; `baseline.raw`, `cases`, `version` and `k` are recorded but unchecked (`src/retrieval-benchmark.test.ts:61-66`) | P2 | `Scheduled-roadmap` |
| F-R5-F-3 | R5 | `precision_at_k` divides by `min(returned,k)` rather than `k`, inflating precision for short result lists (`src/retrieval-benchmark.ts:68,73`) | P3 | `Closed-P3` |
| F-R5-F-4 | R5 | No assertion compares raw with reconciled metrics, so the reconciliation effect is printed but never verified (`src/retrieval-benchmark.ts:117`) | P3 | `Closed-P3` |
| F-R5-G-1 | R5 | §8.2 defines independence as "different registrable domains" while code counts source families by canonical URL and text overlap (`infobroker.md:1013-1015` → `src/corroborate.ts:350-367`) | P1 | `Scheduled-roadmap` |
| F-R5-G-2 | R5 | §8.2 omits the secondary-only calibration cap, so a reader cannot know a 0.9/1.0-tier finding can be clamped to 0.7 (`infobroker.md:994-1020`) | P2 | `Scheduled-roadmap` |
| F-R5-G-3 | R5 | §8.1 gives contested findings `confidence: low`, but code assigns the dominant cluster's confidence, which can reach 0.9/1.0 (`infobroker.md:963-969` → `src/corroborate.ts:302-305,316-322`) | P2 | `Scheduled-roadmap` |
| F-R5-G-4 | R5 | §8.1's agreement map is `{green,yellow,red:gaps}`; code's `red` is `confidence < 0.5` and unsourced findings are excluded from the map (`infobroker.md:986` → `src/corroborate.ts:396-417,786-791`) | P2 | `Scheduled-roadmap` |
| F-R5-G-5 | R5 | §8.1 says `agree.length >= 2 → confirmed`, but the path also requires `confidence >= 0.5` (`infobroker.md:957-962` → `src/corroborate.ts:306-312`) | P3 | `Closed-P3` |
| F-R5-G-6 | R5 | §8.3 says `partial` is set when a limit is reached; code sets it whenever any finding is below threshold (`infobroker.md:1035` → `src/corroborate.ts:819-822`) | P3 | `Closed-P3` |

### R6 finding register (2026-11-09)

| ID | Chunk | Predicate | Severity | Disposition |
|---|---|---|---|---|
| F-R6-A-1 | R6 | `manage_kb` advertised `max_results` default 8/max 50 and the unconfigured/invalid-KB REQ-002 error are unasserted; only `check-intent-citations` pins the action enum (`src/tool-surface.test.ts:187-210`; `src/index.ts:2058-2060`) | P1 | `Resolved` |
| F-R6-A-2 | R6 | A caller `source_url` is discarded for text-only ingest: the `else if (!url)` branch overwrites the identity with `""`, and empty-URL chunks split into one entry per chunk (`src/index.ts:2236-2243`) | P1 | `Resolved` |
| F-R6-A-3 | R6 | Receipt-only-for-report/KB and at-least-one-of-text-or-url refusal branches are handler-only with no test (`src/index.ts:2185-2186,2215-2227`) | P1 | `Resolved` |
| F-R6-A-4 | R6 | REQ-060c per-collection counts/last ingestion, REQ-060e newest-first order and chunk_count, REQ-060f chunk order and no-document error, REQ-060d filter requirement are cited but unasserted (`src/kb.test.ts:113-184`) | P1 | `Resolved` |
| F-R6-A-5 | R6 | The tool-level locked-store error mapping is static-only; the test asserts `kbClaims` does not throw (`src/kb-claims.test.ts:339-354`; `src/index.ts:2065-2069`) | P1 | `Resolved` |
| F-R6-A-6 | R6 | REQ-060i `stale=true` and the document-basis source-absent branch are unasserted (`src/kb-report-receipt.test.ts:556`; `src/kb-receipt.ts:371-373`) | P1 | `Resolved` |
| F-R6-A-7 | R6 | Verified sources are counted but not listed, so "each source state" surfaces as aggregate counts (`src/kb-receipt.ts:374-375`) | P3 | `Closed-P3` |
| F-R6-B-1 | R6 | REQ-064 auto-index has no observing test: non-blocking, failure suppression, toggle, and the three hook sites are unasserted (`src/deep-search.test.ts:103-116`; `src/kb.ts:1038-1074`) | P1 | `Resolved` |
| F-R6-B-2 | R6 | REQ-065 config-default precedence is indistinguishable from the literal fallback because the fixture default equals `"default"` (`src/kb.test.ts:237-258`) | P1 | `Resolved` |
| F-R6-B-3 | R6 | REQ-066 startup/interval expiry, tier-driven removal, indefinite tiers, and the no-error-event clause have zero assertions (`src/kb-hardening.test.ts:46-150`; `src/kb.ts:1103-1121`) | P1 | `Resolved` |
| F-R6-B-4 | R6 | REQ-067 absent/invalid→error is contradicted by the shipped-defaults fallback, and KB config reload is untested (`src/config.ts:978`; `config.test.ts:614-625`) | P1 | `Resolved` |
| F-R6-B-5 | R6 | REQ-072 meaning-equivalence dedup runs only for `report://` identities; non-report duplicates under different URLs persist (`src/kb.ts:604-621`) | P1 | `Resolved` |
| F-R6-B-6 | R6 | REQ-083 report retention is not `source_type`-guarded (tier expiry removes any chunk), and revision/supersedes are receipt-only and non-monotonic (`src/kb.ts:1096-1101`; `src/index.ts:2038`) | P1 | `Resolved` |
| F-R6-C-1 | R6 | `freshness.default_tier` is only type-checked; a name with no tier never decays or expires (`src/config.ts:938-940`; `src/kb.ts:321-328,1097-1098`) | P2 | `Scheduled-roadmap` |
| F-R6-C-2 | R6 | REQ-074's cited test asserts tier labels only; decay/expiry and hot reload are static-only (`src/kb.test.ts:371-379`) | P3 | `Closed-P3` |
| F-R6-C-3 | R6 | REQ-075's decay reduction, zero-decay exemption, and freshness-adjusted ordering are unasserted (`src/kb.test.ts:67-73`) | P2 | `Scheduled-roadmap` |
| F-R6-C-4 | R6 | The below-threshold fall-through and unconfigured/disabled-KB bypass are static-only (`src/index.ts:353-369`) | P3 | `Closed-P3` |
| F-R6-C-5 | R6 | A `research` request early-returns without `kb_recall`, so "not applicable" is unimplemented for research (`src/index.ts:322-346`) | P1 | **Resolved 2026-11-10** — research and deep/not-applicable cases in `debate-club/src/kb-retrieval.test.ts` |
| F-R6-C-6 | R6 | Blend reuses the KB-first sufficiency filter, dropping sub-threshold cached rows, and the all-external-fail path needs a non-empty filtered cache (`src/index.ts:367-369,398,751`) | P1 | **Resolved 2026-11-10** — blend/default contrast and all-external-fail case in `debate-club/src/kb-retrieval.test.ts` |
| F-R6-C-7 | R6 | REQ-103 degradation appends an informational event with no remediation message and no test (`src/kb.ts:114-120`; `src/index.ts:2348`) | P1 | **Resolved 2026-11-10** — remediation event asserted in `src/kb-model.test.ts` |
| F-R6-D-1 | R6 | `resealAll` never re-seals the `events` table, so encrypted event history is silently lost on rekey or disable (`src/kb-sqlite.ts:702-808,390-423`) | P1 | **Resolved 2026-11-10** — event rows decode and reseal in the transition (`src/kb-sqlite.ts` `resealAll`), unreadable rows are preserved, and `events()` skips a marked row with no key; `src/kb-encryption-sqlite.test.ts` (`event history across key transitions`) |
| F-R6-D-2 | R6 | No SQLite store format/version marker: a newer store is opened read-write and DDL runs before verification, contrary to "never rewritten" (`src/kb-sqlite.ts:32-71,105-131,893-907`) | P1 | **Resolved 2026-11-10** — `SQLITE_FORMAT_VERSION` lives in the SQLite header and `probeStoreFile` classifies before any read-write open (`src/kb-sqlite.ts`); `src/kb-sqlite.test.ts` (`store format marker and classification`) |
| F-R6-D-3 | R6 | Handler lock refusal, `stats.encryption`, locked status reachability, and key-source precedence are code-reading only (`src/index.ts:2065-2070`; `src/kb.ts:720`; `src/kb-crypto.ts:203-216`) | P2 | `Scheduled-roadmap` |
| F-R6-E-1 | R6 | A corrupt live SQLite store yields a lock error only: no backup copy and no empty-store recovery, so clause (c) is unimplemented for the live backend (`src/kb.ts:416-424`; `src/kb-migrate.ts:110-123`) | P1 | **Resolved 2026-11-10** — `recoverCorruptStore` archives, continues empty, reports the event, and restores on failure (`src/kb-sqlite.ts`); `src/kb-hardening.test.ts` (`corrupt live store recovery`, `corrupt store recovery backout`). Limitation: a corrupt store's encryption state is unreadable, so the backup suffix follows `opts.encryptionEnabled` |
| F-R6-E-2 | R6 | Encryption-enabled upgrades unlink the legacy JSON, so clause (b) preserves no artifact; this conflicts with REQ-084's no-plaintext rule and needs a spec decision (`src/kb-migrate.ts:171-176`; `kb-migrate.test.ts:86-88`) | P2 | `Scheduled-roadmap` |
| F-R6-E-3 | R6 | Clause (a) has no gate-asserted test; the probe is a one-off outside `npm run check`, and `test-isolation.test.ts:1`'s REQ-108 tag is a false citation (`src/kb-sqlite.test.ts:82-95`) | P2 | `Scheduled-roadmap` |
| F-R6-E-4 | R6 | `sqliteSearch` accumulates every matching chunk before slicing to `maxResults`, so a broad query over an oversize store is not heap-bounded (`src/kb.ts:536-558,580`) | P2 | `Scheduled-roadmap` |
| F-R6-E-5 | R6 | Migration `JSON.parse`s the whole legacy store, so an upgrade cannot complete when the JSON exceeds the heap (`src/kb-migrate.ts:73,105`) | P3 | `Closed-P3` |
| F-R6-E-6 | R6 | `docCount` corruption is silently coerced to 0 without backup/rebuild/reporting (`src/kb-sqlite.ts:359`) | P3 | `Closed-P3` |
| F-R6-F-1 | R6 | The ledger persists only URL-bearing findings; an unsourced batch claim is never stored, so "persist each finding" is unmet (`src/index.ts:1939`) | P2 | **Resolved 2026-11-10** — the ledger mapping persists every finding, so an unsourced batch claim becomes a zero-edge claim record; `debate-club/src/kb-ledger.test.ts` (`an unsourced batch finding is persisted with no source edges`) |
| F-R6-F-2 | R6 | `claim_sources.retrieved_at` is plaintext while the rest of the edge is sealed (`src/kb-sqlite.ts:106,826`) | P2 | **Resolved 2026-11-10** — the retrieval time travels inside the sealed edge payload, the clear column holds an empty placeholder, and a REQ-086 transition carries and blanks it (residual for a never-transitioned store: D-096); `src/kb-claims.test.ts` (`keeps the retrieval time out of the clear column…`, `reads a legacy clear retrieval time…`) |
| F-R6-F-3 | R6 | "A ledger failure never alters the response" is static-only; no tool-level assertion with a locked KB (`src/index.ts:1927-1945`) | P3 | `Closed-P3` |
| F-R6-F-4 | R6 | A snippet-basis receipt source without `retrieved_at` loses the retrieval time from the canonical manifest (`src/kb-receipt.ts:302-306`) | P2 | **Resolved 2026-11-10** — `buildReceiptManifest` stamps every unlabelled source with the ingest instant, so the manifest always carries a retrieval time; `src/kb-report-receipt.test.ts` (`stamps a retrieval time on a snippet-basis source with no caller timestamp`) |
| F-R6-F-5 | R6 | `grade` and `retrieved_at` are stored without the length bounds applied to sibling fields (`src/kb-receipt.ts:217,89`) | P3 | `Closed-P3` |
| F-R6-F-6 | R6 | Disk-only-plus-receipt and non-report-plus-receipt refusals have no tool-level test (`src/index.ts:2225-2227`) | P3 | `Closed-P3` |
| F-R7-E-4 | R7 | A failed `verify_claims` run returns an `[ERROR]` envelope as ordinary content; the runner's parser returned `null`, so the topic was recorded `status:"ok"` with empty claims (`scripts/monitor-watchlist.ts:42-49,122-138`) | P0 | **Resolved 2026-11-09** — `parseVerifyEnvelope` classifies `[ERROR]`/unreadable bodies as failures; `scripts/monitor-watchlist.test.ts` |
| F-R7-B-1 | R7 | The analysis skill assigns a fourth confidence label, `No confidence`, against REQ-115's three-label scale (`skills/analysis-loop/SKILL.md:180`) | P1 | `Scheduled-roadmap` |
| F-R7-C-1 | R7 | The `register-url` rejection branch has no defect fixture and no asserting test (`src/lib/report-manifest.ts:413-415`) | P1 | `Scheduled-roadmap` |
| F-R7-C-2 | R7 | `SHAPE_BLOCKS["Fact-Check"]` is empty while the template defines a verdict table, so a Fact-Check report missing its block validates (`src/lib/report-manifest.ts:136-137`; `skills/infobroker/references/report-template.md:125-136`) | P1 | `Scheduled-roadmap` |
| F-R7-C-3 | R7 | The `undeterminable` publication-date branch has no positive or negative fixture (`src/lib/report-manifest.ts:438-440`) | P1 | `Scheduled-roadmap` |
| F-R7-E-1 | R7 | The monitoring path is a pure Markdown diff: no receipt baseline and no `verify_report` revalidation before comparison (`src/lib/report-delta.ts:24-36`; `scripts/monitor-delta.ts:56-61`) | P1 | `Scheduled-roadmap` |
| F-R7-E-2 | R7 | Source comparison is id-set membership only; same-id URL/grade/hash drift is reported unchanged and there is no unverifiable field (`src/lib/report-delta.ts:34,76-84`) | P1 | `Scheduled-roadmap` |
| F-R7-G-2 | R7 | A renamed bare tool in a skill file is treated as prose, so the gate stays green; only a renamed prefixed tool is caught (`src/intent-citations.ts:89-96`) | P1 | `Scheduled-roadmap` |
| F-R7-A-1 | R7 | REQ-050's content check is warn-only; the KB-first paragraph can be deleted without failing a gate (`scripts/validate-spec.ts:580-585`) | P2 | `Scheduled-roadmap` |
| F-R7-A-2 | R7 | No failing assertion covers REQ-051's escalation, manifest, quality-gate, or revalidate clauses; the only error is a token clause REQ-051 does not state (`scripts/validate-spec.ts:589-596`) | P2 | `Scheduled-roadmap` |
| F-R7-B-2 | R7 | The technique catalog claims six families but assigns no technique to a family; the "cause and effect" family has no mapped method (`skills/analysis-loop/references/techniques.md:8-12,30-139`) | P2 | `Scheduled-roadmap` |
| F-R7-C-4 | R7 | Register `interests`, `source`, and `type` fields and their rejection branches are unasserted (`src/lib/report-manifest.ts:420-437`) | P2 | `Scheduled-roadmap` |
| F-R7-C-5 | R7 | `manifest-likelihood` and `manifest-verdict` vocabularies have no fixture or test; finding-level likelihood is unvalidated (`src/lib/report-manifest.ts:306-310`) | P2 | `Scheduled-roadmap` |
| F-R7-D-1 | R7 | `pipeline-map.md` defines the shared TAIL without TRANSLATE, contradicting the canonical order (`skills/infobroker/references/pipeline-map.md:62`) | P2 | `Scheduled-roadmap` |
| F-R7-D-3 | R7 | No instruction sets the manifest language after translation and no gate rejects a stale value (`skills/infobroker/SKILL.md:102-103`; `src/lib/report-manifest.ts:260-270`) | P2 | `Scheduled-roadmap` |
| F-R7-D-4 | R7 | An unsupported drafted claim may be attributed or softened instead of removed or marked unverified (`skills/infobroker/SKILL.md:89-90`) | P2 | `Scheduled-roadmap` |
| F-R7-E-3 | R7 | The delta product has no revision/supersedes output, and `revision` is optional so a changed report can ship at revision 1 (`src/lib/report-delta.ts:9-17`; `src/lib/report-manifest.ts:287-291`) | P2 | `Scheduled-roadmap` |
| F-R7-E-5 | R7 | The dry-run early return and per-topic error isolation are unobserved by the lib test; only the new parser test covers the error path (`src/lib/watchlist.test.ts`; `scripts/monitor-watchlist.ts:95-100`) | P2 | `Scheduled-roadmap` |
| F-R7-E-6 | R7 | The run record is overwritten unconditionally, so an error/empty run erases prior claims and the next run restates them as new (`scripts/monitor-watchlist.ts:115-139`) | P2 | `Scheduled-roadmap` |
| F-R7-E-7 | R7 | Due-ness reads `last_run` but the runner never writes it back, so repeated invocations reselect the same topics (`scripts/monitor-watchlist.ts:112-141`; `src/lib/watchlist.ts:39-46`) | P2 | `Scheduled-roadmap` |
| F-R7-F-1 | R7 | Export determinism is implied by pure functions but never asserted by a repeat-and-compare test (`src/lib/report-export.test.ts:9-26`) | P2 | `Scheduled-roadmap` |
| F-R7-F-2 | R7 | Library exports call `validateReport` but ignore `ok`; `reportToSourcesCsv` does not validate at all (`src/lib/report-export.ts:34-56`) | P2 | `Scheduled-roadmap` |
| F-R7-G-1 | R7 | The routing surface is a hand-maintained five-file list; `troubleshooting.md`, `config-tune.md`, and `provider-map.md` are never parsed (`src/intent-citations.ts:57-63`) | P2 | `Scheduled-roadmap` |
| F-R7-G-3 | R7 | The README provider section says to enable optional providers in the shipped `config.json`, contradicting the user-layer rule (`README.md:476-477` vs `:516-522`) | P2 | `Scheduled-roadmap` |
| F-R7-A-3 | R7 | The SKILL.md KB phases omit the "knowledge-base inspection" reservation for direct `manage_kb` search (`skills/infobroker/SKILL.md:74,145`) | P3 | `Closed-P3` |
| F-R7-A-4 | R7 | The Fact-Check pipeline archives with a receipt but omits the verify-before-reuse step (`skills/infobroker/SKILL.md:160-166`) | P3 | `Closed-P3` |
| F-R7-A-5 | R7 | `journeys.md` does not state a recovery procedure per journey (`skills/infobroker/references/journeys.md:10-50`) | P3 | `Closed-P3` |
| F-R7-A-6 | R7 | REQ-053's gate checks file presence and the Mermaid token only (`scripts/validate-spec.ts:699-709`) | P3 | `Closed-P3` |
| F-R7-B-3 | R7 | The analysis step says "assumption or alternative" where REQ-088 says both (`skills/analysis-loop/SKILL.md:181-182`) | P3 | `Closed-P3` |
| F-R7-B-4 | R7 | The analysis skill restates a grade-based confidence rule instead of citing the canonical bands (`skills/analysis-loop/SKILL.md:175-180`) | P3 | `Closed-P3` |
| F-R7-B-5 | R7 | `workflows.md` cites `references/techniques.md`, which does not resolve from `skills/infobroker/` (`skills/infobroker/references/workflows.md:139-140`) | P3 | `Closed-P3` |
| F-R7-B-6 | R7 | REQ-052's gate asserts name strings, not that the four skill files exist or ship (`scripts/validate-spec.ts:688-696`) | P3 | `Closed-P3` |
| F-R7-C-6 | R7 | The fixture gate asserts pass/fail by filename, never the finding code (`scripts/check-report-fixtures.ts:39-73`) | P3 | `Closed-P3` |
| F-R7-C-7 | R7 | The fixture gate's non-recursive readdir skips `test-fixtures/reports/delta/` (`scripts/check-report-fixtures.ts:56`) | P3 | `Closed-P3` |
| F-R7-C-8 | R7 | The archived manifest is a subset missing `as_of`, `handling`, `language`, and `target_length` (`src/types.ts:362-371`) | P3 | `Closed-P3` |
| F-R7-C-9 | R7 | An invalid finding-level confidence value is untested; only absence is covered (`src/lib/report-manifest.ts:512`) | P3 | `Closed-P3` |
| F-R7-C-10 | R7 | Skeleton absence is tested for one required section only (`src/report-contract.test.ts:47-52`) | P3 | `Closed-P3` |
| F-R7-C-11 | R7 | The non-subsection Key Findings path and `finding-missing` branch are untested (`src/lib/report-manifest.ts:527-531`) | P3 | `Closed-P3` |
| F-R7-D-2 | R7 | `workflows.md` lists ARCHIVE before POLISH/TRANSLATE/REVALIDATE (`skills/infobroker/references/workflows.md:60-70`) | P3 | `Closed-P3` |
| F-R7-F-3 | R7 | The export projection drops `likelihood`, `modality`, `attribution`, and register provenance fields (`src/lib/report-export.ts:36,41-46,57-65`) | P3 | `Closed-P3` |
| F-R7-F-4 | R7 | `render-report` CLI flags are untested (`scripts/render-report.ts:16-61`) | P3 | `Closed-P3` |
| F-R7-G-4 | R7 | §10.3's `manage_kb` row omits the live `claims` and `verify_report` actions (`infobroker.md:1430`; `src/index.ts:1980`) | P3 | `Closed-P3` |
| F-R8-A-1 | R8 | REQ-043 update preservation has no asserting test; §2 F11 claims "G1 update-preservation tests guard the guarantee" with no carrier (`infobroker.md:74`; no update/preservation assertion in `src/**/*.test.ts`) | P1 | `Scheduled-roadmap` |
| F-R8-C-1 | R8 | The cooldown notice on every successful tool response is unobserved; only `collectNotices` unit coverage exists (`src/index.ts:1693-1694`; `src/state-health.test.ts:187`) | P2 | `Scheduled-roadmap` |
| F-R8-D-1 | R8 | REQ-096's "security requirement traceable to a gate" is asserted as a §E reference, not as gate traceability (`scripts/validate-spec.ts:939-944`) | P2 | `Scheduled-roadmap` |
| F-R8-F-1 | R8 | REQ-100's "refuse to read or write state in a directory it does not own" branch is implemented but untested (`src/key-pool.ts:63`) | P2 | `Scheduled-roadmap` |
| F-R8-F-2 | R8 | REQ-099's "designated directory SHALL be created with owner-only permissions when absent" clause has no assertion (`src/kb-crypto.ts` key-file creation) | P2 | `Scheduled-roadmap` |
| F-R8-F-3 | R8 | Key confinement is refused with `internal_error` rather than a confinement-specific code; REQ-002 taxonomy is R1-owned (D77 note) (`src/index.ts` manage_kb encryption branch) | P3 | `Closed-P3` |
| F-R8-Z-1 | R8 | Tracker drift: the R8 `Code:` line omitted `call-log.ts`, `session-stats.ts`, `lib/{atomic-write,sanitize-error}.ts`, the `index.ts` handler regions, and the gate scripts; the `Spec:` line and status-board cell omitted §3 SR-002/SR-003/SR-007 | P3 | **Resolved 2026-11-10** |
| F-R9-A-1 | R9 | REQ-055's clause guard requires ≥2 tags for any REQ with ≥2 "or" branches instead of one tag per branch (`src/clause-coverage.ts:68-73`; `scripts/validate-spec.ts:321-370`) | P1 | `Scheduled-roadmap` |
| F-R9-B-1 | R9 | REQ-106's server-reporting clause is unimplemented: no tool response reports per-tool parameter counts, description coverage, invocation cost, or definition size (`src/index.ts:1613-1618`; `src/tdqs.ts:270` computes `paramCount`, never emitted) | P1 | `Scheduled-roadmap` |
| F-R9-B-2 | R9 | REQ-106's annotation-contradiction clause is report-only: candidates never fail `check-tdqs`, which exits on `structuralViolations` alone (`src/tdqs.ts:424-438`; `scripts/check-tdqs.ts:134`) | P1 | `Scheduled-roadmap` |
| F-R9-B-3 | R9 | REQ-089's behavioral-consequence clause (state effects, external calls, rate limits, auth, destructive ops) has no asserting test; the bar gate and live test assert only structural markers (`scripts/validate-spec.ts:809-838`; `src/tool-surface.test.ts:140-205`) | P1 | `Scheduled-roadmap` |
| F-R9-C-1 | R9 | REQ-078's taxonomy gate checks presence only: "exactly one feature area" is unasserted, and §D group 6 declares gate `G0` while its REQs carry G0+G1 and G1+G3 (`infobroker.md:1787` vs `:1211-1214`; `scripts/validate-spec.ts:534-555`) | P1 | `Scheduled-roadmap` |
| F-R9-C-2 | R9 | REQ-080's default-consistency gate reconciles two defaults and scans one fallback pattern in four files; `fetch_page.max_length`, `verify_claims.max_iterations`/`confidence_threshold`, and `get_citations.max_results` are unchecked (`scripts/validate-spec.ts:764-800`) | P1 | `Scheduled-roadmap` |
| F-R9-C-3 | R9 | REQ-081's "derived … rather than static literals" clause is unasserted; the Arena test checks presence and positivity only (`debate-club/src/mcp-contract.test.ts:386-391`) | P2 | `Scheduled-roadmap` |
| F-R9-D-1 | R9 | Appendix C's preamble claims "every rule is enforceable by G3", but C.4, C.9, and C.10 have no G3 carrier — `validate-spec` never reads `CHANGELOG.md` (`infobroker.md:1687-1689`, `:1736-1741`) | P1 | `Scheduled-roadmap` |
| F-R9-D-2 | R9 | §9.3 advertises a live G2 smoke lane, but no shipped script or package task implements it (`infobroker.md:1106-1111`; no G2 runner in `scripts/` or `package.json`) | P3 | `Closed-P3` |
| F-R9-Z-1 | R9 | Tracker drift: the R9 `Code:` line named the nonexistent `src/tool-surface.ts` and omitted `clause-coverage.ts`, `feature-taxonomy.ts`, the gate scripts, the `index.ts` registration/spec regions, and the Arena carrier; the `Spec:` line and status-board cell omitted §1 preamble/North Star and §3 SR-011/SR-012 | P3 | **Resolved 2026-11-10** |
| F-M1-1 | M1 | Tracker drift: the prose-ownership table assigns §1 goal 3 (provider intelligence) to R3 (`worklist.md:86`) while R3's D28 records §7.4 only (`docs/plans/2026-11-09-full-review-r3/plan.md:33`), so the unit carried no verdict row through nine chunks | P3 | **Resolved 2026-11-10** — row recorded at the program close from R3's REQ-020a/020c/020h verdicts plus F-R2-27 (`worklist.md` R3 prose table) |
| F-M1-2 | M1 | Disposition drift: 52 rows assert `Scheduled-roadmap` with no roadmap home (R4 18, R5 27 plus one malformed, R6 6); R2 27 and R3 15 are covered only by their section's chunk-register trigger; the `F-R5-B-8` row was unparseable (unescaped pipe characters inside its formula, `src/source-family.ts:69-76`) | P3 | `Closed-P3` — census recorded in the M1 record; the malformed row is repaired; re-disposition deferred to a remediation pass |
| F-M1-3 | M1 | Orphaned deferral: R4 dispositioned F-R4-C-9 `Deferred-R1` although R1 (the REQ-004 owner) closed before R4 filed it, so the deferral never landed on a live surface (`worklist.md` F-R4-C-9; `src/index.ts:1092,1163`) | P3 | **Resolved 2026-11-10** — re-targeted `Scheduled-roadmap` and added to the R4 extraction remediation section and its trigger |

## Program risks / notes

- R2 and R6 are the heaviest. If either does not close in one session, split by
  a recorded D-amendment and keep the REQ partition exact.
- `ROADMAP.md` carries one sweep section. Add a separate remediation section
  only when a finding needs scheduling; do not pre-list hypothetical work.
- The roadmap trigger advances at each chunk close. If a run stops mid-chunk,
  the trigger stays on that chunk and the AAR lands `LOOP OPEN`.
