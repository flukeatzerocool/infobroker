# DECISIONS.md — Infobroker Implementation Decisions

## Active Decisions

### D-086: CalVer Is Normalized on Publish (2026.11.06)

`npm view infobroker versions` returns `2026.11.4`, not the `2026.11.04` stored
in `package.json`: npm strips the leading zero from each numeric segment, the
same transform `normalizeSemver` already applies to `server.json`. The registry
accepts the version, so publishing is not blocked, but the published identity
never equals the repository identity and `v2026.11.04` names a tag whose
registry version is `2026.11.4`. Strict SemVer 2.0.0 forbids leading zeros, so
any tool comparing `package.json` to the registry sees a mismatch. Decision: do
not change versioning inside the release-routine plan, because it touches
`today()`, the CHANGELOG header regex, and every historical entry; schedule the
normalization on `ROADMAP.md` instead. Rejected: leaving it unrecorded (the
mismatch was previously invisible), and normalizing only `server.json` (already
done, which is why the mismatch looked handled).

### D-087: Release-Loop Baseline (2026.11.06)

The numbers the release-routine plan is measured against, before its restructure
lands: 0.46 pushes/day, commit-to-push lead time median 14.9h and p90 347h,
median 2 commits per push (max 97), 41 of 52 pipeline commits followed by another
within 48h, 32 commits unpushed, and roughly 30 percent of in-session time spent
on the pipeline and gates. `npm run metrics` reproduces the first four from the
origin reflog; `npm run status` reports the unpushed count and age. The next
review compares against this line rather than relying on recall.

### D-085: LLM Steps Never Publish (2026.11.06)

The push pipeline ran four LLM steps (read-through, sync, changelog, README)
that rewrote tracked files, then staged the whole tree and published it. What
shipped was therefore not the tree the deterministic gates had tested, and a
failing gate fed another LLM repair that rewrote more of it: 50 of 239 commits
touched the pipeline and 40 of those had a follow-up within 48 hours. The
release path is now split. `npm run prep` (`--no-commit`) runs the AI steps and
stops with a reviewable diff, which the session loop reviews and commits.
`npm run release` (`--no-ai`) skips all four AI steps and the AI scan, requires
a clean tree whose version and CHANGELOG already agree, then runs auth, the
deterministic scan, the full gate suite, the commit, the tag, and the push, with
no `opencode` dependency. A deterministic release publishes exactly the reviewed
tree. The entry point is `prep`, not `prepare`, because `prepare` is an npm
lifecycle hook that would run the pipeline on every `npm install`. Rejected:
keeping the AI steps in the publish path (unreviewable diffs and a self-repair
loop at release time); naming the command `prepare` (lifecycle hijack); dropping
the AI review entirely (it still catches what the deterministic gates cannot,
just not during publish).

### D-084: Provider Rate Limits and Privacy-Chain Ordering (CF-1, CF-2, CF-9, CF-10; 2026.11.06)

Stack Exchange's `per_second: 0.003` was a scraped "one call per five minutes"
guess, but the throttle is per-provider and serialized, so a second `code`
query queued ~333 s instead of advancing the chain. The shipped limit is now the
documented unauth allowance (`per_day: 300`, §A.3) plus ordinary 1 s spacing.
Throttling still reads only `per_second` and quota only `per_day`/`per_month`
(REQ-030, REQ-033), so a daily cap cannot become a stall, and
`src/shipped-config.test.ts` bounds every shipped implied interval at 60 s so the
failure cannot return silently. A keyed install gets 10,000 calls/day from the
API, so it raises `per_day` in `config.local.json` rather than overriding the
shipped baseline. Rejected: keeping the scraped interval (one provider stalls the
whole chain for minutes), deleting the limit (loses the spacing and the quota
signal the fallback path reads), and disabling the provider (drops the keyless
`code` primary).

`privacy_critical` now runs SearXNG → Mojeek → DuckDuckGo: a self-hosted
instance means only the operator sees the query, Mojeek runs an independent
index, and DuckDuckGo resells and forwards upstream. SearXNG stays disabled by
default and `getDispatchChain` drops it until `INFOBROKER_SEARXNG_URL` is set
(REQ-031), so an unconfigured install starts at Mojeek rather than failing on a
leading entry. Rejected: leaving DuckDuckGo first, the only shipped chain member
that resells.

The `academic` and `news` chains are unchanged; `config-tune.md` records their
rationale (CF-9, CF-10): academic leads with Semantic Scholar's cross-publisher
coverage and citation graph, then arXiv preprints, then the keyless metadata
indexes ordered broadest to most specialised; news leads with DuckDuckGo's fresh
index and snippets, then GDELT's lagged, headline-only global coverage, then
tech-scoped Hacker News. The roadmap item asks for the rationale rather than a
reorder; changing either order would be a separate, benchmark-backed decision.

### D-082: Strict Provider Keys (CF-3, CR-19; 2026.11.06)

Configuration validation rejects an unknown provider key instead of ignoring it,
and the README and troubleshooting reference state the consequence: one typo
invalidates the whole user layer, which then falls back to shipped defaults with
an error notice. Warn-and-ignore was rejected because a silently dropped key
yields a provider running on defaults the user did not choose (wrong priority,
rate limit, or mapping), which is harder to diagnose than a refused layer. The
error names the key, and the fix stays in `config.local.json`; the server never
rewrites the file.

### D-083: Domain Blocklist Scope (CF-7, SR-1; 2026.11.06)

The `source_quality.blocklist` applies to results returned by `search_web`,
including a knowledge-base recall used to answer a search — a cached copy must
not resurrect a blocked host — and does not apply to `fetch_page` or
`verify_claims`. The blocklist is a search-result policy, not a content-access
policy: a caller that names a URL explicitly or asks for a claim to be checked
may still need that source. REQ-020h states the scope, and README documents it.

### D-081: Roadmap Holds Scheduled Work; Standing Facts Are Decisions (2026.11.06)

`ROADMAP.md` holds scheduled work: a `## <title>` section needs an action a
maintainer can take and a `**Trigger:**` line naming what starts it or closes
it. Standing facts — accepted advisories, by-design limitations, and the
open-web non-goals — are decisions, not work, so they live here and a review
cites the decision instead of filing a roadmap item. The rule follows a review
that found two non-items ("Dependency advisories", "Knowledge base" streaming
LSA) plus a duplicate copy of the D-061 non-goal list occupying the file, which
meant the roadmap could never read as burned down. Alternatives rejected:
keeping informational notes on the roadmap behind a status label (the P1/P3
distinction stays unreadable to the next review); moving them to `README.md`
(the word budget and `validate-readme` make it a poor home for state that moves
with every `npm audit`); leaving the rule declarative (the drift already
happened twice, so `scripts/check-roadmap.ts` enforces the section shape and the
`**Trigger:**` line deterministically). D-061's non-goal list remains
authoritative; `ROADMAP.md` carries a one-line pointer to it.

### D-080: Dependency Advisories — Fix the Moderate, Accept the Four Low (2026.11.06)

`npm audit` reports five advisories. The moderate one (`@hono/node-server`
`serveStatic` double-decode, vulnerable `1.19.10 - 2.1.2`) is fixed by a
lockfile-only update to `2.1.6`, which stays inside the MCP SDK's
`^1.19.9 || ^2.0.5` range and needs no `package.json` change. The four low
advisories are one upstream chain — `markdownlint-cli` (`>=0.44.0`, including
the current `0.50.0`) → `markdownlint` → `micromark-extension-math` → `katex`
(`0.11.0 - 0.18.1`) — so no published `markdownlint-cli` is clean and no
maintainer action closes them; they are accepted, and the audit gate fails only
at high/critical so `npm run check` stays green. Alternatives rejected:
`npm audit fix --force`, which downgrades `markdownlint-cli` to `0.43.0` (a
semver-major downgrade of a lint tool to silence a low); an npm `overrides`
entry forcing `katex` `0.19.1`, a transitive major bump under a package that
pins `0.16` and is exercised by `npm run lint:md`; and keeping the item on
`ROADMAP.md`, where the note had also gone stale by claiming `markdownlint-cli`
was no longer flagged. Revisit when `markdownlint` ships a `katex`-clean
`micromark-extension-math`.

### D-079: User-Defined Provider Hardening (2026.11.06)

A `generic_http` entry that reuses a built-in provider slug is rejected rather
than preferred over the registered module: the registry identity would
otherwise be ambiguous, and a user re-pointing a built-in engine for privacy
was silently sending queries to the original backend. The registered slug list
lives in a dependency-free module so configuration validation can use it
without importing the provider modules, which import the config loader.

`auth_env` now sends its value as a bearer token for generic providers instead
of being accepted and ignored. `dispatch_append` was chosen over making
`dispatch` arrays merge by default: the existing wholesale-replace semantics
are documented and relied on by user layers, so appending is opt-in and
idempotent, placing user slugs after the shipped chain. Unknown provider keys
are rejected because a typo such as `result_path` previously produced an empty
provider at runtime with an opaque mapping error. Generic capabilities are
limited to `web_search` and search task types because the shared backend does
not implement `suggest` or `content_fetch`.

`health_endpoint` exists because the fallback health probe is a real search
query, which spends metered API credits. Scholarly `field_map` keys and
array/number leaves reuse the normalizer's existing additive metadata path.
`retry.ts` treats all 5xx as retryable; a generic provider previously threw a
`RetryableError` for them even though only 429/503 were retried. (REQ-010,
REQ-014, REQ-037)

### D-078: KB Blend, Collection Recall, and Report Source Links (2026.11.06)

The knowledge-base memory item resolves three session-observed failures.
`fresh` becomes a three-state mode: `false` keeps KB-first sufficiency, `true`
skips recall, and `"blend"` returns cached results beside a fresh external
search. On a URL duplicate the external result wins because it is fresher; the
displaced cached row is counted rather than silently dropped, and a blend
whose external tier fails still returns the cached work instead of an error.
`collection` scopes recall to a named collection and is ignored when recall is
skipped. Deep and research requests bypass recall as before, because they must
read pages.

Report-to-source links live in the existing encrypted receipt manifest rather
than a new table. A `report_sources` table would duplicate the encrypted
receipt and add a table to the reseal and migration surface; parsing the report
body would lose the document-versus-snippet hash basis. `manifest.sources` is
the deduplicated, URL-sorted union of report-level and claim-level sources, so
`get` can return the link and `verify_report` can verify it separately from
the per-claim edges. A manifest written before the field existed remains
verifiable. Report ingest now returns `meta.report_id`, which the skill's ARCHIVE
step gates the completion token on.

### D-077: Brave Search Removed from the Reference Server (2026.11.06)

D-075 shipped Brave enabled as the general-web redundancy target. That is
reversed: Brave is removed from the provider registry, `config.json`, the
dispatch chains, the spec, and the client references. The Brave Search API
Terms of Use (last updated 1 Sep 2026, §2 "Use Restrictions") forbid the
customer to "store, cache, or create a database of Search Results, in whole or
in part, other than transient storage required for operation." Infobroker's
knowledge base persists provider results in SQLite (`kb.auto_index: true`, the
`stable` freshness tier never expires) and re-serves them through KB-first
recall, which is a persistent database of Search Results rather than transient
storage; clause (xiii) also restricts using results to evaluate or benchmark AI
services, which the Lab and benchmark lanes do. Brave sells storage rights only
on its Data for AI plan. Rather than ship a default provider whose licensed use
depends on disabling the KB, the reference server drops Brave entirely; a
deployment that buys storage rights can add it back through the configuration
layer without a source change. `general_web` and `news` now begin at
DuckDuckGo, and `semantic` begins at Exa. No keyed provider ships enabled, so
the REQ-031 auth-filter test moved to a synthetic configuration fixture.

### D-076: Structured Tool Output with a Shared Envelope Schema (2026.11.06)

Every tool now registers a `z.looseObject` output schema (converted to JSON
Schema for `tools/list`) and returns the same `[OK]`/`[ERROR]` envelope as
`structuredContent` beside the text. The MCP SDK validates `structuredContent`
against the declared schema, so a plain JSON Schema object was rejected: the
SDK's `normalizeObjectSchema` only recognises Zod schemas, and a plain object
fails at validation time. One shared schema covers all seven tools rather than
seven bespoke schemas, because REQ-001 already defines the envelope as the
common contract; per-tool fields travel under the permissive object. Errors
stay non-`isError` text so clients keep branching on `status`/`code`, and the
schema marks `error` optional so both statuses validate. A finalizer parses the
text envelope and attaches it, so a handler that returns unexpected non-JSON
text still yields a minimal object instead of failing output validation.

Raw fetch mode is `raw: true`, not `format: "text"`, because `manage_kb`
already uses `format` for the disk file format; two meanings for one parameter
name invite confusion. Raw mode is limited to a single URL without crawl or
extract and returns `invalid_input` otherwise rather than silently ignoring
the flag. `match_quality` is a deterministic band over the existing top passage
score (strong >= 0.5, moderate >= 0.25, weak > 0, none otherwise), not an LLM
judgement, so it stays testable and cheap. Observed fixture top scores (0.04,
0.13, 0.18, 0.60, 0.69, 0.73) separate cleanly under those thresholds. Batch
per-input metadata gained `url` and `passages` beside the existing provider,
status, and truncation fields; `search_web` and `fetch_page` inherit the same
shape through the shared `mergeItems`.

Notice injection now pretty-prints the rewritten envelope instead of
serialising it compactly, which removes the long-single-line class the essay
session hit when a notice was present.

### D-075: Keyed General-Web Redundancy and Cooldown-Derived Retry Hints (2026.11.06)

Brave now ships `enabled: true` in `config.json`. D-005 required a keyed
provider to be both credentialed and manually enabled, which predates the
tier-aware auth filter in `getDispatchChain`: a `keyed_http` provider whose
`auth_env` is unset is already excluded from every chain. The `enabled: false`
default was therefore redundant for keyed providers, and it meant an operator
who followed the README and exported `INFOBROKER_BRAVE_API_KEY` still got
DuckDuckGo plus three small-web engines — one general index, not two. Brave is
the general-web redundancy target, so only Brave changes state; Exa, Tavily,
and Yep stay disabled because enabling them widens the news, semantic,
synthesis, and corroboration chains in one step, which is a separate decision.
Keyless installs see no behavioral change: the auth filter drops Brave before
any dispatch. The alternative — enabling Brave only in the user configuration
layer — fixes one install and leaves the defect for every keyed install; a new
keyless general engine was rejected because scraping another general index
carries the same anti-bot fragility already recorded as risk F2.

`retry_after_ms` is the server's own cooldown remaining, not a provider
`Retry-After` header. The value is derived from active cooldowns across the
attempted chain rather than from the `rateLimited` flag, so a bot-challenge
cooldown (which REQ-038 treats as cooldown-worthy but is not an HTTP 429)
still reports a non-zero value. It is omitted, never `0`, when nothing is
cooling down. Parsing provider headers was rejected: provider support is
inconsistent, and the cooldown is the state the server actually enforces.

Every provider-attributable error remediation now names
`inspect_providers action=health` through one helper, so the hint cannot drift
between call sites. The shared batch seam (`settleBatch`) converts a thrown
item into a per-input error envelope; `mergeItems` already merged partial
provider failures, and `Promise.all` was the remaining way for one element to
discard its siblings.

### D-073: Batch Claim Verification with Advisory Modality (2026.11.05)

`verify_claims` could only take one query string, which it split on
"and"/"but" — so a caller with several independent claims either got corrupted
claim text or had to make one call per claim, multiplying the per-invocation
HTTP budget the spec caps. The tool now accepts `claims` as a list, seeded
verbatim, and returns one finding per claim in caller order with `claim_index`.
A batch is one corroboration run: searches, iterations, and the
`max_http_calls` budget are shared, so per-invocation cost stays bounded.
A claim with no attributed source is retained as `unverified` in batch mode
(it is the row the draft checker needs) but still dropped in single-query mode,
which preserves every existing caller's output. The batch "claim list" is the
`findings` array itself rather than a second parallel structure: duplicating
claim/verdict/confidence/sources would double the payload and let REQ-004
truncation split a record.

Each attributed source now carries a `span` (`{start,end,text}`) locating the
sentence in the stored snippet that supports the claim, and an advisory
`modality` (`asserted`/`reported`/`speculative`) read from a pure lexicon
module. Modality is deliberately non-scoring: folding it into the confidence
ladder would contradict REQ-026a's authority weighting and change every
existing score. The report gate is mechanical instead of heuristic — a claim
that declares a non-asserted modality must carry an `attribution` phrase that
appears in the body, so a hedged source cannot be upgraded to flat assertion
without a visible failure. Span and modality are not persisted in the claim
ledger: they are derived, advisory data, and extending `ClaimSourceEdge` would
force a migration of the sealed record for no analytic gain.

The skill's existing `REDRAFT-CHECK` phase absorbed the FACT-CHECK DRAFT
procedure rather than gaining a new phase, because the canonical pipeline
order is order-enforced by `validate-spec` and REQ-120; a second phase would
break both for no benefit.

Alternatives rejected: one `corroborate()` call per claim (multiplies the
SR-008 budget by the batch size); `query: string | string[]` (weak schema and
a poor tool description for TDQS); always retaining unsourced claims (changes
single-claim output); an LLM/heuristic "reads too flat" report check
(false-positive prone, not verifiable as a G3 gate); persisting span/modality
in the ledger (schema migration for advisory data).

### D-074: Operational Records, Research Passages, and Source-Quality Ordering (2026.11.05)

Per-call observability is a diagnostic stream by default, not a file:
`output.call_log` accepts `stderr`, `file`, or `off`, and the shipped default
is `stderr`. The MCP server already writes startup and state diagnostics there,
clients capture it, and a default file sink would append on every call for
every install (and during tests). The file sink remains available and is
owner-only (0600) with a single-generation rotation at
`output.call_log_max_bytes`. Records are fixed-shape JSON lines with a
sanitized tool/provider name, an outcome, and elapsed milliseconds; they never
carry the query, URL, snippet, or credentials, so the log can be shared when
diagnosing a session. HTTP transport records (`kind: http`) and dispatch
outcome records (`kind: provider`) are separate: one attempt can make several
HTTP requests because of retries, and counting both as "calls" would hide that.
The session summary lives in `inspect_providers action=spec` rather than a new
action or tool, because that action already reports uptime, request count, and
tool metrics; adding a surface would churn TDQS, intent citations, and the
harness for no user gain.

Passage defaults move from 100/5 to 250/6 words globally rather than gaining a
separate research profile. The essay session used `fetch_page(question=…)`
directly, so a deep/research-only knob would have left the observed path
unchanged. The per-call `passage_size` and `max_passages` parameters still
override for Q&A. The 500-word option was rejected as too costly for ordinary
question mode.

DuckDuckGo moves to 0.25 requests/second with 800 ms of jitter. Jitter alone
does not lower the sustained rate that produced the six-query `rate_limited`
burst; a fixed 0.33/s cadence did. Lowering to 0.20/s was rejected because a
five-query batch would exceed the practical client wait before retries. The
tuning is a measured-once setting, not a guarantee: the build records whether
a live burst still trips the limit and lowers `per_second` if it does.

Source quality is a small, configurable ranking term plus a blocklist, not a
built-in reputation list. Defaults reward `.gov`/`.mil`/`.edu`/`.int` hosts;
trusted and low-quality domains ship empty so an operator supplies judgement
rather than inheriting a list that rots. The default weight (0.15) keeps
relevance dominant and `0` restores pure semantic order. Quality is folded
into the existing single `reconcileResults` embedding pass; a post-reconcile
re-sort would repeat the embedding work and could separate a representative
from its duplicate group. The blocklist is exempted in REQ-020g's count
guarantee by cross-reference, because removing a blocked host intentionally
reduces the count.

### D-072: Citation Aggregation Through the Provider Layer (2026.11.05)

`get_citations` had always called two bespoke clients (arXiv and Semantic
Scholar) and returned a bare array, so a failed chain looked identical to a
genuine zero-result answer and the scholarly providers already configured for
`search_web` were invisible to citations. The tool now walks the `academic`
dispatch chain and calls each provider's own `search()` implementation,
converting normalized results into citations. This keeps one HTTP/parse path
per provider, makes the OpenAlex enrichment required by the same roadmap item
shared by both tools, and produces per-provider status naturally.

Crossref was added as a keyless `free_http` academic provider at the tail of
the chain rather than as a citations-only fetch, because the roadmap named it
in the academic chain and `search_web` should answer scholarly queries without
a second direct call. The response envelope keeps `provider: "academic"` (a
chain, not a slug) and moves the real detail into `meta.providers`; the Arena
and existing clients already treat `"academic"` as the serving identity of an
aggregate. References dedupe by DOI (title plus year when absent), merging
missing fields onto the first, highest-priority provider's record.

Alternatives rejected: keeping bespoke per-source clients (duplicate parsers
that drift from the provider modules); stopping at the first provider with
enough references (defeats dedupe and cross-provider coverage); a
citations-only Crossref adapter (invisible to `search_web`, duplicate HTTP
path); changing `provider` to the first serving slug (breaks the published
contract and hides aggregation). Known limits: a work carrying a DOI on one
provider and no DOI on another dedupes only by title, and BibTeX keys can
still collide for distinct works sharing a first author and year.

### D-070: Push Requires Post-Commit Human Approval (2026.10.26)

The pipeline used to ask "Commit, push, and tag?" *before* any of those
happened, which conflated finishing the work with publishing it. The default
now runs every step, repairs bounded gate failures, commits locally, prints a
readiness report, and only then asks whether to publish. Declining keeps the
commit local and exits 0; `--yes` pre-approves for unattended runs; a
non-interactive run without `--yes` exits 1 rather than publishing or silently
skipping the push. Auto-repair is bounded (`PIPELINE_FIX_ATTEMPTS`, default 2)
because unbounded fixing can thrash the tree and would violate the review-loop
termination rule. The loop never resolves secrets, destructive git operations,
divergence forcing, or non-ancestor tags; those remain human decisions.
Bounded `--to` runs force both `--no-commit` and `--no-push` so a truncated
pipeline cannot publish; `--from` alone is also a testing run, and `--from`
with `--commit` may publish (D-071 covers the tag side). Alternatives
rejected: keeping the pre-commit confirmation (too early to review the
result), auto-pushing after a green run (no human gate on publication), and
unbounded repair (no termination guarantee). Verification:
`scripts/pipeline/pipeline-logic.test.ts`, `bash -n`, and the pipeline
rehearsal in a scratch clone.

### D-071: A Release Tag Never Changes Version (2026.11.04)

The 2026-11-04 release moved `v2026.10.28` onto a 2026.11.04 commit. The tag
block read a version snapshot taken before step 1, while the sync step bumps
the version mid-run, so the "stale tag" branch fired for a tag that belonged to
a different release. Three rules now hold. The release version is read from
`package.json` immediately before tagging, never from a start-of-run snapshot.
A tag is moved only when its own `package.json` reports the version being
released and it is an ancestor of HEAD; a tag carrying other code — or a tag
whose version cannot be read — is refused, and `--force-tag` is the explicit
human override. The tag's `package.json` is asserted against the release
version after creation, so a mislabelled tag fails the run instead of shipping.
Branch and tag travel in one push per remote. A mirror push failure is fatal
because npm and the MCP Registry publish from the mirror's CI. The decision
lives in `scripts/lib/release-policy.ts` so it is unit-tested; the pipeline
rehearses it against a scratch repo. Alternatives rejected: never moving a tag
(breaks same-CalVer multi-commit releases, where no version bump happens on a
non-behavior run) and always forcing (the defect this replaces).

### D-068: Encrypted-Compatible Knowledge Base Prefilter (REQ-108, REQ-060a; 2026.10.27)

The roadmap deferred a prefilter until SQLite search latency on the production
corpus exceeded 2× the legacy backend. `scripts/benchmark-kb-store.ts` measured
copies of the deployed corpus (50,806 chunks, 445 MB legacy JSON seed) with the
same chunk set in both backends. Median per-query p50 before the change:
JSON 367 ms, SQLite plaintext 2,748 ms (7.5×), SQLite encrypted 3,695 ms (10.1×).
The threshold was met, so the prefilter shipped: an in-process, capacity-bounded
Bloom signature over the nonzero buckets of each stored lexical embedding.
A shared bucket is necessary for a nonzero cosine dot, so a signature hit is a
sound candidate test for `signed-hash-tfidf`; LSA stays a full scan because its
vectors are dense. Signatures are never persisted, so encrypted stores need no
migration and no plaintext index. The signature map is capped at 16 MiB and
disables itself (full scan) above the cap.

After: SQLite plaintext 280 ms (9.9× faster than before), encrypted 345 ms
(10.8×), both below the legacy JSON p50 for the same queries, with identical
top-5 source/score signatures. Alternatives rejected: a plaintext FTS5 index
(leaks content at rest), persisted posting lists (data migration plus
content-proportional residency), and deterministic-encryption indexes (new
crypto construction and equality leakage). Verification:
`scripts/benchmark-kb-store.ts`; `src/kb-prefilter.test.ts`;
`src/kb-sqlite.test.ts`; `src/kb-encryption-sqlite.test.ts`.

While benchmarking, encrypted first-open migration was found to delete its own
legacy source before the archive rename: the temporary encrypted store removed
plaintext archives in the shared directory, so migration returned an error,
lost the recoverable archive, and reported "the legacy store is untouched."
`SqliteStoreOptions.protectedLegacyPath` now shields the migration source, the
migrated archive is removed explicitly once encryption is on, and encrypted
opens sweep any leftover plaintext archive. Covered by `src/kb-migrate.test.ts`
and `src/kb-sqlite.test.ts`.

### D-069: Remove the Legacy JSON Knowledge Base Backend (REQ-105, REQ-109, REQ-060h; 2026.10.27)

The one-release `kb.store_backend` escape hatch had served its purpose: the
default had been SQLite since 2026.10.20 and legacy stores migrate on first
open. Keeping the backend meant a second persistence path, a second encryption
format, JSON-format tests, and an `unsupported_backend` surface for claims and
receipts. The option, the in-memory store, the JSON read/write functions, and
the backend-specific tests are removed; `kb-migrate.ts` and
`scripts/migrate-kb.ts` stay so an existing `vector-store.json` still migrates
non-destructively, and the artifact predicates stay so a legacy store is still
recognized for the shipped-empty gate and for plaintext-archive cleanup.

The user layer is migrated explicitly: a registered removal drops
`kb.store_backend` with the usual backup, and state health reports
`config_key_removed` until it is applied. `config_version` moves to 2. There is
no backend rollback after this release: enabling encryption already removed
plaintext archives, and now no JSON backend exists to roll back to. Recovery is
the existing key backup, verify, and rekey path; a plaintext migration archive
is preserved only while encryption has never been enabled.

Alternatives rejected: keeping the JSON backend read-only (still two
serialization paths and a rollback claim), leaving the option as a silent no-op
(users would believe they were on JSON), and deleting the migration path (would
strand every pre-SQLite deployment). Verification: `npm run check`;
`src/kb-migrate.test.ts`, `src/kb-sqlite.test.ts`, `src/config-migrations.test.ts`,
and the config/state-health suites.

### D-067: Retrieval Benchmark Replays Committed Results (REQ-130; 2026.10.26)

The retrieval benchmark stores raw multi-provider results and grades, then runs
them through the real reconciliation path. Alternatives rejected: live network
runs (non-deterministic and outside `npm run check`) and a frozen output
snapshot (tautological — it would exercise no pipeline code). The floor is a
deterministic test over committed inputs, kept separate from the REQ-123
confidence-calibration gold set.

### D-066: Privacy Posture Is Generated, Not Prose (REQ-129; 2026.10.26)

Provider privacy posture is derived from tier, account requirements, and the
resale flag with explicit per-provider overrides, then generated into
`provider-privacy.md` and checked for staleness. Alternatives rejected:
hand-written prose (drifts from configuration) and runtime-only reporting (no
auditable artifact). Retention defaults to `unknown` rather than an implied
privacy guarantee.

### D-065: Unicode Tokenization Without a Model Bump (REQ-128; 2026.10.26)

The tokenizer normalizes to NFKC and keeps every Unicode letter/number, with
character bigrams for scripts that lack word separators. ASCII output is
character-for-character identical to the legacy tokenizer, so existing English
KB vectors stay comparable; non-Latin content improves on the next re-index.
Alternatives rejected: a new embedding model id (forces REQ-082 reconciliation
for no gain) and a third-party tokenizer (breaks the in-process, zero-dependency
invariant of REQ-103). Language-restricted searches prefer providers that
honor the language.

### D-064: Analysis Is a `search_web` Mode, Not a Tool (REQ-127; 2026.10.26)

Topic/entity extraction, result clustering, and timelines attach to
`search_web` under a boolean `analyze` mode, following the existing
`deep`/`research` pattern. Alternatives rejected: an eighth tool (forces TDQS,
intent-citation, README, §D, and AGENTS tool-table changes for a lightweight
feature) and a `manage_kb` action (wrong storage home). Analysis is computed
in-process from the results already returned.

### D-063: Monitoring and Export Stay Client-Side (REQ-125, REQ-126; 2026.10.26)

Monitoring is a bounded CLI run, not an in-server daemon: `monitor-watchlist`
selects due topics, calls the local MCP server over stdio, and writes one
claim-delta record per topic. Cron or CI owns the schedule. This keeps the MCP
server request-scoped and avoids a background process inside a client-managed
stdio transport. Report export is a deterministic post-processing step over a
validated Markdown report (HTML/JSON/CSV), not a second report format the
generator must maintain.

### D-061: Open-Web Scope Boundary (2026.10.26)

Infobroker remains an open-web search, analysis, and reporting tool. The
review that compared it with professional OSINT practice surfaced coverage
gaps (SOCMINT, infrastructure, corporate registries, sanctions/PEP, breach
data, media forensics), but the product does not compete there: dedicated
OSINT platforms do those jobs better. Those categories are recorded as
non-goals on `ROADMAP.md`, and the improvement work concentrates on trust in
what the server already collects — source independence, citation-grade
snapshots, calibration, and reporting. Alternatives rejected: build the
full-spectrum OSINT platform (scope and liability without a differentiation
advantage) and remove the intelligence-cycle framing entirely (loses the
analysis/reporting story the skills implement).

### D-062: Snapshots Reuse the Knowledge Base (REQ-122; 2026.10.26)

Citation-grade snapshots are stored as knowledge-base documents tagged
`source_type: "snapshot"` with an evergreen freshness tier, not in a new
SQLite table or a plaintext sidecar directory. The KB already provides
atomic writes, deduplication by source URL, optional at-rest encryption, and
the hashing `verify_report` uses, so a snapshot is immediately verifiable.
A sidecar would bypass encryption; a new table would add a schema migration
without adding capability. Snapshots remain bounded per finding and per
source and are skipped when the KB is unconfigured. Verification snapshots the
snippet it already holds; deep reading snapshots the page it already fetched.
This avoids adding an outbound request during corroboration and keeps the
tool's HTTP-call budget and offline contract fixtures intact.

Amendment 2026-10-28 (review remediation): the two snapshot kinds are kept
distinguishable rather than merged. A verification snippet is stored as
`source_type: "snippet_snapshot"` under the identity `<url>#snippet`, reports
`snapshot_basis: "snippet"`, and is gated by the content policy before storage;
a fetched document keeps the live URL, `source_type: "snapshot"`, and
`snapshot_basis: "document"`. `cachedDocument` ignores snippet snapshots so a
report receipt cannot upgrade an excerpt to document-grade verification. The
no-outbound-during-corroboration rule is unchanged: wiring a page fetch into
`verify_claims` was rejected as contradicting it. Snapshots are bounded by
UTF-8 bytes and report `snapshot_truncated` when clipped.

### D-060: State-Health Notices, Safe Startup, and Opt-In Update Discovery (REQ-079, REQ-105, REQ-111, REQ-112, REQ-113; 2026.10.22)

A stale user configuration was visible only on stderr at startup and in a
`reload_config` response, and an invalid merged layer made the server refuse
to start. External users could therefore miss a required migration or be
locked out after an update. The server now reports state health through
`inspect_providers` action `spec`, attaches a bounded top-level `notices`
array to successful responses only when something is actionable, and falls
back to shipped defaults without writing the user layer when that layer is
invalid. Automatic user-layer migration remains opt-in via
`state.auto_migrate_config`; it validates the merged result and writes a
backup before replacing the layer. An opt-in `state.update_check` compares the
build version with the published npm version, caches for a day, and never
downloads or applies an update. KB data needs no version marker here because
its schema changes are additive and the JSON store already migrates
automatically; a KB schema marker is deferred until a real KB migration
exists.

### D-059: Session-Log Findings — Claim-Seeded Corroboration and Fetch Cache (REQ-020, REQ-021g, REQ-026; 2026.10.22)

`verify_claims` previously keyed findings on the titles of whatever pages a
search returned, so the caller's proposition was never the unit of
verification and 48 of 50 findings across 13 logged calls were unverified at
confidence 0.3. Findings are now seeded from `extractClaims(query)` and each
source is attributed to its closest claim; result titles never become
findings. This preserves the response shape and the independence/authority
confidence rule while making "confirmed" mean the caller's claim was
corroborated. Alternatives rejected: renaming the tool (breaking, and hides
the defect) and ranking result titles against the query (still does not
verify the claim).

Search-result URLs are normalized to absolute http(s) at the normalizer
boundary. DuckDuckGo returns a scheme-less display URL, and deep reading
filtered on `^https?://`, so 27 logged deep calls read zero pages. The same
normalization repairs citations and KB URL keys.

`fetch_page` reads a fresh knowledge-base copy before an outbound call
(REQ-021g) because 64 same-session duplicate fetches were observed and the
tool only wrote to the KB. The cache is age-bounded and can be disabled;
stale entries fall through. `max_passages` defaults to 5 (was 1) because
question mode otherwise returned a single 100-word passage. Native-HTML
content is converted to text before ranking, fixing markup-polluted passages.

---

### D-058: Disk-Backed SQLite Knowledge Base (REQ-108; 2026.10.20)

The knowledge base parsed the entire `vector-store.json` (513 MB in the live
instance) into memory at startup, so heap use grew with stored chunk count and
repeated gate runs could exhaust a host. This moves the default store to
`node:sqlite` — built into Node 24, no dependency or native build — and streams
chunks for search/list/get/stats. Each row stores the chunk payload; when
encryption is enabled the payload, IDF/model state, and event messages are
sealed per row with AES-256-GCM, and a passphrase is stretched once at open
with a store salt. A legacy JSON store is migrated non-destructively on first
open and preserved as `vector-store.json.migrated-<timestamp>`; the JSON
backend remains as a one-release `store_backend` escape hatch. Migration is
non-destructive but `JSON.parse` of a 513 MB legacy store is a one-time ~1.5 GB
peak; OOM aborts before any write. Enabling encryption removes plaintext
archives, so rollback is available only if encryption has never been enabled.

Alternatives rejected: sharded JSON (search still loads all chunks);
`better-sqlite3`/SQLCipher (native dependency); memory-mapped binary (no built-in
mmap, high custom-format risk); keeping the single JSON store (does not fix the
finding). LSA remains an explicit exception: its SVD allocates O(n·v)/O(n·k),
so the bounded-heap contract covers the default signed-hash model; the roadmap
records a streaming LSA redesign.

---

### D-057: Routing Citation Integrity Gate (REQ-107; 2026.10.20)

The client routing surface had four hand-maintained intent/tool tables and no
gate tying them to the live schema; `validate-spec` checked only file presence.
This adds a citation gate that derives operations from the live `tools/list`
(action enums, boolean modes, and the `fetch_page (question)` string allowlist),
requires every operation to be cited at least once, and resolves every tool,
operation, and parameter citation. The four skill files use bare tool names;
`instructions/search-preferences.md` uses the `infobroker_*` prefix.

Alternatives rejected: an intent registry plus generated docs (too much surface
for seven tools and no demonstrated drift); a tool-name-only check (misses the
hidden operation surface); adding a grouping dimension to TDQS (the external
score stays untouched). The gate reports 114 citations with zero findings after
migration; the seeded-stale fixture proves it can fail.

Accepted risk: the deployed client exposes `infobroker_infobroker_*` and the
headless probe returned NO_SUCH_TOOL for `infobroker_search_web`. The user
explicitly authorized the single-prefix rewrite after seeing that evidence. The
gate validates the server's `tools/list`, not client namespace resolution.
Verification: `npm run check-intent-citations`, `npm run validate-spec`, and
`npm run check`.

### D-056: TDQS 1.2 Conformance Gate and Score-Improvement Pass (REQ-040, REQ-106; 2026.10.02)

The Glama TDQS audit (2026-09-30) scored the server A 4.8/5.0: `search_web` at
5.0 and the other six tools at 4.8, each losing only Conciseness (4/5) and
Parameter Semantics (4/5), plus a server-level Completeness of 4/5 ("config is
reloaded but never edited programmatically"). TDQS 1.2 is an LLM rubric, so
scores are not mechanically guaranteed (D-048); the prior remediation passes
were one-off editorial edits with no regression guard beyond REQ-092's static
check.

This pass does two things. First, it codifies the standard: REQ-106 requires
the deterministic layer of TDQS 1.2 (stages 1, 2, and 4 — context signals, hard
gates, and the shadow prefilter) and binds it to a new live-surface gate,
`scripts/check-tdqs.ts`, alongside the opt-in LLM rubric runner
`scripts/tdqs-rubric.ts`. `src/tdqs.ts` implements the spec's normative
required-subtree traversal, invocation cost, exact-integer `round1` arithmetic,
tier map, and server rollups. The gate fails on the objective preconditions
(missing or tautological description, undocumented parameter, missing
annotation) and reports shadow candidates, annotation-contradiction candidates,
and per-tool signals; the six dimension scores remain LLM-judged and are
deliberately out of the deterministic gate.

Second, it acts on the feedback: the six 4.8 tools' descriptions were rewritten
to cut redundancy (Conciseness) and add parameter semantics, and `manage_kb`'s
orphaned `title`, `collection`, `source_type`, and `freshness_tier` parameters
were tied to their actions. `reload_config` gained a `patch` capability
(REQ-040) that deep-merges a partial configuration into the user layer with
unknown-key rejection, a recoverable backup, and validate-before-write — closing
the server Completeness gap while keeping the seven-tool surface (REQ-090/092).

Alternatives rejected: an in-repo LLM grader wired into `npm run check` (breaks
the offline/deterministic gate contract); a density byte-cap as a hard failure
(TDQS conciseness is relative to tool complexity, so a single cap would
false-positive on `manage_kb`'s 15 parameters — the signal is reported, not
gated); extracting all tool definitions into a shared module so the gate could
avoid spawning the server (a larger refactor of `index.ts` with no benefit over
the already-proven stdio surface); adding an eighth config-editing tool (breaks
the seven-tool surface). Score movement is LLM-judged: the deterministic gate
guarantees the preconditions, and Glama re-scores on its next sweep.

### D-055: Glama Maintenance-Grade Remediation — GitHub Releases and Community Profile (2026.09.16)

Glama's maintenance grade is a repository-health signal, not a code score: its
definition is commit activity, issue responsiveness, release frequency, and
community profile (the score table lists maintainers, response time, release
cycle, and releases over 12 months). The project scored C despite high commit
activity because the GitHub repository emitted none of the release signals:
zero GitHub Releases (CalVer git tags and npm versions do not count — every
A-rated peer has releases; every C-rated peer has none), zero issues and pull
requests ever, a single maintainer, and a 42% community profile. Glama also
returned no maintenance breakdown for the repository at all.

The remediation is distribution and governance, not server behavior: a
tag-triggered `release.yml` creates a GitHub Release for every `v*` tag pushed
to the mirror (idempotent, so a force-moved tag re-runs safely); the repository
gains `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, an issue-template chooser and bug
template, and a pull-request template; and the push pipeline now stages
`.github/`, which it previously omitted — it staged a fixed root-file list plus
four directories, so new workflow and template files would have been silently
dropped. Contributor-facing links point at the canonical git.gay repository,
since GitHub is a read-only mirror. No REQ is added: REQ-091 covers npm and
MCP-registry publication, and none of these files change the server contract.

Alternatives rejected: folding release creation into `publish.yml` (it runs
path-filtered on `main`, before the tag is pushed, so it cannot see the tag);
creating releases locally from `push-pipeline.sh` (adds a `gh` auth dependency
the pipeline deliberately avoids by delegating publication to CI); a
third-party release action (an extra action to pin and vet when `gh` is
preinstalled on runners); naming a personal Code of Conduct contact (the
maintainer declined to publish one, so the enforcement channel is the canonical
repository's private reporting route).

### D-054: Security Audit Remediation (REQ-021a, REQ-084, REQ-097, REQ-098, REQ-100, REQ-101, REQ-102; 2026.09.14)

A full-stack security audit (spec traceability, implementation controls,
adversarial probing, supply chain) found one demonstrated P0 and a cluster of
conformance gaps; all are fixed in-session.

- **SSRF deny-list completed** (REQ-021a). The guard missed the unspecified
  address (`0.0.0.0`, which connecting to reaches the local host on Linux),
  CGNAT, benchmarking, documentation, multicast, and reserved IPv4 ranges,
  and IPv4-mapped IPv6 (`::ffff:127.0.0.1`) — the latter reached a loopback
  server through `fetch_page`'s native path. The address predicate now
  delegates a mapped address's embedded IPv4 to the IPv4 check and blocks the
  IPv6 transition/documentation/discard forms. It remains a deny-list per
  D-047; the resolve-vs-connect residual is unchanged.
- **Encryption is an invariant, not a transition** (REQ-084). When encryption
  is enabled the store must never be plaintext: any start with no resolvable
  key now locks and refuses knowledge-base operations, not only the enabling
  transition, and `sealReportBytes` refuses rather than falling back to
  plaintext. Previously a reload with a plaintext store and a removed key
  wrote reports unencrypted while reporting the store "enabled".
- **Single-line, single-choke-point hardening**: audit detail has control
  characters collapsed (REQ-098); the content-policy matcher normalizes
  whitespace and zero-width characters (REQ-097); the error sanitizer redacts
  credential-shaped values (REQ-102).
- **The publish path carries the gate** (REQ-101): the workflow runs
  `npm run check` before publishing and pins its actions to commit SHAs; the
  local pre-push hook alone was bypassable. `vitest` and the transitive `hono`
  were updated to patched releases, taking `npm audit` to zero.

Alternatives rejected: an allow-list SSRF model (contradicts D-047 and needs a
maintained list), a new IP-range dependency (avoidable with node built-ins),
and a block-by-default content policy (breaks sensitive-topic research).

### D-053: Opt-In User-Config Migration with Drift Reporting (REQ-105; 2026.09.14)

The user configuration layer is deep-merged over the shipped default, so a
release that renames, moves, or removes a config key leaves the old entry in the
user's file, silently ignored. REQ-105 makes that drift observable and migratable
without the server ever rewriting user state on its own.

A top-level `config_version` stamps the shipped schema (`1` today). At load the
server compares the user layer against the shipped top-level key set and the
registered migration/deprecation registry and emits one stderr warning naming the
drift — it does not touch the file. Drift is also reported in every
`reload_config` response. The migration itself is opt-in: `reload_config` gains a
`migrate` parameter (default false) that copies the user layer to a timestamped
`*.bak-*` sibling at 0600, applies registered key relocations plus the version
stamp, and commits with an atomic temp+rename. Entries the schema does not
recognize are copied through untouched; the user layer version is validated
against the shipped version, and a layer newer than the server is rejected rather
than downgraded.

Alternatives rejected: **automatic migration at load** (writes a user-owned file
without consent and risks a half-migrated layer if the process dies), **a separate
migration tool** (grows the fixed seven-tool surface for a rare operation), and a
**sidecar overlay file** (a second user-state file to preserve and document, for
no gain). `applyConfigMigrations` is pure and tested with injected renames; the
registry ships with the live `kb.expiry` deprecation as its first entry, so the
transform path is exercised rather than dead. Lossy migrations (where the new
shape carries information the old one lacks) are reported for manual edit, never
auto-rewritten.

### D-052: Persistent Key-Pool Rotation (REQ-104; 2026.09.14)

Deferred from the competitive batch (D-043) because every keyed provider cached
its key at module scope. The pool is now env-only: `INFOBROKER_<PROVIDER>_API_KEYS`
(comma/whitespace separated) is preferred, falling back to the single
`INFOBROKER_<PROVIDER>_API_KEY` of REQ-011, so existing installs are unchanged.
`src/key-pool.ts` resolves the next available credential round-robin per call;
a 401/403 disables that credential for the session and a 429 cools it down
individually, so the next call rotates without an in-call retry loop (matching
REQ-104's "SHALL NOT retry that credential"). Selection state persists under
`$TMPDIR/infobroker/key-pool.json`, keyed by a non-reversible hash so no
credential material is written to disk; `inspect_providers` reports per-key
availability and reason only. The four keyed providers (Brave, Exa, Tavily,
Yep) dropped their module-scope caches in favour of per-call resolution.
Alternatives rejected: config-declared key lists (would change the config schema
and the generated auth reference for no user benefit — env pools cover the
free-tier multi-key case); in-call rotation loops (unnecessary given
session-disable semantics).

### D-051: Semantic Reconciliation with Explicit Contradiction Detection (REQ-026f, REQ-020g, REQ-020b/e; 2026.09.14)

The roadmap's semantic-retrieval items shipped on the REQ-103 embedding seam.
Corroboration groups paraphrased agreeing claims by embedding similarity
(replacing token Jaccard clustering, D-013) and cross-provider results collapse
by semantic near-duplication and order by relevance to the query (REQ-020g).
Critically, embedding similarity places a claim and its opposite close together
(they share topic), so agreement clustering alone would merge contradictions and
silently drop the `contested` verdict required by §8.1. An explicit conflict
check — negation polarity, a small antonym/direction pair table, and unequal
numeric/date values — keeps contradictory claims in separate perspectives
(REQ-026f). The lexical fallback still applies on tiny corpora, where LSA has no
co-occurrence to learn from.

### D-050: In-Process Embedding Seam, LSA, and the Rejected LSA Default (REQ-103; 2026.09.14)

REQ-103 is implemented with **no new dependencies**: `src/embed.ts` is a pure
TypeScript embedding seam holding two in-process models — `signed-hash-tfidf`
(the historical fixed-dimension lexical vectorizer, D-031) and `lsa` (latent
semantic analysis via a deterministic randomized SVD, which groups paraphrases
and synonyms through co-occurrence). `kb.embedding_model` selects the model and
is now read; an unknown reference degrades to the built-in model with an event
and `model_available: false` (F9), so non-KB operation is unaffected. Both the
knowledge base and passage retrieval route through the seam; the duplicated
hashed vectorizer in `rerank.ts` is gone. Transient consumers (passage ranking,
claim reconciliation, cross-provider collapse, query expansion, intent
classification) fit LSA per call over their small candidate set, where the cost
is bounded.

Setting LSA as the shipped KB default was rejected: on a populated store the KB
re-fits and re-embeds every chunk synchronously at startup, which blocked the
MCP `initialize` handshake past its timeout in the live tool-surface test
(measured, not hypothetical). The shipped default therefore remains
`signed-hash-tfidf`; `lsa` is opt-in, and the persisted model name triggers the
REQ-082 reconciliation on switch. A hosted embedding API remains rejected per
D-049 (content never leaves the process).

### D-049: Local In-Process Embedding Capability (REQ-103; 2026.09.14)

REQ-103 formalizes that knowledge-base and passage retrieval use an embedding
model that executes inside the server process, with content never transmitted
to a third party for embedding. The capability is now implemented: the
configured `embedding_model` selects the in-process model at knowledge-base
initialization, and an unavailable model reports degraded availability with a
remediation message (REQ-103).

A hosted embedding API was rejected: it would send knowledge-base content
off-box, contradicting the "privacy always" principle and the at-rest
encryption guarantee (REQ-084). The model posture is an English-first shipped
default with a configurable multilingual swap; the concrete model name is an
implementation detail recorded here rather than in REQ prose (SR-011).

This decision also recorded a gap that REQ-103 makes explicit: `embedding_model`
existed in the configuration schema without runtime wiring, and F9's
model-unavailable branch was unreachable (`modelAvailable` was a constant).
Both paths are now live: the knowledge base configures the model from
`embedding_model` at init, and model availability is tracked at runtime so the
F9 degraded branch fires.

### D-048: TDQS 5/5 Completion Pass (2026.09.11)

The 2026-09-09 Glama re-inspection (post v0.1.2) left three tools below 5/5
on the tool-definition quality audit (TDQS): `fetch_page` 4.0 (Behavior 1/5 —
its description said pages are "auto-indexed into the knowledge base" while
its `readOnlyHint` was `true`), `verify_claims` 4.3 (Conciseness 2/5, plus
unnamed KB write and vague response structure), and `get_citations` 4.9
(Conciseness 4/5 — a parameter clause restating the schema).

Three fixes close the gap. `fetch_page` now declares `readOnlyHint: false`,
because the tool does write state (the KB auto-index in `doFetchPage`); the
alternative of keeping `readOnlyHint: true` and rewording "auto-indexed" to
"cached" (mirroring `search_web`'s accepted phrasing) was rejected as
rubric-gaming that still left the annotation false. Its description also
gained the two edge cases the audit named as missing: anti-bot challenge
pages fall through to the next renderer, and unreachable URLs return an
`[ERROR]` envelope. `verify_claims` was rewritten compactly, made its KB
write explicit, and named its confirmed/contested/unverified response
structure and the `confidence_threshold` below-bar behavior. `get_citations`
dropped the schema-duplicated "(1–30, default 8)" clause while keeping the
cost coupling ("larger values take longer"). No REQ body changed: REQ-089/092
require declaring the four hints and disclosing consequences, and pinning a
hint's value would be an implementation detail, not a contract.

TDQS is an LLM-rubric audit, not a deterministic gate, so 5/5 is not
mechanically guaranteed; the pass aligns each description with the rubric's
stated dimensions and relies on Glama re-scoring after the next inspection.

### D-047: OWASP Security Baseline, Content Policy, and Spec-Quality Pass (2026.09.06)

A spec-review baseline (8 dimensions) and a threat-modeling pass surfaced two
demonstrated gaps: the server auto-ingests unfiltered web content into a
persistent KB that is later recalled into answers (a data-protection exposure
for professional/educational audiences), and security detail was thin at the
edges (no audit trail, no tool-surface file confinement, no persisted-state
integrity, no documented security model). OWASP is adopted as the baseline —
Top 10:2025 and LLM Top 10:2025 mapped in a new §E appendix, every category
to a controlling REQ or a named residual risk (REQ-096, G3-verified).

Design decisions:

- **Content policy default is `flag`, not `off` or `block`** (REQ-097).
  `flag` returns flagged content to the caller (legitimate research on
  sensitive topics still works) but never stores it; `block` is the
  opt-in strictest mode; `off` preserves legacy behavior. The built-in
  assessment is zero-dependency (pattern categories), with an optional
  external assessor whose failure falls back to the built-in. Assessment
  sits at the storage boundary (auto-index choke point) plus the return
  boundary of the content-returning tools.
- **Key confinement applies to the tool surface, not configuration**
  (REQ-099). `kb.encryption.key_file` is operator-owned and unrestricted;
  only caller-supplied `key_file` tool parameters are confined to the keys
  directory, so existing configs keep working while a compromised client
  cannot exfiltrate key material to an arbitrary path.
- **SSRF resolution is a deny-list refinement, not an allow-list** (REQ-021a
  alignment). Hostnames are resolved and every resolved address is validated
  per hop and per request; the residual resolve-vs-connect TOCTOU is a named
  residual risk in §E because the transport exposes no connected address.
- **REQ-096/101 are gate-level, not runtime, REQs**: 096 is a meta-REQ
  (like REQ-077/078), 101 is an artifact REQ (like REQ-091), so neither
  needs a source-file citation; the gate enforces both.

Alternatives rejected: ASVS 5.0 as a full L1 requirement manifest (heavy,
no demonstrated gap beyond the mapped categories); a block-by-default
content policy (breaks sensitive-topic research); DNS pinning (not possible
with the current transport).
Resolved findings: SR-1..SR-10 from the spec-review baseline.

Glama's tool-definition quality audit (TDQS) scored the server 4.6/5 with a
4.3 minimum (`get_citations`) after the D-038 rework. The remaining gaps
were one server-level dimension — naming consistency, where `web_search`
was the single tool breaking the verb-noun pattern — and description
dimensions across six tools: parameter semantics (baseline 3/5 when the
description restates schema facts), behavioral disclosure (error scenarios,
rate limits, live-probe side effects), conciseness (density), completeness
(response shape per action), and usage guidance (alternative tools named as
bare slugs instead of exact `infobroker_`-prefixed names).

`web_search` was renamed to `search_web`, completing verb-noun naming across
the surface; the capability token `web_search` (provider `capabilities`,
`duckduckgo_web_search`, authority weights) is a separate vocabulary and is
unchanged. Tool descriptions were rewritten to state parameter semantics
beyond the schema, disclose error/rate-limit behavior, name alternatives by
exact tool name, and (for `manage_kb`) specify the response shape per
action. The alternative-tool gates in `scripts/validate-spec.ts` and
`src/tool-surface.test.ts` now accept the prefixed form.

Alternatives rejected: keeping `web_search` (accepts a 4/5 naming-consistency
ceiling); keeping slug names in descriptions (the audit explicitly warned
that bare slugs "could cause an agent to look for a nonexistent tool").

### D-045: README Spec-Reconciliation Gate and Feature-Taxonomy Check (2026.09.05)

The README auto-update step relied solely on the model reading `infobroker.md`
and choosing to update `README.md`; nothing failed the pipeline when a spec
prose/REQ change left the README untouched, and `validate-readme` reconciled
tools and providers but not feature content. Two mechanical checks close the
gap. First, a push-pipeline guard: after the README step, a REQ-body change
this run (`spec_req_change`) with no non-whitespace `README.md` diff fails the
pipeline — a hard spec→README binding that forces the README step to do its
job, mirroring the C.10 changelog provenance requirement. Second,
`validate-readme` now reconciles the README §MCP Server feature tour against
the §D feature taxonomy via `src/lib/feature-taxonomy.ts`: group numbers and
names are derived from `infobroker.md` at validate time (single source of
truth), with a declared marketing-title→group mapping (`Unified Search→1`,
`Content Extraction→1`, `Citations→1`, `Provider Intelligence→2`,
`Multi-Source Verification→3`, `Knowledge Base→4`, `Operational Visibility→5`,
`Research Pipeline→7`). A README feature subsection with no §D group (invented
feature) or an uncovered user-facing §D group (1–5, 7) is a hard error.
Feature blurbs are matched at group granularity, not per-REQ, because the
README DESIGN non-goal forbids REQ citations in prose.

### D-044: Corroboration First-Pass Cap and Early Exit (2026.09.04)

The corroboration Phase-1 broad pass previously fanned out to every active
search-capable provider concurrently (`Promise.allSettled` over the full pool,
up to 21 providers in a zero-config install), each fetching
`first_pass_max_results` (10) results — ~170–210 snippets before refinement,
with wall time bound by the slowest provider. The first pass is now capped to
`corroboration.first_pass_max_providers` (default 5), ordered by config
`priority` descending (high-authority first: encyclopedia, structured fact,
academic before small-web scrapers), run in concurrency-limited batches of 4
with an early-exit once every finding clears the confidence bar. The full pool
remains available for gap refinement, so breadth is deferred, not lost.

Alternatives rejected: AbortController cancellation of in-flight calls
(per-searcher signature churn, minimal gain once the batch size is small);
reducing only `max_http_calls` (keeps the latency problem); keeping the
all-active first pass and only trimming results (still pays 17–21 round trips).
This supersedes the all-active first pass documented in D-036.

### D-043: Competitive Improvement Batch — Zero-Config Providers, Research Compile, Fetch Modes (REQ-020f, REQ-021d, REQ-021e, REQ-028, REQ-081, REQ-095; 2026.09.04)

The competitive feature report (Glama related-servers + directory + off-registry
servers) identified four competitor archetypes. Three gaps map to new
server-side capability and are implemented as *modes on existing tools*, not
new tools, preserving the seven-tool surface (REQ-090/092). (1) Six zero-config
providers — OpenAlex, Europe PMC, Hacker News, GDELT, SEC EDGAR, World Bank —
plus a `financial` task type (REQ-095); they register through the REQ-070
mapping, so no tool handler changed. (2) `web_search` gained a `research` mode
(REQ-020f): one call fans out to derived query variants and deep-reads each,
returning passages grouped by variant — token-bounded (`research.max_variants`
default 3, `research.max_pages_per_variant` default 2); report synthesis stays
in the client skills, matching the deep-search-as-mode decision (D-035). (3)
`fetch_page` gained opt-in `crawl` (REQ-021d, bounded same-origin, SSRF guard
per hop) and `extract` (REQ-021e, JSON-LD/OpenGraph/microdata) modes. Every new
mode is off by default, so the happy-path token cost of a plain search is
unchanged; the skill workflow reference gates `research: true` to the
Deep-Dive, Competitive Evaluation, and Gated Analysis shapes only. Deep-read
passages now surface `start`/`end` span anchors (REQ-028 amendment); REQ-026b
already carries per-source claim text, so corroboration needed no change.
REQ-081 now reports the token footprint in bytes *and* tokens, where the token
figure is a deterministic characters-per-token estimate — no new build gate,
because the REQ-090/092 bar already caps the surface at seven tools. Key-pool
rotation (the Search Toolkit gap) is deferred to the roadmap: every keyed
provider caches its key at module scope, so rotation requires touching each
keyed provider, which is not justified at "Could" priority (see ROADMAP).

### D-042: Tool-Definition Quality Bar Codified (REQ-092; 2026.09.03)

The Glama TDQS audit (D-038, D-040) fixed the tool definitions but left the
scoring criteria implicit in the REQ-089/090 prose, with enforcement weaker
than the prose: the gate checked only "Use when"/"Do NOT use", the return
contract, and at least one of three annotations, so a description could drop
an alternative, a coupling note, or a destructive annotation and still pass.
REQ-092 states the quality bar as a named contract — purpose, when-to/not plus
alternatives, behavioral consequences, response contract, parameter couplings,
and all three read-only/destructive/idempotent annotations — and binds it to
both G1 (the live stdio tool-surface test) and G3 (a static scan of
src/index.ts descriptions and annotations in validate-spec). All seven tools
now declare a `destructiveHint` (previously only `manage_kb` did). REQ-091 also
gained a G3 gate: validate-spec verifies server.json and glama.json presence
and that the registered version equals the npm-canonical package version.
On 2026.09.10 the bar was extended to a fourth hint: the M8ven directory audit
requires all four ToolAnnotations (read-only, destructive, idempotent,
open-world), and `inspect_providers`, `manage_kb`, `reload_config`, and
`get_citations` had never declared `openWorldHint`. REQ-089/092 now name the
open-world dimension and G1/G3 enforce all four hints.

### D-041: Rate-Limit Cooldown and Cross-Task Fallback (REQ-038, REQ-031a; 2026.09.03)

A Glama research session saturated the `general_web` chain (three HTML-scraping
engines) and the client fell back to its built-in tools. Root cause: (a) the
fallback chain is task-scoped and narrow, and (b) a rate-limited provider was
re-tried on every request in a burst — there was no cross-request memory. Two
contracts close it. REQ-038 gives each provider a per-provider cooldown on a
rate-limit (HTTP 429) or anti-bot challenge (DuckDuckGo 202), skipped during
fallback selection without a new outbound call; the duration is configurable
(`output.rate_limit_cooldown_ms`, default 30s) and reported via
`inspect_providers` without touching quota. REQ-031a gives a non-`general_web`
chain that exhausts by errors a final pass through the `general_web` chain.
DuckDuckGo's 202 now throws a `BotChallengeError` (a `ParseError` subclass) so
cooldown detection needs no message matching; the existing `ParseError`-typed
test still passes because of the subclass. The `rate_limited` error code named
in REQ-002 remains un-emitted (no clean observable path without a wider
error-semantics change) and is logged to the roadmap, not implemented here.

### D-040: Return-Contract and Parameter-Coupling Disclosure (REQ-089 extension, 2026.09.02)

Glama's TDQS per-tool audit criticized two smells the D-038 pass did not
close: no tool description stated what the tool returns ("missing return
description" is a named smell in the underlying research, arXiv 2602.18914),
and the multi-action tools (`inspect_providers`, `manage_kb`,
`verify_claims`) left parameter couplings undocumented. REQ-089 gained a
clause requiring every tool definition to state its response contract and
any non-obvious parameter couplings. All seven descriptions now state the
`[OK]`/`[ERROR]` JSON envelope, and the three multi-action tools name which
parameter each action needs. The stdio-surface test
(`src/tool-surface.test.ts`) now enforces both the return-contract clause
and the coupling notes, so the gain cannot silently regress. Kept compact
per the research's token-overhead warning (arXiv 2602.14878).

### D-039: Registry-Published Distribution (REQ-091) and Glama Metadata (2026.09.02)

The server was npm-published but never registered with the official MCP
registry, and the publish workflow carried two defects: `mcp-publisher
publish` was invoked without the `server.json` positional argument, and the
"already published?" guard compared the CalVer spelling (`2026.09.02`)
against npm's canonical form (`2026.9.2`), which never match, so every push
re-attempted publication. REQ-091 states the contract: the build SHALL
publish to npm and register with the MCP registry, and the registered version
SHALL equal the npm-canonical form of the package version over the stdio
transport. The workflow now passes `server.json` explicitly and normalizes
the local version before comparing. A `glama.json` declaring the maintainer
was added so Glama can attribute the listing.

### D-038: Tool-Surface Rename to verb_noun and Definition-Quality REQs (2026.09.02)

The tool surface mixed three naming patterns (verb_noun, bare verb, noun),
and the tool descriptions under-specified usage and behavior — Glama's
TDQS audit scored the server 2.9/5 with a 1.8 minimum on `web_search`, and
2/5 naming coherence. Two contracts were added: REQ-089 (every tool states
purpose, when-to/when-not with alternatives, and behavioral consequences;
every parameter is described; annotations declared) and REQ-090 (verb_noun
naming). Four tools were renamed — `corroborate` → `verify_claims`,
`kb` → `manage_kb`, `providers` → `inspect_providers`, `cite` →
`get_citations` — while `web_search`, `fetch_page`, and `reload_config`
already matched. The corroboration *concept* (glossary, §8 algorithm, the
internal `corroborate.ts` module and function) is unchanged; only the
advertised tool name changed. This is a breaking change for callers of the
four renamed tools; it was accepted as the cost of fixing the coherence
dimension, and every client-facing reference (README, skills, instructions,
fixtures) was updated in the same change. A stdio-surface test
(`src/tool-surface.test.ts`) now enforces both contracts.

### D-037: Hedged (Speculative) Fallback Dispatch for `web_search` and `fetch_page` (2026.08.24)

The fallback chain was sequential: provider N+1 was tried only after provider N
failed or timed out, so worst-case latency was chain-depth × timeout (up to 45s
for a slow `jina` followed by `native_fetch`). The roadmap called for concurrent
dispatch, but a naive all-providers-at-once race would multiply provider calls
(and quota cost) on every request even when the first provider succeeds.

- **Hedged dispatch** — run the primary alone for a latency-derived window
  (`clamp(avgLatency(primary), hedge_min_delay_ms, hedge_max_delay_ms)`; the
  floor when the primary has no recorded latency), then race the remaining
  providers and take the first non-empty success. The common path costs one
  call and preserves priority; the hedge only fires when the primary is slow
  or failing. `output.hedge_enabled: false` restores the sequential chain.
- **Quality-aware fetch hedge** — `fetch_page` renderers are not equivalent
  (`jina` returns Markdown, `native_fetch` returns HTML-to-text), so a pure
  first-success race would systematically downgrade content. `fetch_page`
  heeds a `hedge_grace_ms` preferred-primary window: a non-preferred winner is
  held briefly so a marginally-slow `jina` still serves. The serving renderer
  is always reported, so the downgrade is transparent when it does occur.
- **First-success semantics** — `meta.fallback_used` now means "the serving
  provider was not the chain's first-choice provider," not "a provider
  errored." A hedged fetch doubles requests to the target site (jina
  server-side plus one direct fetch), but `native_fetch` is quota-free and the
  tail-latency win is large; deep mode counts a hedged page as one page read.
- **Pure `src/hedge.ts`** — the race primitive (`raceFirstSuccess`) and the
  deadline computation (`computeHedgeDelay`) are extracted, unit-tested, and
  shared by both tools, mirroring the `batch.ts`/`truncate.ts`/`rerank.ts`
  convention. `corroborate` is deliberately untouched: it already races a
  broad pool and needs every provider's claims for cross-referencing.

### D-036: Corroborate Integration — All-Active Pool, Priority, Parallel Gaps, KB Recall (2026.08.24)

`corroborate` had drifted from its own contract: it filtered its provider pool
to `web_search`-capable providers while REQ-026 promised "all active," which
left REQ-026a's authority weighting a dead knob (encyclopedia/academic sources
were weighted highest yet never queried) and made the skill's "uses all active
providers" claim false. Four fixes land together:

- **All-active pool** — corroborate now defaults to every active provider that
  exposes a search function, skipping only those whose `auth_env`/`url_env` is
  unset (parity with `getDispatchChain`). Authority weighting becomes live.
- **Priority routing** — a `priority` parameter narrows the pool by intent
  (privacy → the privacy_critical chain; free_only → non-keyed/self-hosted),
  reusing the same intent vocabulary as `web_search` without its
  `fallback_depth` slice, which would gut cross-referencing.
- **Parallel gap refinement** — Phase 3 issues up to three gap queries
  concurrently within the remaining HTTP-call budget (the closed ROADMAP item).
- **KB recall** — new REQ-026e; prior KB findings reconcile as corroborating
  sources before external search, gated by `corroboration.kb_recall` (default
  true). The KB stays derivative (SR-001): absence or failure never blocks.

A per-provider timeout race wraps each searcher call, matching `web_search`.
`selectChain` was deliberately not reused for the pool because its
`fallback_depth` cap is a sequential-chain concept; corroboration needs the
broad set.

### D-035: Deep Search as a web_search Mode, Not a New Tool or a Corroborate Upgrade (2026.08.24)

Deep search — search, then read the top results and rank each page's passages
against the query — is implemented as a `deep: true` mode on `web_search`
(REQ-028) rather than a new tool or an extension of `corroborate`. Three
alternatives were weighed:

- **New `infobroker_deep_search` tool** — rejected. Deep search is a search
  *depth*, not a distinct job, and the tool surface is deliberately lean
  (13 → 6 tools in 2026.08.21). An eighth tool drags the full
  spec/README/validator/skill governance surface for a capability the existing
  tool already nearly provides.
- **Fold into `corroborate`** — rejected. `corroborate`'s contract (REQ-026) is
  verdicts from snippets; it never fetches page bodies, and reading bodies
  would change its identity, its confidence model, and its 30-call budget.
  Keeping read-depth (deep) and verification (corroborate) composable instead
  of entangled preserves both contracts.
- **`deep` mode on `web_search`** — chosen, mirroring how `suggest` (REQ-020b)
  and `expand` (REQ-020e) already live as modes on the same tool.

The passage-ranking reused comes from REQ-021b (`rerank.ts`), and passage-size
tuning reuses the `fetch` block rather than adding parallel knobs. The `deep`
block governs only fetch economics (page budget, total-page cap, concurrency,
early-exit score, and a hard time limit); date detection is off by default to
keep the critical path fast. Two related latency wins — parallel first-hop
fallback dispatch and concurrent `corroborate` gap refinement — were roadmapped
separately rather than bundled here; the latter shipped in D-036.

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

The state path is resolved lazily and honours `INFOBROKER_QUOTA_STATE`, a
test seam mirroring `INFOBROKER_KEYPOOL_STATE`. The quota test points it at a
per-run temporary directory, so it never depends on — or writes — the real
user state at `$TMPDIR/infobroker/quota.json`, and it does not rely on another
test having created that directory first.

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

## Spec Waivers

REQ IDs listed here are intentionally unimplemented. `validate-spec` accepts a
listed REQ for traceability and reports it as waived; any uncited REQ not
listed here is an error. Remove a line when its REQ is implemented and cited.

- (none)
