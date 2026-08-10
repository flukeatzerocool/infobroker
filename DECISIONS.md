# DECISIONS.md — Infobroker Implementation Decisions

## Active Decisions

### D-012: Build Fingerprint (auto-generated)

**Spec hash:** `11092c8845d560ec5bd946e1fc9a3f5066e6a31fc38be7e6b9822a4408d554ea`
**Source hash:** `134bddd476bed485e90c63491ead735814dae0c2eb4ca1fd8d4af28ecbec0a52`
**Config hash:** `2bd8dad703161afb7ec9476ddb45fa11f061c22b7a2e87bf117c8615995b75d5`
**Total fingerprint:** `4af69e7fc9402585cb61afecf1572fd8b5489d48db895765d71cdbca39d76ecb`
**Generated:** 2026-08-10T15:38:40.333Z
### D-001: Response Envelope Format
The REQ-001 contract specifies JSON with `[OK]`/`[ERROR]` prefix.
Tools return `[OK] JSON_BODY` or `[ERROR] JSON_BODY` text content through
MCP's `{content: [{type: "text", text: ...}]}` format. The JSON body
follows the `ToolOkResponse` / `ToolErrorResponse` shapes.

### D-002: Provider Search Architecture

All providers export a `Provider` object matching the `Provider` interface
from `types.ts`. They are aggregated into a `PROVIDERS` registry in
`providers/index.ts` and dispatched by slug at runtime — no switch
statement or per-provider branching in tool handlers. Adding a new
provider requires one file (the provider module) and one line in the
registry. The prior switch-statement approach (2026.08.10 and earlier) was
replaced to satisfy REQ-070 (Provider Registration).

### D-003: Scraped Provider Rate Limits
Marginalia and Mojeek use conservative rate limits (0.2 req/sec = 5s
interval) because their rate limits are undocumented. DuckDuckGo uses
3s minimum as documented.

### D-004: Convergence Algorithm

The convergence loop executes Phase 1 (broad search) in parallel using
`Promise.allSettled` — per-provider throttles are independent so parallel
dispatch is safe. Phase 3 (gap refinement) remains sequential because it
depends on gap analysis from Phase 2. Claim reconciliation uses Jaccard
similarity to cluster agreeing and disagreeing sources (see D-013).

### D-005: Keyed Provider Auth Handling
Keyed providers (Brave, Exa, Tavily) are configured in config.json with
`enabled: false` by default. Users must set the corresponding
`INFOBROKER_<NAME>_API_KEY` env var and toggle `enabled: true`.
Health checks report `inactive` when keys are missing. The startup health
check logs `inactive (no_api_key)` for keyed providers without keys.

### D-006: Client-artifact REQ Exemptions
REQs 050-054 (client artifacts) are verified by file presence, not
source citations, per the validate-spec exemption. These files are
generated/maintained manually: `instructions/search-preferences.md`,
`skills/infobroker/SKILL.md`, `skills/infobroker/references/*.md`,
`vendor/opencode-skills/*/SKILL.md`, and `README.md`.

### D-010: Timeout, Latency Window, and Config Validation (2026.08.08 — implemented 2026.08.10)

REQ-035 (Request Timeout), REQ-036 (Latency Tracking Window), and
REQ-037 (Config Validation) were authored during the 2026.08.08
spec-engineering pass and implemented in the subsequent build cycle.
Per-provider request timeouts use `Promise.race` with configurable
timeout values. Latency metrics are computed over a bounded sliding
window configured via `output.latency_window_size`. Config validation
on load and reload rejects missing provider fields, invalid dispatch
chains, and negative rate-limit values; invalid configs on reload leave
the previous config active.

### D-007: Provider Interface Enforcement

Every provider exports a `const provider: Provider` object that satisfies
the `Provider` interface at the TypeScript type level. The `PROVIDERS`
registry in `providers/index.ts` is typed as `Record<string, Provider>`,
so an invalid provider entry (missing `slug`, wrong `health()` return shape,
etc.) is caught by `tsc --noEmit` at commit time. This replaces the
earlier convention-based approach (documented in the initial D-007) where
the `Provider` interface existed only for documentation and was not
enforced at build time.

### D-008: Retry Strategy

HTTP errors with status 429 or 503 are retried with exponential backoff.
Default: 3 retries with 1s base delay (1s, 2s, 4s). Providers throw
`RetryableError` with the HTTP status code. Non-retryable errors (4xx
auth, 5xx server errors) fail immediately and trigger fallback chain
advancement. Per-provider `retry_count` and `retry_backoff_ms` fields in
`config.json` override the defaults. (REQ-032)

### D-009: Quota Tracking Granularity
Quota counters track daily and monthly usage. Reset occurs at midnight
UTC for daily, month boundary for monthly. The 80% warning threshold
and 100% exhaustion are computed per-provider. Counters without explicit
limits (Infinity) never trigger warnings.

### D-013: Convergence Reconciliation Approach (2026.08.10)

Claim reconciliation in `converge` uses token-based Jaccard similarity
to detect agreement and disagreement between sources. This is a
lightweight approach that requires no LLM or embedding model. Sources
with Jaccard similarity ≥ 0.3 are grouped into agreement clusters.
When multiple clusters exist for a topic, the finding is marked
"contested" with `perspectives` populated from each cluster's
representative snippet. This satisfies REQ-026's reconciliation
requirements without external dependencies.

### D-014: Convergence Provider Defaults (2026.08.10)

The `converge` tool's `providers` parameter defaults to all active
providers with `web_search` capability (as specified by REQ-026)
rather than the general_web dispatch chain. Gap refinement uses
round-robin provider selection to distribute follow-up queries
rather than repeatedly hitting a single backend.

### D-011: Knowledge Base Implementation (2026.08.09 — implemented 2026.08.10)

REQ-060 through REQ-067 (Knowledge Base) were authored during the
2026.08.09 spec-engineering pass and implemented with a TF-IDF + cosine
similarity hybrid search approach. The embedding model ("tf-idf") runs
in-process with zero external dependencies. The vector store persists to
a JSON file at the configured storage path. Auto-indexing fires via
`setImmediate` after successful `web_search`, `fetch_page`, and `converge`
calls — it never delays or errors the primary response. Content expiry
runs on startup and at the configured maintenance interval. Collection
scoping resolves from user-provided, env var, config default, then literal
"default". Storage corruption triggers backup and fresh store creation.
