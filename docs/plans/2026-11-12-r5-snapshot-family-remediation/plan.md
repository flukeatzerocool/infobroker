# R5 snapshot and family remediation

**Done bar:** F-R5-C-1, F-R5-C-3, and F-R5-B-1 are each pinned by a test; no test
reaches the network on the archive path; `typecheck`, `validate-spec`,
`validate-readme`, `check-roadmap`, `test-debate-club`, and `npm run check` pass;
`CHANGELOG.md` and `DECISIONS.md` record the behavior change and the supersession
of D-026; the roadmap section is retired.

**Date:** 2026-11-12 · **Roadmap section:** § R5 snapshot and family remediation
**Findings:** F-R5-C-1, F-R5-C-3, F-R5-B-1 · **Gate depth:** standard

## What changed

1. **Archiving follows preservation.** `verify_claims` gated the Wayback
   reference on `corroboration.archive_sources`, which shipped `false` while
   `preservation.enabled` shipped `true`, so the preservation-enabled default
   never archived. The gate is now `preservation.enabled` with a new
   `preservation.archive` opt-out. The wave runs under one abortable budget
   (2 s) with a 4 s per-request ceiling beneath it, so default-on archiving
   cannot add a full timeout per source.
2. **Deep reading reports its snapshot.** `search_web` called `snapshotSource`
   and discarded the result. The storage result now travels back through the
   deep fetch seam and surfaces as `snapshot_sha256`, `snapshot_tier`,
   `snapshot_basis`, `snapshot_url`, and `snapshot_truncated`.
3. **Short republishes share a family.** A 20-content-token gate suppressed
   every short-text comparison. It is replaced by a five-content-token,
   two-shingle floor, reading the snippet rather than title-plus-snippet.

## Verification

| Check | Result |
|---|---|
| Red: `attaches archived_url` against the pre-change gate | 1 failed / 98 skipped |
| `vitest src/corroborate.test.ts` | 99 passed |
| `vitest src/deep-search.test.ts src/dispatch-orchestration.test.ts` | 9 + 20 passed |
| `vitest src/source-family.test.ts src/corroborate.test.ts` | 107 passed |
| Full `vitest run` | 119 files, 1394 tests passed |
| `validate-spec` / `validate-readme` / `check-roadmap` / `version-sync` | pass |

## Conditions carried from plan review

- **C-1** — the `archiveBudgetMs` seam is exercised by a real wall-clock test
  asserting budget + 500 ms. Met: `bounds the archive wave at its budget`.
- **C-2** — every suite on the corroboration path installs the rejecting `fetch`
  stub unconditionally. Met: file-level `beforeEach` in `src/corroborate.test.ts`;
  all other `corroborate(` call sites are in that file.
