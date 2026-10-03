# Roadmap

<!--
  Format: one `## <title>` per upcoming item, followed by 1–3 bullet lines.
  Newest first. Remove entries once they ship (they move to CHANGELOG.md).
  Update this file when planning a release.
-->

## Dependency audit remediation

- `npm run check`'s `npm audit --audit-level=high` step fails on registry-drift
  advisories (2 high: `brace-expansion`, `undici`; 5 moderate) with no local
  dependency change — reconcile via `npm audit fix` or scoped overrides.
- Surfaced 2026-10-02 during the harness-gate cleanup; independent of it.

## Harness expectation drift gate

- Add a check that cross-references harness `tool_audit` expectations
  (`debate-club/lab-scenarios.json`, `test-fixtures/research/manifest.json`)
  against the skill/tool behavior they encode, so a stale gate fails a gate
  instead of a live run.
- Motivated by the 2026-10-02 stale `kb_before_search` gate removal (see
  CHANGELOG); the harnesses now carry no such check.
