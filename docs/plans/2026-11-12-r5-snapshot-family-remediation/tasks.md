# Tasks — R5 snapshot and family remediation

## C1 — preserve-gated archiving

- [x] Gate on `preservation.enabled !== false && preservation.archive !== false`
      (`src/corroborate.ts`).
- [x] Remove `corroboration.archive_sources` from `src/types.ts` and
      `config.json`; add `preservation.archive: true`.
- [x] Validate `preservation.archive` as a boolean in `src/config.ts`.
- [x] Abortable wave: `ARCHIVE_TOTAL_BUDGET_MS = 2000`, one `AbortController`,
      `AbortSignal.any([waveSignal, AbortSignal.timeout(4000)])` per save.
- [x] `archiveBudgetMs` option on `corroborate` as the test seam.
- [x] Fixture base `preservation: { enabled: false }` + file-level rejecting
      `fetch` stub and `afterEach vi.unstubAllGlobals()`.
- [x] Five archive cases: enabled, disabled, archive-opt-out, failure tolerance,
      wave budget.

**Evidence:** red run against the pre-change gate (1 failed / 98 skipped);
post-change `vitest src/corroborate.test.ts` → 99 passed.

## C2 — deep-reading snapshots

- [x] `DeepFetchResult.snapshot` and five `DeepEnrichedResult` fields.
- [x] Explicit mapping of `hash_basis → snapshot_basis`,
      `truncated → snapshot_truncated` (a spread would emit the wrong keys).
- [x] `src/index.ts` keeps the `snapshotSource` result and returns it.
- [x] Unit propagation and omission cases.
- [x] Server-level case in `src/dispatch-orchestration.test.ts` with a hermetic
      KB; `preservation.enabled: false` case written through `config.local.json`
      because `setup()` forwards only `chains` and `output`.

**Evidence:** `vitest src/deep-search.test.ts` → 9 passed;
`vitest src/dispatch-orchestration.test.ts` → 20 passed.

## C3 — short-snippet families

- [x] Replace the 20-token gate with `MIN_FAMILY_TOKENS = 5`,
      `MIN_FAMILY_SHINGLES = 2`, applied to the snippet.
- [x] Merge case (6 content tokens, 3 shingles), distinct-snippet case,
      single-shingle and shared-title cases.
- [x] Reconcile-level `family_count: 1` case with one `source_family` key.

**Evidence:** `vitest src/source-family.test.ts src/corroborate.test.ts` → 107
passed; full `vitest run` → 1394 passed.

## C4 — spec, decision, docs

- [x] REQ-026c gains "Archiving SHALL be disableable without disabling source
      snapshots." Body stays inside Appendix B (3 sentences, 4 SHALL clauses,
      2 backtick tokens beyond the tool signature, ~500 characters).
- [x] `DECISIONS.md` D-106 supersedes D-026; D-026 marked superseded with the
      reasoning retained.
- [x] README Knowledge Base section names deep-reading snapshots and the archive
      opt-out inside the 350-word limit.
- [x] CHANGELOG entry under `## 2026.11.11` (no version bump; the release owns it).

**Evidence:** `validate-spec`, `validate-readme` (0 errors), `version-sync`,
`check-non-goals` all pass.

## C5 — roadmap and record

- [x] F-R5-C-1, F-R5-C-3, F-R5-B-1 marked `Resolved`; census updated 10/168 →
      13/165; F-R5-C-9 stays `Closed-P3`, F-R5-B-4 and F-R5-B-8 stay scheduled.
- [x] Roadmap section retired (trigger was satisfied: R6 closed 2026-11-09).
- [x] Increment record written.

**Evidence:** `check-roadmap` → 15 sections OK; `check-loop-artifacts`.
