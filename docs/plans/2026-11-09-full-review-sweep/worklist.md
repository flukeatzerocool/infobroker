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
| REQ-011 API Key Safety | `finding:F-R2-7` | no key value reaches config/output/errors/logs/health (`src/config.ts:32-55`, `src/key-pool.ts:132-143`, `src/index.ts:1467-1492`); the only cited test asserts `server.json` env-var names (`server-manifest.test.ts:51-62`), not the missing-key/optional-key/leak clauses |
| REQ-013 Provider Discovery | `finding:F-R2-19` | active/inactive(missing key)/degraded(latency, quota)/exhausted produced (`src/health-status.ts:19-41`); `inactive` legs carry no clause tag or test, and `degraded`(partial results) has no producer — the test injects `baseStatus` (`health-status.test.ts:28-37`) |
| REQ-014 Generic HTTP Tier | `holds` | config-defined tier with endpoint/auth/probe/mapping and the same validation on load and reload (`src/providers/generic-http.ts:87-168`; `src/config.ts:483-514`, `:992-997`) |
| REQ-015 Provider Removal | `finding:F-R2-14` | dispatch, recommendations, and `search_web` skip a disabled provider (`src/config.ts:1023`; `src/index.ts:417-421`), but `verify_claims.providers` bypasses the enabled check (`src/corroborate.ts:566-571`) |
| REQ-129 Provider Privacy Posture | `finding:F-R2-12` | posture derived from config with overrides, `unknown` only for `retains_query`, live list reports it, generated doc is gated (`src/privacy.ts:27-51`; `src/index.ts:1498`; `scripts/validate-spec.ts:409`); `requires_account` derives from tier only, so CORE (required key) is documented `none` |
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
| REQ-024a list action | `finding:F-R2-20` | all fields, four non-active reasons, and `inline_fallback` hold live; the `status:"active"` filter selects operational-and-not-exhausted rows while rows report assessed status, so degraded rows appear under the active filter (`src/index.ts:1458-1471`) |
| REQ-024b health action | `finding:F-R2-22` | live status, latency, quota, daily counters, and `last_success` hold (probe); a disabled provider is still probed and can report active (`src/index.ts:1520-1533`), and `last_error`/`last_success` have no test |
| REQ-024c spec action | `finding:F-R2-24` | build identity, 26/22/21 counts excluding inline fallback, uptime, state paths, and the KB block all hold live; `total_requests_served` counts provider samples only (`src/index.ts:1626`), and `last_spec_review` is boot time (`:67`) |

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

### R4 — `fetch_page` (12)

`REQ-021` `REQ-021a` `REQ-021b` `REQ-021c` `REQ-021d` `REQ-021e` `REQ-021f`
`REQ-021g` `REQ-021h` `REQ-021i` `REQ-021j` `REQ-021k`

Spec: §4.3 (those IDs), §6.4.
Code: `src/fetch-fallback.ts`, `src/extract.ts`, `src/providers/jina.ts`,
`src/preservation.ts`, `src/modality.ts`, `src/http.ts`, `src/truncate.ts`,
`src/structured-fact.ts`, plus the `fetch_page` handler in `src/index.ts`.

### R5 — Corroboration and citations (15)

`REQ-026` `REQ-026a` `REQ-026b` `REQ-026c` `REQ-026d` `REQ-026e` `REQ-026f`
`REQ-026g` `REQ-026h` `REQ-121` `REQ-122` `REQ-123` `REQ-130` `REQ-027`
`REQ-027a`

Spec: §4.3 (those IDs), §5.5, §8.
Code: `src/corroborate.ts`, `src/calibration.ts`, `src/source-family.ts`,
`src/structured-fact.ts`, `src/cite.ts`, `src/bibtex.ts`.

### R6 — Knowledge base (29)

`REQ-060` `REQ-060a` `REQ-060b` `REQ-060c` `REQ-060d` `REQ-060e` `REQ-060f`
`REQ-060g` `REQ-060h` `REQ-060i` `REQ-064` `REQ-065` `REQ-066` `REQ-067`
`REQ-072` `REQ-074` `REQ-075` `REQ-076` `REQ-076a` `REQ-082` `REQ-083`
`REQ-084` `REQ-085` `REQ-086` `REQ-087` `REQ-108` `REQ-109` `REQ-110`
`REQ-103`

Spec: §4.9.
Code: `src/kb*.ts`, `src/embed.ts`, `src/retrieval-benchmark.ts`.

### R7 — Client artifacts and reporting (17)

`REQ-050` `REQ-051` `REQ-052` `REQ-053` `REQ-054` `REQ-107` `REQ-088`
`REQ-114` `REQ-115` `REQ-117` `REQ-116` `REQ-125` `REQ-118` `REQ-119`
`REQ-120` `REQ-120a` `REQ-126`

Spec: §4.7, §10.2–10.3, App D.
Code: `skills/`, `instructions/`, `README.md`, `src/report-*.ts`,
`src/monitor-*.ts`, `scripts/validate-readme.ts`.

### R8 — Deployment, state, security (15)

`REQ-042` `REQ-043` `REQ-105` `REQ-111` `REQ-111a` `REQ-112` `REQ-113`
`REQ-091` `REQ-096` `REQ-097` `REQ-098` `REQ-099` `REQ-100` `REQ-101`
`REQ-102`

Spec: §2, §4.10, §4.11, §5.1–5.2, §5.4, §10.1, App E.
Code: `src/config-migrations.ts` (path/patch logic lives in `src/config.ts`), `src/update-check.ts`,
`src/state-health.ts`, `src/audit-log.ts`, `src/content-policy.ts`,
`src/kb-hardening.ts`, `scripts/`, `.githooks/`.

### R9 — Spec integrity and tool quality (9)

`REQ-055` `REQ-077` `REQ-078` `REQ-080` `REQ-081` `REQ-089` `REQ-090`
`REQ-092` `REQ-106`

Spec: §3 Terminology, §4.3 (those IDs), §4.8, §9.1–9.5, App B–C.
Code: `src/tdqs.ts`, `src/tool-surface.ts`, `src/intent-citations.ts`,
`scripts/validate-spec.ts`, `scripts/check-*.ts`.

### M1 — Machine evidence

No REQ ownership. Runs the full suite, `check-pack`, debate-club Arena, TDQS,
intent citations, report fixtures, and the fixture-freshness check; records exit
status and any new evidence.

## Status board

| Chunk | Spec | REQs | Status | Next trigger |
|---|---|---|---|---|
| R1 | §3 SR-009, §4.1, §6.1–6.2 | 6 | **closed 2026-11-09** | R2 |
| R2 | §4.2, §4.3 (024 family), §4.4–4.6, §5.3, §6.3, §7.1–7.3, App A | 25 | **closed 2026-11-09** | R3 |
| R3 | §4.3 (020 family, 124, 127, 128, 028), §7.4 | 14 | **closed 2026-11-09** | R4 |
| R4 | §4.3 (021 family), §6.4 | 12 | not started | R3 closed |
| R5 | §4.3 (026 family, 121–123, 130, 027), §5.5, §8 | 15 | not started | R4 closed |
| R6 | §4.9 | 29 | not started | R5 closed |
| R7 | §4.7, §10.2–10.3, App D | 17 | not started | R6 closed |
| R8 | §2, §4.10–4.11, §5.1–5.2, §5.4, §10.1, App E | 15 | not started | R7 closed |
| R9 | §3 terminology, §4.3 (089/090/092/106), §4.8, §9, App B–C | 9 | not started | R8 closed |
| M1 | all | — | not started | R9 closed |

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
| F-R2-2 | R2 | `reload_config` patch merges over the startup layer snapshot, overwriting an external edit made while running (`src/config.ts:308`) | P1 | `Scheduled-roadmap` |
| F-R2-3 | R2 | `auth_env`/`url_env`/`auth_optional` types are unvalidated; a non-string `auth_env` throws in `getDispatchChain` (`src/config.ts:1025`) | P1 | `Scheduled-roadmap` |
| F-R2-4 | R2 | REQ-010 defaults-inheritance and update-preservation clauses have no asserting test (`src/config.ts:319-331`) | P2 | `Closed-P3` |
| F-R2-5 | R2 | REQ-037 "missing required provider fields" rejection branch is untested (`src/config.ts:385-415`) | P2 | `Closed-P3` |
| F-R2-6 | R2 | REQ-040 invalid-reload retention unasserted; the test only expects a throw (`src/config.test.ts:593`) | P2 | `Closed-P3` |
| F-R2-7 | R2 | REQ-011 citation asserts `server.json` env-var names only; no leak/optional-key/missing-key assertion (`src/server-manifest.test.ts:51-62`) | P2 | `Scheduled-roadmap` |
| F-R2-8 | R2 | REQ-104 pool is advertised for every required-auth tier but honored only by keyed providers; CORE/generic_http read one variable (`src/config.ts:1025-1030`; `src/providers/core.ts:10-14`) | P1 | `Scheduled-roadmap` |
| F-R2-9 | R2 | An exhausted key pool is still reported `active`/`auth_ok: true` (`src/index.ts:1410-1420`) | P2 | `Scheduled-roadmap` |
| F-R2-10 | R2 | REQ-104 restart-persistence test only reloads malformed state, never a valid rejection/cooldown (`src/key-pool.test.ts:83-113`) | P3 | `Closed-P3` |
| F-R2-11 | R2 | REQ-104's three WHEN branches carry no clause tags (`src/key-pool.test.ts:1`) | P3 | `Closed-P3` |
| F-R2-12 | R2 | REQ-129 `requires_account` derives from tier only; CORE (required key) is documented `none` (`src/privacy.ts:47`) | P1 | `Scheduled-roadmap` |
| F-R2-13 | R2 | REQ-129 posture `unknown` is reachable only for `retains_query` (`src/privacy.ts:46`) | P3 | `Closed-P3` |
| F-R2-14 | R2 | `verify_claims.providers` bypasses the disabled-provider rule (`src/corroborate.ts:566-571`) | P1 | `Scheduled-roadmap` |
| F-R2-15 | R2 | Disabled-provider exclusion has no test for dispatch or `search_web` (`src/config.ts:1023`; `src/index.ts:417-421`) | P2 | `Scheduled-roadmap` |
| F-R2-16 | R2 | REQ-014 "added without source changes" is never tested end-to-end (`src/config.test.ts:175-191`, `:301-306`) | P3 | `Closed-P3` |
| F-R2-17 | R2 | REQ-071 identifier literal is duplicated in three places and caller-overridable (`src/providers/duckduckgo.ts:83`; `src/corroborate.ts:933`; `src/lib/url-guard.ts:190`) | P3 | `Closed-P3` |
| F-R2-18 | R2 | Credential-pool variables are absent from `server.json` and `provider-auth.md` (`server.json:21-45`) | P3 | `Closed-P3` |
| F-R2-19 | R2 | REQ-013 `inactive` legs carry no tag or test; `degraded`(partial results) has no producer (`src/health-status.ts:19-41`; `health-status.test.ts:28-37`) | P1 | `Scheduled-roadmap` |
| F-R2-20 | R2 | `status:"active"` filter returns rows whose reported status is `degraded` (`src/index.ts:1458-1471`) | P1 | `Scheduled-roadmap` |
| F-R2-21 | R2 | REQ-024a's four non-active reasons are unasserted (`src/index.ts:1417-1421`) | P2 | `Scheduled-roadmap` |
| F-R2-22 | R2 | `inspect_providers` health probes a config-disabled provider and can report it active (`src/index.ts:1520-1533`) | P1 | `Scheduled-roadmap` |
| F-R2-23 | R2 | REQ-024b `last_error`/`last_success` are untested and process-local (`src/index.ts:1567-1572`) | P2 | `Scheduled-roadmap` |
| F-R2-24 | R2 | REQ-024c `total_requests_served` counts provider samples, not server requests (`src/index.ts:1626`) | P1 | `Scheduled-roadmap` |
| F-R2-25 | R2 | `last_spec_review` reports server boot time (`src/index.ts:67,1633`) | P3 | `Closed-P3` |
| F-R2-26 | R2 | REQ-034's citation stubs the predicate; the 0.8 boundary, `quota_warning`, and 100% skip are unasserted (`src/chain.test.ts:84-97`) | P2 | `Scheduled-roadmap` |
| F-R2-27 | R2 | REQ-036 implements a count window only; no configurable strategy or time window (`src/latency.ts:15,29-33`) | P1 | `Scheduled-roadmap` |
| F-R2-28 | R2 | Retries bypass the per-provider throttle; `throttle()` sits outside `retryWithBackoff` (`src/index.ts:492-509`) | P1 | `Scheduled-roadmap` |
| F-R2-29 | R2 | An explicit `provider` is prepended before the auth filter (`src/index.ts:415-416`) | P1 | `Scheduled-roadmap` |
| F-R2-30 | R2 | A fully quota-exhausted chain returns empty success, not exhaustion (`src/index.ts:478-490` → `:773`) | P1 | `Scheduled-roadmap` |
| F-R2-31 | R2 | Timeouts are not retryable, so REQ-035's transient-failure leg is not honored (`src/retry.ts:60-66`) | P1 | `Scheduled-roadmap` |
| F-R2-32 | R2 | Quota writes are debounced 30 s with a `beforeExit` flush only; SIGTERM/SIGINT loses the window (`src/quota.ts:32,83-99`) | P1 | `Scheduled-roadmap` |
| F-R2-33 | R2 | Quota reset applies a 30 s grace and has no reset test (`src/quota.ts:113-115`) | P2 | `Scheduled-roadmap` |
| F-R2-34 | R2 | A rate-limited `fetch_page` omits `retry_after_ms` (`src/fetch-fallback.ts:139-144`) | P1 | `Scheduled-roadmap` |
| F-R2-35 | R2 | Dispatch orchestration (hedge switch, cross-task order, all-empty vs all-error, cooldown skip) has no integration test | P2 | `Scheduled-roadmap` |
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

## Program risks / notes

- R2 and R6 are the heaviest. If either does not close in one session, split by
  a recorded D-amendment and keep the REQ partition exact.
- `ROADMAP.md` carries one sweep section. Add a separate remediation section
  only when a finding needs scheduling; do not pre-list hypothetical work.
- The roadmap trigger advances at each chunk close. If a run stops mid-chunk,
  the trigger stays on that chunk and the AAR lands `LOOP OPEN`.
