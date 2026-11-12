# After-action report — KB recalled-source provenance

**Date:** 2026-11-12 · **Plan:** `plan.md` (stamped, sha256 `0c74579e…`) · **Depth:** light

## What happened

1. Added two `@implements REQ-026d recalled-source-provider` tests to
   `src/corroborate.test.ts`: one asserting that a recalled source's ingest
   `provider` appears on the finding source and in
   `result.provenance.sources`; one asserting that a recalled source with no
   recorded provider omits the field.
2. Recorded the red result: 1 failed / 95 passed — the provider assertion
   failed with `undefined` on the unmodified source.
3. Fixed the recall mapping in `src/corroborate.ts` to carry
   `provider: r.provider || undefined`.
4. Fixed the test's optional-chaining access to the optional
   `provenance.sources` array after the first typecheck failed (one retry).
5. Green: 96 passed (94 baseline + 2 new). `npm run typecheck` clean.
6. Added the `CHANGELOG.md` entry and removed the `ROADMAP.md` section.
7. Gates: `validate-spec`, `check-roadmap`, `check-gate-coverage`,
   `check-intent-citations` green. Full `npm run check` green through
   `check-gate-table`, stopping only at the expected `missing aar.md`.
8. Wrote this AAR, then re-ran `check-loop-artifacts`, `check:fast`, and the
   full `npm run check` on the final tree.

## What went right

- The chain was already wired (`attributeSource` → `provenance.sources`);
  only one mapping link was missing, so the fix stayed a single expression and
  the adjacent consumers (snapshot metadata, finding sources) picked it up
  without further edits.
- Reading the type (`KbSearchResult.provider`) before the fix confirmed the
  data was present at the source, so no KB or provider change was needed.

## What went wrong

- **Test type error.** The first version accessed `result.provenance.sources`
  directly; the type declares `sources?`, so `tsc --noEmit` failed twice
  (two call sites). Fixed with optional chaining in one retry. Root cause:
  reading `provenance` in `corroborate.ts` (always populated there) instead of
  the declared type.
- **Plan wording versus implementation.** The plan's D1 step said "add
  `provider: r.provider`"; the empty-provider requirement (D3) needs
  `|| undefined` so an empty string is omitted rather than reported as a
  placeholder. The expression differs from the plan's literal; it satisfies
  D3 and stays inside the planned surface. Recorded in `tasks.md` as an
  implementation note, not a scope change.
- **The empty-provider test was not red.** It passed before the fix because
  the field was absent either way. It is a pin against a future placeholder,
  not red evidence for the defect; counted honestly.

## Findings

- **Transient `check-loop-artifacts` red (P3).** Creating the increment
  directory makes the gate red until `aar.md` exists. Expected mid-increment
  and recorded in the plan as C-1. **Disposition: closed as informational**
  (resolved when this file was written; gate re-run green).
- **`check-loop-artifacts` warning on `2026-11-10-r6-encryption-capacity-remediation`**
  (missing `**Done bar:**`). Pre-existing, outside this increment.
  **Disposition: closed as informational.**
- **Unpushed backlog (P1 operational).** 106 commits before this increment.
  Publication is the maintainer's decision and this plan explicitly did not
  push. **Disposition: deferred by user.**

## Verification

| Command | Result |
|---|---|
| Red run (`npx vitest run src/corroborate.test.ts`) | 1 failed / 95 passed (96) |
| Post-fix targeted suite | 96 passed (96) |
| `npm run typecheck` | clean (after the optional-chaining fix) |
| `npm run validate-spec` | All checks passed (127 REQs cited, 0 uncited files) |
| `npm run check-roadmap` | OK (16 sections) |
| `npm run check-gate-coverage` | 118 G1 REQs: 117 cited, 1 exempt, 0 waived |
| `npm run check-intent-citations` | 141 citations, 0 findings |
| `npm run check` (before AAR) | FAIL at `check-loop-artifacts` only — `missing aar.md` (C-1) |
| `npm run check-loop-artifacts` (after AAR) | 0 errors, 1 pre-existing warning |
| `npm run check:fast` (final tree) | PASS (19 gates, 22.5 s) |
| `npm run check` (final tree) | PASS (full, 154.8 s; run record not written because the tree was dirty before the split commits) |

## Loop status

LOOP PAUSED
