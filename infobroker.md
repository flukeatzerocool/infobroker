# Infobroker — Research & Writing Professional MCP Server

## §1 Mission and Capability Model

Infobroker is a configurable, multi-provider MCP server that wraps public web
search, structured knowledge, scholarly, and content-extraction APIs behind a
unified tool surface. Its design goals:

1. **Free first, privacy always.** Zero-config default uses only free, no-auth-required providers that respect user privacy.
2. **Upgrade path.** Optional API-keyed providers (Brave, Exa, Tavily, SearXNG) for higher throughput and specialized queries.
3. **Provider intelligence.** The server recommends the best provider for a task, considering capability, quota, and latency.
4. **Truth by iteration.** A `converge` tool runs multi-pass cross-source verification to surface agreements, contradictions, and gaps.
5. **Writing pipeline.** Server provides raw research materials; bundled client skills handle writing, summarization, fact-checking, and proofreading.
6. **Knowledge persistence.** Research results are indexed in a local knowledge base so subsequent queries can retrieve prior findings without repeating searches. The knowledge base is derivative — the server operates normally without it.

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
| F8 | Convergence loop stalls | `converge` produces no new claims after iteration N | Hard cap on max_iterations; loop exits when no new sources found |
| F9 | Embedding model unavailable | KB tools return errors, auto-indexing silently fails | KB tools report degraded status with remediation "run once with network access to download the embedding model." Auto-indexing silently skips until model is available. |
| F10 | Knowledge base storage corruption | KB queries return unexpected results or fail | On detection, the server backs up the corrupt storage and creates a fresh store. `kb_stats` reports the event. |

---

## §3 Standing Rules and Terminology

### Architectural Invariants

- **SR-001 Outbound by design.** Infobroker's primary operation is outbound HTTP requests. A local knowledge base may cache and index prior research results for semantic retrieval. The knowledge base is derivative — the server must function correctly when the KB is uninitialized or disabled.
- **SR-002 Single user.** One connection = one config. No multi-tenancy.
- **SR-003 API keys never surfaced.** Keys from env vars are injected at startup and never appear in tool output, logs, errors, or `provider_health` responses.
- **SR-004 Zero-config works.** DuckDuckGo, Marginalia, Mojeek (in-process scraping) + Jina Reader, Wikipedia, Wiktionary, Wikidata, OpenStreetMap, Internet Archive, arXiv, Semantic Scholar, Stack Exchange, GitHub, CORE (all free HTTP, no API key required) provide a functional default.
- **SR-005 Providers are standalone modules.** Each search/content backend exports functions matching a common signature convention. Adding, removing, or swapping a provider requires updating the tool dispatch table but does not require modifying the tool surface — tool names, schemas, and response formats remain unchanged.
- **SR-006 Config hot-reloadable.** The config file is reloaded on `reload_config` invocation (or SIGHUP on the process) without dropping active connections.
- **SR-007 Rate limit state persists.** Quota counters survive restarts via a JSON state file.
- **SR-008 Convergence is bounded.** `converge` has a hard max on iterations (default 5) and total HTTP calls per invocation (default 30).
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
| **Provider tier** | Built-in (in-process, zero config) / Free HTTP (no auth) / Self-hosted HTTP (user runs) / Keyed HTTP (API key required) |
| **Fallback chain** | Ordered list of providers tried in sequence on failure |
| **Content renderer** | A provider that fetches and formats a URL (Jina Reader, native HTTP) |
| **Task type** | A category of search task (general web, encyclopedia, academic, code, etc.) used by `choose_provider` |
| **Convergence** | The multi-pass truth-finding loop in `converge` |
| **Synthesis** | The container format that presents search findings to writing skills |
| **Collection** | A named namespace that scopes knowledge base content. Collections are implicit — they exist when first used. |
| **Chunk** | A segment of text stored with its embedding vector in the knowledge base. Each chunk retains the source URL, provider, and ingestion timestamp of the content it was derived from. |
| **Vector store** | The local database that indexes chunks by their embedding vectors and supports semantic (vector similarity) and keyword (full-text) retrieval. |
| **KB** | Abbreviation for "knowledge base." |

---

REQ IDs use block reservations: 001–004 (output/error contracts), 010–013 (provider configuration), 020–026 (core tools), 030–037 (rate limiting and resilience), 040–041 (state and configuration), 050–055 (client artifacts and spec integrity), 060–067 (knowledge base).

**Out of scope.** §4 defines functional requirements and tool contracts. Output format catalogues, file format specifications, and code-level interfaces are defined in `src/types.ts`. Worked examples and tutorials belong in the README.

## §4 Requirements

### 4.1 Output and Error Contracts

**REQ-001 — Status Prefix Contract**
Every tool response SHALL be a JSON object with at minimum: `status` (`"ok"` or `"error"`), `provider` (slug of the provider that serviced the request), `results` (array) or `error` (object). Client-facing text in `content` fields MUST use `[OK]` / `[ERROR]` prefixes for human-readable output. _Check:_ G0.

**REQ-002 — Error Taxonomy**
Errors SHALL include: `code` (machine-readable slug: `provider_unavailable`, `rate_limited`, `invalid_input`, `config_error`, `parse_error`), `message` (human-readable), `provider` (which provider errored), `remediation` (what to try: "retry with fallback", "check API key", "wait 60s"). Unknown errors default to `internal_error`. _Check:_ G0.

**REQ-003 — Result Format Normalization**
All providers SHALL return results in a common shape that includes a title, URL, and snippet, with optional fields for publication date and source type. Provider-specific response formats SHALL be mapped to the common shape. _Check:_ G1.

**REQ-004 — Truncation**
Tool outputs longer than the configured max length SHALL be truncated and written to the filesystem at `$TMPDIR/infobroker/`. The tool response SHALL include a `truncated: true` flag and `output_path` pointing to the full file. _Check:_ G1.

### 4.2 Provider Configuration

**REQ-010 — Config File**
Provider configuration SHALL reside in a JSON file at a path specified by the `INFOBROKER_CONFIG` environment variable. The config declares each provider's type, auth, rate limits, and priority. _Check:_ G1.

**REQ-011 — API Key Safety**
API keys SHALL be accepted via environment variables: `INFOBROKER_<PROVIDER>_API_KEY`. Keys SHALL NOT appear in config file values, tool output, error messages, logs, or `provider_health` responses. If a key is missing, the provider is marked `inactive` with reason "no_api_key". _Check:_ G1.

**REQ-012 — Environment Variable Mapping**
The env var prefix is `INFOBROKER_` followed by the provider slug in uppercase, suffixed `_API_KEY`. Example: `INFOBROKER_BRAVE_API_KEY`. For URL-based providers (SearXNG), the env var is `INFOBROKER_<PROVIDER>_URL`. _Check:_ G1.

**REQ-013 — Provider Discovery**
On startup, the server SHALL log each configured provider's status: `active` (key present + reachable), `inactive` (key missing or unreachable), `degraded` (reachable but response latency exceeds a configurable threshold or the provider returns partial results). This status is exposed via `list_providers` and `provider_health`. _Check:_ G1.

### 4.3 Core Tools

**REQ-020 — `web_search`**
Unified search across configured providers. Parameters: `query` (required), `provider` (optional, auto-select if omitted), `max_results` (default 10, max 50), `safe_search` (on/off, default on), `time_range` (optional: day/week/month/year), `page` (pagination, default 1). Returns normalized results with source provenance. Falls back through the configured chain on failure. Providers SHALL accept all
parameters without error. A provider that does not support a parameter (page,
safe_search, time_range) SHALL return results as normal, ignoring the
unsupported parameter. The server SHALL enforce `max_results` on the response
even when the underlying provider ignores it. _Check:_ G0, G1.

**REQ-021 — `fetch_page`**
Fetch and extract the content of a URL. Parameters: `url` (required), `renderer` (optional: `jina` default, `native_fetch`, `wikipedia`, `internet_archive`), `max_length` (default 50k chars). Default renderer is Jina Reader (`https://r.jina.ai/{url}`) which produces clean Markdown optimized for LLM consumption. Falls back to native HTTP fetch if Jina is throttled or errors. _Check:_ G0, G1.

**REQ-022 — `search_suggestions`**
Query autocomplete. Parameters: `query` (required), `provider` (optional, defaults to DuckDuckGo autocomplete endpoint). Returns an array of suggestion strings. _Check:_ G0, G1.

**REQ-023 — `choose_provider`**
Recommend the best provider for a given task. Parameters: `task` (required, natural-language description of what the user wants to find), `priority` (optional: `speed`, `quality`, `privacy`, `free_only`). Returns: recommended provider slug, rationale, fallback chain, estimated latency, quota status. _Check:_ G0, G1.

**REQ-024 — `list_providers`**
List all configured providers with their status, capabilities, rate limits, quota usage, and supported task types. Parameters: `status` (optional filter: `active`, `all`). _Check:_ G0, G1.

**REQ-025 — `provider_health`**
Detailed health for a specific provider. Parameters: `provider` (required slug). Returns: status, quota_used, quota_remaining, quota_reset_at, avg_latency_ms, last_error, last_success. _Check:_ G0, G1.

**REQ-026 — `converge`**
Multi-pass truth-finding search. Parameters: `query` (required), `max_iterations` (default 5, max 10), `confidence_threshold` (default 0.8), `providers` (optional array, defaults to all active). See §8 for the full convergence algorithm. _Check:_ G0, G1.

### 4.4 Rate Limiting and Resilience

Rate limiting (REQ-030) and quota tracking (REQ-033, REQ-034) use separate
fields from the provider's rate_limit configuration. Throttling is governed by
`per_second`; quota is governed by `per_day` and `per_month`. These systems
operate independently.

**REQ-030 — Per-Provider Throttling**
Each provider SHALL enforce a configurable minimum interval between requests. The throttle SHALL be scoped per-provider, not global. _Check:_ G1.

**REQ-031 — Fallback Chain**
The fallback chain SHALL be ordered by provider priority in `config.json`. On error, response timeout, or empty results, the server SHALL advance to the next provider in the chain. The chain depth limit SHALL be configurable per task type. _Check:_ G1.

**REQ-032 — Retry Policy**
Providers SHALL retry on transient errors before advancing to the next provider in the fallback chain. Retry backoff and maximum retry count SHALL be configurable per provider in `config.json`. _Check:_ G1.

**REQ-033 — Persistent Quota Tracking**
Daily and monthly quota counters SHALL persist to `$TMPDIR/infobroker/quota.json`. Counters SHALL be written to disk after every quota increment. Counters reset on schedule (daily at midnight UTC, monthly at month boundary). This survives restarts. _Check:_ G1.

**REQ-034 — Quota Warning Threshold**
At 80% of quota usage, `provider_health` SHALL report status `degraded` with a `quota_warning` field. At 100%, status becomes `exhausted` and the provider is skipped by fallback chains until reset. _Check:_ G1.

**REQ-035 — Request Timeout**
Each outbound provider call SHALL be bounded by a configurable timeout. A call
that exceeds the timeout SHALL be treated as a transient failure and SHALL
trigger fallback chain advancement. The timeout is configurable per provider in
`config.json`. _Check:_ G1.

**REQ-036 — Latency Tracking Window**
Provider latency metrics reported via `provider_health` SHALL be computed over
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

**REQ-041 — `spec_health`**
Build health report. Returns the operational status of the server: build identity (version), provider summary (count, active count), uptime, cumulative request count, and paths to persistent state files. _Check:_ G0, G1.

### 4.6 Client Artifacts

**REQ-050 — `search-preferences.md`**
The build SHALL produce an instruction file at `instructions/search-preferences.md` that maps user intent to Infobroker tools. This file is sourced by the MCP client's instruction loader. _Check:_ G3 (file presence).

**REQ-051 — Orchestrator Skill**
The build SHALL produce an OpenCode-compatible skill at `skills/infobroker/SKILL.md` that chains Infobroker tools with the bundled writing and research skills. The skill defines two pipelines: "Research Professional" and "Fact-Check Pipeline". _Check:_ G3 (file presence).

**REQ-052 — Bundled Skills**
The build SHALL include all skill dependencies at `vendor/opencode-skills/` so the repo requires no external skill paths. Each bundled skill SHALL include an "Infobroker Integration" section documenting its role in the pipeline. _Check:_ G3 (file presence).

**REQ-053 — Pipeline Reference**
The build SHALL include `skills/infobroker/references/pipeline-map.md` with a Mermaid diagram of the skill pipeline and `skills/infobroker/references/provider-map.md` with the task→provider dispatch table. _Check:_ G3 (file presence).

**REQ-054 — User Documentation**
The build SHALL generate a `README.md` documenting: setup steps, provider configuration, `opencode.json` integration snippet, skill pipeline overview, and how to add new providers. _Check:_ G3 (file presence).

### 4.7 Spec Integrity

**REQ-055 — Spec-Code Traceability**
Every source file in `src/` SHALL cite in a header comment each REQ it
implements, using the format `@implements REQ-NNN`. A file may satisfy multiple
REQs; every implemented REQ must appear in at least one source file's citation.
The `validate-spec` script (§9.4) verifies bidirectional coverage: every REQ
with an implementation must be cited, and every source file must cite at least
one REQ. Generated artifacts (build output, `node_modules/`) and client-artifact
REQs (§4.6, verified by file presence) are exempt. _Check:_ G3.

### 4.8 Knowledge Base

**REQ-060 — `kb_search`**

Semantic and keyword hybrid search over the local knowledge base. Parameters: `query` (required), `max_results` (default 10, max 50), `collection` (optional — scope search to one collection), `source_type` (optional — filter by the origin of the indexed content). Returns chunks ranked by combined vector similarity and full-text relevance, each with source URL, score, and matching snippet. If the knowledge base is not initialized, returns error with remediation. Returns zero results when the KB is empty or no matches are found. _Check:_ G0, G1.

**REQ-061 — `kb_ingest`**

Explicit ingestion of content into the knowledge base. Parameters: `text` (optional — raw text to chunk and index), `url` (optional — a URL to fetch and index using the default content renderer per REQ-021), `title` (optional), `collection` (optional). At least one of `text` or `url` must be provided. When `url` is given, the server fetches the page content before indexing; a fetch failure returns an error. Returns the number of chunks ingested and the source identifier. _Check:_ G0, G1.

**REQ-062 — `kb_stats`**

Knowledge base operational metrics. No required parameters. Returns: total chunk count, collection names and their chunk counts, estimated storage size, last ingestion timestamp, embedding model availability, and any status events such as storage corruption recovery. _Check:_ G0, G1.

**REQ-063 — `kb_delete`**

Remove content from the knowledge base. Parameters: `collection` (optional), `source_url` (optional). At least one filter must be provided. If no filter is provided, the tool returns an error. Returns the count of removed chunks. _Check:_ G0, G1.

**REQ-064 — Auto-Indexing**

Search results from `web_search`, rendered page content from `fetch_page`, and findings from `converge` SHALL be automatically indexed into the knowledge base. Auto-indexing SHALL NOT delay or error the response to the originating tool call. An auto-indexing failure SHALL NOT surface to the caller of the originating tool. Auto-indexing SHALL be toggleable via configuration. _Check:_ G1.

**REQ-065 — Collection Scoping**

A collection exists and is addressable the first time content is assigned to it. The active collection for auto-indexing and for any knowledge base tool call that omits the `collection` parameter SHALL be the most specific collection specifier available, where a tool-provided parameter takes precedence over the environment variable `INFOBROKER_KB_COLLECTION`, which takes precedence over the configured default. If no specifier is set at any level, the collection SHALL be the literal string `"default"`. Querying a collection that has no content returns zero results, not an error. _Check:_ G1.

**REQ-066 — Content Expiry**

Indexed content SHALL be removable by age. Expiry intervals SHALL be configurable independently per source type. On server startup and at a configurable maintenance interval, content whose age exceeds the expiry interval for its source type SHALL be removed. Source types configured with a zero or absent expiry interval SHALL never expire. _Check:_ G1.

**REQ-067 — Knowledge Base Configuration**

The knowledge base configuration SHALL reside within the server's main configuration file. The configuration SHALL specify: storage location, embedding model reference, chunking parameters, auto-indexing toggle, default collection name, per-source-type content expiry intervals, and maximum results per query. If the knowledge base configuration section is absent or invalid, all knowledge base tools SHALL return an error with remediation. Config reload SHALL apply knowledge base configuration changes per REQ-040. _Check:_ G1.

---

## §5 Build Process

### 5.1 Language and Runtime

- Language: TypeScript (Node.js 20+)
- MCP SDK: `@modelcontextprotocol/sdk` (stdlib transport)
- Validation: `zod` (peer dependency of MCP SDK)
- HTTP: `undici` (built into Node.js 20+)
- HTML parsing: `cheerio` (for DuckDuckGo scraping)
- Distribution: `npx` via npm package, or direct `tsx src/index.ts`

### 5.2 Layered Architecture

```
Layer 3: Tools                 web_search, fetch_page, converge, choose_provider,
                               list_providers, provider_health, search_suggestions,
                               reload_config, spec_health,
                               kb_search, kb_ingest, kb_stats, kb_delete

Layer 2: Provider Backends     ddg, marginalia, mojeek, brave, searxng,
                               wikipedia, wiktionary, wikidata, openstreetmap,
                               semantic_scholar, arxiv, core, stack_exchange,
                               github, jina, internet_archive, exa, tavily

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
  tier: 'builtin' | 'free_http' | 'self_hosted_http' | 'keyed_http';
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
`keyed_http`.

### 5.4 Build Phases

1. **MCP Skeleton**: stdio transport, tool registration, config loader, env var reader.
2. **Zero-Config Providers**: DuckDuckGo (HTML scraping), Jina Reader (HTTP), Wikipedia API, Wiktionary API, Internet Archive.
3. **Registration-tier & Keyed Providers** (optional): Semantic Scholar, Stack Exchange, GitHub, CORE (free unauth tiers; see §A.3); Brave, Exa, Tavily (API key required; see §A.4).
4. **Tools**: Wire providers to tool handlers. Implement fallback chains, rate limiting, quota tracking, normalization.
5. **Convergence Engine**: Multi-pass search loop with cross-reference, refinement, and confidence scoring.
6. **Client Artifacts**: Generate `search-preferences.md`, skill files, README.
7. **Auth Reference Generation**: Read `config.json` for `auth_env`/`url_env` fields; generate `skills/infobroker/references/provider-auth.md` with the provider-to-auth mapping.
8. **Verification**: G0 MCP conformance, G1 mock provider tests, G2 live smoke tests (key-gated).
9. **Knowledge Base**: Embedding model loader, vector store initialization, chunking pipeline, auto-indexing hooks wired to `web_search`, `fetch_page`, and `converge`, KB MCP tools (`kb_search`, `kb_ingest`, `kb_stats`, `kb_delete`), content expiry maintenance loop.

### 5.5 Convergence Quality (Single Phase)

Unlike Holonovel (which has a ruleset extraction phase), Infobroker has a single
construction quality phase: tool schemas are author-declared and verified against
the MCP specification at build time. Provider backends are tested with mock
responses. The convergence loop validates against:
- Every tool has a zod schema and a registered handler
- Every provider implements the Provider interface
- Fallback chains have at least one active provider
- `converge` exits within max_iterations

---

## §6 Runtime Conventions

### 6.1 Tool Naming

All tools use `snake_case`. Tool names are domain terminology: `web_search`,
`fetch_page`, `search_suggestions`, `choose_provider`, `list_providers`,
`provider_health`, `converge`, `reload_config`, `spec_health`, `kb_search`,
`kb_ingest`, `kb_stats`, `kb_delete`.

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
| Stack Exchange | `https://api.stackexchange.com/2.3/` | 300/day unauth, 10K/day keyed |
| GitHub | `https://api.github.com/search/code` | 60/hr unauth, 5K/hr token |
| Brave | `https://api.search.brave.com/res/v1/web/search` | 2K/mo free tier |
| SearXNG | User-configured (`/search?format=json`) | Requires Docker, JSON format must be enabled |
| Marginalia | `https://search.marginalia.nu/search` | HTML scraping, open source |
| Mojeek | `https://www.mojeek.com/search` | HTML scraping, independent index |
| Exa | `https://api.exa.ai/search` | 1K/mo free tier, neural search |
| Tavily | `https://api.tavily.com/search` | 1K/mo free credits |
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
| `privacy_critical` | duckduckgo | searxng (if configured) | — |
| `content_fetch` | jina | native_fetch | — |

### 7.3 Provider Deprioritization

`choose_provider` SHALL consider current quota remaining when recommending.
A provider at >80% usage is demoted one tier in the dispatch table. A provider
at 100% is removed from recommendations until reset.

---

## §8 Convergence Loop

### 8.1 Algorithm

```
function converge(query, max_iterations=5, confidence_threshold=0.8, providers=[...]):
  findings = {}
  iteration = 0

  while iteration < max_iterations:
    // Phase 1: Broad search across all active providers
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

Independence: Two sources are independent if they have different root domains
(e.g., wikipedia.org and britannica.com are independent; two wikipedia.org
pages are not).

### 8.3 Iteration Limits

- `max_iterations` defaults to 5, capped at 10.
- Max total HTTP calls per `converge` invocation: 30.
- If either limit is reached, return partial findings with `convergence: "partial"` flag.

---

## §9 Verification

### 9.1 G0 — MCP Conformance

- `initialize` handshake produces valid `InitializeResult`
- `tools/list` returns all registered tools with correct `inputSchema`
- `tools/call` with valid params returns a non-error response (smoke test with mocked providers)
- Invalid params produce `isError: true` with error taxonomy compliant message
- `server/discover` advertises correct protocol version

### 9.2 G1 — Integration Tests

- Each provider backend tested with mock HTTP responses (real responses recorded once, replayed in CI)
- Fallback chain: mock provider A fails → provider B called → results from B returned
- Rate limiting: mock clock, verify throttling enforces interval
- Quota tracking: mock exhausted provider → verify fallback skip
- Normalizer: input from each provider format → verify common output shape
- `converge`: mock 3 providers with overlapping claims → verify agreement detection
- Config reload: change config → verify new provider active, old inactive
- Spec drift: parse all `@implements REQ-NNN` citations from `src/**/*.ts`
  and cross-reference against the REQ manifest in this specification. Report
  any REQ with zero citations (excluding §4.6 artifact REQs) as unimplemented;
  report any source file without citations as undocumented.
- KB search: mock vector store with known embeddings; query → verify results ranked by relevance
- KB ingestion: provide text content → verify chunks created and stored
- KB deletion: add content then issue delete → verify correct count removed
- KB auto-indexing: execute `web_search` with mock provider → verify store received results after response
- KB collection scoping: insert content into two collections → query scoped to one → verify only scoped results returned
- KB expiry: insert content with past timestamp → trigger maintenance → verify expired content removed; verify non-expired content retained
- KB config validation: provide invalid KB config section → verify `kb_search` returns config error

### 9.3 G2 — Live Smoke Tests (Optional)

- Run against real provider endpoints
- Requires API keys for keyed providers
- Skips providers without keys (reports skipped, not failed)
- Verifies: connectivity, auth, response parsing, quota reporting

### 9.4 G3 — Spec Validation Gate

- `npm run validate-spec` exits zero
- Every REQ in §4 has at least one source-file citation
  (`@implements REQ-NNN`) or belongs to §4.6 (client artifacts verified by
  file presence) or has a recorded waiver in DECISIONS.md
- Every source file in `src/` has at least one `@implements` header comment
- No REQ body contains: a parameter type annotation, a "Default:" clause,
  an enumerated catalogue longer than 5 items, or a lifecycle description
  duplicated across multiple REQs
- Appendix B violations are warnings; Appendix C violations are errors

---

## §10 Artifacts and Handoff

### 10.1 Project Files

```
infobroker/
├── infobroker.md                          # This specification
├── instructions/
│   └── search-preferences.md              # AI tool-routing instructions
├── skills/
│   └── infobroker/
│       ├── SKILL.md                       # Orchestrator: chains search → skills
│       └── references/
│           ├── provider-map.md            # Task → provider dispatch reference
│           └── pipeline-map.md            # Skill pipeline diagram (Mermaid)
├── vendor/
│   └── opencode-skills/
│       ├── deep-research/SKILL.md         # Phase 3: verify & triangulate
│       ├── fact-checking/SKILL.md         # Claims → verdicts
│       ├── summarization/SKILL.md         # Multi-strategy condensation
│       ├── technical-writing/SKILL.md     # Reports, docs, tutorials
│       ├── copywriting/SKILL.md           # Persuasive frameworks
│       ├── proofreading/SKILL.md          # Grammar, style, clarity
│       ├── code-review/SKILL.md           # Evaluate code solutions
│       └── translation/SKILL.md           # Multilingual output
├── README.md                              # Setup, config, integration (future)
├── ~/.local/share/infobroker/
│   └── knowledge-base/                     # Vector store (created at runtime)
├── DECISIONS.md                           # Implementation decisions (future)
└── AGENTS.md                              # Code map for AI maintainers (future)
```

### 10.2 Client Integration

```json
// opencode.json additions
{
  "instructions": [
    "/home/fluke/infobroker/instructions/search-preferences.md",
    ...existing instructions...
  ],
  "skills": {
    "paths": [
      "/home/fluke/infobroker/skills",
      "/home/fluke/infobroker/vendor/opencode-skills",
      "/home/fluke/.config/opencode/skills"
    ]
  },
  "mcp": {
    "infobroker": {
      "type": "local",
      "command": ["node", "/home/fluke/infobroker/dist/index.js"],
      "environment": {
        "INFOBROKER_CONFIG": "/home/fluke/infobroker/config.json"
      }
    }
  }
}
```

### 10.3 What Replaces What

| Old (DuckDuckGo MCP) | New (Infobroker) |
|----------------------|-------------------|
| `duckduckgo_web_search` | `web_search` — DuckDuckGo is still the default provider, with fallback |
| `duckduckgo_get_page_content` | `fetch_page` — Jina Reader as default renderer, native fallback |
| `duckduckgo_suggest_related_searches` | `search_suggestions` — DuckDuckGo autocomplete, same endpoint |
| (none) | `choose_provider` — new capability |
| (none) | `converge` — multi-pass truth-finding |
| (none) | `list_providers` + `provider_health` — operational visibility |
| (none) | `reload_config` + `spec_health` — ops tooling |
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

**ArXiv** — `https://export.arxiv.org/api/query?search_query={query}&max_results=10`. 1 call per 3 seconds.

### A.3 Free HTTP (Registration Required)

**Semantic Scholar** — `https://api.semanticscholar.org/graph/v1/paper/search?query={query}`. Shared pool at 1000 RPS; dedicated pool with key at 1 RPS. Covers 214M papers, 2.5B citations.

**Stack Exchange** — `https://api.stackexchange.com/2.3/search/advanced?q={query}&site=stackoverflow`. 300 req/day baseline, 10K/day with app key. Covers 170+ Q&A sites.

**GitHub** — `https://api.github.com/search/code?q={query}`. 60 req/hour baseline, 5000/hr with token. Can search code, repos, issues.

**CORE** — `https://api.core.ac.uk/v3/search/works?q={query}`. Open access research papers.

### A.4 Keyed HTTP (Free Tier)

**Brave Search** — `https://api.search.brave.com/res/v1/web/search?q={query}`. 2,000 queries/mo free. Independent index (40B+ pages). 669ms average latency. Also has News and Images endpoints.

**Exa** — `https://api.exa.ai/search`. 1,000 searches/mo free. Neural/semantic search. Best for "find companies like X" or conceptual queries. Can filter by date, domain, content type.

**Tavily** — `https://api.tavily.com/search`. 1,000 credits/mo free. RAG-optimized results with inline citations. Good for "give me sources about X."

### A.5 Self-Hosted HTTP

**SearXNG** — User runs Docker container. MCP calls `POST /search?format=json` on the user's instance URL. Full privacy — all queries stay on user's machine. 274 search backends available. Requires `format: json` enabled in `settings.yml`.

### A.6 Scraped (No Official API)

**Marginalia** — `https://search.marginalia.nu/search?query={query}`. Open-source search engine prioritizing non-commercial content. HTML scraping. Unknown rate limits — conservative 5s interval.

**Mojeek** — `https://www.mojeek.com/search?q={query}`. Privacy-first search engine with independent index. HTML scraping. Unknown rate limits — conservative 5s interval.

---

## §B Appendix: REQ Authoring Conventions

This appendix defines what belongs in a requirement and what does not. It is not
a build artifact — it is a spec-maintainer reference.

**REQ anatomy.** One paragraph stating the *what*. Ends in `_Check:_` with test
citations. Contains no parameter types, no algorithm descriptions, no default
values, no catalogue enumerations, no tool-name lists.

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
artifacts (§4.6) or build process (§5) which are verified by artifact presence
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
- REQ bodies with duplicated lifecycle descriptions across multiple REQs

**C.7 Risk-calibrated detail.** The level of detail in a REQ SHALL match the
risk profile of the requirement:
- **High risk** (API key handling, error taxonomy, convergence integrity):
  precise contract language, explicit SHALL clauses, edge cases enumerated
- **Medium risk** (rate limiting, quota tracking, fallback behavior):
  configurable thresholds cited, expected behavior stated, recovery paths named
- **Low risk** (output formatting, suggestion format, status reporting):
  shape described, content left to builder judgment

**C.8 Out-of-scope discipline.** Every major section SHALL explicitly state
what it does NOT cover, using an "Out of scope" clause or equivalent. This
bounds the builder's interpretation and prevents scope creep. Ambiguity about
what is in scope is as dangerous as ambiguity about behavior.
