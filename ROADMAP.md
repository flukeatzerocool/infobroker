# Roadmap

## Open-web scope boundary

Infobroker is an open-web search, analysis, and reporting tool, not a
professional OSINT platform. The following are explicit non-goals: SOCMINT
platform collection; WHOIS/DNS/certificate-transparency/attack-surface data;
corporate registries and beneficial ownership; sanctions/PEP screening;
breach/leak indexes; image/video/audio forensics; STIX/MISP/OpenCTI and graph
link analysis; court-admissible chain-of-custody; multi-user case management
and ACLs; enterprise scheduling.

<!--
  Format: one `## <title>` per upcoming item, followed by 1–3 bullet lines.
  Newest first. Remove entries once they ship (they move to CHANGELOG.md).
  Update this file when planning a release.
-->

## [P0] Batch response fidelity

- `fetch_page` array mode drops `snippets[]`, `top_score`, `note`, and
  per-item truncation; merge them per REQ-021b and REQ-021.
- Merged results must carry per-result provider provenance, not a single
  top-level provider (REQ-021).
- Add regression tests for multi-URL question mode, partial failures, and
  truncated items.

## [P0] Draft verification loop

- `verify_claims` accepts one claim at a time; add a batch claim list
  returning claim → verdict → confidence → source → span (REQ-026).
- Add a FACT-CHECK DRAFT step to the Infobroker skill: extract claims,
  verify, fix, re-check (REQ-050 family).
- Preserve source modality ("reportedly") and flag upgrades to flat
  assertion.

## [P0] Provider resilience

- The live `general_web` chain is DuckDuckGo plus three small-web engines
  because Brave is not configured; enable a keyed provider or add a second
  general engine (REQ-031).
- Return the real `retry_after_ms` and name `inspect_providers` in every
  provider-error remediation (REQ-002, REQ-038).
- Return partial batch results with per-query errors instead of one
  `[ERROR]` for the whole batch.

## [P1] Intent routing

- The keyword classifier sends a biography query to the location chain and
  scholarly queries without "academic"/"journal" to general web; add
  DOI/journal/author-year signals and a confidence floor (REQ-020a).
- Add a `task_type` override to `search_web` (REQ-020).
- Add the misrouted queries from the essay session as regression fixtures.

## [P1] Structured response contract

- Add `structuredContent` and `outputSchema` to all seven tools so Code Mode
  receives objects, not `[OK]`-prefixed strings (REQ-001).
- Add a raw-text mode and standardize `snippet`/`snippets`; include
  `top_score`, `passages_returned`, and `match_quality` (REQ-021b).
- Make batch items self-describing: provider, status, url, passages,
  truncated.

## [P1] Structured facts and fetch fallbacks

- Route attendance/date/percentage queries to Wikidata and extract Wikipedia
  infobox/table data before falling back to prose (REQ-020a, REQ-021).
- Add a Crossref/DOI resolver and repository/Internet Archive fallback for
  paywalled academic URLs (REQ-021).
- Fix the `file://` remediation to point at the `read` tool and distinguish
  paywall/anti-bot from network failure.

## [P2] Knowledge-base memory

- Make report ingest a required tail step for Deep-Dive and Research &
  Write; archive the finished report, not just the style sheet (REQ-050
  family).
- Add `fresh: "blend"` so fresh search still recalls cached work, and let
  `search_web` recall named collections (REQ-020).
- Link an ingested report to its source URLs.

## [P2] Skill pipeline alignment

- Surface `search_web (deep)` and `research` in the main EXTRACT step; add
  ARCHIVE and FACT-CHECK DRAFT to the pipeline (REQ-050).
- Add source grades A/B/C to the report template and a citation-completeness
  check (REQ-116).
- Clarify when `verify_claims` applies to interpretive theses vs. discrete
  facts.

## [P2] Observability, config, and source quality

- Log per-call provider, latency, and status; expose a session summary and
  cooldown notices (REQ-111).
- Raise the research passage size and add DDG jitter/rate-limit tuning
  (REQ-030).
- Rank results by domain quality and primary-source bias; add a configurable
  blocklist (REQ-020g).

## Dependency advisories

- `npm audit` reports 3 high advisories in the `markdownlint` devDependency
  chain (`re2js`) plus moderate advisories (`@hono/node-server`, katex,
  minimatch). The fix is a breaking `markdownlint-cli` upgrade; `npm run check`
  cannot pass until it ships.

## Knowledge base

- Streaming/out-of-core LSA: `LsaModel.fit` allocates O(n·v) and O(n·k) matrices,
  so fitted-model reconciliation remains memory-bound by design.
