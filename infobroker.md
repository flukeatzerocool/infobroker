# Infobroker — Research & Writing Professional MCP Server

## Contents

1. [§1 Mission and Capability Model](#1-mission-and-capability-model)
2. [§2 Failure Modes](#2-failure-modes)
3. [§3 Standing Rules and Terminology](#3-standing-rules-and-terminology)
4. [§4 Requirements](#4-requirements)
5. [§5 Build Process](#5-build-process)
6. [§6 Runtime Conventions](#6-runtime-conventions)
7. [§7 Provider Selection Dispatch](#7-provider-selection-dispatch)
8. [§8 Corroboration Loop](#8-corroboration-loop)
9. [§9 Verification](#9-verification)
10. [§10 Artifacts and Handoff](#10-artifacts-and-handoff)
11. [§A Appendix: Provider Catalog](#a-appendix-provider-catalog)
12. [§B Appendix: REQ Authoring Conventions](#b-appendix-req-authoring-conventions)
13. [§C Appendix: Spec-Driven Development Discipline](#c-appendix-spec-driven-development-discipline)
14. [§D Appendix: Feature Taxonomy](#d-appendix-feature-taxonomy)

## §1 Mission and Capability Model

Infobroker is a configurable, multi-provider MCP server that wraps public web
search, structured knowledge, scholarly, and content-extraction APIs behind a
unified tool surface. Its design goals:

1. **Free first, privacy always.** Zero-config default uses only free, no-auth-required providers that respect user privacy.
2. **Upgrade path.** Optional API-keyed providers (Brave, Exa, Tavily, SearXNG) for higher throughput and specialized queries.
3. **Provider intelligence.** The server recommends the best provider for a task, considering capability, quota, and latency.
4. **Truth by iteration.** A `corroborate` tool runs multi-pass cross-source verification to surface agreements, contradictions, and gaps.
5. **Writing pipeline.** Server provides raw research materials; bundled client skills handle writing, summarization, proofreading, and translation, while the orchestrator routes requests to research workflow shapes including fact-checking.
6. **Knowledge persistence.** Research results are indexed in a local knowledge base so subsequent queries can retrieve prior findings without repeating searches. The knowledge base is derivative — the server operates normally without it.

The knowledge base is a local caching layer — it does not alter the core
intelligence cycle. When the KB is configured, the server checks the cache
before collection (KB-First Sufficiency, REQ-076); when it is not, the
server operates as a pure retrieval pipeline. Both paths satisfy the North
Star contract: ask, and it finds out.

### North Star

Infobroker is the Bothan Spynet as a tool. Like the Spynet's decentralized
cells trading intelligence across the galaxy, Infobroker queries independent
provider backends — each with its own sources, specialties, and limits —
through a single, impartial interface. It doesn't collect secrets, cultivate
sources, or pick sides. It retrieves, normalizes, and delivers.

In intelligence-cycle terms: the user's query is direction; provider
backends are collection; the normalizer, rate-limiter, and quota tracker are
processing; and the response contract is dissemination. Infobroker automates
collection and processing so the user only supplies direction and receives
dissemination — ask, and it finds out.

Infobroker is not a chatbot. It is a search backend. It complements (not replaces)
built-in client `websearch`/`webfetch` tools — the bundled client instructions
route to Infobroker first, falling back to built-ins only on error.

---

## §2 Failure Modes

| ID | Failure | Symptoms | Mitigation |
|----|---------|----------|------------|
| F1 | Provider API down | Timeout, HTTP 5xx | Fallback chain advances to next provider |
| F2 | DuckDuckGo HTML scraping breaks | Zero results, parse errors | Scraped providers extract results via CSS selectors targeting known HTML layouts. Upstream layout changes cause selector mismatch (zero results extracted), which advances the fallback chain per REQ-031. Provider restoration requires a build update with corrected selectors. |
| F3 | API key misconfiguration | HTTP 401/403 from keyed provider | ProviderHealth reports auth status; server skips unauthenticated providers |
| F4 | Result format inconsistency | Null fields, unexpected types | normalizer coerces all providers to a single JSON shape; unknown fields dropped |
| F5 | MCP protocol errors | tools/list returns wrong schema | G0 conformance gate catches schema drift |
| F6 | Client instruction drift | AI uses built-in tools instead of Infobroker | `search-preferences.md` is a spec-required deliverable; README documents the `opencode.json` snippet |
| F7 | Quota exhaustion without fallback | Provider returns rate-limit error | ProviderHealth tracks quota; exhausted providers are skipped by fallback chain; 80% warning threshold |
| F8 | Corroboration loop stalls | `corroborate` produces no new claims after iteration N | Hard cap on max_iterations; loop exits when no new sources found |
| F9 | Embedding model unavailable | KB tools return errors, auto-indexing silently fails | KB tools report degraded status with remediation "run once with network access to download the embedding model." Auto-indexing silently skips until model is available. |
| F10 | Knowledge base storage corruption | KB queries return unexpected results or fail | On detection, the server backs up the corrupt storage and creates a fresh store. The `kb` stats action reports the event. |
| F11 | Update overwrites user state | User config layer, KB content, or quota state lost after applying an update | User-owned state lives outside the distributed tree; shipped defaults and the user config layer are separate (REQ-010, REQ-042, REQ-043). G1 update-preservation tests guard the guarantee. |
| F12 | Generic provider misconfiguration | Empty results or parse errors from a user-defined endpoint | Config validation rejects a malformed endpoint or result mapping (REQ-014); a provider whose mapping produces no results advances the fallback chain (REQ-031) |

---

## §3 Standing Rules and Terminology

### Architectural Invariants

- **SR-001 Outbound by design.** Infobroker's primary operation is outbound HTTP requests. A local knowledge base may cache and index prior research results for semantic retrieval. The knowledge base is derivative — the server must function correctly when the KB is uninitialized or disabled.
- **SR-002 Single user.** One connection = one config. No multi-tenancy.
- **SR-003 API keys never surfaced.** Keys from env vars are injected at startup and never appear in tool output, logs, errors, or `providers` health responses.
- **SR-004 Zero-config works.** DuckDuckGo, Marginalia, Mojeek (in-process scraping) + Jina Reader, Wikipedia, Wiktionary, Wikidata, OpenStreetMap, Internet Archive, arXiv, Semantic Scholar, Stack Exchange, GitHub, CORE (all free HTTP, no API key required) provide a functional default.
- **SR-005 Providers are standalone modules.** Each search/content backend exports functions matching a common signature convention. Adding, removing, or swapping a provider requires updating the tool dispatch table but does not require modifying the tool surface — tool names, schemas, and response formats remain unchanged.
- **SR-006 Config hot-reloadable.** The config file is reloaded on `reload_config` invocation (or SIGHUP on the process) without dropping active connections.
- **SR-007 Rate limit state persists.** Quota counters survive restarts via a JSON state file.
- **SR-008 Corroboration is bounded.** `corroborate` has a hard max on iterations (default 5) and total HTTP calls per invocation (default 30).
- **SR-009 Determinism not required.** Web search results are inherently non-deterministic. Only deterministic behavior is tool schemas and error contracts.
- **SR-010 All tool input is validated server-side before any outbound call.** Validation includes structural checks (type, range, format, URL well-formedness) on every input field; no outbound request is dispatched until all validation passes.

- **SR-011 Contracts, not implementations.** Requirements state what the server
  must do. The verification gates (§9) enforce quality — do not prescribe how
  to achieve it. No output format catalogues, no tool-name enumerations outside
  §6.1, no specific architecture decisions outside §5.2, no worked examples
  disguised as requirements. If a verification gate catches a deviation, trust
  the gate.

  **Before adding a requirement, apply these tests:**
  (a) Does this REQ state *what* the server must do, or *how* to implement it?
  If it names a parameter type, default value, sort order, or algorithm — it's
  an implementation detail. Cut it. Exception: tool signatures in §4.3 define
  the server's external contract. Parameter names, required/optional status,
  and default values are part of *what* the tool must accept — an alternate
  implementation must accept the same parameters with the same defaults.
  Algorithm descriptions, sort orders, and internal state mechanics remain
  prohibited.
  (b) Can a verification gate (G0, G1, G2) catch a deviation from this REQ?
  If not, the REQ is either too vague or too prescriptive. Tighten or loosen
  accordingly.
  (c) Does this REQ duplicate content already present elsewhere in this spec?
  If so, cite it — don't restate it.
  (d) Does the REQ end with a "Default:" clause specifying a starting value?
  If so, remove it — defaults are the config file's domain (REQ-010).
  (e) Would the REQ still be valid if the builder chose a different library,
  data structure, algorithm, or file format? If not, it's locked to one
  implementation.

- **SR-012 Red-team every REQ.** Before finalizing a new or modified REQ, answer
  four questions: (a) How could an AI builder misinterpret this requirement?
  Read each sentence and list a plausible wrong reading. (b) What words in this
  REQ body are ambiguous or context-dependent? Flag every hedge, every undefined
  term, every provider-relative concept. (c) What edge case does this REQ not
  cover? Think across provider tiers — free_http without auth, keyed_http with
  quota exhaustion, self_hosted_http with user-controlled URLs. (d) What
  provider configuration would make this REQ inapplicable or contradictory?
  If any question produces a concrete gap, tighten the REQ or record the gap
  in Appendix B. This is a spec-authoring discipline — not a mechanical check
  — and is exercised by the author, not the builder. No _Check:_ citation
  attaches.

### Terminology

| Term | Definition |
|------|-----------|
| **Provider** | A search or content-extraction backend (DuckDuckGo, Wikipedia, Brave, etc.) |
| **Provider tier** | Built-in (in-process, zero config) / Free HTTP (no auth) / Self-hosted HTTP (user runs) / Keyed HTTP (API key required) / Generic HTTP (user-defined endpoint, configuration-defined) |
| **Fallback chain** | Ordered list of providers tried in sequence on failure |
| **Content renderer** | A provider that fetches and formats a URL (Jina Reader, native HTTP). Task type for dispatch: `content_fetch`. |
| **Task type** | A category of search task (general web, encyclopedia, academic, code, etc.) used by `web_search` auto-selection |
| **Corroboration** | The multi-pass truth-finding loop in `corroborate` |
| **Synthesis** | The container format that presents search findings to writing skills |
| **Collection** | A named namespace that scopes knowledge base content. Collections are implicit — they exist when first used. |
| **Chunk** | A segment of text stored with its embedding vector in the knowledge base. Each chunk retains the source URL, provider, and ingestion timestamp of the content it was derived from. |
| **Vector store** | The local database that indexes chunks by their embedding vectors and supports semantic (vector similarity) and keyword (full-text) retrieval. |
| **KB** | Abbreviation for "knowledge base." |
| **Freshness tier** | A classification assigned to knowledge base content at ingest time that determines how quickly its retrieval confidence decays and when it expires. Tiers range from volatile content that loses accuracy rapidly to stable content that remains accurate indefinitely. |

---

REQ IDs use block reservations: 001–004, 073, 079 (output/error contracts), 010–015 (provider configuration), 020–021, 024, 026–028 and their sub-REQs `020a`–`020e`, `021a`–`021c`, `024a`–`024c`, `026a`–`026d` (core tools), 030–037 (rate limiting and resilience), 040, 042–043 (state and configuration), 050–054 (client artifacts), 055, 077–078, 080–081 (spec integrity), 060, 064–067, 072, 074–076, 082–087 and sub-REQs `060a`–`060g` (knowledge base), 070–071 (provider architecture).

**Out of scope.** §4 defines functional requirements and tool contracts. Output format catalogues, file format specifications, and code-level interfaces are defined in `src/types.ts`. Worked examples and tutorials belong in the README.

---

## §4 Requirements

### 4.1 Output and Error Contracts

**REQ-001 — Status Prefix Contract**
Every tool response SHALL be a JSON object with at minimum: `status` (`"ok"` or `"error"`), `provider` (slug of the provider that serviced the request), `results` (array) or `error` (object). Client-facing text in `content` fields MUST use `[OK]` / `[ERROR]` prefixes for human-readable output. _Check:_ G0.

**REQ-002 — Error Taxonomy**
Errors SHALL include: `code` (machine-readable slug: `provider_unavailable`, `rate_limited`, `invalid_input`, `config_error`, `parse_error`, `all_providers_exhausted`, `corroboration_error`), `message` (human-readable), `provider` (which provider errored), `remediation` (what to try: "retry with fallback", "check API key", "wait 60s"). Errors that do not match a defined code SHALL use `internal_error`. _Check:_ G0.

**REQ-003 — Result Format Normalization**
All providers SHALL return results in a common shape that includes a title, URL, and snippet, with optional fields for publication date, source type, and the original source when the serving provider or its configuration declares the result is aggregated or resold. Provider-specific response formats SHALL be mapped to the common shape. _Check:_ G1.

**REQ-004 — Truncation**
Tool outputs longer than the configured max length SHALL be truncated and written to the filesystem at `$TMPDIR/infobroker/`. The tool response SHALL include a `truncated: true` flag and `output_path` pointing to the full file. The truncated text SHALL include an in-band note identifying that truncation occurred and where the full content was written. _Check:_ G1.

**REQ-073 — Minimum Viable Result**

After normalization, any result whose URL is absent or empty SHALL be discarded. Discarded results SHALL NOT count toward the caller's requested maximum results count. _Check:_ G1.

**REQ-079 — Output Verbosity**

The server SHALL support a configurable output verbosity that applies to all tool responses. In compact verbosity, responses SHALL omit optional metadata and per-result fields beyond title, URL, and snippet while retaining the REQ-001 envelope and any required result fields. Default verbosity SHALL be verbose. _Check:_ G1.

### 4.2 Provider Configuration

**REQ-010 — Config File**
Provider configuration SHALL reside in a JSON file at a path specified by the `INFOBROKER_CONFIG` environment variable. The configuration SHALL be composed of a shipped default configuration and a user configuration layer. Values in the user layer SHALL take precedence over values in the shipped default. The user configuration layer SHALL be preserved when the software is updated. The config declares each provider's tier, auth, rate limits, and priority, and SHALL support a defaults section supplying values inherited by providers that do not override them. _Check:_ G1.

**REQ-011 — API Key Safety**
API keys SHALL be accepted via environment variables: `INFOBROKER_<PROVIDER>_API_KEY`. Keys SHALL NOT appear in config file values, tool output, error messages, logs, or `providers` health responses. If a key is missing, the provider is marked `inactive` with reason "no_api_key". _Check:_ G1.

**REQ-012 — Environment Variable Mapping**
The env var prefix is `INFOBROKER_` followed by the provider slug in uppercase, suffixed `_API_KEY`. Example: `INFOBROKER_BRAVE_API_KEY`. For URL-based providers (SearXNG), the env var is `INFOBROKER_<PROVIDER>_URL`. _Check:_ G1.

**REQ-013 — Provider Discovery**
The server SHALL assess each configured provider's status: `active`, `inactive` (missing key or unreachable), or `degraded` (latency above a configurable threshold or partial results). The assessment SHALL be exposed via the `providers` tool, and startup SHALL NOT be delayed awaiting it. _Check:_ G1.

**REQ-014 — Generic HTTP Provider Tier**
The server SHALL support a provider tier whose search behavior is defined by configuration rather than by a provider module in the source tree. The configuration of a provider of this tier SHALL declare the HTTP endpoint it queries, how requests are constructed, and how responses map to the normalized result shape. A provider of this tier SHALL be added without source-code changes by placing its configuration entry in the user configuration layer and referencing it from a dispatch chain. A provider of this tier SHALL be subject to the same configuration validation as all providers, and an invalid configuration SHALL be rejected on load and reload. _Check:_ G1.

**REQ-015 — Provider Removal by Disable**
A disabled provider SHALL be treated as removed from dispatch: it SHALL NOT appear in fallback chains or provider recommendations, and it SHALL be skipped by all provider-selection logic. Disabling a provider SHALL require only a configuration change in the user configuration layer, SHALL NOT remove its configuration entry or backend module, and SHALL NOT require source-code changes. The disabled state SHALL be preserved across software updates. _Check:_ G1.

### 4.3 Core Tools

**REQ-020 — `web_search`**
`web_search` is the unified search tool. Parameters: `query` (required) which SHALL accept a single value or an array of up to five; plus optional `provider`, `max_results` (default 8, max 30), `safe_search` (default on), `time_range`, `page` (default 1), `priority`, `suggest` (default false), `content_type` (default all), and `region`. When `suggest` is true, the tool SHALL return query-autocomplete strings instead of results. Otherwise it SHALL return normalized results with provenance, enforce `max_results`, and SHALL fall back through the configured chain on failure. Array inputs SHALL be searched concurrently and merged into one response with per-input provenance. Providers SHALL ignore unsupported parameters without error; the `content_type` filter is applied server-side. _Check:_ G0, G1.

**REQ-020a — `web_search` auto-selection**
WHEN `provider` is omitted, the tool SHALL select the serving provider by classifying the query into a task type (§7.1) and using that type's dispatch chain (§7.2). The selection SHALL exclude exhausted, disabled, or unauthenticated providers and SHALL demote providers at quota warning per REQ-034. The response SHALL identify the serving provider. _Check:_ G1.

**REQ-020b — `web_search` suggestion mode**
WHEN `suggest` is true, the tool SHALL return autocomplete suggestions for the query from a suggestion-capable provider, presenting each as a result with a title and no URL. WHEN the primary suggestion provider fails, the tool SHALL attempt another suggestion-capable provider before returning an error; when none is available or all fail, the tool SHALL return an error per REQ-002. _Check:_ G0, G1.

**REQ-020c — `web_search` priority routing**

Parameters: the `web_search` tool accepts `priority` with values `privacy`, `free_only`, `speed`, and `quality`. WHEN a caller supplies `priority`, the tool SHALL route the query through a chain honoring that value: `privacy` SHALL prefer providers that do not forward queries to third parties, `free_only` SHALL exclude providers requiring an API key or self-hosted instance, `speed` SHALL prefer providers with the lowest recent latency, and `quality` SHALL use the default dispatch chain. The response SHALL identify the serving provider. _Check:_ G1.

**REQ-020d — `web_search` parameter transparency**

Parameters: the `web_search` tool accepts `time_range`, `page`, `safe_search`, `content_type`, and `region`. WHEN the serving provider does not support a caller-supplied parameter, the response SHALL list that parameter in `meta.ignored_params`. The list SHALL be empty when every supplied parameter is supported. _Check:_ G0, G1.

**REQ-020e — `web_search` query expansion**
WHEN `web_search` receives `expand` set to true, the tool SHALL return query-expansion strings instead of search results, derived from a suggestion-capable provider and the query's keywords, presented as results with a title and no URL. WHEN no suggestion-capable provider is available, the tool SHALL derive expansions from the query alone rather than erroring. _Check:_ G0, G1.

**REQ-021 — `fetch_page`**
Fetch and extract the content of a URL. Parameters: `url` (required) which SHALL accept a single value or an array of up to five; plus optional `renderer` (`jina` default, `native_fetch`, `wikipedia`, `internet_archive`, `arxiv`, `stack_exchange`), `max_length` (default 50k chars), `question`, `passage_size`, `max_passages`, and `detect_date`. Default renderer is Jina Reader (`https://r.jina.ai/{url}`) producing clean Markdown for LLM use. When the primary renderer is slow, the tool SHALL race a fallback renderer, returning the first successful render and preferring the primary within a short grace; it SHALL also fall back when the renderer is throttled or errors. Array inputs SHALL be processed concurrently and merged into a single response with per-input provenance. _Check:_ G0, G1.

**REQ-021b — `fetch_page` question-grounded extraction**
WHEN `fetch_page` receives a `question`, the tool SHALL split the fetched content into passages at sentence boundaries and SHALL return the passages ranked by relevance to the question, each with a relevance score, up to the configured passage count. The response SHALL identify the extraction mode: passage content when ranking produced a match, or full content with a note when no passage matched or the content was unreadable. A low top score SHALL be reported as the page not answering the question rather than as a ranking failure. _Check:_ G1.

**REQ-021c — `fetch_page` date detection**
WHEN `fetch_page` receives a `detect_date` request, the tool SHALL report the page's last-updated date when determinable from HTTP headers or document metadata, together with the evidence source and a confidence rating. WHEN no date is determinable, the tool SHALL omit the date field rather than guess. The detected date SHALL be surfaced alongside the content in the same response. _Check:_ G1.

**REQ-021a — `fetch_page` network-target safety**
WHEN `fetch_page` receives a URL whose host resolves to a loopback, private, link-local, or metadata address, the tool SHALL refuse to fetch it and SHALL return an error per REQ-002 unless the configuration permits private-network targets. The guard SHALL be reapplied after each redirect hop, up to a maximum number of hops that SHALL be configurable in the configuration file. A refused target SHALL be reported with a code that distinguishes the safety refusal from a general fetch failure. _Check:_ G1.

**REQ-024 — `providers`**
`providers` reports provider operational state. Parameters: `action` (required: list, health, spec), `provider` (optional slug; required when action is health). Each action SHALL behave per its sub-REQ. Responses SHALL follow the REQ-001 envelope. _Check:_ G0, G1.

**REQ-024a — `providers` list action**
WHEN action is list, the tool SHALL report every configured provider with its status, capabilities, rate limits, quota usage, and supported task types, with an optional filter selecting only active providers. WHEN a provider is not active, the tool SHALL report the reason for its state, distinguishing a missing API key, a missing endpoint URL, a provider disabled by configuration, and quota exhaustion. _Check:_ G0, G1.

**REQ-024b — `providers` health action**
WHEN action is health, the tool SHALL perform a live connectivity check against the named provider and report its resulting status, average latency, current quota counters, and the timestamps of the most recent error and success from operational history. _Check:_ G0, G1.

**REQ-024c — `providers` spec action**
WHEN action is spec, the tool SHALL report build identity, provider counts, uptime, cumulative request count, and paths to persistent state files; when the knowledge base is configured, the report SHALL also include chunk count, per-collection counts, freshness tier distribution, and last ingestion timestamp. _Check:_ G0, G1.

**REQ-026 — `corroborate`**
Multi-pass truth-finding search. Parameters: `query` (required), `max_iterations` (default 5, max 10), `confidence_threshold` (default 0.8), `providers` (optional array, defaults to all active), `priority` (optional, routes the corroboration pool by intent). It SHALL search across providers, reconcile claims into findings, and return each finding with a claim, verdict, confidence, and up to three corroborating sources. The response SHALL include an agreement map and a synthesis statement. See §8 for the full corroboration algorithm. _Check:_ G0, G1.

**REQ-026a — corroboration source authority**

When `corroborate` computes a finding's confidence, the confidence SHALL reflect the authority of the corroborating sources in addition to their independence. Source authority SHALL be determined by each source's `source_type`, such that scholarly, encyclopedia, and primary sources contribute more weight than generic web pages. The authority weights SHALL be configurable in the configuration file, and a finding's reported confidence SHALL use the configured weights. _Check:_ G1.

**REQ-026b — corroboration claim attribution**

Each finding returned by `corroborate` SHALL associate every corroborating source with the specific claim that source supports. A finding SHALL report, alongside its verdict and confidence, the per-source claim text. _Check:_ G1.

**REQ-026c — corroboration source preservation**
WHEN source preservation is enabled in the configuration, `corroborate` SHALL best-effort capture a durable archive reference for each corroborating source URL and SHALL report that reference alongside the live URL in the finding. Preservation SHALL be non-blocking, bounded in concurrency, and SHALL NOT affect confidence, verdict, or the response on archive failure. _Check:_ G1.

**REQ-026d — corroboration provenance record**
The `corroborate` response SHALL include a provenance record naming the server version, the effective iteration limit, confidence threshold, and the per-source-type contribution to each finding, formatted so a downstream citation can document the analytic tooling used. The record SHALL be present in verbose output. _Check:_ G1.

**REQ-026e — corroboration knowledge-base recall**
WHEN the knowledge base is configured and recall is enabled, `corroborate` SHALL query the knowledge base for prior findings before external search and SHALL reconcile any returned results as corroborating sources alongside fresh external results. Knowledge-base results SHALL be capped in number and SHALL carry their original source URLs. A knowledge base that is uninitialized, disabled, or failing SHALL NOT prevent external search, and a corroboration SHALL NOT be served from the knowledge base alone. _Check:_ G1.

**REQ-027 — `cite`**
The `cite` tool returns academic references for a query. Parameters: `query` (required), `max_results` (default 8, max 30). It SHALL return each reference with a formatted BibTeX citation and the fields needed to render it: title, authors, year, venue, and URL. It SHALL operate without an API key when at least one scholarly source is reachable. A reference without author data SHALL be formatted as a non-article entry rather than omitted. _Check:_ G0, G1.

**REQ-028 — `web_search` deep reading**
WHEN `web_search` receives `deep` set to true, the tool SHALL, after returning search results, fetch the top-ranked result pages and rank each page's passages against the query, reusing the passage ranking of REQ-021b. The response SHALL associate each fetched result with its ranked passages, each with a relevance score, up to the configured passage count. A result whose page cannot be fetched SHALL be reported with its snippet rather than dropped. The number of pages fetched SHALL be bounded by configuration. _Check:_ G1.

### 4.4 Rate Limiting and Resilience

Rate limiting (REQ-030) and quota tracking (REQ-033, REQ-034) use separate
fields from the provider's rate_limit configuration. Throttling is governed by
`per_second`; quota is governed by `per_day` and `per_month`. These systems
operate independently.

**REQ-030 — Per-Provider Throttling**
Each provider SHALL enforce a configurable minimum interval between requests. The throttle SHALL be scoped per-provider, not global. _Check:_ G1.

**REQ-031 — Fallback Chain**
The fallback chain SHALL be ordered by provider priority in `config.json` and SHALL exclude providers that are disabled or lack required authentication. The server SHALL hedge on latency by dispatching lower-priority providers once the serving provider exceeds a configurable threshold, and SHALL return the first provider to succeed. On error, response timeout, or empty results, the server SHALL try the next provider, counting a blocked or non-parseable response as a provider failure. The maximum fallback depth SHALL be configurable. When every provider in the chain is exhausted by errors, the server SHALL return an error with code `all_providers_exhausted`; when every provider instead returns empty, the server SHALL return a successful empty result. _Check:_ G1.

**REQ-032 — Retry Policy**
Providers SHALL retry on transient errors before advancing to the next provider in the fallback chain. Retry backoff and maximum retry count SHALL be configurable per provider in `config.json`. _Check:_ G1.

**REQ-033 — Persistent Quota Tracking**

Daily and monthly quota counters SHALL persist to `$TMPDIR/infobroker/quota.json`. Counter state SHALL be durably written to disk such that quota enforcement survives server restarts. Counters reset on schedule (daily at midnight UTC, monthly at month boundary). _Check:_ G1.

**REQ-034 — Quota Warning Threshold**
At 80% of quota usage, the `providers` health action SHALL report status `degraded` with a `quota_warning` field. At 100%, status becomes `exhausted` and the provider is skipped by fallback chains until reset. _Check:_ G1.

**REQ-035 — Request Timeout**
Each outbound provider call SHALL be bounded by a configurable timeout. A call
that exceeds the timeout SHALL be treated as a transient failure and SHALL
trigger fallback chain advancement. The timeout is configurable per provider in
`config.json`. _Check:_ G1.

**REQ-036 — Latency Tracking Window**
Provider latency metrics reported via the `providers` health action SHALL be computed over
a bounded time window. The window strategy is configurable. All-time unbounded
accumulation SHALL NOT be the sole computation strategy. _Check:_ G1.

**REQ-037 — Config Validation**
The server SHALL validate the configuration structure on load and reload.
Validation SHALL reject: missing required provider fields, dispatch chains
referencing providers not declared in the configuration, and invalid rate-limit
values. On reload, an invalid configuration SHALL leave the previous
configuration active without interruption. _Check:_ G1.

### 4.5 State and Configuration

**REQ-040 — Configuration Reload**
The `reload_config` tool SHALL re-read the config file without restarting. Active connections are preserved. If the new config is invalid, the previous config remains active and an error is returned. _Check:_ G1.

### 4.6 Provider Architecture

**REQ-070 — Provider Registration**
Adding a provider backend to the source tree SHALL NOT require modification
of any tool handler source code — the functions that respond to MCP
tool/call requests. The server SHALL resolve a provider slug to its search,
health, and content-fetch implementations through a single mapping
structure maintained independently of tool handler source. A provider
present in the source tree but disabled in configuration SHALL be
registered but skipped during dispatch. _Check:_ G1.

**REQ-071 — Outbound HTTP Identification**
Every outbound HTTP request from a provider backend SHALL include an
identifier that distinguishes the request as originating from this server.
The identifier SHALL be consistent across all providers regardless of
provider tier or transport. _Check:_ G1.

### 4.7 Client Artifacts

**REQ-050 — `search-preferences.md`**
The build SHALL produce an instruction file at `instructions/search-preferences.md` that maps user intent to Infobroker tools. The instruction file SHALL direct the client to prefer knowledge base search over external web search for content that may have been previously indexed, treating external providers as fallback when the knowledge base returns no relevant results. The instruction file SHALL direct the client to rely on the `web_search` tool's built-in knowledge-base-first retrieval for external queries and SHALL reserve a direct `kb` search for answering from stored content alone or inspecting the knowledge base. This file is sourced by the MCP client's instruction loader. _Check:_ G3 (file presence, content verification).

**REQ-051 — Orchestrator Skill**
The build SHALL produce an OpenCode-compatible skill at `skills/infobroker/SKILL.md` that chains Infobroker tools with the bundled writing and research skills. The skill SHALL define a Research Professional pipeline and a Fact-Check Pipeline. Each pipeline SHALL include a knowledge-base retrieval phase before external web search that the `web_search` tool's built-in KB-first behavior satisfies, reserving a direct `kb` search for stored-content-only answers and knowledge-base inspection. _Check:_ G3 (file presence, content verification).

**REQ-052 — Bundled Skills**
The build SHALL produce an orchestrator skill (REQ-051) that references four pipeline skills — summarization, technical-writing, proofreading, and translation — by name, and that routes research requests to workflow shapes defined in `skills/infobroker/references/workflows.md`. These skills SHALL be shipped in the repository so the build is self-contained and requires no external skill dependency. _Check:_ G3 (content verification).

**REQ-053 — Pipeline Reference**
The build SHALL include `skills/infobroker/references/pipeline-map.md` with a Mermaid diagram of the skill pipeline, `skills/infobroker/references/provider-map.md` with the task→provider dispatch table, `skills/infobroker/references/workflows.md` with the workflow-shape definitions, and `skills/infobroker/references/journeys.md` mapping user intents to the workflow shapes, tool sequence, and recovery procedures each journey follows. _Check:_ G3 (file presence).

**REQ-054 — User Documentation**
The build SHALL generate a `README.md` documenting: setup steps, provider configuration, `opencode.json` integration snippet, skill pipeline overview, and how to add new providers. _Check:_ G3 (file presence).

**REQ-088 — Gated-Analysis Technique Selection**
The build SHALL produce a gated-analysis skill at `skills/analysis-loop/SKILL.md` that provides a technique-selection mechanism. When the skill enters its analysis phase, it SHALL select one structured analytic technique by matching the analysis state to fit criteria in a bundled catalog at `skills/analysis-loop/references/techniques.md`, SHALL name the selected technique and its fit rationale in the output, and SHALL apply the technique as a discrete step whose result is reported. The catalog SHALL document at least six techniques across at least three families of the intelligence tradecraft canon, each with a fit criterion, a method, and an output. _Check:_ G3 (file presence, content verification).

### 4.8 Spec Integrity

**REQ-055 — Spec-Code Traceability**
Every source file in `src/` SHALL cite in a header comment each REQ it
implements, using the format `@implements REQ-NNN`. A file may satisfy multiple
REQs; every implemented REQ must appear in at least one source file's citation.
The `validate-spec` script (§9.4) verifies bidirectional coverage: every REQ
with an implementation must be cited, and every source file must cite at least
one REQ. Generated artifacts (build output, `node_modules/`) and client-artifact
REQs (§4.7, verified by file presence) are exempt. _Check:_ G3.

**REQ-077 — REQ Manifest**
The specification SHALL include a manifest table
listing every REQ with its ID, title, section, and verification gate. The
manifest SHALL match the REQ bodies in §4 exactly: no REQ in the body without
a manifest row, and no manifest row without a body. _Check:_ G3.

**REQ-078 — Feature Taxonomy**
The specification SHALL include a feature
taxonomy appendix (§D) that lists every tool and every §4 REQ grouped by
thematic feature area, with each area's primary REQ range and verification gate.
The taxonomy SHALL be exhaustive: every tool and every §4 REQ SHALL appear in
exactly one feature area. The client-facing README SHALL link to the taxonomy.
_Check:_ G3.

**REQ-080 — Tool Default Consistency**
Every tool parameter default declared in this specification SHALL be the value the tool applies when the parameter is omitted, and no code path SHALL apply a different value. Behavior configurable through the configuration file SHALL resolve entirely from the configuration, and source code SHALL NOT carry a divergent numeric fallback for a value the configuration supplies. Where a tool default and a configuration value describe the same limit, they SHALL match. Verification SHALL fail when any of these divergences is present. _Check:_ G3.

**REQ-081 — Token Footprint Report**
The `providers` spec action SHALL report a token-footprint record measuring the advertised tool surface and the server's typical response size. The record SHALL include the total byte size of the advertised tool schemas derived from live tool registration, and a byte measurement of recent tool responses. The measurements SHALL be derived from live registration and measured responses rather than static literals. _Check:_ G1.

### 4.9 Knowledge Base

**REQ-060 — `kb`**
`kb` manages the local knowledge base and stored reports. Parameters: `action` (required: search, ingest, list, get, stats, delete, encryption) and the parameters of the selected action's sub-REQ. Each action SHALL behave per its sub-REQ. When the knowledge base is unconfigured or invalid, every action SHALL return an error per REQ-002. Responses SHALL follow the REQ-001 envelope. _Check:_ G0, G1.

**REQ-060a — `kb` search action**
WHEN action is search, the tool SHALL return chunks ranked by combined vector similarity and full-text relevance, each with source URL, score, collection, source type, and a matching snippet. The tool SHALL accept a maximum-results count (default 8, max 50), a collection filter, and a source-type filter, and SHALL return zero results when the knowledge base is empty or no matches are found. _Check:_ G0, G1.

**REQ-060b — `kb` ingest action**
WHEN action is ingest, the tool SHALL index provided text or a fetched URL into the knowledge base, accepting an optional title, collection, source type, freshness tier, source last-updated date, save destination, and format. At least one of text or URL SHALL be provided; a fetch failure SHALL return an error. The tool SHALL report the number of chunks ingested and the source identifier. _Check:_ G0, G1.

**REQ-060c — `kb` stats action**
WHEN action is stats, the tool SHALL report total chunk count, per-collection chunk counts, estimated storage size, last ingestion timestamp, embedding model availability, and any status events such as storage-corruption recovery. _Check:_ G1.

**REQ-060d — `kb` delete action**
WHEN action is delete, the tool SHALL remove chunks by collection or source URL, requiring at least one filter, and SHALL report the count of removed chunks. _Check:_ G0, G1.

**REQ-060e — `kb` list action**
WHEN action is list, the tool SHALL enumerate stored documents as distinct entries with title, source URL, collection, source type, freshness tier, chunk count, ingest timestamp, and stored source last-updated date, ordered newest first, and SHALL accept a collection filter and a source-type filter. _Check:_ G1.

**REQ-060f — `kb` get action**
WHEN action is get, the tool SHALL return a stored document in full by source URL, reassembling its chunks in order, and SHALL return an error when no document matches the source URL. _Check:_ G1.

**REQ-060g — `kb` encryption action**

WHEN action is encryption, the tool SHALL operate on the knowledge base's at-rest encryption state per its `operation` sub-parameter: `status` SHALL report the encryption state and on-disk format, `generate_key` SHALL write a new key to a caller-supplied key-file path without returning key material, `verify` SHALL test the active key against the store, `backup` SHALL copy the active key file to a caller-supplied backup path, and a rekey sub-operation SHALL re-seal the store to a new key file without loss of stored content. This action SHALL remain reachable while the store is locked. _Check:_ G0, G1.

**REQ-064 — Auto-Indexing**

Search results from `web_search`, rendered page content from `fetch_page`, and findings from `corroborate` SHALL be automatically indexed into the knowledge base. Auto-indexing SHALL NOT delay or error the response to the originating tool call, irrespective of auto-indexing success or failure. An auto-indexing failure SHALL NOT surface to the caller of the originating tool. Auto-indexing SHALL be toggleable via configuration. _Check:_ G1.

**REQ-065 — Collection Scoping**

A collection exists and is addressable the first time content is assigned to it. The active collection for auto-indexing and for any knowledge base tool call that omits the `collection` parameter SHALL be the most specific collection specifier available, where a tool-provided parameter takes precedence over the environment variable `INFOBROKER_KB_COLLECTION`, which takes precedence over the configured default. If no specifier is set at any level, the collection SHALL be the literal string `"default"`. Querying a collection that has no content returns zero results, not an error. _Check:_ G1.

**REQ-066 — Content Expiry**

Indexed content SHALL be removable by age. The removal interval for content SHALL be determined by its freshness tier, not by its source type. Content whose freshness tier defines no expiry SHALL remain in the knowledge base indefinitely. Expired content SHALL be removed on server startup and at the configured maintenance interval. Auto-removed content SHALL NOT trigger error events. _Check:_ G1.

**REQ-067 — Knowledge Base Configuration**

The knowledge base configuration SHALL reside within the server's main configuration file. The configuration SHALL specify: storage location, embedding model reference, chunking parameters, auto-indexing toggle, default collection name, freshness tier definitions including per-tier confidence decay rates and expiry intervals, auto-classification strategy, KB-first sufficiency thresholds, maximum results per query, an optional report storage directory, and an optional default save destination for reports. If the knowledge base configuration section is absent or invalid, all knowledge base tools SHALL return an error with remediation. Config reload SHALL apply knowledge base configuration changes per REQ-040. _Check:_ G1.

**REQ-072 — Knowledge Base Deduplication**

Content ingested into the knowledge base SHALL be deduplicated by source URL. Ingesting a URL that has already been indexed SHALL replace or update the existing chunks rather than creating duplicates. Reports ingested without a source URL SHALL be assigned a stable identifier derived from their title so that re-ingesting the same report updates it in place. The chunk count reported by the `kb` stats action SHALL NOT increase when re-ingesting a previously indexed URL. _Check:_ G1.

**REQ-074 — Freshness Classification**

Content ingested into the knowledge base SHALL be classified into a freshness tier at the time of ingestion. The knowledge base SHALL support multiple freshness tiers whose definitions are configurable. Each freshness tier SHALL define a rate at which retrieval confidence decays as the content ages, and a maximum age beyond which the content is removed from the knowledge base. Content for which the classification mechanism produces no determination SHALL be assigned a configurable default tier. The classification strategy SHALL be hot-reloadable per REQ-040. _Check:_ G1.

**REQ-075 — Confidence Decay**

Knowledge base search results SHALL include a freshness-adjusted score that accounts for both semantic relevance and content age. The adjustment SHALL be proportional to the content's freshness tier and the elapsed time since ingestion. Content whose freshness tier defines zero decay SHALL be reported with its relevance score unchanged. Results SHALL be ranked by freshness-adjusted score. _Check:_ G1.

**REQ-076 — KB-First Sufficiency**

When the knowledge base is configured, every web search SHALL query the knowledge base before external providers. If the knowledge base returns results that meet a configurable relevance threshold and a configurable freshness confidence threshold, those results SHALL replace external search. If the knowledge base returns no results, or if the results do not meet both thresholds, external search SHALL proceed without error. A knowledge base that is uninitialized or disabled SHALL NOT prevent external search. Results returned from the knowledge base SHALL include their original source URLs. _Check:_ G1.

**REQ-082 — KB Retrieval Consistency**

The knowledge base SHALL remain retrievable as content accumulates: content indexed earlier SHALL remain discoverable by search after later content is ingested, and retrieval SHALL NOT discard matching content solely because the store has grown or because the embedding model configuration changed since that content was indexed. When the embedding model configuration changes, the server SHALL reconcile stored content so that previously indexed chunks remain comparable to new queries. Stored content that cannot be retrieved under the current configuration SHALL be surfaced as a status event rather than silently omitted. _Check:_ G1.

**REQ-083 — Report Storage**

The knowledge base SHALL store generated reports as a distinct content class. A report SHALL be tagged with a report source type and stored per REQ-065 so that it remains retrievable in full and enumerable via the `list` action. A report SHALL be retained indefinitely and SHALL NOT be auto-removed, while its retrieval confidence SHALL decay with age per its freshness tier so that an outdated report does not satisfy KB-first sufficiency for time-sensitive queries. Ingesting a report SHALL support an optional save destination that writes the report to a local file as well as, or instead of, the knowledge base, defaulting to the knowledge base. _Check:_ G1.

**REQ-084 — KB At-Rest Encryption**

The knowledge base SHALL support optional at-rest encryption of its stored content and of reports written to disk, where the key SHALL be derived from a user-supplied secret that is never stored with the content. WHEN encryption is enabled, the server SHALL NOT persist knowledge-base content or reports in plaintext, SHALL refuse knowledge-base operations when the required secret is unavailable or invalid, reporting the refusal as an error per REQ-002, and SHALL report the encryption state in the stats action. The server SHALL support changing the secret without loss of stored content. WHEN encryption is disabled, stored content SHALL remain readable. _Check:_ G1.

**REQ-085 — KB Data Preservation**

WHEN the knowledge base store cannot be read — because the encryption key is unavailable, decryption fails, or the file format is unrecognized or newer than supported — the server SHALL NOT modify, overwrite, rename, or delete the store file, SHALL NOT persist new content, and SHALL report the failure as an error per REQ-002, leaving the store unchanged for recovery. The server SHALL persist knowledge-base content only through atomic writes such that a crash leaves either the previous complete store or the new complete store, never a partial file. A store written in an unrecognized or newer format SHALL NOT be rewritten by this version. _Check:_ G1.

**REQ-086 — KB Encryption Transitions and Recovery**

The knowledge base SHALL support enable and disable of at-rest encryption (REQ-084) as explicit, immediate transitions. WHEN encryption is enabled while the store is plaintext, the server SHALL encrypt the store in place; WHEN encryption is disabled while the store is encrypted and the secret is available, the server SHALL decrypt the store in place. Each transition SHALL commit atomically and verify the result before replacing the store. WHEN the store is locked, the server SHALL expose the encryption state, the on-disk format, and a recovery directive through a knowledge-base operation that remains reachable while locked. The server SHALL support verifying a candidate secret against the store and re-keying the store to a new secret without loss of stored content. _Check:_ G1.

**REQ-087 — KB Source Date Preservation**

WHEN knowledge-base ingest knows a source's last-updated date, whether supplied by the caller or determined from a fetched URL per REQ-021c, the tool SHALL store that date with the ingested content. The list, get, and search actions SHALL report the stored source date alongside their other fields. WHEN no date is known, the actions SHALL omit the date field rather than guess. Re-ingesting a source SHALL preserve a previously stored date when the new ingest supplies none. _Check:_ G1.

### 4.10 Deployment and Updates

**REQ-042 — Source Distribution**

Users SHALL obtain the server from a public source repository. Updates
SHALL be delivered as repository updates that users apply to their local
copy. The distributed repository SHALL NOT contain user configuration
layers, stored research content, or accumulated quota state. _Check:_ G1.

**REQ-043 — Update Preservation**

Applying an update to the server SHALL NOT remove, reset, or overwrite
user-owned state: the user configuration layer (REQ-010), indexed
knowledge base content (REQ-067), and accumulated quota state (REQ-033).
The server SHALL operate on preserved user state after an update without
requiring reconfiguration. _Check:_ G1.

---

## §5 Build Process

### 5.1 Language and Runtime

- Language: TypeScript (Node.js 20+)
- MCP SDK: `@modelcontextprotocol/sdk` (stdlib transport)
- Validation: `zod` (peer dependency of MCP SDK)
- HTTP: `undici` (built into Node.js 20+)
- HTML parsing: `cheerio` (for DuckDuckGo scraping)
- Distribution: public source repository (currently hosted at git.gay). Users clone the repository and run locally with `tsx src/index.ts`; updates arrive as repository fetches. Secret material is provided at runtime via environment variables (REQ-011).

### 5.2 Layered Architecture

```
Layer 3: Tools                 web_search, fetch_page, corroborate, cite,
                               providers, kb, reload_config

Layer 2: Provider Backends     duckduckgo, marginalia, mojeek, wiby, brave, searxng,
                               wikipedia, wiktionary, wikidata, openstreetmap,
                               semantic_scholar, arxiv, core, stack_exchange,
                               github, jina, internet_archive, exa, tavily, yep

Layer 1.5: Knowledge Base      Chunking, embedding generation, vector store,
                               auto-indexing hooks, collection scoping, expiry

`native_fetch` (content fallback) is implemented inline in the `fetch_page`
tool handler rather than as a standalone provider file; it has no health
check or rate limiting.

Layer 1: MCP Skeleton          @modelcontextprotocol/sdk, zod schemas,
                               stdio transport, json-rpc handler
```

### 5.3 Provider Plugin Interface

Every provider implements:
```typescript
interface Provider {
  slug: string;
  tier: 'builtin' | 'free_http' | 'self_hosted_http' | 'keyed_http' | 'generic_http';
  capabilities: ('web_search' | 'academic' | 'code' | 'encyclopedia' | 'news' | 'archive' | 'content_fetch')[];
  rateLimit: { perSecond?: number; perDay?: number; perMonth?: number };
  health(): Promise<{ status: "active" | "degraded" | "inactive"; avgLatencyMs: number }>;
  search(query: string, options: SearchOptions): Promise<SearchResult[]>;
  fetchPage?(url: string): Promise<string>;
  suggest?(query: string): Promise<string[]>;
}
```

Terminology tier names map to interface `tier` values: Built-in → `builtin`,
Free HTTP → `free_http`, Self-hosted HTTP → `self_hosted_http`, Keyed HTTP →
`keyed_http`, Generic HTTP → `generic_http`. A generic HTTP provider is not a
distinct module per provider: every generic provider is a configuration
instance resolved through the registration mapping (REQ-070) to a single
shared implementation, so adding one requires no provider-module source
change (REQ-014).

### 5.4 Build Phases

1. **MCP Skeleton**: stdio transport, tool registration, config loader, env var reader.
2. **Zero-Config Providers**: DuckDuckGo (HTML scraping), Jina Reader (HTTP), Wikipedia API, Wiktionary API, Internet Archive.
3. **Registration-tier & Keyed Providers** (optional): Semantic Scholar, Stack Exchange, GitHub, CORE (free unauth tiers; see §A.3); Brave, Exa, Tavily (API key required; see §A.4). Generic HTTP provider support (REQ-014): the shared generic-http implementation parameterized by configuration.
4. **Tools**: Wire providers to tool handlers. Implement fallback chains, rate limiting, quota tracking, normalization.
5. **Corroboration Engine**: Multi-pass search loop with cross-reference, refinement, and confidence scoring.
6. **Client Artifacts**: Generate `search-preferences.md`, skill files, README.
7. **Auth Reference Generation**: Read `config.json` for `auth_env`/`url_env` fields; generate `skills/infobroker/references/provider-auth.md` with the provider-to-auth mapping.
8. **Verification**: G0 MCP conformance, G1 mock provider tests, G2 live smoke tests (key-gated).
9. **Knowledge Base**: Embedding model loader, vector store initialization, chunking pipeline, auto-indexing hooks wired to `web_search`, `fetch_page`, and `corroborate`, the `kb` MCP tool, content expiry maintenance loop.

### 5.5 Corroboration Quality (Single Phase)

Unlike Holonovel (which has a ruleset extraction phase), Infobroker has a single
construction quality phase: tool schemas are author-declared and verified against
the MCP specification at build time. Provider backends are tested with mock
responses. The corroboration loop validates against:
- Every tool has a zod schema and a registered handler
- Every provider implements the Provider interface
- Fallback chains have at least one active provider
- `corroborate` exits within max_iterations

---

## §6 Runtime Conventions

### 6.1 Tool Naming

All tools use `snake_case`. Tool names are domain terminology: `web_search`,
`fetch_page`, `corroborate`, `cite`, `providers`, `kb`, `reload_config`. These logical
names are registered with the MCP client under an `infobroker_` prefix
(e.g., `infobroker_web_search`).

### 6.2 Output Format

Tool responses are JSON with this envelope:
```json
{
  "status": "ok",
  "provider": "wikipedia",
  "results": [...],
  "meta": {
    "query_time_ms": 234,
    "fallback_used": false,
    "quota_remaining": 950
  }
}
```

### 6.3 Provider API Conventions

| Provider | Endpoint Base | Notes |
|----------|-------------|-------|
| DuckDuckGo | `https://html.duckduckgo.com/html/` | HTML scraping, 3s minimum interval |
| Wikipedia | `https://en.wikipedia.org/w/api.php` | `action=query&format=json` |
| Wiktionary | `https://en.wiktionary.org/w/api.php` | Same API as Wikipedia |
| Wikidata | `https://www.wikidata.org/w/api.php` | `action=wbsearchentities` + `action=wbgetentities` |
| OpenStreetMap | `https://nominatim.openstreetmap.org/search` | 1 req/sec, User-Agent required |
| Jina Reader | `https://r.jina.ai/` | Append URL to path, returns Markdown |
| Internet Archive | `https://archive.org/wayback/available` | Check availability, then fetch |
| Semantic Scholar | `https://api.semanticscholar.org/graph/v1/` | 1 RPS authenticated, shared pool unauth |
| arXiv | `https://export.arxiv.org/api/query` | 1 call/3 sec |
| Stack Exchange | `https://api.stackexchange.com/2.3/` | 300/day unauth, 10,000/day keyed |
| GitHub | `https://api.github.com/search/code` | 60/hr unauth, 5,000/hr token |
| Brave | `https://api.search.brave.com/res/v1/web/search` | 2,000/mo free tier |
| SearXNG | User-configured (`/search?format=json`) | Requires Docker, JSON format must be enabled |
| Marginalia | `https://search.marginalia.nu/search` | HTML scraping, open source |
| Mojeek | `https://www.mojeek.com/search` | HTML scraping, independent index |
| Wiby | `https://wiby.me/` | HTML scraping, curated small-web directory |
| Exa | `https://api.exa.ai/search` | 1,000/mo free tier, neural search |
| Tavily | `https://api.tavily.com/search` | 1,000/mo free credits |
| Yep | `https://platform.yep.com/api/search` | 1,000 free requests, Ahrefs first-party index |
| CORE | `https://api.core.ac.uk/v3/search/works` | Open access research |

### 6.4 Jina Reader
Append the target URL to `https://r.jina.ai/`. Example:
`https://r.jina.ai/https://example.com/article`. Jina returns the page content
rendered as Markdown. Falls back to native HTTP GET + HTML-to-text extraction
when Jina returns 429 or error.

---

## §7 Provider Selection Dispatch

### 7.1 Task Types

| Task type | Description | Key metric |
|-----------|-------------|-----------|
| `general_web` | Broad topic search | Relevance, diversity |
| `small_web` | Non-commercial, blogs, personal sites | Unique content |
| `encyclopedia` | Factual, encyclopedic information | Authoritativeness |
| `definition` | Word definitions, etymology, translations | Structure |
| `structured_fact` | Dates, statistics, identifiers | Precision |
| `location` | Geocoding, place lookup | Accuracy |
| `academic` | Papers, citations, authors | Scholarly authority |
| `code` | Code snippets, technical Q&A | Correctness |
| `news` | Recent events, current affairs | Recency |
| `archive` | Historical web pages, past versions | Historical range |
| `semantic` | "Find things like X", conceptual search | Embedding similarity |
| `synthesis` | Synthesized answer with citations | Factual density |
| `privacy_critical` | Must not leak query to third party | Data sovereignty |

### 7.2 Dispatch Table

| Task type | Primary | Fallback 1 | Fallback 2 |
|-----------|---------|-----------|-----------|
| `general_web` | brave (if keyed) | duckduckgo | marginalia |
| `small_web` | marginalia | mojeek | duckduckgo |
| `encyclopedia` | wikipedia | duckduckgo | — |
| `definition` | wiktionary | duckduckgo | — |
| `structured_fact` | wikidata | wikipedia | duckduckgo |
| `location` | openstreetmap | wikipedia | duckduckgo |
| `academic` | semantic_scholar | arxiv | — |
| `code` | stack_exchange | github | duckduckgo |
| `news` | brave (if keyed) | duckduckgo | — |
| `archive` | internet_archive | duckduckgo | — |
| `semantic` | exa (if keyed) | brave (if keyed) | duckduckgo |
| `synthesis` | tavily (if keyed) | exa (if keyed) | duckduckgo |
| `privacy_critical` | duckduckgo | searxng (if configured) | mojeek |
| `content_fetch` | jina | native_fetch | — |

### 7.3 Provider Deprioritization

`web_search` auto-selection SHALL consider current quota remaining when
selecting. A provider at >80% usage is demoted one tier in the dispatch table.
A provider at 100% is removed from selection until reset.

### 7.4 Priority Routing

The `web_search` `priority` parameter (REQ-020c) overrides the task-type
chain with an intent-first selection:

| Priority | Routing behavior |
|----------|------------------|
| `privacy` | Use the `privacy_critical` chain (DuckDuckGo, SearXNG if configured, Mojeek); fall back to the task chain if empty |
| `free_only` | Exclude `keyed_http` and `self_hosted_http` providers from the selected chain |
| `speed` | Order the selected chain by lowest recent average latency; providers with no recorded latency retain configuration priority order |
| `quality` | Use the default task-type dispatch chain (unchanged) |

An explicit `provider` parameter takes precedence over priority routing.

---

## §8 Corroboration Loop

### 8.1 Algorithm

```
function corroborate(query, max_iterations=5, confidence_threshold=0.8, providers=[...], priority=None):
  findings = {}
  iteration = 0

  // Phase 0: Knowledge-base recall (REQ-026e) — prior findings reconcile as
  // corroborating sources; never blocks external search.
  kb_results = kb_recall(query)
  reconcile_claims(findings, kb_results)

  while iteration < max_iterations:
    // Phase 1: Broad search across all active providers (up to
    // first_pass_max_results results per provider, default 10)
    raw_results = parallel_search(query, providers)
    claims = extract_claims(raw_results)

    // Phase 2: Cross-reference — group claims by topic
    grouped = group_by_topic(claims)
    for (topic, claims_set) in grouped:
      agree, disagree, gaps = reconcile(claims_set)

      if agree.length >= 2:
        findings[topic] = {
          confidence: compute_confidence(agree.length, providers),
          sources: agree.map(source_info),
          verdict: "confirmed"
        }
      else if disagree.length > 0:
        findings[topic] = {
          confidence: low,
          sources: disagree.map(source_info),
          verdict: "contested",
          perspectives: map_variants(disagree)
        }
      else:
        gaps.push(topic)

    // Phase 3: Refinement — search specifically for gap topics
    if gaps.length == 0 || confidence_threshold_met(findings, confidence_threshold):
      break

    for gap in gaps:
      refined_query = derive_query(gap, findings)
      more_results = search(refined_query, best_provider_for(gap))
      add_to_claims(more_results)

    iteration++

  return {
    findings: [{topic, claim, confidence, verdict, sources, perspectives?}],
    agreement_map: {green: [...], yellow: [...], red: gaps},
    synthesis: summary(findings),
    iteration_count: iteration,
    providers_used: [...],
    total_sources: count_total_sources(findings)
  }
```

### 8.2 Confidence Scoring

| Sources agreeing | Confidence | Rating |
|-----------------|-----------|--------|
| 0 | 0.0 | Unverified |
| 1 | 0.3 | Single source |
| 2 (independent) | 0.7 | Corroborated |
| 3+ (independent) | 0.9 | Well-corroborated |
| 5+ including 1 primary | 1.0 | Established |

The default `confidence_threshold` of 0.8 therefore gates `green` on the 0.9
tier (three or more independent sources); the 0.7 tier (two independent
sources) reports as `yellow`. Source authority (REQ-026a) scales the
independence-based confidence above by a per-source-type weight, so a finding
backed only by generic web pages scores below one backed by scholarly or
encyclopedia sources at the same source count.

Independence: Two sources are independent if they have different registrable
domains (e.g., wikipedia.org and britannica.com are independent; two pages on
wikipedia.org, or two subdomains of the same registrable domain, are not).
The similarity threshold at which claims are grouped into an agreement cluster
is configurable via `corroboration.similarity_threshold`.

### 8.3 Iteration Limits

- `max_iterations` defaults to 5, capped at 10.
- Max total HTTP calls per `corroborate` invocation: 30.
- `first_pass_max_results` (default 10) bounds results fetched per provider in Phase 1.
- Gap-refinement queries run concurrently within the remaining HTTP-call budget.
- Knowledge-base recall is governed by the configurable `corroboration.kb_recall` setting.
- If either limit is reached, return partial findings with `corroboration: "partial"` flag.

---

## §9 Verification

### 9.1 G0 — MCP Conformance

- `initialize` handshake produces valid `InitializeResult`
- `tools/list` returns all registered tools with correct `inputSchema`
- `tools/call` with valid params returns a non-error response (smoke test with mocked providers)
- Invalid params produce `isError: true` with error taxonomy compliant message
- `server/discover` advertises correct protocol version

### 9.2 G1 — Integration Tests

- Each provider backend tested with mock HTTP responses (real responses recorded once, replayed in CI). Recorded fixtures SHALL be refreshed on a documented cadence so selector and format drift is caught before it reaches production.
- Fallback chain: mock provider A fails → provider B called → results from B returned
- Hedged dispatch: mock a fast primary → verify only the primary is called; mock a slow primary plus a fast fallback → verify the fallback serves and only after the hedge window
- Fallback depth: configure `output.fallback_depth` → verify the chain dispatches at most that many providers before reporting `all_providers_exhausted`
- Renderer hedge: mock a slow `jina` plus a fast `native_fetch` → verify `native_fetch` serves only after the hedge window; mock a marginally-slow `jina` → verify `jina` still serves within the grace period
- Redirect hops: configure `output.max_redirect_hops` → verify `fetch_page` follows at most that many redirect hops, re-applying the guard each hop
- Rate limiting: mock clock, verify throttling enforces interval
- Quota tracking: mock exhausted provider → verify fallback skip
- Normalizer: input from each provider format → verify common output shape
- `corroborate`: mock 3 providers with overlapping claims → verify agreement detection
- Config reload: change config → verify new provider active, old inactive
- Token footprint: call `providers` spec action → verify `tool_schema_bytes` and `median_response_bytes` are present, numeric, and consistent with live registration
- Generic provider: add a configuration-defined provider against a mock JSON endpoint → verify `web_search` returns mapped results through the dispatch chain
- Generic provider malformed config: declare a generic provider with an invalid endpoint or result mapping → verify config validation rejects it on load and reload
- Provider removal: disable a provider in the user configuration layer → verify it is skipped by dispatch and recommendations, and the disabled state survives reload and a simulated update
- Spec drift: parse all `@implements REQ-NNN` citations from `src/**/*.ts`
  and cross-reference against the REQ manifest in this specification. Report
  any REQ with zero citations (excluding §4.7 artifact REQs) as unimplemented;
  report any source file without citations as undocumented.
- KB search: mock vector store with known embeddings; query → verify results ranked by relevance
- KB retrieval consistency: ingest content across multiple calls so the vocabulary grows between calls; query for a term present only in the earliest content → verify it is returned and ranked (REQ-082)
- KB ingestion: provide text content → verify chunks created and stored
- KB deletion: add content then issue delete → verify correct count removed
- KB auto-indexing: execute `web_search` with mock provider → verify store received results after response
- KB collection scoping: insert content into two collections → query scoped to one → verify only scoped results returned
- KB expiry: insert content with past timestamp → trigger maintenance → verify expired content removed; verify non-expired content retained
- KB config validation: provide invalid KB config section → verify `kb` search returns config error
- KB deduplication: ingest URL with content → note chunk count → re-ingest same URL → verify count unchanged, content updated
- Normalizer discard: normalize results with empty URL → verify zero results returned, max_results count preserved for downstream provider
- Config overlay: load shipped default plus user configuration layer → verify user values take precedence over shipped values
- Update preservation: apply updated shipped defaults over an existing user layer, knowledge base store, and quota file → verify all user-owned state is retained and the server operates without reconfiguration

### 9.3 G2 — Live Smoke Tests (Optional)

- Run against real provider endpoints
- Requires API keys for keyed providers
- Skips providers without keys (reports skipped, not failed)
- Verifies: connectivity, auth, response parsing, quota reporting

### 9.4 G3 — Spec Validation Gate

- `npm run validate-spec` exits zero
- Every REQ in §4 has at least one source-file citation
  (`@implements REQ-NNN`) or belongs to §4.7 (client artifacts verified by
  file presence) or has a recorded waiver in DECISIONS.md
- Every source file in `src/` has at least one `@implements` header comment
- No REQ body exceeds the Appendix B mechanical limits: more than 800
  characters, more than 8 sentences, more than 8 SHALL clauses, more than one
  paragraph, a markdown table, a bullet list, or numbered steps
- No REQ body enumerates more than 5 backtick-delimited tokens, except a
  tool-signature REQ that declares its parameter contract ("Parameters:") or
  an output/error contract REQ (§4.1)
- No REQ body contains a parameter type annotation, a standalone "Default:"
  clause, or a lifecycle description duplicated across multiple REQs
- No REQ ID departs from the three-digit numeric form (`REQ-NNN` with an
  optional single-letter sub-REQ suffix), and no REQ body is empty or begins
  with a lowercase letter
- The REQ manifest matches the REQ bodies in §4 exactly
- A REQ body that defines a status/outcome through "or"-joined normative
  branches, or gates a behavior on a "when … declares" conditional, carries a
  named clause tag per branch in a test file
  (`// @implements REQ-NNN <branch-slug>`), so no branch ships untested
- Appendix B mechanical violations are errors; Appendix B judgment violations
  (what/how, red-team, EARS, readability, proofreading dimensions) are
  warnings; Appendix C violations are errors

### 9.5 REQ Manifest

| REQ | Title | Section | Gate |
|-----|-------|---------|------|
| REQ-001 | Status Prefix Contract | 4.1 | G0 |
| REQ-002 | Error Taxonomy | 4.1 | G0 |
| REQ-003 | Result Format Normalization | 4.1 | G1 |
| REQ-004 | Truncation | 4.1 | G1 |
| REQ-073 | Minimum Viable Result | 4.1 | G1 |
| REQ-079 | Output Verbosity | 4.1 | G1 |
| REQ-010 | Config File | 4.2 | G1 |
| REQ-011 | API Key Safety | 4.2 | G1 |
| REQ-012 | Environment Variable Mapping | 4.2 | G1 |
| REQ-013 | Provider Discovery | 4.2 | G1 |
| REQ-014 | Generic HTTP Provider Tier | 4.2 | G1 |
| REQ-015 | Provider Removal by Disable | 4.2 | G1 |
| REQ-020 | web_search | 4.3 | G0, G1 |
| REQ-020a | web_search auto-selection | 4.3 | G1 |
| REQ-020b | web_search suggestion mode | 4.3 | G0, G1 |
| REQ-020c | web_search priority routing | 4.3 | G1 |
| REQ-020d | web_search parameter transparency | 4.3 | G0, G1 |
| REQ-020e | web_search query expansion | 4.3 | G0, G1 |
| REQ-021 | fetch_page | 4.3 | G0, G1 |
| REQ-021a | fetch_page network-target safety | 4.3 | G1 |
| REQ-021b | fetch_page question-grounded extraction | 4.3 | G1 |
| REQ-021c | fetch_page date detection | 4.3 | G1 |
| REQ-024 | providers | 4.3 | G0, G1 |
| REQ-024a | providers list action | 4.3 | G0, G1 |
| REQ-024b | providers health action | 4.3 | G0, G1 |
| REQ-024c | providers spec action | 4.3 | G0, G1 |
| REQ-026 | corroborate | 4.3 | G0, G1 |
| REQ-026a | corroboration source authority | 4.3 | G1 |
| REQ-026b | corroboration claim attribution | 4.3 | G1 |
| REQ-026c | corroboration source preservation | 4.3 | G1 |
| REQ-026d | corroboration provenance record | 4.3 | G1 |
| REQ-026e | corroboration knowledge-base recall | 4.3 | G1 |
| REQ-027 | cite | 4.3 | G0, G1 |
| REQ-028 | web_search deep reading | 4.3 | G1 |
| REQ-030 | Per-Provider Throttling | 4.4 | G1 |
| REQ-031 | Fallback Chain | 4.4 | G1 |
| REQ-032 | Retry Policy | 4.4 | G1 |
| REQ-033 | Persistent Quota Tracking | 4.4 | G1 |
| REQ-034 | Quota Warning Threshold | 4.4 | G1 |
| REQ-035 | Request Timeout | 4.4 | G1 |
| REQ-036 | Latency Tracking Window | 4.4 | G1 |
| REQ-037 | Config Validation | 4.4 | G1 |
| REQ-040 | Configuration Reload | 4.5 | G1 |
| REQ-070 | Provider Registration | 4.6 | G1 |
| REQ-071 | Outbound HTTP Identification | 4.6 | G1 |
| REQ-050 | search-preferences.md | 4.7 | G3 |
| REQ-051 | Orchestrator Skill | 4.7 | G3 |
| REQ-052 | Bundled Skills | 4.7 | G3 |
| REQ-053 | Pipeline Reference | 4.7 | G3 |
| REQ-054 | User Documentation | 4.7 | G3 |
| REQ-088 | Gated-Analysis Technique Selection | 4.7 | G3 |
| REQ-055 | Spec-Code Traceability | 4.8 | G3 |
| REQ-077 | REQ Manifest | 4.8 | G3 |
| REQ-078 | Feature Taxonomy | 4.8 | G3 |
| REQ-080 | Tool Default Consistency | 4.8 | G3 |
| REQ-081 | Token Footprint Report | 4.8 | G1 |
| REQ-060 | kb | 4.9 | G0, G1 |
| REQ-060a | kb search action | 4.9 | G0, G1 |
| REQ-060b | kb ingest action | 4.9 | G0, G1 |
| REQ-060c | kb stats action | 4.9 | G1 |
| REQ-060d | kb delete action | 4.9 | G0, G1 |
| REQ-060e | kb list action | 4.9 | G1 |
| REQ-060f | kb get action | 4.9 | G1 |
| REQ-060g | kb encryption action | 4.9 | G0, G1 |
| REQ-064 | Auto-Indexing | 4.9 | G1 |
| REQ-065 | Collection Scoping | 4.9 | G1 |
| REQ-066 | Content Expiry | 4.9 | G1 |
| REQ-067 | Knowledge Base Configuration | 4.9 | G1 |
| REQ-072 | Knowledge Base Deduplication | 4.9 | G1 |
| REQ-074 | Freshness Classification | 4.9 | G1 |
| REQ-075 | Confidence Decay | 4.9 | G1 |
| REQ-076 | KB-First Sufficiency | 4.9 | G1 |
| REQ-082 | KB Retrieval Consistency | 4.9 | G1 |
| REQ-083 | Report Storage | 4.9 | G1 |
| REQ-084 | KB At-Rest Encryption | 4.9 | G1 |
| REQ-085 | KB Data Preservation | 4.9 | G1 |
| REQ-086 | KB Encryption Transitions and Recovery | 4.9 | G1 |
| REQ-087 | KB Source Date Preservation | 4.9 | G1 |
| REQ-042 | Source Distribution | 4.10 | G1 |
| REQ-043 | Update Preservation | 4.10 | G1 |

---

## §10 Artifacts and Handoff

### 10.1 Project Files

Shipped in the distributed repository:

```
infobroker/
├── infobroker.md                          # This specification
├── instructions/
│   └── search-preferences.md              # AI tool-routing instructions
├── skills/
│   ├── infobroker/
│   │   ├── SKILL.md                       # Orchestrator: routes intent → workflow, chains search → skills
│   │   └── references/
│   │       ├── provider-map.md            # Task → provider dispatch reference
│   │       ├── pipeline-map.md            # Skill pipeline diagram (Mermaid)
│   │       └── workflows.md               # Workflow-shape definitions
│   ├── analysis-loop/
│   │   └── SKILL.md                       # Gated analytic-rigor research workflow
│   ├── summarization/
│   │   └── SKILL.md                       # Condense findings
│   ├── technical-writing/
│   │   └── SKILL.md                       # Reports, docs, tutorials
│   ├── proofreading/
│   │   └── SKILL.md                       # Grammar, style, clarity
│   └── translation/
│       └── SKILL.md                       # Multilingual output
├── README.md                              # Setup, config, integration
├── config.json                            # Shipped default configuration
├── DECISIONS.md                           # Implementation decisions
└── AGENTS.md                              # Code map for AI maintainers
```

User-owned (NOT in the repository; preserved across updates per REQ-043):

```
config.local.json                          # User configuration layer (REQ-010)
~/.local/share/infobroker/knowledge-base/  # Vector store (created at runtime)
$TMPDIR/infobroker/quota.json              # Persistent quota counters (REQ-033)
$TMPDIR/infobroker/trunc-*.txt             # Full content of truncated responses
```

Component names above are the reference layout; the user configuration
layer's location is a build decision (REQ-010), so long as it ships
separately from the shipped default and survives updates.

### 10.2 Client Integration

```json
// opencode.json additions
{
  "instructions": [
    "<path-to-Infobroker>/instructions/search-preferences.md",
    ...existing instructions...
  ],
  "skills": {
    "paths": [
      "<path-to-Infobroker>/skills",
      "<path-to-opencode-config>/skills"
    ]
  },
  "mcp": {
    "infobroker": {
      "type": "local",
      "command": ["node_modules/.bin/tsx", "src/index.ts"],
      "cwd": "<path-to-Infobroker>",
      "environment": {
        "INFOBROKER_CONFIG": "<path-to-Infobroker>/config.json"
      }
    }
  }
}
```

The `INFOBROKER_CONFIG` path points to the shipped default; the user
configuration layer is merged over it by the server (REQ-010).

### 10.3 What Replaces What

| Old (DuckDuckGo MCP) | New (Infobroker) |
|----------------------|-------------------|
| `duckduckgo_web_search` | `web_search` — DuckDuckGo is still the default provider, with fallback |
| `duckduckgo_get_page_content` | `fetch_page` — Jina Reader as default renderer, native fallback |
| `duckduckgo_suggest_related_searches` | `web_search` with `suggest` — DuckDuckGo autocomplete, same endpoint |
| (none) | `web_search` auto-selection — task-type routing (was `choose_provider`) |
| (none) | `corroborate` — multi-pass truth-finding |
| (none) | `cite` — academic references as BibTeX |
| (none) | `providers` — operational visibility (was `list_providers` + `provider_health` + `spec_health`) |
| (none) | `kb` — knowledge base search/ingest/stats/delete (was four `kb_*` tools) |
| (none) | `reload_config` — ops tooling |
| Client `websearch` | Infobroker is preferred; built-in is fallback |
| Client `webfetch` | Infobroker `fetch_page` is preferred; built-in is fallback |

---

## §A Appendix: Provider Catalog

### A.1 Built-in (Zero Config, In-Process)

**DuckDuckGo** — HTML scraping of `html.duckduckgo.com`. 3s minimum interval enforced server-side. Parses result title, URL, snippet from the HTML page. No server-side state or tracking.

### A.2 Free HTTP (Zero Config)

**Jina Reader** — `https://r.jina.ai/{url}`. Renders any URL as Markdown. Rate-limited (undocumented). Exponential backoff on 429.

**Wikipedia** — `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch={query}`. Also supports `action=parse` for page content, `prop=extracts` for summary text. Generous rate limits.

**Wiktionary** — `https://en.wiktionary.org/w/api.php`. Same API as Wikipedia. `action=query&prop=extracts` for definitions.

**Wikidata** — `https://www.wikidata.org/w/api.php?action=wbsearchentities&search={query}&format=json`. Returns entity IDs, descriptions, labels. Also `action=wbgetentities` for full entity data.

**OpenStreetMap** — `https://nominatim.openstreetmap.org/search?q={query}&format=json`. 1 req/sec, User-Agent header required. Returns lat/lon, display name, type.

**Internet Archive** — `https://archive.org/wayback/available?url={url}` returns availability timestamp. Then `https://web.archive.org/web/{timestamp}/{url}` retrieves the page. Generous limits.

**arXiv** — `https://export.arxiv.org/api/query?search_query={query}&max_results=10`. 1 call per 3 seconds.

### A.3 Free HTTP (Registration Required)

**Semantic Scholar** — `https://api.semanticscholar.org/graph/v1/paper/search?query={query}`. Shared pool at 1,000 RPS; dedicated pool with key at 1 RPS. Covers 214M papers, 2.5B citations.

**Stack Exchange** — `https://api.stackexchange.com/2.3/search/advanced?q={query}&site=stackoverflow`. 300 req/day baseline, 10,000/day with app key. Covers 170+ Q&A sites.

**GitHub** — `https://api.github.com/search/code?q={query}`. 60 req/hour baseline, 5,000/hr with token. Can search code, repos, issues.

**CORE** — `https://api.core.ac.uk/v3/search/works?q={query}`. Open access research papers.

### A.4 Keyed HTTP (Free Tier)

**Brave Search** — `https://api.search.brave.com/res/v1/web/search?q={query}`. 2,000 queries/mo free. Independent index (40B+ pages). 669ms average latency. Also has News and Images endpoints.

**Exa** — `https://api.exa.ai/search`. 1,000 searches/mo free. Neural/semantic search. Best for "find companies like X" or conceptual queries. Can filter by date, domain, content type.

**Tavily** — `https://api.tavily.com/search`. 1,000 credits/mo free. RAG-optimized results with inline citations. Good for "give me sources about X."

### A.5 Self-Hosted HTTP

**SearXNG** — User runs Docker container. MCP calls `POST /search?format=json` on the user's instance URL. Full privacy — all queries stay on user's machine. 274 search backends available. Requires `format: json` enabled in `settings.yml`.

**Yep** — `https://platform.yep.com/api/search` (POST, JSON body, Bearer auth). First-party index built on AhrefsBot (100B+ pages, 8B crawled daily). 1,000 free requests, then pay-as-you-go. Native `content_type`, `location`, `language`, `safe_search`, and publication-date filters. `highlights` type returns query-relevant excerpts at no extra cost.

### A.6 Scraped (No Official API)

**Marginalia** — `https://search.marginalia.nu/search?query={query}`. Open-source search engine prioritizing non-commercial content. HTML scraping. Unknown rate limits — conservative 5s interval.

**Mojeek** — `https://www.mojeek.com/search?q={query}`. Privacy-first search engine with independent index. HTML scraping. Unknown rate limits — conservative 5s interval.

**Wiby** — `https://wiby.me/?q={query}`. Curated directory of the non-commercial "small web". HTML scraping. Low volume, high signal; conservative 5s interval.

### A.7 Generic HTTP (User-Defined)

A user adds a generic HTTP provider entirely in the user configuration layer
(REQ-014) — no provider module is written. The entry declares the tier, the
ability it serves (for dispatch), the endpoint and request it queries, and
the mapping from response fields to the normalized result shape (REQ-003):

```json
{
  "my_search": {
    "tier": "generic_http",
    "capabilities": ["web_search"],
    "enabled": true,
    "priority": 20,
    "endpoint": "https://api.example.com/search",
    "query_param": "q",
    "results_path": "data.items",
    "field_map": { "title": "name", "url": "link", "snippet": "summary" }
  }
}
```

The slug is then referenced from a dispatch chain so `web_search` picks it up.
Removing the provider means setting `enabled`
to `false`; the entry and its backend remain installed (REQ-015). A generic
provider whose endpoint or result mapping is malformed is rejected by
configuration validation (REQ-037, REQ-014).

---

## §B Appendix: REQ Authoring Conventions

This appendix defines what belongs in a requirement and what does not. It is not
a build artifact — it is a spec-maintainer reference.

**REQ anatomy.** One paragraph stating a single verifiable contract — the
*what*. Ends in `_Check:_` with gate citations. Contains no parameter types,
no algorithm descriptions, no default values, no catalog enumerations
(>5 backtick tokens), no markdown tables, no bullet lists, no numbered steps,
and no blank lines. A REQ body IS a single paragraph — if it needs more, it is
at minimum two REQs. Sub-REQs (REQ-XXXa) handle composable, separable concerns.

**Keyword semantics.** The key words "SHALL", "SHALL NOT", "MUST",
"MUST NOT", "SHOULD", and "MAY" in REQ bodies carry RFC 2119 meaning —
normative only in uppercase (RFC 8174). Lowercase "shall" and "must" are
plain English. REQ bodies use "SHALL" for all obligations; "MUST" is reserved
for security-critical obligations (API key handling, secret leakage). An
imperative "must" in prose is advisory, not normative.

**EARS notation.** REQ authors are encouraged — but not required — to structure
requirement bodies using the Easy Approach to Requirements Syntax (EARS), which
makes trigger, condition, and response explicit in machine-parseable clauses.
The five patterns are:

- **Ubiquitous:** "THE system SHALL <behavior>."
- **Event-driven:** "WHEN <trigger> THE system SHALL <response>."
- **State-driven:** "WHILE <state> THE system SHALL <behavior>."
- **Unwanted behavior:** "IF <condition> THEN THE system SHALL <response>."
- **Optional feature:** "WHERE <feature is included> THE system SHALL <behavior>."

The narrative REQ body remains the canonical contract; EARS clauses are
supplementary precision tools, not replacements. All other Appendix B rules
still apply to EARS clauses.

**Mechanical limits (gate-blocking).** The following are verified by G3 (§9.4)
and enforced as errors before commit:

- No REQ body exceeds 800 characters.
- No REQ body exceeds 8 sentences.
- No REQ body contains more than 8 SHALL clauses.
- No REQ body spans more than one paragraph (no blank lines).
- No REQ body contains a markdown table, bullet list, or numbered steps.
- No REQ body enumerates more than 5 backtick-delimited tokens, except a
  tool-signature REQ that declares its parameter contract (body contains
  "Parameters:") or an output/error contract REQ (§4.1) that enumerates the
  response envelope or error taxonomy by design.
- Every REQ body ends with `_Check:` citing at least one gate.
- No REQ body contains a standalone "Default:" clause.
- No REQ body contains a parameter type annotation or zod schema.
- Every REQ ID uses the three-digit numeric form (`REQ-NNN`) with an optional
  single-letter sub-REQ suffix; a malformed numeric part (four digits, bare
  digits) is a defect.
- No REQ body is empty.
- No REQ body begins with a lowercase letter (the truncated-lead signature).

These rules are not advisory. A REQ violating any rule is a spec defect that
blocks the gate. Split the REQ or move procedural content to the appropriate
section (§5 for build processes, §6 for runtime conventions, Appendices for
reference tables).

**REQ Authoring Checklist** (apply before committing any new or modified REQ):

- [ ] States *what*, not *how* — no parameter types, sort orders, or algorithms (SR-011a)
- [ ] Tool-signature exception used only where the REQ declares a tool's
      external parameter contract
- [ ] No "Default:" clause (SR-011d) — defaults live in config.json
- [ ] No enumerated catalogues (>5 backtick tokens) outside the tool-signature
      exception
- [ ] No worked examples disguised as requirements
- [ ] Trust-the-gates test: would G0/G1/G2 catch a deviation?
- [ ] Red-team test: answered the four SR-012 questions
- [ ] REQ body is exactly one paragraph — no blank lines, no tables, no
      bullet lists, no numbered steps
- [ ] REQ body ≤ 800 characters, ≤ 8 sentences, ≤ 8 SHALL clauses
- [ ] REQ contains exactly one logical contract — if multiple SHALL clauses
      cover distinct concerns, split it or use a sub-REQ (REQ-XXXa)
- [ ] Procedural/algorithmic content is in §5 or §6, not the REQ body
- [ ] No lifecycle description duplicated across multiple REQs
- [ ] REQ body ends with `_Check:` citing at least one gate

**Proofreading dimensions.** Before committing, review each REQ body and the
spec's narrative prose for: passive voice, modal drift (should/may used where
SHALL is intended), double negatives, sentence length (>40 words), condition
stacking (nested IF/WHEN), and pronoun ambiguity. These are warnings, not gate
failures — a flag is a pointer, not a verdict.

**Readability standard.** Narrative prose (§1–§3, §5–§8) SHALL read at a
Flesch-Kincaid grade level of 12 or below. The check is a warning, not a gate.
REQ bodies and the reference appendices are exempt.

**Provenance.** Every REQ SHALL be traceable to its origin spec version and
CHANGELOG entry via version control history. When a REQ is modified, the
CHANGELOG entry SHALL cite the REQ by ID and the nature of the change.
Provenance for deleted REQs is maintained by the CHANGELOG.

**What belongs elsewhere:**

- Parameter shapes and tool signatures → tool registration in `src/index.ts`
  (`zod` schemas are the live contracts)
- Sort orders, algorithms, and scraping heuristics → builder's implementation
  judgment; verified by G1 integration tests
- Default starting values → `config.json` is the canonical source (REQ-010)
- Tool name lists and output format catalogues → `tools/list` is the live
  registry; the REQ states the category
- State-machine transition rules → §6.3 provider API conventions table
- Worked examples and step-by-step procedures → README.md and the bundled
  client skills (REQ-051)
- JSON schemas and file format specifications → `src/types.ts` is canonical;
  G0 conformance tests verify correctness
- Return-value field enumerations → §6.2 Output Format

**The "trust the gates" test.** If a deviation from a requirement would be
caught by G0 (MCP conformance), G1 (integration tests), or G2 (live smoke),
do not specify the mechanism in the REQ — specify the outcome. The REQ ends
at the contract boundary.

**Gate-driven REQ review.** When the spec validation gate (G3) reports more
than two findings of the same class across two or more verification runs, the
maintainer flags the pattern as a candidate for REQ revision. Common classes
include: consistently missing citations in a provider file not covered by
existing REQs, repeated G1 failures from an undertested contract, or REQ body
violations recurring in the same subsection. The flag cites the finding class,
the affected files, and the REQ(s) most likely affected. This is a
spec-maintainer signal, not a build requirement.

---

## §C Appendix: Spec-Driven Development Discipline

This appendix defines the development discipline that prevents spec-code drift.
It is prescriptive — every rule is enforceable by G3 (§9.4).

**C.1 Spec-anchored model.** The specification lives in the repository alongside
the code. Both evolve together; divergence is a defect. The specification is the
contract; the implementation is the fulfillment. When the implementation's
behavior changes, the corresponding REQ must be updated in the same commit.

**C.2 Traceability.** Every source file in `src/` SHALL cite the REQ(s) it
implements via `@implements REQ-NNN` header comments (REQ-055). Every REQ in
§4 SHALL be cited in at least one source file, unless it concerns client
artifacts (§4.7) or build process (§5) which are verified by artifact presence
rather than source citations.

**C.3 Separate what from how.** The specification (§1–§4, §7–§8) states
contractual requirements — what the system must do. The build process (§5)
states architecture. The configuration file (`config.json`) states parameters
and dispatch rules. Implementation files (`src/`) state how. These layers must
not blur: a REQ that prescribes a specific zod schema field or encoding
algorithm is a defect.

**C.4 Update-after-change.** When a tool's behavior changes (new parameter,
different output shape, modified fallback logic), the corresponding REQ must
be updated in the same commit. When a provider is added or removed, both the
spec and config must reflect the change. A commit that changes `src/` without
a corresponding `infobroker.md` update — where the change alters a
requirement-level contract — SHALL be flagged by code review.

**C.5 Verification as the enforcer.** The verification gates (§9) are the
mechanical guarantee that spec and code remain aligned:
- G0: MCP protocol conformance (tool schemas match implementation)
- G1: Integration tests with mock providers (REQ behavior verified)
- G2: Live smoke tests (real endpoints behave as specified)
- G3: Spec validation gate (bidirectional coverage, REQ body hygiene)

**C.6 Drift detection.** `npm run validate-spec` (G3) is the automated drift
detector. It must exit zero before any commit that changes `infobroker.md` or
any file in `src/`. The check surfaces:
- REQs with no implementing source file (spec-only, needs implementation or
  explicit waiver recorded in DECISIONS.md)
- Source files with no REQ citation (undocumented code)
- REQ bodies that violate SR-011 (implementation detail in a contract)
- REQ bodies that violate the Appendix B mechanical limits (errors) or the
  judgment conventions (warnings)
- REQ bodies with duplicated lifecycle descriptions across multiple REQs
- REQ manifest (§9.5) mismatches against the §4 body

**C.7 Risk-calibrated detail.** The level of detail in a REQ SHALL match the
risk profile of the requirement:
- **High risk** (API key handling, error taxonomy, corroboration integrity):
  precise contract language, explicit SHALL clauses, edge cases enumerated
- **Medium risk** (rate limiting, quota tracking, fallback behavior):
  configurable thresholds cited, expected behavior stated, recovery paths named
- **Low risk** (output formatting, suggestion format, status reporting):
  shape described, content left to builder judgment

**C.8 Out-of-scope discipline.** Every major section SHALL explicitly state
what it does NOT cover, using an "Out of scope" clause or equivalent. This
bounds the builder's interpretation and prevents scope creep. Ambiguity about
what is in scope is as dangerous as ambiguity about behavior.

**C.9 Release discipline.** Release tooling that ships the distributed
repository SHALL stage new files and modified files in the source tree —
not only modified files that were already tracked — so that the full change
set passes the verification gates (C.6) before commit. The release tooling
SHALL run the verification gates and version-consistency checks against the
change set it is about to ship, before committing or pushing, and SHALL fail
fast on a dirty working tree before staging. Release tooling SHALL NOT
silently overwrite an existing version tag; re-tagging a version SHALL
require explicit confirmation. Release tooling SHALL refuse to commit
material that would expose secret material (REQ-011).

**C.10 Provenance.** Every REQ SHALL be traceable to the spec version and
CHANGELOG entry in which it was introduced or last modified. A modified REQ's
CHANGELOG entry SHALL cite the REQ ID and the nature of the change. The REQ
manifest (§9.5) is the index; version-control history is the record.

---

## §D Appendix: Feature Taxonomy

This appendix groups every feature of the server into eight thematic areas.
Each area is a self-contained unit of work — a sprint-sized chunk — defined by
the tools it surfaces and the requirements that govern it. The group-to-tool
mapping lets a maintainer plan an improvement sprint as "harden the Knowledge
Base" and immediately know which REQs and gates bound the work.

Every tool and every §4 REQ appears in exactly one group (its primary home).
Where a REQ supports more than one concern, the primary group is the one whose
behavior the REQ most directly governs; the "also governs" column names the
secondary concerns rather than duplicating the REQ.

| # | Feature area | Tools | Primary REQs | Gate |
|---|--------------|-------|--------------|------|
| 1 | Core Retrieval | `web_search`, `fetch_page`, `cite` | REQ-003, REQ-004, REQ-020, REQ-020a, REQ-020b, REQ-020c, REQ-020d, REQ-020e, REQ-021, REQ-021a, REQ-021b, REQ-021c, REQ-027, REQ-028, REQ-030, REQ-031, REQ-032, REQ-035, REQ-073 | G0, G1 |
| 2 | Provider Intelligence | `providers` | REQ-010, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-024, REQ-024a, REQ-024b, REQ-024c, REQ-070, REQ-071 | G0, G1 |
| 3 | Corroboration | `corroborate` | REQ-026, REQ-026a, REQ-026b, REQ-026c, REQ-026d, REQ-026e | G0, G1 |
| 4 | Knowledge Base | `kb` | REQ-060, REQ-060a, REQ-060b, REQ-060c, REQ-060d, REQ-060e, REQ-060f, REQ-060g, REQ-064, REQ-065, REQ-066, REQ-067, REQ-072, REQ-074, REQ-075, REQ-076, REQ-082, REQ-083, REQ-084, REQ-085, REQ-086, REQ-087 | G0, G1 |
| 5 | State & Operations | `reload_config` | REQ-033, REQ-034, REQ-036, REQ-037, REQ-040, REQ-042, REQ-043, REQ-081 | G0, G1 |
| 6 | Tool Surface & Contracts | (all 7 tools) | REQ-001, REQ-002, REQ-079 | G0 |
| 7 | Client Artifacts | (no tools) | REQ-050, REQ-051, REQ-052, REQ-053, REQ-054, REQ-088 | G3 |
| 8 | Spec Governance | (no tools) | REQ-055, REQ-077, REQ-078, REQ-080 | G3 |

Notes:

- **Group 6** groups the output and error envelope contracts (REQ-001, REQ-002)
  that bind to every tool; the per-tool behavior REQs live in their thematic
  group (1–5).
- **Group 7** and **Group 8** are build-and-spec concerns with no runtime tool
  surface; they are verified by file presence and by the G3 drift detector
  rather than by live tool calls.
- The README documents Groups 1–5 as the user-facing feature tour and
  surfaces Group 7 (Client Artifacts) in its Skills section; Group 8 is a
  maintainer concern surfaced only in this spec.
