# AAR — CalVer as valid SemVer

**Status:** Stage 1 executed 2026-11-07. Stage 2 (the closing release) is
scheduled for the first date on or after 2026-11-08.

**Done bar:** see `plan.md`. Stage 1 is green; Stage 2 closes the ROADMAP item
when `npm view infobroker version` and `npm view infobroker@<version> gitHead`
match `package.json` and the tag.

## What happened

1. The three zero-stripping transforms were removed: `normalizeSemver`, the
   REQ-091 comparison in `validate-spec`, and the `publish.yml` local-version
   transform. `today()` and `version-bump` now emit `YYYY.M.D`.
2. `version-sync` compares exact strings, rejects a padded root version, and
   parses CHANGELOG headings numerically so historical padded entries survive.
3. The tree was re-stamped from `2026.11.07` to `2026.11.7`; `server.json`
   reached that value by identity rather than normalization.
4. REQ-091, the README, CONTRIBUTING, the changelog prompt, and D-094 were
   updated. The new unit and pipeline cases cover both spellings.

## Evidence

| Command | Result |
|---|---|
| `npm run version-sync` before the bump | exit 1 on the padded root and `server.json` mismatch (the live gate) |
| `npm run version-sync` after the bump | PASS, root `2026.11.7` |
| `npm run typecheck` / `typecheck:scripts` | PASS |
| `npx vitest run` | 103 files, 1040 tests passed |
| `npm run test-push-pipeline` | 23/23 PASS |
| `npm run check` | PASS, 22 gates, 50.8 s (dirty tree, so not recorded) |
| `npm run check:fast` | PASS, 19 gates, 20.0 s |

## Findings

| # | Finding | Severity | Disposition |
|---|---|---|---|
| 1 | `2026.11.7` is already published to npm, so a release today would tag new code with an existing version and the mirror publish would skip it | P1 | Scheduled: Stage 2 on the first unpublished date (≥ 2026-11-08); recorded in D-094 and the ROADMAP trigger stays open. |
| 2 | `pipeline-logic.test.ts` still asserted a padded version format and failed the full suite | P0 | Resolved in-session (regex accepts 1–2 digit segments; unpadded rewind case added). |
| 3 | `validate-readme` padded only the day, so a single-digit month would have failed the date check | P2 | Resolved in-session (month and day are padded). |
| 4 | Legacy padded spellings in `release-policy.test.ts` and the loop-audit fixtures | P3 | Closed as informational: they deliberately exercise the dual-spelling boundary. |
| 5 | `.github/workflows/release.yml` still describes a force-moved tag, stale since D-092 | P3 | Closed as informational; unrelated to this item (soft-flagged at plan review). |

## Amendments at build

- Commit 1 carries the REQ-091 body, the README versioning bullet, and the
  CHANGELOG entry with the code and tests; the plan's commit table placed them
  in commit 2. Grouping them with the behavior they describe keeps each commit
  self-consistent and avoids a commit whose CHANGELOG entry has no body.

## Open

- Stage 2 (C5) remains open by design. The ROADMAP section is not removed
  until the published identity is verified with `gitHead`.

LOOP OPEN
