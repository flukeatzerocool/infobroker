# Changelog

## 2026.08.21 — Tool consolidation and output economy

- Consolidated the tool surface from 13 tools to 6. `web_search` absorbs
  `choose_provider` (task-type auto-selection, REQ-020a) and
  `search_suggestions` (suggestion mode, REQ-020b). `providers` unifies
  `list_providers`, `provider_health`, and `spec_health` (REQ-024, REQ-024a–c).
  `kb` unifies `kb_search`, `kb_ingest`, `kb_stats`, and `kb_delete`
  (REQ-060, REQ-060a–d). Removed REQ-022, REQ-023, REQ-025, REQ-041,
  REQ-061, REQ-062, REQ-063. The validate-spec tool list is now derived from
  `src/index.ts` registrations rather than hardcoded.
- New REQ-079 (Output Verbosity): configurable compact mode that omits
  optional metadata beyond title, URL, and snippet while retaining the
  REQ-001 envelope, defaulting to verbose. `web_search` and `kb` default
  `max_results` reduced and capped; `kb` search results carry only the
  contracted fields. `converge` caps corroborating sources at three per
  finding and adds a synthesis statement (REQ-026).
- REQ-031 fallback chains now exclude disabled or unauthenticated providers
  (tier-aware: keyed/self-hosted only) and allow concurrent first-hop
  dispatch; REQ-013 startup health no longer delays readiness.
- REQ-010 config gains a `defaults` block inherited by providers that do not
  override it; the redundant `type` field was removed from `config.json`;
  keyed providers (`brave`, `exa`, `tavily`) now ship `enabled: false` per
  DECISIONS.md D-005.
- Convergence quality: `first_pass_max_results` and `similarity_threshold`
  are configurable; source independence uses registrable domains rather than
  raw hostnames (§8.2). Recorded G1 fixtures refresh on a documented cadence
  (§9.2).

## 2026.08.21 — Generic HTTP provider tier (spec)

- New REQ-014 (Generic HTTP Provider Tier): a provider whose search behavior
  is defined by configuration rather than a provider module, addable without
  source changes via the user configuration layer. New REQ-015 (Provider
  Removal by Disable): disabling a provider removes it from dispatch without
  removing its entry or module, preserved across updates. (REQ-014, REQ-015)
- Supporting spec edits: terminology and §5.3 tier union gain the
  `generic_http` tier, a §A.7 recipe, an F12 failure mode, G1 test bullets,
  manifest rows, and taxonomy placement for the two new REQs. Recorded as
  forward-looking in DECISIONS.md D-019.

## 2026.08.21 — Self-contained skill suite

- The client-artifact skills now ship self-contained in the repository, so a
  fresh install carries the full research-and-writing pipeline with no
  outside skill dependency. Six pipeline skills are vendored — deep-research,
  fact-checking, summarization, technical-writing, proofreading, and
  translation. (REQ-052)
- Two former pipeline skills — copywriting and code-review — are dropped from
  the set and no longer referenced anywhere in the repository; they remain
  available as global skills where installed. The spec-authoring skills
  (spec-review, spec-engineering-loop) are likewise no longer shipped in the
  repository.
- The CTI-modeled research workflow was renamed from `research-engineering-loop`
  to `analysis-loop`, and wired into the orchestrator as the escalation path
  for high-stakes questions requiring gated analytic rigor.

## 2026.08.21 — Update-safety hardening for user data

- A knowledge-base storage-path change (e.g. an update altering the shipped
  default, or a user overlay no longer overriding it) is now detected and
  warned about instead of silently orphaning existing data. Pending writes
  flush to the previous path first, and the event is recorded in `kb_stats`.
  Data is never migrated or deleted. (REQ-010, REQ-067)
- Hot reload (`reload_config` and SIGHUP) now flushes pending knowledge-base
  writes before re-initializing, so an ingest still inside the write debounce
  window is no longer dropped on reload. (REQ-040)
- Config overlay merging now warns when a user layer replaces a non-empty
  shipped array (such as a `dispatch` chain) wholesale, surfacing that updates
  to that key's default will not apply. (REQ-010)

## 2026.08.21 — README update system hardening

- `validate-readme` now derives the tool surface from `src/index.ts` and the
  provider registry from `config.json` at validate time, so the README can
  never drift from the code or config. The previous hardcoded tool list
  omitted the four `kb_*` tools.
- The README DESIGN style guide gained a product principle, word budget,
  non-goals, refrain contract, and a 10-item binary style checklist for AI
  edits; the validator's prose scanner now skips HTML-comment content.
- The README auto-update prompt now runs a single Generate → Verify loop —
  phase 2 re-checks every claim against its source and reports high-severity
  findings before the mechanical gate.
- README prose now names the previously-omitted tools (`fetch_page`,
  `search_suggestions`, `kb_search`, `kb_ingest`, `kb_stats`, `kb_delete`,
  `spec_health`) in backticks, substantiating the "thirteen tools" claim.

## 2026.08.20 — Feature taxonomy and defect fixes

- A feature taxonomy appendix (§D) now groups every tool and every §4 REQ
  into eight thematic feature areas, each naming its primary REQ range and
  verification gate, to serve as the canonical map for improvement sprints.
  (REQ-078)
- The `validate-spec` script (G3) now enforces taxonomy exhaustiveness —
  every tool slug and every §4 REQ must appear in §D — and treats REQ-078 as
  a meta-REQ alongside REQ-055 and REQ-077.
- The README documents a Knowledge Base feature in §3 and links to the
  feature taxonomy; `validate-readme` checks both. (REQ-078)
- Defect fixes: `fetch_page` now honors its `max_length` parameter, the
  `converge` tool now accepts a `providers` parameter (REQ-026), `kb_search`
  now ranks by combined relevance and age (REQ-075), `list_providers`
  `active` filtering reflects operational status (REQ-024), `choose_provider`
  demotes providers at 80% quota (REQ-023), `spec_health` derives the build
  version from package metadata (REQ-041), and `fetch_page` auto-indexes
  full page content rather than the truncated snippet (REQ-064).

## 2026.08.20 — Spec format and style guide reform

- The REQ authoring conventions (Appendix B) now define a full format guide:
  mechanical limits on every REQ body (at most 800 characters, 8 sentences,
  8 SHALL clauses, one paragraph, and 5 backtick tokens outside the
  tool-signature and output/error-contract exemptions), RFC 2119 keyword
  semantics, optional EARS notation, a pre-commit authoring checklist, and
  proofreading/readability dimensions. The mechanical limits are now enforced
  as gate-blocking errors, not warnings.
- A REQ manifest (§9.5) lists every requirement with its section and
  verification gate, and the spec validator checks it against the §4 body for
  bidirectional coverage. (REQ-077)
- Section numbering in §4 was corrected to run sequentially, knowledge-base
  and output-contract REQ blocks were reordered numerically, and a table of
  contents was added. Appendix C now requires REQ provenance to the changelog
  and spec version. (C.10)

## 2026.08.20 — Build fingerprint determinism and hook staging

- The auto-generated build fingerprint block in `DECISIONS.md` no longer
  includes a `Generated:` timestamp, so re-running `npm run hash` on an
  unchanged tree produces no diff. The timestamp remains only in the
  gitignored `$TMPDIR/infobroker/fingerprints.txt`.
- The pre-commit hook now re-stages `DECISIONS.md` after `npm run hash`,
  so a spec-hash change lands in the same commit as the spec edit instead of
  surfacing as a post-commit dirty tree.
- Shell scripts remain gate-checked with `bash -n`; `shellcheck` is
  documented as recommended-but-optional (not a devDependency).

## 2026.08.20 — Push pipeline overhaul

- The `push-pipeline.sh` was restructured into a modular pipeline
  (`scripts/pipeline/lib.sh` + `scripts/pipeline/prompts/`) with the AI
  steps driven through a single persistent `opencode serve` session rather
  than four cold-start sessions, reducing per-run context reloads.
- Release-discipline guarantees were added: the pipeline now stages new
  files in the source tree (previously only already-tracked files were
  staged, so a sync that added a file shipped nothing), runs tests and
  version-consistency checks after the server sync, refuses to silently
  overwrite an existing version tag without `--force-tag`, and refuses to
  commit staged content matching secret patterns. (Appendix C.9)
- New flags: `--resume`, `--from=<step>`, `--parallel`, `--force-tag`,
  `--force-push`, `--allow-secrets`. Model tiering is configurable via
  `PIPELINE_MODEL` and `PIPELINE_LIGHT_MODEL`; dead-data scan scope via
  `SCAN_DIRS`.

## 2026.08.19 — Source distribution and update-preservation guarantees

- The specification now documents the actual deployment channel: Infobroker
  is distributed as a public source repository (hosted at git.gay) that users
  clone and run locally, with updates delivered as repository fetches. The
  prior "distributed via npm" claim was removed. (REQ-042)
- Applying an update now guarantees user-owned state is preserved: the user
  configuration layer, knowledge base content, and quota state all live
  outside the distributed tree and are never reset or overwritten by a pull.
  (REQ-043)
- Configuration is now layered: the tracked `config.json` holds shipped
  defaults, and a git-ignored `config.local.json` (or `INFOBROKER_CONFIG_LOCAL`)
  holds user overrides that take precedence and survive updates. (REQ-010)
- The client-integration snippet and project file tree were corrected to
  use repo-relative paths and to separate shipped files from user-owned
  state. A new failure mode documents update-clobbers-user-state mitigation.
  (F11)

## 2026-08-10 — Spec artifact drift remediation

- Vendor directory references removed from the specification, decisions
  document, and client integration snippet — the eight pipeline skills
  were moved to the global OpenCode skills directory during an earlier
  consolidation pass, but the spec and DECISIONS.md still pointed at the
  deleted `vendor/opencode-skills/` path. (REQ-052)
- README provider counts corrected from eight/en to ten/eight, matching
  the ten providers with "No" in the Key Required column of the adjacent
  table.
- The translation skill is now wired into the orchestrator as an explicit
  TRANSLATE phase in the Research Professional pipeline and a row in the
  Quick Guide table, closing the gap where it was listed in REQ-052 but
  absent from any pipeline.
- The `research-engineering-loop` skill (CTI-modeled research workflow)
  is now listed in the project file tree. It directly consumes Infobroker
  tools and was previously undocumented.
- Spec version reference bumped from v2026.08.06 to v2026.08.10.

## 2026-08-10 — Knowledge base freshness classification and consumer integration

- Content ingested into the knowledge base is now classified by freshness
  tier at ingest time — ephemeral, recent, stable, or evergreen — based on
  query intent, time range, and source provider. Each tier defines its own
  confidence decay rate and expiry interval, so news results age out quickly
  while encyclopedia content persists indefinitely. (REQ-074, REQ-075)
- Expiry is now determined by freshness tier rather than source type,
  resolving the problem where all web search results shared the same
  expiration window. (REQ-066)
- Web search now queries the knowledge base before hitting external
  providers. If the KB returns results that meet configurable relevance and
  freshness thresholds, those results replace external search entirely — no
  API calls wasted on previously researched questions. An empty or disabled
  KB does not prevent external search. (REQ-076)
- `choose_provider` now recommends knowledge base search as a first-resort
  option when the KB is configured and contains content. (REQ-023)
- `spec_health` now reports knowledge base status: total chunks, collection
  breakdown, freshness tier distribution, and last ingestion time. (REQ-041)
- The client search-preferences instruction file now directs AI clients to
  check the knowledge base before making external web requests. (REQ-050)
- The Infobroker skill pipelines now include a RECALL phase that searches
  the knowledge base before external web search, allowing cached results
  to skip the full research pipeline. (REQ-051)
- The `kb_search` tool description now signals its role as the
  first-resort search tool, describing its content as cached results from
  previous web_search, fetch_page, and converge calls with
  freshness-adjusted scores.
- Freshness tier configuration accepts the legacy `expiry` shape with a
  deprecation warning, so existing config files continue working without
  migration. (REQ-074)
- Spec validation now checks that the instruction and skill files contain
  knowledge base routing language. (REQ-050, REQ-051)

<!--
  CHANGELOG WRITING STYLE

  Every entry must be comprehensible to someone who hasn't read the spec
  in a month. The changelog is for human readers, not for spec traceability.

  Rules:

  1. Human-readable description first. Open every bullet with what changed
     and why it matters in plain English. The REQ reference follows in
     parentheses — it's a traceability anchor, not the subject.

     Yes: "Rate limiting is now enforced per-provider with configurable
          intervals, preventing any one provider from dominating shared
          quota pools. (REQ-030)"

     No:  "REQ-030: Added per-provider throttling..."

  2. No internal diffs. Don't list provider count changes, config entry
     additions, or file count updates. Those are maintenance records, not
     changelog content.

  3. Group by what a user or operator experiences. Organize bullets under
     each date heading by impact area, not by REQ number order.

  4. Reader test. Every bullet must pass: "Would someone who hasn't read
     the spec in a month understand what changed and why it matters?"
-->

## 2026.08.10 — Code and spec hardening via plan-review audit

- Quota counters are now written to disk at intervals rather than
  synchronously on every increment, eliminating a latency bottleneck
  under concurrent load. Durability on shutdown is preserved via a
  process-exit flush. Quota reports now expose daily and monthly
  counters separately rather than a single opaque maximum. (REQ-033)

- Retry backoff now includes random jitter, preventing thundering-herd
  retries when multiple callers hit the same transient error. Retry
  eligibility regex matching now uses word boundaries to avoid false
  positives from coincidental status-code substrings. The unused
  `slug` parameter was removed from the retry signature. (REQ-032)

- Rate-limiter no longer registers providers without an active
  per-second limit, and uses the pre-sleep timestamp for the elapsed
  interval rather than the post-sleep clock. (REQ-030)

- Normalized results with empty URLs are now discarded rather than
  passed to callers as junk. A provider-specific field-alias map
  handles edge-case provider formats without touching the generic
  normalization logic. The normalizer also handles one level of
  nested object fields (e.g., `{title: {rendered: "..."}}`) instead
  of silently dropping them. (REQ-003, REQ-073)

- Knowledge base ingestion is now deduplicated by source URL —
  re-ingesting the same URL updates existing chunks rather than
  creating duplicates. IDF weights are computed from the pre-ingestion
  vocabulary, eliminating the self-influence bias where a new
  document's own terms inflated its vector scores. KB writes are
  debounced at the same 30s interval as quota writes. A configurable
  vocabulary dimension cap (`max_vocab_terms`, default 10,000) bounds
  TF-IDF vector size for large stores. Keyword-match regexes are
  compiled once per query rather than once per chunk, and auto-index
  batches flush in one write rather than per-result. (REQ-060 through
  REQ-067, REQ-072)

- The `ProviderConfig` type dropped the vestigial `type` field (the
  `tier` field already serves this purpose) and the `"scraped"` enum
  value. The `ToolErrorResponse` error object no longer redundantly
  nests `provider` when it already appears at the top level.

- `converge` now accepts searchers via an optional `options.searchers`
  parameter, allowing tests to inject mock searchers through the API
  rather than monkey-patching module-level state. Added test coverage
  for error recovery (one provider throws, others continue), quota
  exhaustion mid-iteration, and the §8.2 confidence table mapping.

## 2026.08.10 — Vendor Skill Consolidation

- Vendored skill files (`code-review`, `deep-research`, `fact-checking`,
  `summarization`, `technical-writing`, `copywriting`, `proofreading`,
  `translation`) were moved from `vendor/opencode-skills/` into the global
  opencode skills directory, eliminating project-level duplication. The
  global skill stubs were previously empty; the vendored copies were the
  sole source of content. The vendor directory is removed and the
  project's `opencode.json` no longer references it.

## 2026.08.10 — Provider Backend Hardening

- Provider backends are now registered in a typed `PROVIDERS` registry instead
  of a manually maintained switch statement, so adding a new provider requires
  only the module file and one registry entry — no tool handler code changes.
  The `Provider` interface is enforced at build time by TypeScript. (REQ-070)

- Every outbound HTTP request now carries a consistent server identifier,
  enforced through a shared HTTP client used by all 18 providers. This replaces
  41 individually hardcoded User-Agent headers with a single source of truth.
  HTTP timeouts are applied uniformly from provider configuration. (REQ-071)

- `provider_health` now performs a live connectivity check against the
  provider during each invocation, replacing startup-only health probes.
  The reported status and latency reflect current conditions. (REQ-025)

- `fetch_page` now supports arXiv and Stack Exchange as content renderers,
  enabling retrieval of paper abstracts and top-voted answer bodies. (REQ-021)

- All 18 providers now accept `SearchOptions` (max_results, safe_search,
  time_range, page), with server-side `max_results` enforcement as a
  safety net for providers that ignore result-count parameters. The
  previously dead `page` parameter is wired through to provider search
  functions.

- Brave Search now accepts `time_range` for recency-filtered queries.

- Duplicate HTML-stripping code removed — `stripHtml` is now a single
  shared utility used by Wikipedia, Wiktionary, and Stack Exchange.


- The `converge` tool now accepts a `providers` parameter so users can
  scope multi-source verification to specific backends (REQ-026).

- Convergence no longer simply counts unique domains and deduplicates
  sources. It now compares what sources actually claim using token-based
  similarity, clustering agreeing sources and surfacing competing
  perspectives when sources disagree. This transforms convergence from
  federated search with deduplication into a truth-finding loop that
  detects agreement, contradiction, and gaps (REQ-026).

- Phase 1 broad search now dispatches to all providers in parallel using
  `Promise.allSettled`, cutting convergence latency significantly for
  typical configurations. Per-provider throttles remain independent and
  safe for concurrent dispatch.

- Gap refinement (Phase 3) now distributes follow-up queries across
  available providers using round-robin selection rather than repeatedly
  hitting a single backend, improving result diversity.

- Provider retry behavior is now configurable per-provider: each provider
  in `config.json` accepts `retry_count` and `retry_backoff_ms` fields
  that override the default exponential backoff (1s, 2s, 4s). Absent
  configuration preserves existing behavior (REQ-032).

- Convergence now has 26 automated tests covering topic extraction, claim
  similarity scoring, agreement detection, disagreement with perspectives,
  provider filtering, and iteration limits.

## 2026.08.10 — Spec Review Remediation

- The dispatch table in §7.2 was aligned to the canonical `config.json`:
  `general_web` now lists Brave as primary (matching the active dispatch
  chain), `academic` drops CORE as a fallback (not in the configured
  chain), and `privacy_critical` promotes DuckDuckGo to primary with
  SearXNG as fallback (reflecting SearXNG's default-disabled state).

- "KB" is now formally defined in the Terminology table (§3) and REQ-065
  and REQ-067 use the full "knowledge base" term in their bodies, removing
  an undefined abbreviation from normative language.

- REQ-065's collection resolution chain was rewritten from a 4-step
  procedural algorithm to a precedence-based contract, per SR-011(a)'s
  prohibition on algorithm descriptions in REQ bodies.

- REQ-003's inline type shape (`{title, url, ...}`) was replaced with
  plain-English prose. REQ-013's vague "slow/limited" qualifier was
  replaced with measurable conditions (latency exceeds configurable
  threshold, partial results). `togglable` was corrected to `toggleable`.

- SR-004's zero-config provider list was expanded to include all
  free-tier providers now enabled by default in `config.json`: Wikidata,
  OpenStreetMap, arXiv, Marginalia, Mojeek, Semantic Scholar, Stack
  Exchange, GitHub, and CORE.

- A REQ block reservation note now appears before §4, documenting the
  numbering scheme for new contributors. §4 gains an explicit "Out of
  scope" clause per Appendix C.8.

## 2026.08.10 — Knowledge Base Implementation + Repo Hygiene

- A new Knowledge Base subsystem is implemented: four MCP tools provide
  semantic and keyword hybrid search over locally indexed research results
  (`kb_search`), explicit text or URL ingestion (`kb_ingest`), operational
  metrics (`kb_stats`), and content removal (`kb_delete`). Vector embeddings
  use in-process TF-IDF with cosine similarity — zero external dependencies.
  (REQ-060 through REQ-067)

- Search results, fetched page content, and convergence findings are
  automatically indexed after each tool call via `setImmediate`, never
  delaying or erroring the primary response. Auto-indexing is togglable
  via the `kb.auto_index` config field. (REQ-064)

- Content expiry runs on startup and at a configurable maintenance interval,
  removing chunks whose source-type age exceeds the configured threshold.
  Collections are implicit namespaces resolved from tool parameters,
  environment variables, config defaults, or literal "default". Storage
  corruption triggers automatic backup and fresh store creation.
  (REQ-065, REQ-066)

- The KB configuration section lives in `config.json` alongside provider
  configuration and hot-reloads per `reload_config`. KB tools return a
  config error when the section is absent — the server operates normally
  without it. (REQ-067)

- A content-addressable build manifest (`scripts/hash-manifest.ts`)
  fingerprints every artifact category (spec, source, config, dependencies,
  artifacts) using SHA-256. Hashes are embedded in DECISIONS.md for
  git-trackable integrity and written to `$TMPDIR/infobroker/fingerprints.txt`
  for local comparisons. A new `npm run hash` script regenerates the
  manifest, and `npm run validate-spec` warns when the spec hash is stale.

- The stale `push` script reference in `package.json` was corrected to
  point at `push-pipeline.sh`. The `per_hour` field was removed from
  `ProviderConfig.rate_limit` (never consumed, removed from the spec's
  Provider interface in the 2026.08.08 pass). The pre-commit hook now
  runs `npm run hash` before other checks.

- DECISIONS.md D-010 was updated to reflect that REQ-035/036/037 are
  now implemented. D-011 was replaced with the KB implementation note.
  The README's zero-config provider count was corrected from 7 to 8.

## 2026.08.09 — Knowledge Base Spec Engineering

- A new Knowledge Base subsystem is specified: four MCP tools (`kb_search`,
  `kb_ingest`, `kb_stats`, `kb_delete`) provide semantic and keyword hybrid
  search over locally indexed research results, explicit document ingestion,
  operational metrics, and content removal. (REQ-060 through REQ-063)

- Search results, fetched page content, and convergence findings are
  automatically indexed after each tool call without delaying or erroring
  the primary response. Auto-indexing is togglable via configuration.
  (REQ-064)

- Collections act as implicit namespaces resolved from tool parameters,
  environment variables, or config defaults. Content expires per source
  type at configurable intervals, with cleanup on startup and periodic
  maintenance. (REQ-065, REQ-066)

- The knowledge base configuration section lives in the main config file
  alongside provider configuration and hot-reloads per the existing
  config reload mechanism. (REQ-067)

- The architectural invariant against local data sources (SR-001) is
  relaxed to acknowledge the knowledge base as a derivative cache —
  the server operates normally when the KB is uninitialized or disabled.

- New failure modes document embedding model unavailability (F9) and
  storage corruption recovery (F10).

- The specification health report (REQ-041) no longer enumerates return
  field names, eliminating a pre-existing catalogue violation warning.

- A new DECISIONS.md entry (D-011) documents REQ-060 through REQ-067 as
  forward-looking requirements from the spec-engineering pass, with
  intentional validate-spec warnings until implementation.

## 2026.08.08 — Push Pipeline

- The lightweight `scripts/push.ts` was replaced with a comprehensive
  `scripts/push-pipeline.sh` that runs a 9-step gate before pushing:
  pre-flight checks, spec audit, spec read-through with proofreading,
  server sync against the spec, provider auth doc regeneration, final
  typecheck gate, dead-data scan, and README/reference refresh before
  committing, tagging, and pushing.

## 2026.08.08 — Cross-cutting Infrastructure Spec Engineering

- A new requirement mandates config validation on load and reload:
  the server must reject configs with missing provider fields, dispatch
  chains referencing nonexistent providers, or invalid rate-limit values.
  Invalid configs on reload leave the previous config active. (REQ-037)

- Quota persistence timing is now explicit: counters are written to disk
  after every quota increment, matching the synchronous-per-request
  implementation strategy. (REQ-033)

- The unused `perHour` field was removed from the Provider interface in
  §5.3. It existed in the type definition but was never consumed by
  rate-limiting or quota-tracking code.

- A rate-limit field ownership note was added to §4.4: `per_second`
  governs throttling (REQ-030); `per_day` and `per_month` govern quota
  (REQ-033/034). Previously this split was discoverable only by reading
  the source.

- A new DECISIONS.md entry (D-010) documents REQ-035, REQ-036, and
  REQ-037 as forward-looking requirements from the spec-engineering pass,
  explaining the intentional validate-spec warnings.

## 2026.08.08 — Provider Backends Spec Engineering

- The failure-mode table (F2) now accurately describes scraped provider
  architecture: results are extracted via CSS selectors that break on
  upstream HTML changes, with fallback chain advancement per REQ-031
  providing recovery. The previous "parsed defensively" claim did not
  reflect the single-path selector implementation.

- The Provider interface in §5.3 now reflects the actual health-function
  return type (`{ status, avgLatencyMs }`) rather than the full
  `HealthReport` type, which is assembled in the skeleton layer. This
  resolves a documented spec-code mismatch.

- REQ-020 (web_search) now defines the contract for unsupported parameters:
  providers must accept all parameters silently, ignoring those they don't
  support. The server is responsible for enforcing `max_results` by
  post-filtering when the underlying provider ignores it.

- `native_fetch` was removed from the §5.2 Layer 2 provider list and
  documented as an inline implementation in the `fetch_page` tool handler.
  It had no provider file, no health check, and no rate limiting — the
  only "provider" that wasn't one.

## 2026.08.08 — MCP Skeleton Spec Engineering

- A new requirement mandates per-provider request timeouts: calls that
  exceed the timeout are treated as transient failures and advance the
  fallback chain. Previously, a hung provider could stall a tool call
  indefinitely. (REQ-035)

- Provider latency metrics must now be computed over a bounded,
  configurable time window rather than unbounded all-time accumulation —
  preventing stale averages from misleading health reports over long
  uptimes. (REQ-036)

- SR-005 was amended from "providers are plugins" to "providers are
  standalone modules" to match the current architecture (standalone
  functions wired via switch statement). This resolves a documented
  spec-code gap (see DECISIONS.md D-002, D-007).

- SR-010 was strengthened to define what "validated" means: structural
  checks (type, range, format, URL well-formedness) on every input field
  before any outbound request is dispatched.

## 2026.08.08 — Spec Hygiene: Code Review Remediation

- A stale REQ-006 citation was removed from `src/index.ts` — the SIGHUP
  reload behavior it referenced was absorbed into SR-006 and REQ-040.
  (SR-006, REQ-040)

- The `fetch_page` tool's `renderer` parameter now lists all four supported
  renderers (`jina`, `native_fetch`, `wikipedia`, `internet_archive`) and
  uses the correct `native_fetch` slug matching the zod schema. (REQ-021)

- SR-011 now explicitly exempts tool-parameter signatures from the
  "no parameter types or defaults" rule — parameter names, required/optional
  status, and default values define the tool's external contract and are
  part of the *what*, not the *how*. Algorithm descriptions and internal
  mechanics remain prohibited.

- Every REQ in §4 now ends with a `_Check:` citation referencing its
  verification gate (G0, G1, G3), in accordance with Appendix B's REQ
  anatomy convention. REQ-055's `_Check: T55` was updated to `_Check: G3`.

- A provider tier naming map was added after §5.3, documenting the mapping
  between human-readable tier names (Built-in, Free HTTP, etc.) and their
  code identifiers (`builtin`, `free_http`, etc.).

- Build Phase 3 was renamed from "Keyed Providers" to "Registration-tier
  & Keyed Providers" to accurately reflect that Semantic Scholar, Stack
  Exchange, GitHub, and CORE have free unauth tiers.

## 2026.08.06 — Auth Derivation from Config

- Provider auth requirements are now derived from `config.json` rather than
  duplicated across the spec's reference tables. The `Auth` column was
  removed from §6.3 and per-provider auth notes were stripped from §A
  (Appendix A). The spec now defines only the mechanism (REQ-011/012) while
  `config.json` is the canonical source for which providers require keys.

- A new build step (`npm run generate-auth`) reads `config.json` and
  produces `skills/infobroker/references/provider-auth.md` — a generated
  reference table mapping each provider to its tier, auth requirement, and
  env variable. The generated file is checked into version control and
  validated for staleness by `npm run validate-spec` at commit time.

- AGENTS.md's provider table no longer has an `Auth` column; it points to
  the generated reference instead. The §5.4 build phases now include the
  auth generation step.

## 2026.08.06 — Full Spec-Compliant Rebuild

- Rate limiting now actually works — all providers are now configured
  with their per-second intervals at startup, preventing quota exhaustion
  from runaway requests. (REQ-030)

- HTTP retries now detect transient errors by status code rather than
  string-matching, so rate-limit responses from Jina Reader, DuckDuckGo,
  and other providers are properly retried with exponential backoff.
  (REQ-032)

- Configuration can now be hot-reloaded by sending SIGHUP to the process
  in addition to the `reload_config` tool, matching the spec's dual-reload
  requirement. (SR-006, REQ-040)

- The fallback chain is now capped at three providers deep by default,
  preventing unbounded provider cascades. (REQ-031)

- Every provider now reports its status at startup, so you can see which
  backends are reachable before the first query. (REQ-013)

- All thirteen tools now return the standardized JSON envelope with status,
  provider, and results fields — `fetch_page`, `search_suggestions`,
  `choose_provider`, `list_providers`, `provider_health`, `spec_health`,
  and `reload_config` were previously returning plain text or ad-hoc
  formats instead of the contracted JSON shape. (REQ-001)

- Eleven new provider backends are now implemented and wired: arXiv,
  Semantic Scholar, Stack Exchange, GitHub, CORE, Marginalia, Mojeek,
  Brave Search, Exa, Tavily, and SearXNG. All 18 configured providers
  have dedicated source files with search and health-check functions.
  Keyed providers authenticate via their documented env-vars and report
  inactive when keys are missing.

- The convergence engine was rewritten to match the three-phase algorithm
  in the specification: broad search across active providers, claim
  extraction with cross-source reconciliation, and targeted gap refinement
  with derived queries. Confidence scoring now follows the independent
  domain-count table. (REQ-026)

- `choose_provider` now recognizes all 13 task types (including small_web,
  structured_fact, semantic, synthesis, and privacy_critical) and
  deprioritizes quota-exhausted providers in its recommendations. (REQ-023)

- A DECISIONS.md file documents all architectural choices, provider wiring
  conventions, and exemption waivers. The AGENTS.md provider table now
  lists all 18 backends.

## 2026.08.06 — Spec Authoring & Drift Prevention

- Requirements must now state contracts, not implementations — two new
  standing rules (SR-011, SR-012) mandate that every REQ describes *what*
  the server does, with red-team review for ambiguity and edge cases
  before finalization. Appendix B defines the full authoring conventions;
  Appendix C prescribes the development discipline for preventing
  spec-code drift. (REQ-055)

- Every source file now cites the requirements it implements via
  `@implements` header comments, enabling automated bidirectional
  spec-code traceability. A new G3 verification gate (`validate-spec`)
  enforces coverage at commit time. (REQ-055)

- Automated spec-code drift detection now available via `npm run
  validate-spec` and `npm run check`. The latter runs typecheck,
  spec validation, and README validation in sequence — all must pass
  before committing.

- AGENTS.md updated with spec authoring guidelines and the pre-commit
  gate workflow.

## 2026.08.06 — Initial Build

- MCP skeleton with stdio transport
- Zero-config providers: DuckDuckGo (HTML scraping), Jina Reader, Wikipedia, Wiktionary, Wikidata, OpenStreetMap, Internet Archive
- Keyed provider configuration: Brave, Exa, Tavily, SearXNG, Semantic Scholar, Stack Exchange, GitHub, CORE
- 13 tools: `web_search`, `fetch_page`, `search_suggestions`, `choose_provider`, `list_providers`, `provider_health`, `converge`, `reload_config`, `spec_health`, `kb_search`, `kb_ingest`, `kb_stats`, `kb_delete`
- Per-provider rate limiting and persistent quota tracking
- Fallback chain with configurable depth
- Convergence engine: multi-pass truth-finding with cross-source verification
- Client artifacts: `search-preferences.md`, skill pipeline, bundled skills
- Result normalization across all provider formats
- Hot-reloadable configuration
