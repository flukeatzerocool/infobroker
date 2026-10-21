# Roadmap

<!--
  Format: one `## <title>` per upcoming item, followed by 1–3 bullet lines.
  Newest first. Remove entries once they ship (they move to CHANGELOG.md).
  Update this file when planning a release.
-->

## Knowledge base

- Remove the legacy JSON backend after the one-release `kb.store_backend: "json"`
  escape hatch.
- Streaming/out-of-core LSA: `LsaModel.fit` allocates O(n·v) and O(n·k) matrices,
  so fitted-model reconciliation remains memory-bound by design.
- Encrypted-compatible KB prefilter: add only if measured SQLite search latency
  on the production corpus exceeds 2× the legacy backend. A plaintext FTS5 index
  is not acceptable for encrypted stores.
