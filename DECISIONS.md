# DECISIONS.md — Infobroker Implementation Decisions

## Active Decisions

### D-016: Feature Taxonomy as Verified Spec Artifact (2026.08.20)

REQ-078 mandates a feature taxonomy appendix (§D) that groups every tool
and every §4 REQ into eight thematic feature areas (Core Retrieval,
Provider Intelligence, Convergence, Knowledge Base, State & Operations,
Tool Surface & Contracts, Client Artifacts, Spec Governance). The taxonomy
is the canonical map for planning improvement sprints — each area names a
self-contained REQ range and verification gate. It is enforced by
`validate-spec` (G3), which checks that every tool slug and every §4 REQ ID
appears in §D, and by `validate-readme`, which checks that the README links
to the taxonomy and documents a Knowledge Base feature section. The taxonomy
is a spec-integrity concern, so REQ-078 sits in §4.8 alongside REQ-055 and
REQ-077 and is treated as a meta-REQ (no source-file citation required).

### D-017: README Single Source of Truth and Self-Verifying Update (2026.08.21)

The README's tool and provider surface must reconcile with the live code
and config, not a hand-maintained list. `validate-readme` derives tool
names from `src/index.ts` registrations and provider slugs from
`config.json` at validate time (excluding the `native_fetch` fallback
renderer), and the tool list for the "names in prose" check is likewise
derived — the previous hardcoded list omitted the four `kb_*` tools. The
README auto-update prompt (`scripts/pipeline/prompts/readme.md`) is a
single prompt with two internal phases (Generate → Verify) rather than a
separate verifier agent, to minimize script surface: phase 2 re-checks
every claim against its source and reports `<N> high-severity finding(s)`,
gating on 0 before the README is considered complete. The mechanical
`validate-readme` gate still runs after the prompt as the hard stop.

### D-018: Self-Contained Skill Suite (2026.08.21)

The client-artifact skill suite is shipped self-contained in the
repository rather than relying on global OpenCode dependencies, so a
fresh install carries the full research-and-writing pipeline with no
outside skill prerequisite (REQ-052). Six pipeline skills are vendored
— deep-research, fact-checking, summarization, technical-writing,
proofreading, and translation. Two former pipeline skills (copywriting
and code-review) are dropped from the set and remain global-only; the
spec-authoring skills (spec-review, spec-engineering-loop) are likewise
not shipped in the repository. The CTI-modeled research workflow was
renamed from `research-engineering-loop` to `analysis-loop`, naming its
analytic-rigor focus rather than an engineering activity.

### D-019: Generic HTTP Provider Tier as Forward-Looking Requirement (2026.08.21)

REQ-014 (Generic HTTP Provider Tier) and REQ-015 (Provider Removal by
Disable) are authored ahead of implementation. They define the user-facing
capability — add a provider by configuration without source changes, and
remove one by disabling it in the user layer — but no source file yet cites
them, so `validate-spec` reports an uncited-REQ warning for each. This is
the documented forward-looking pattern (precedent D-010, which recorded
REQ-035/036/037 before their implementation). The generic provider resolves
through the existing registration mapping (REQ-070) to a single shared
implementation rather than a per-provider module; no per-tier tier constant
is introduced to the provider-module interface beyond widening the tier
union in §5.3.

### D-020: Tool Consolidation and Output Economy (2026.08.21)

The 13-tool surface was consolidated to 6 tools to cut `tools/list` schema
bloat and round-trips: `web_search` (task-type auto-selection + suggestion
mode), `fetch_page`, `converge`, `providers` (list/health/spec), `kb`
(search/ingest/stats/delete), and `reload_config`. `search_suggestions` and
`choose_provider` folded into `web_search`; the four `kb_*` and three
ops/spec tools folded into `kb` and `providers` respectively, expressed via
sub-REQs (`020a`–`020b`, `024a`–`024c`, `060a`–`060d`). The validate-spec
tool list is derived from `src/index.ts` registrations instead of a
hardcoded array, matching the README validator's single-source-of-truth
pattern (D-017).

Output economy (REQ-079) adds a configurable compact verbosity that drops
`meta` and non-contracted fields, and `converge` caps corroborating sources
at three plus a synthesis statement. Keyed providers now ship `enabled:
false` in `config.json`, finally matching the long-standing D-005 intent;
free-HTTP providers with optional auth keys remain enabled because they
operate without a key. The redundant `type` field was removed from
`config.json` (tier is the single authority). A `defaults` block supplies
provider timeout/retry inheritance. Convergence source independence now
collapses to the registrable domain (eTLD+1 heuristic) and accepts
configurable first-pass breadth and similarity threshold.

### D-021: Priority Routing and Parameter Transparency (2026.08.22)

The `web_search` `priority` parameter was previously accepted and ignored
(`void priority`). It is now implemented (REQ-020c) as an intent-first
selection: `privacy` routes to the `privacy_critical` chain, `free_only`
drops keyed and self-hosted providers, `speed` reorders by recent average
latency, and `quality` (or omission) preserves the task-type dispatch
chain; an explicit `provider` parameter overrides all of these. Chain
selection and ignored-parameter computation are extracted to `src/chain.ts`
as pure, unit-tested helpers. Parameter transparency (REQ-020d) reports
`meta.ignored_params` for `time_range`, `page`, and `safe_search` when the
serving provider does not honor them; `max_results` is never reported
because the server enforces it. The per-provider support map is seeded
from an audit of each provider's `search()` (DuckDuckGo honors
`time_range`+`safe_search`; Brave honors `time_range`; the remainder honor
none).

### D-022: Convergence Authority Weighting, Claim Attribution, and Synthesis (2026.08.22)

Convergence confidence now reflects source authority in addition to
independence (REQ-026a): each corroborating source contributes a
`convergence.authority_weights` multiplier keyed by its `source_type`
(absent/unknown `source_type` is neutral 1.0, preserving the §8.2
domain-count baseline). Claim attribution (REQ-026b) adds a per-source
`claim` field (the source's snippet) so every corroborating source is bound
to its own claim text. The synthesis statement is now a deterministic
narrative over confirmed, contested, and unverified findings rather than a
count summary (REQ-026). Registrable-domain resolution moved from a
hardcoded multi-label TLD list to the `tldts` public-suffix library, which
adds one runtime dependency in exchange for correct domain independence
for arbitrary TLDs.

### D-023: Pluggable Embedding Model Interface (2026.08.22)

The knowledge base exposes an in-process `EmbeddingModel` interface whose
single built-in implementation is a zero-dependency TF-IDF vectorizer.
`kbStats` reports the active model's name. A richer local model can be
registered against the interface without changing call sites; REQ-067's
"embedding model reference" and REQ-060c's availability reporting already
bound the contract, so no new REQ was required (F9 covers unavailability).

### D-012: Build Fingerprint (auto-generated)

**Spec hash:** `ffb4644015e5b7250f87173e1247e4f81050f8329bff6566275e38e8bfaaabea`
**Source hash:** `9ec010fa4214ca7d9d44638c28781a85b63f4bfdb3eb8f07b80ea23ba7fb4117`
**Config hash:** `9108adc0d7b99abe3ae48128b741df18088fa4a4c24e5cf9f6969b14d8bf3854`
**Total fingerprint:** `d98970fac63639f5287d8c11ef1cb2cc69353cd83dbc0210eacc6250b495268a`
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
and `README.md`. Pipeline skills are shipped in the repository, not global OpenCode dependencies.

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
Default: 2 retries with 1s base delay (1s, 2s). Providers throw
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

### D-015: User Configuration Overlay and Source Distribution (2026.08.19)
REQ-042 (Source Distribution) and REQ-043 (Update Preservation) were
authored to document the repository-based deployment (hosted at git.gay)
and guarantee that updates do not erase user-owned state. Distribution is
a git repository: users clone it and run the server locally with `tsx`;
updates arrive as repository fetches. There is no npm publication.

Configuration is layered per REQ-010: the tracked `config.json` holds the
shipped defaults, and a git-ignored `config.local.json` (or a path set via
`INFOBROKER_CONFIG_LOCAL`) holds user overrides. The server deep-merges the
user layer over the shipped default — user values take precedence, arrays
are replaced wholesale — before validation and reload. The knowledge base
(`~/.local/share/infobroker/knowledge-base`) and quota state
(`$TMPDIR/infobroker/quota.json`) live outside the repository, so they are
preserved across updates. API keys remain environment-variable-only
(REQ-011) and are therefore update-safe.
