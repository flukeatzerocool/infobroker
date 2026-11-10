# Stage 4 — re-zoom (cold pass)

Artifact sha256: 2e5476069cc93dec0245eb847165aa98cb9f9ee8ed5b2238f59cc558d528b846
Reads: 5/8

## Findings (as reported)

- Major [clarity] status line miscounted the Stage 3 inventory (said 2 Blockers / 11 Majors;
  the report lists 3 / 22 / 6). **Fixed** — header now states 3 / 22 / 6 and the disposition.
- Major [design] watchlist live leg could not inject the temp config, and an un-injected run
  would reach the real user config. **Fixed** — D63 now declares the live half `NOT_RUN` up
  front; no provider stubs are authored.
- Major [design] expected `status:"error"` may be unreachable through in-band envelopes.
  **Resolved by** the same fix (the live leg is not run).
- Major [design] step 21's "section count equals new-P1 count" contradicted the grouping rule.
  **Fixed** — every new P1 must appear in exactly one section.
- Major [design] REQ-115 cross-surface fix pointed at `confidence.md`, which R7b owns.
  **Fixed** — R7b reads R7a's restatements instead.
- Major [clarity] formatting-repair mapping could point at `infobroker.md`. **Fixed** — step 23
  forbids in-session spec-prose repair and names the increment's own docs.
- Nits: tracker citation narrowing; step-14 matrix scope; `check-pack` halves; wording
  residuals. **Fixed** in the same amendment.

Partition arithmetic verified correct: R7a 11 + R7b 6 = 17, disjoint, H included.
