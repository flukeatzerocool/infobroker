# Roadmap

<!--
  Format: one `## <title>` per upcoming item, followed by 1–3 bullet lines.
  Newest first. Remove entries once they ship (they move to CHANGELOG.md).
  Update this file when planning a release.
-->

<!-- No upcoming items. Remove entries once they ship to CHANGELOG.md. -->

## Persistent key-pool rotation (deferred from competitive batch, 2026.09.04)

- Search Toolkit-style multi-key pools: ordered key lists per keyed provider,
  rotate on 401/403/429, per-key cooldown, persisted cursor. Deferred because
  every keyed provider caches its key at module scope, so rotation requires
  touching each keyed provider — see DECISIONS.md D-043.

## Emit the `rate_limited` error code (REQ-002 conformance)

- REQ-002 names `rate_limited` but no code path emits it. Deferred from the
  2026.09.03 cooldown change: a clean observable path (e.g. an explicitly
  requested provider returning 429) needs a small error-semantics decision
  before implementation. See DECISIONS.md D-041.
