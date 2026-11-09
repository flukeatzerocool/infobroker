# Roadmap

<!--
  Admission rule: a `## <title>` section is a scheduled work item. It needs an
  action a maintainer can take, 1–3 bullet lines, and a `**Trigger:**` line
  naming what starts the work or what closes it. Priority order, P0 first;
  remove a section when the work ships (it moves to CHANGELOG.md).

  Standing facts are not roadmap items: accepted dependency advisories and
  by-design limitations are recorded in DECISIONS.md, and a review cites the
  decision rather than filing a roadmap entry. `npm run check-roadmap`
  enforces this rule; `## Non-goals` is exempt from it because
  `npm run check-non-goals` verifies that section as a pointer to the
  `## Scope Non-goals` block in DECISIONS.md.
-->

## Full-repository review sweep

- Run a whole-repository semantic review one chunk per session: R1 contracts, R2 config/providers/resilience, R3 `search_web`, R4 `fetch_page`, R5 corroboration, R6 knowledge base, R7 client artifacts/reporting, R8 deployment/state/security, R9 spec integrity, then the M1 machine-evidence pass. The tracker is `docs/plans/2026-11-09-full-review-sweep/worklist.md`.
- Each chunk produces a per-REQ verdict table, a fresh-context plan and code review, findings dispositioned P0–P3, green exit gates, and an increment record under `docs/plans/`.
- Coverage is §1–§10 and Appendices A–E, including all 142 §4 REQs, with every section assigned to exactly one chunk.

**Trigger:** start chunk R2 after the R1 remediation is scheduled; close this item when every chunk is closed and the final machine-evidence pass is green.

## R1 contract remediation

- Apply compact verbosity uniformly: `fetch_page`, `inspect_providers`, `manage_kb`, and `reload_config` build envelopes directly and bypass `ok()`, so `output.verbose=false` does not trim their metadata or optional per-result fields (REQ-079; `src/index.ts:103`, `:1142`–`:1390`, `:1490`–`:1590`, `:2046`–`:2290`).
- Write the full content and set `output_path` on the knowledge-base cache-hit truncation path; it currently reports `truncated: true` with no file and no path (REQ-004; `src/index.ts:1037`).
- Top up `max_results` after invalid normalized results are discarded; the request asks the provider for `max_results` and slices after filtering, so discarded rows reduce the delivered count (REQ-073; `src/index.ts:505`).

**Trigger:** scheduled by chunk R1 on 2026-11-09; close each bullet when its regression test lands.

## Non-goals

Open-web scope boundary; the authoritative list lives in `DECISIONS.md`
under `## Scope Non-goals`.
