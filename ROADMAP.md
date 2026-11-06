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

## [P1] Structured response contract

- Add `structuredContent` and `outputSchema` to all seven tools so Code Mode
  receives objects, not `[OK]`-prefixed strings (REQ-001).
- Add a raw-text mode and standardize `snippet`/`snippets`; include
  `top_score`, `passages_returned`, and `match_quality` (REQ-021b).
- Make batch items self-describing: provider, status, url, passages,
  truncated.

## [P2] Knowledge-base memory

- Make report ingest a required tail step for Deep-Dive and Research &
  Write; archive the finished report, not just the style sheet (REQ-050
  family).
- Add `fresh: "blend"` so fresh search still recalls cached work, and let
  `search_web` recall named collections (REQ-020).
- Link an ingested report to its source URLs.

## Dependency advisories

- `npm audit` reports 5 low/moderate advisories (`@hono/node-server`
  `serveStatic` double-decode, a `katex` range). The audit gate fails only on
  high/critical, so `npm run check` is green; upgrade when a compatible
  release ships. `markdownlint-cli` is now `^0.50.0` and no longer flagged.

## Knowledge base

- Streaming/out-of-core LSA: `LsaModel.fit` allocates O(n·v) and O(n·k) matrices,
  so fitted-model reconciliation remains memory-bound by design.
