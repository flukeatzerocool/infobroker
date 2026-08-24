# DECISIONS.md — Infobroker Implementation Decisions

## Active Decisions

### D-034: Per-Provider Health Threshold and Reseller Provenance (2026.08.23)

Two latent REQ legs were closed without new REQ IDs. REQ-013's `degraded`
definition is an "or" of two triggers; the shipped server implemented only the
"partial results" branch (non-OK/timed-out health probe, quota warning) and had
no latency threshold. D-034 adds a per-provider `degraded_latency_ms` config key
with an `output.degraded_latency_ms` global fallback; `doProviderHealth` now
flips `active → degraded` when the bounded-window average latency exceeds the
effective threshold. The per-provider scope reuses the existing per-provider
config lookup, so it adds no new plumbing.

REQ-003 requires each result to carry an `original_source` "when the serving
provider or its configuration declares the result is aggregated or resold." The
normalizer already surfaced `original_source` and the generic tier already
mapped it via `field_map`, but no built-in provider declared the condition, so
the clause was dead code. D-034 adds a `resells: true` flag on the aggregator/
reseller providers (DuckDuckGo, Brave, Marginalia, Mojeek, Wiby, SearXNG, Yep,
Tavily, Exa) and populates `original_source` where the API exposes a distinct
origin — Brave (its `profile` name/`meta_url` host) and Yep (its `source`
object). Tavily, Exa, and the scraped providers serve their own index, so the
result URL is already the origin; forcing a DuckDuckGo redirect-chase was
rejected as fragile. First-party sources (Wikipedia, arXiv, etc.) correctly
leave `resells` unset.

### D-033: KB Encryption Transitions and Recovery Journey (2026.08.23)

D-032 added the encryption primitives (envelope, key source chain, lock
semantics) but left the user journey implicit: enabling required hand-rolled
`openssl` keygen plus a config edit, disabling was an undocumented deferred
side effect of the next write, and recovery was operator-shell-only (rekey via
`INFOBROKER_KB_REKEY_*` env vars plus a restart). D-033 (REQ-086) makes the
transitions explicit and reachable through the client-facing `kb` tool via an
`encryption` action (`status`, `generate_key`, `verify`, `backup`, `rekey`).

Three journey decisions:

- **Enable/disable are explicit, immediate transitions**, mirroring each
  other. Enable already eagerly re-encrypted the legacy plaintext store at
  init; disable now eagerly re-decrypts an encrypted store at init rather
  than deferring to the next write. Disabling while the store is still
  encrypted and the key is gone locks the store (never resets), matching
  D-032's "on-disk magic is authoritative" rule.
- **Secrets never cross tool parameters.** The tool accepts key *file paths*
  only; `generate_key` and `backup` return paths, never key material. This
  avoids writing secrets into client conversation logs while still giving
  agents a path to stage and back up keys.
- **The recover surface stays reachable while locked.** All other `kb`
  actions honor the lock; `encryption` does not, so an agent can inspect
  state, verify a candidate key, restore a backup, or re-key without first
  unlocking. Recovery remains bounded by REQ-085 (a lost key is
  unrecoverable by design), but the path to a backup or re-key is now a tool
  call rather than a shell ritual.

### D-032: KB At-Rest Encryption and Data-Preservation Invariants (2026.08.23)

The knowledge base stores user-generated reports alongside auto-indexed web
content in a single plaintext JSON file exposed to file-level exfiltration
(device theft without full-disk encryption, backup/cloud-sync leaks, other
local users). D-032 adds optional, off-by-default at-rest encryption
(REQ-084) and a set of data-preservation invariants (REQ-085). Encryption is
the `INFOKB1` versioned envelope: AES-256-GCM with the header bound as
associated data, a fresh random nonce per write, and a key resolved from an
ordered source chain — `kb.encryption.key_file` (the required primary source,
robust to MCP clients that do not propagate shell environment variables) →
`INFOBROKER_KB_KEY` (raw 32-byte key) → `INFOBROKER_KB_PASSPHRASE`
(scrypt N=2^17/r=8/p=1 wrapping a random 256-bit DEK, so a passphrase change
re-wraps the DEK without re-encrypting the store). Safe defaults and failure
semantics follow SQLCipher and the `age` tool: the on-disk magic header is
authoritative; a missing/wrong key, decryption failure, or a newer format is a
hard error that leaves the store byte-identical and locks the KB with a
REQ-002 error — never a backup-and-reset. All persistence is an atomic
temp+fsync+rename (which also fixes a latent torn-write bug in the plaintext
path), every encrypted write is self-verified by an encrypt→decrypt→compare
round-trip before rename, migrations and re-key use staged verify-before-commit,
and unknown/newer formats are never rewritten. Cross-process concurrent writes
are surfaced via a save-time fingerprint detect-and-warn rather than silently
merged. This defers OS-keychain integration (native dependency + headless
Linux libsecret/dbus absence) in favor of the key file, and leaves the
default-off cleartext mode as a documented, accepted risk.

### D-031: KB Retrieval Consistency and Stable Feature Space (2026.08.23)

The knowledge base's built-in vectorizer computed TF-IDF embeddings against
the live vocabulary, which grows with every ingest. Because chunk embeddings
were frozen at the pre-ingest vocabulary snapshot while each query was
vectorized against the current (larger) vocabulary, the two vectors no longer
shared a dimension; `cosineSimilarity` produced NaN and every chunk was
silently discarded, so `kb` search returned zero results on any populated
store. The fix replaces the vocabulary-indexed vectorizer with a
fixed-dimension signed feature-hashing model (`signed-hash-tfidf`, 4096 dims):
each token hashes to an index via FNV-1a and contributes `tf-idf` weighted by a
sign derived from a second hash. The dimension is constant regardless of
vocabulary growth, so cosine similarity is always well-defined and new content
is always vector-searchable. On load, when the store's recorded model differs
from the active model (including a legacy `tf-idf` store), every chunk is
re-embedded from its stored text and the reconciliation is recorded as a status
event — this satisfies the REQ-082 reconciliation contract on embedding-model
change. The now-unused `max_vocab_terms` config key is removed from the schema
(same commit series); the historical CHANGELOG entry noting its 10,000 default
remains as provenance. This amends D-023 (the built-in model is no longer
vocab-indexed TF-IDF) and D-011 (the retrieval approach is hashed TF-IDF +
cosine, still zero-dependency).

### D-030: Imperative Completion Tokens and Skill Auto-Selection (2026.08.22)

A researcher-style test run (18 scenarios exercising every workflow shape
through realistic, non-leading utterances) exposed two defects the
component suite could not. First, the workflow-shape completion tokens
(`research complete.`, `fact-check complete.`, `evaluation complete.`, and
the rest) fired zero times in natural use: they are declared as `Token:`
notes in `references/workflows.md` but no instruction in the orchestrator
tells the agent to emit them, so the agent completes the research and never
writes the token. Second, skill auto-selection is unreliable — roughly half
the scenarios satisfied the request with raw Infobroker tool calls and
never loaded the `infobroker` orchestrator, because `search-preferences.md`
routed to tools only, not skills. The fix makes the tokens imperative in
the orchestrator's pipeline steps (mirroring `analysis-loop`'s proven form)
and adds a skill-loading directive to `search-preferences.md` plus a
sharper orchestrator description. The completion token is now a permanent,
grep-able part of every research deliverable, not a test-only artifact.
The component suite (`test-skills`) is reframed as a contract-emission
check; the new `test-research` suite covers end-to-end routing and quality.

### D-029: Proofreading De-spec'd and Skill Test Harness (2026.08.22)

The `proofreading` skill is now a pure prose-polish skill. Its prior "spec
mode" detected structural problems in specification files (REQ block
hygiene, manifest completeness, test-ID consistency, term-definition
hygiene, golden-transcript coverage) and handed verdicts to `spec-review`
via a `proofread FAILED.` token. That split ownership blurred the skill's
identity and added a spec-specific surface that contradicted the rest of
the prose workflow, so it was removed: the frontmatter trigger, the Spec
Mode section, the structural-handoff output format, and the `proofread
FAILED.` form are gone. The skill now ends only with `proofread passed.
[scope] — N corrections`. The push pipeline's read-through step
(`scripts/pipeline/prompts/readthrough.md`) still performs the authoring
audit, but as direct prompt instructions alongside a prose pass — the
mechanical `validate-spec` gate (Step 1) remains the structural backstop.
Separately, an agentic test harness now exercises every bundled skill live:
a manifest-driven `npm run test-skills` runs each skill through headless
opencode against the real Infobroker MCP and asserts its completion token
in order, with an optional `--grade` rubric pass. This makes skill
regressions catchable without a human invoking each skill by hand.

### D-028: Orchestrator as Workflow Router and Skill Consolidation (2026.08.23)

The skill suite gained five research workflow capabilities without adding
skills. Instead of a new SKILL.md per capability, the orchestrator
(`skills/infobroker/SKILL.md`) now opens with a Phase 0 Classify gate that
maps intent to one of nine workflow shapes, and a new reference
`skills/infobroker/references/workflows.md` defines each shape compactly
(trigger, tool sequence, grepable output token, escalation). This mirrors
the existing `provider-map.md`/`pipeline-map.md` reference pattern: shape
definitions load only when routed, so the always-on cost is a single
broadened orchestrator description, not nine competing descriptions.
Deep-dive and fact-checking became workflow shapes rather than standalone
skills, folding their procedures (deep-research's scope→parallel-search→
triangulate→synthesize and fact-checking's verdict taxonomy) into the
shape layer and deleting the two SKILL.md files — the suite drops from
eight bundled skills to six plus the analysis-loop escalation, per REQ-052.
The four writing sub-skills (summarization, technical-writing,
proofreading, translation) stay standalone: merging them would save only
~80 always-on words while destroying MIT-licensed standalone utility. A
token-footprint trade: always-on ~325 → ~270 words, per-task cost down via
sectional shape reads.

### D-027: Tool Default Single-Source of Truth (2026.08.23)

The recurring efficiency sweep surfaced a persistent class of drift: tool
default values lived in three places — the zod `inputSchema` in
`src/index.ts`, handler `?? N` fallback literals, and `config.json` — and
disagreed (`web_search` `max_results` schema said 8 while the handler
carried a dead `?? 5`; `kb` inverted the pair). REQ-080 makes the contract
explicit: every tool default declared in §4.3 is the value the tool applies
when the parameter is omitted, config-sourced values resolve entirely from
the configuration, and no code path may carry a divergent numeric fallback.
The single source of truth per value is fixed by class — a tool parameter
default is declared in the §4.3 tool signature and applied by the zod
schema; a tunable (timeout, first-pass breadth, verbosity, KB thresholds) is
declared in `config.json`. `validate-spec` (G3) now enforces this: it errors
on any `config.<field> ?? <number>` shadow literal in the tool layer
(`index.ts`, `corroborate.ts`, `config.ts`, `kb.ts`) and on any divergence
between the spec-declared `max_results` default and the zod default.
Provider-internal over-fetch defaults (`?? 10` in duckduckgo, wikipedia,
generic-http, yep; hardcoded 10 in tavily/arxiv) are deliberate — the server
trims to the requested `max_results` — and are exempt, not shadowing a
config value.

### D-024: `converge` Renamed to `corroborate` (2026.08.23)

The multi-pass truth-finding tool was renamed from `converge` to
`corroborate` to match the discipline it serves. "Convergence" is the
algorithmic term for an iterative loop; the capability is cross-source
verification — the wording the README and REQ-026 already used. The
replacement is the OSINT/IC doctrine term (ATP 2-22.9's top validation tier
is "corroborated" OSINT; the named technique is "cross-source
corroboration"), and it is the single candidate understood natively across
all intended audiences (CTI, journalists, market researchers, academics,
engineers). "Triangulate" was the runner-up for its independence metaphor;
"verify" and "truth-find" were rejected (collides with fact-checking,
overclaims). The rename is a G0 tool-contract change taken pre-1.0 while the
surface is small. Internal identifiers (`CorroborationResult`,
`corroboration` config block, `corroboration_error`) follow the tool name
for consistency.

### D-025: Provider Additions and Startpage Rejection (2026.08.23)

Two providers were added from the audience-expansion research: **Yep**
(keyed_http) and **Wiby** (builtin scraper). Yep was confirmed a mature,
first-party, documented API (`platform.yep.com/api/search`) with a 1,000-request
free tier and native `content_type`/`location`/`language`/`safe_search`
filters on an AhrefsBot 100B-page index — it is a stronger addition than the
original "verify stability" hedge implied, and it natively serves the new
`content_type`/`region` web_search parameters. Wiby is a curated small-web
directory added to the `small_web` chain as a complement to Marginalia and
Mojeek. **Startpage was rejected**: no official API, and HTML scraping is
ToS-risky and actively CAPTCHA-blocked (F2 fragility with no fallback value
beyond indexes already covered by Brave and Yep). Presearch, Gigablast,
You.com, and Andi were likewise rejected (dormant, token-gated, or redundant
with Tavily/Exa).

### D-026: Corroboration Source Preservation Off by Default (2026.08.23)

Corroboration source preservation (`archive_sources`) is implemented as a
best-effort, non-blocking Wayback save with bounded concurrency, but ships
disabled by default. It is doctrinally correct (ICS 206-01 "most stable and
permanent location"; the OSINT compendium's "archive relevant pages in real
time"), but default-on would POST every cited URL to a third party and add
Save-Page-Now latency to every corroboration. Enabling it is a deliberate
opt-in rather than a surprise.

### D-016: Feature Taxonomy as Verified Spec Artifact (2026.08.20)

REQ-078 mandates a feature taxonomy appendix (§D) that groups every tool
and every §4 REQ into eight thematic feature areas (Core Retrieval,
Provider Intelligence, Corroboration, Knowledge Base, State & Operations,
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

### D-019: Generic HTTP Provider Tier (2026.08.21, implemented 2026.08.23)

REQ-014 (Generic HTTP Provider Tier) and REQ-015 (Provider Removal by
Disable) define the user-facing capability — add a provider by
configuration without source changes, and remove one by disabling it in
the user layer. REQ-014 was implemented 2026.08.23: `src/providers/generic-http.ts`
provides a single shared factory (`createGenericProvider`) resolved through
the registration mapping (REQ-070) via `resolveProvider` in
`src/providers/index.ts`, honoring the design recorded when the requirement
was authored. A generic provider declares `endpoint`, `query_param`,
`results_path`, and `field_map` in the user config layer; dispatch and
corroboration resolve it at runtime, and config validation (REQ-037)
rejects a malformed entry on load and reload.

### D-020: Tool Consolidation and Output Economy (2026.08.21)

The 13-tool surface was consolidated to 6 tools to cut `tools/list` schema
bloat and round-trips: `web_search` (task-type auto-selection + suggestion
mode), `fetch_page`, `corroborate`, `providers` (list/health/spec), `kb`
(search/ingest/stats/delete), and `reload_config`. `search_suggestions` and
`choose_provider` folded into `web_search`; the four `kb_*` and three
ops/spec tools folded into `kb` and `providers` respectively, expressed via
sub-REQs (`020a`–`020b`, `024a`–`024c`, `060a`–`060d`). The validate-spec
tool list is derived from `src/index.ts` registrations instead of a
hardcoded array, matching the README validator's single-source-of-truth
pattern (D-017).

Output economy (REQ-079) adds a configurable compact verbosity that drops
`meta` and non-contracted fields, and `corroborate` caps corroborating sources
at three plus a synthesis statement. Keyed providers now ship `enabled:
false` in `config.json`, finally matching the long-standing D-005 intent;
free-HTTP providers with optional auth keys remain enabled because they
operate without a key. The redundant `type` field was removed from
`config.json` (tier is the single authority). A `defaults` block supplies
provider timeout/retry inheritance. Corroboration source independence now
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

### D-022: Corroboration Authority Weighting, Claim Attribution, and Synthesis (2026.08.22)

Corroboration confidence now reflects source authority in addition to
independence (REQ-026a): each corroborating source contributes a
`corroboration.authority_weights` multiplier keyed by its `source_type`
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

**Spec hash:** `21abb0c856c9767a48792144b0b55d23e45f789ed7ab14091026cd1eb74b3bb2`
**Source hash:** `2c449c2a99230215916d421b7f5edf4fb73938ee0d6d8ee11edb9c182d9bf8e8`
**Config hash:** `632cc155c348f8169348f62272b7a78241bfb62f7476456e0848b287a220edac`
**Total fingerprint:** `34066356289d152a07401814efad733b5e15556b704827853e2c1947ef84546a`
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

### D-004: Corroboration Algorithm

The corroboration loop executes Phase 1 (broad search) in parallel using
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

### D-013: Corroboration Reconciliation Approach (2026.08.10)

Claim reconciliation in `corroborate` uses token-based Jaccard similarity
to detect agreement and disagreement between sources. This is a
lightweight approach that requires no LLM or embedding model. Sources
with Jaccard similarity ≥ 0.3 are grouped into agreement clusters.
When multiple clusters exist for a topic, the finding is marked
"contested" with `perspectives` populated from each cluster's
representative snippet. This satisfies REQ-026's reconciliation
requirements without external dependencies.

### D-014: Corroboration Provider Defaults (2026.08.10)

The `corroborate` tool's `providers` parameter defaults to all active
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
`setImmediate` after successful `web_search`, `fetch_page`, and `corroborate`
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
