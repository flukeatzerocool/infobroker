# Changelog

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

## 2026.08.10 — Convergence Loop Implementation

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

- All nine tools now return the standardized JSON envelope with status,
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
- 9 tools: `web_search`, `fetch_page`, `search_suggestions`, `choose_provider`, `list_providers`, `provider_health`, `converge`, `reload_config`, `spec_health`
- Per-provider rate limiting and persistent quota tracking
- Fallback chain with configurable depth
- Convergence engine: multi-pass truth-finding with cross-source verification
- Client artifacts: `search-preferences.md`, skill pipeline, bundled skills
- Result normalization across all provider formats
- Hot-reloadable configuration
