# Roadmap

<!--
  Format: one `## <title>` per upcoming item, followed by 1–3 bullet lines.
  Newest first. Remove entries once they ship (they move to CHANGELOG.md).
  Update this file when planning a release. This file feeds the newsletter's
  "Upcoming" section directly.
-->

## Concurrent web_search fallback
- Dispatch the first `fallback_depth` providers concurrently and take the first success, cutting worst-case search latency from chain-depth × timeout to one timeout.
