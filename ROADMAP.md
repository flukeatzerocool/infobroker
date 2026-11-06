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

## Dependency advisories

- `npm audit` reports 5 low/moderate advisories (`@hono/node-server`
  `serveStatic` double-decode, a `katex` range). The audit gate fails only on
  high/critical, so `npm run check` is green; upgrade when a compatible
  release ships. `markdownlint-cli` is now `^0.50.0` and no longer flagged.

## Knowledge base

- Streaming/out-of-core LSA: `LsaModel.fit` allocates O(n·v) and O(n·k) matrices,
  so fitted-model reconciliation remains memory-bound by design.
