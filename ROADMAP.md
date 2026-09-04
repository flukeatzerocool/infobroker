# Roadmap

<!--
  Format: one `## <title>` per upcoming item, followed by 1–3 bullet lines.
  Newest first. Remove entries once they ship (they move to CHANGELOG.md).
  Update this file when planning a release.
-->

<!-- No upcoming items. Remove entries once they ship to CHANGELOG.md. -->

## Emit the `rate_limited` error code (REQ-002 conformance)

- REQ-002 names `rate_limited` but no code path emits it. Deferred from the
  2026.09.03 cooldown change: a clean observable path (e.g. an explicitly
  requested provider returning 429) needs a small error-semantics decision
  before implementation. See DECISIONS.md D-041.
