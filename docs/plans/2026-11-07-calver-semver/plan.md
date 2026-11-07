# Plan — CalVer as valid SemVer: one version identity from package.json to npm

**Status:** Draft for approval (2026-11-07).
**Mode:** planned. **Gate:** build-review.
**Increment:** `docs/plans/2026-11-07-calver-semver/`.
**Review independence:** self.

**Done bar:** Stage 1 (this session) is done when `npm run check` and
`npm run check:fast` are green on a tree whose version is the single string
`2026.11.7`; `npm run version-sync` proves byte-identical stamps (no
normalization); unit tests prove `today()` emits `YYYY.M.D`, `set` still
accepts legacy `YYYY.MM.DD`, and a mixed-spelling CHANGELOG passes; the
REQ-091 gate and `server-manifest` test assert exact equality; and
`npm run session:close` passes. The ROADMAP item closes at Stage 2, on the
first release date whose unpadded CalVer is not already on npm: `npm view
infobroker version` equals `package.json` **and** `npm view
infobroker@<version> gitHead` equals `git rev-parse v<version>`.

## Why

ROADMAP item 1, P0: "Normalize CalVer to valid SemVer". D-086 records the
defect: npm strips the leading zero from each numeric segment, so a repository
version `2026.11.07` publishes as `2026.11.7`; the tag, the package, and the
registry identity never agree. D-086 deferred the fix to this roadmap item.

The mismatch is currently masked in three places, not one:

- `scripts/lib/version.ts:normalizeSemver` rewrites `server.json`;
- `scripts/validate-spec.ts:861` rewrites `package.json` before comparing it
  to `server.json` (REQ-091);
- `.github/workflows/publish.yml:41` rewrites `package.json` before comparing
  it to `npm view`.

Strict SemVer 2.0.0 forbids leading zeros in numeric identifiers, so the
repository should emit the canonical spelling directly and every consumer
should compare like for like. This plan removes the three transforms, makes
the tree's version the single identity, and schedules the one release that
can prove it.

Baseline measured this session, before any edit:

| Check | Result |
|---|---|
| `npm run status` | 11 unpushed, oldest 2.7 h, version `2026.11.07`, tag `v2026.11.07` |
| `npm run check` | PASS, 22 gates, 49.0 s (recorded full run) |
| `npm run check:fast` | PASS, 19 gates, 20.0 s |
| `package.json` / tag / `server.json` | `2026.11.07` / `v2026.11.07` / `2026.11.7` |
| `npm view infobroker version` | `2026.11.7` |
| `npm view infobroker@2026.11.7 gitHead` | `13a05565…`, equal to `git rev-parse v2026.11.07` |

## Scope

**In:** `today()` and the bump path emit `YYYY.M.D`; one stamp string across
every version site; removal of the three zero-stripping transforms; numeric
parsing of mixed-spelling CHANGELOG history; the README date-padding fix; the
REQ-091 wording and its gates; the unit and pipeline tests that pin the
behavior; the re-stamp of this tree to `2026.11.7`; and the Stage 2 release
that closes the roadmap item.

**Out:** any change to the CalVer date convention (one release per date, no
prerelease or build-metadata suffixes); rewriting historical CHANGELOG
entries; re-tagging or republishing an existing version (D-092); the weekly
gate-retirement item (ROADMAP item 2); any new gate or check. Two nearby
consumers need no change, verified at draft time:
`src/update-check.ts:78` (`compareVersions` parses digit runs numerically) and
`scripts/lib/loop-audit.ts:43` (`versionToDate` already accepts 1–2 digit
segments).

## Decisions

- **D1 — The canonical spelling is `YYYY.M.D`.** No leading zeros in any
  numeric identifier, per SemVer 2.0.0. `2026.11.7` is valid; `2026.11.07`
  is not. The version is still a calendar date; only its spelling changes.
  Rejected: keeping `YYYY.MM.DD` and tolerating normalization (D-086 already
  rejects it), and a SemVer epoch or build-metadata suffix (changes the
  release convention for no benefit).
- **D2 — One write path, exact comparison.** `setVersion` writes the same
  string to every site, including `server.json`. `check` asserts exact
  equality, `validate-spec`'s REQ-091 check compares exact strings,
  `server-manifest.test.ts` asserts exact equality, and `publish.yml` reads
  `package.json` verbatim. `normalizeSemver` is deleted. Rejected: keeping
  normalization as an idempotent "correction" (it hides the next drift).
- **D3 — The clock is injectable.** `today(now: Date = new Date())` keeps the
  existing local-date behavior but lets tests pin the format without a fake
  timer. Rejected: a `vi.setSystemTime`-only test (couples the test to the
  runner clock).
- **D4 — The README date stays ISO-padded.** `Last updated: YYYY-MM-DD.`
  remains zero-padded because `validate-readme` compares it to the package
  date and treats it as a display date, not a version identity. The existing
  `expectedDate` transformation pads only the day; it must pad the month too
  so `2027.1.5` yields `2027-01-05`. Rejected: deriving the README date from
  the narrow version spelling (`2026-11-7`, not ISO 8601).
- **D5 — CHANGELOG history is not rewritten.** New headers use `YYYY.M.D`;
  existing padded headers stay as written. `check` parses every heading into a
  numeric tuple, compares numerically, and reports a canonical unpadded
  value. Rejected: rewriting historical headers (destroys the record) and
  lexicographic comparison (breaks once single-digit months appear).
- **D6 — `set` accepts both spellings; `bump` emits one.** The push pipeline
  rewinds stamps to the pre-run version via `version.ts set`, and that version
  may be a historical padded one (`scripts/pipeline/lib.sh:782`). The guard
  accepts `YYYY.M.D` and `YYYY.MM.DD` and writes the argument verbatim;
  `bump` always emits `YYYY.M.D`. `check` additionally rejects a root version
  with leading zeros, so a padded `bump` can never pass again. Rejected:
  rewriting the rewind path to normalize (it would reintroduce a second
  spelling).
- **D7 — Re-stamp now to `2026.11.7`; never publish today.** Removing
  normalization makes the padded tree inconsistent, so the tree is re-stamped
  in the same commit as the strict checks. Today's unpadded CalVer,
  `2026.11.7`, is already on npm (published 2026-11-07T07:20Z from tag
  `v2026.11.07`), so a release today would tag new code with an existing npm
  version and the mirror's publish job would skip it. The closing release is
  therefore the first date on or after 2026-11-08, which `version-bump` stamps
  as `2026.11.8`.
- **D8 — The ROADMAP section stays until Stage 2.** Its trigger names the
  published equality, not the code change. Stage 1 lands the implementation;
  Stage 2 removes the section in the release commit after the `npm view`
  check.
- **D9 — No new REQ.** REQ-091 already owns the registry identity; its body
  loses the "npm-canonical form" escape hatch and its gate becomes strict.
  No new source file is introduced, so no REQ citation is added.

## Blast radius

| File | Change | Size | Verification |
|---|---|---|---|
| `scripts/lib/version.ts` | `today()` emits `YYYY.M.D` with injectable clock; delete `normalizeSemver` | M | `version.test.ts` |
| `scripts/version.ts` | `set` guard accepts 1–2 digit segments; `isoDate` pads month/day; reject padded root; numeric CHANGELOG parse; drop normalization; usage text | M | `version.test.ts`, `version-sync` |
| `scripts/version.test.ts` | Unpadded fixtures; `today()` format; legacy `set`; mixed-history CHANGELOG; padded-root rejection; strict `server.json` | M | `npm test` |
| `scripts/validate-spec.ts` | REQ-091 check compares exact strings; drop `canonical`; update comment | S | `validate-spec` |
| `scripts/validate-readme.ts` | `expectedDate` pads month and day; message says `(vYYYY.M.D)` | S | `validate-readme` |
| `src/server-manifest.test.ts` | Exact string equality; comment describes the single identity | S | `npm test` |
| `.github/workflows/publish.yml` | Read `package.json` version verbatim (drop the zero-stripping transform) | S | workflow read-through; `check` unaffected |
| `infobroker.md` | REQ-091: registration version equals the published package version exactly | S | `validate-spec` |
| `README.md` | Versioning bullet says `YYYY.M.D`; version and `Last updated` stamps rewritten by `version-bump` | S | `validate-readme`, `version-sync` |
| `CONTRIBUTING.md` | Commit format `YYYY.M.D — <title>` | S | review |
| `scripts/pipeline/prompts/changelog.md` | `## YYYY.M.D — <title>` | S | review |
| `CHANGELOG.md` | New `## 2026.11.7` entry (seeded by `version-bump`, body in Stage 1) | S | `version-sync` |
| `DECISIONS.md` | D-094 supersedes D-086; record the collision and the closing condition | S | `check-non-goals` |
| `package.json`, `package-lock.json`, `src/index.ts`, `AGENTS.md`, `infobroker.md` stamp, `README.md` stamp | Re-stamp to `2026.11.7` via `npm run version-bump` | S | `version-sync` |
| `server.json` | Written as `2026.11.7` (already that value; now by identity, not normalization) | S | `version-sync`, `validate-spec` |
| `scripts/test-push-pipeline.ts` | Fixture version `2026.11.7`; keep the harness green | S | `test-push-pipeline` |
| `scripts/pipeline/pipeline-logic.test.ts` | Add one unpadded rewind case beside the padded one | S | `npm test` |
| `ROADMAP.md` | Remove the shipped section (Stage 2 only) | S | `check-roadmap` |
| `docs/plans/2026-11-07-calver-semver/{plan,tasks,aar}.md` | Increment record | S | `check-loop-artifacts` |

Rollback cost: **1** for each Stage 1 commit (revert it); **2** for Stage 2
(a published tag/version is immutable, D-092 — a mistake is corrected by the
next version).

## Steps

### C0 — Baseline and increment record (S)

1. Re-run `npm run status`, `npm run check`, `npm run check:fast`; record the
   SHAs and the `npm view` values in the table above.
2. Confirm the three masking sites still exist at `scripts/lib/version.ts:21`,
   `scripts/validate-spec.ts:861`, and `.github/workflows/publish.yml:41`.
3. Create this increment with `plan.md`, `tasks.md`, and a provisional
   `aar.md` ending `LOOP OPEN`; `check-loop-artifacts` must pass.

### C1 — One spelling in code and tests (M)

1. `scripts/lib/version.ts`: `today(now = new Date())` returns
   `${y}.${m}.${d}` with `Number`, no padding; delete `normalizeSemver` and
   its comment.
2. `scripts/version.ts`:
   - `isoDate` pads month and day to two digits.
   - `setVersion` writes `version` verbatim to `server.json`.
   - `check` rejects a root version that is not canonical
     (`/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/`), replaces the
     lexicographic CHANGELOG scan with a numeric tuple scan, and compares
     `server.json` to the root string exactly.
   - `set` guard becomes `/^\d{4}\.\d{1,2}\.\d{1,2}$/`; usage says
     `<YYYY.M.D>` and notes that legacy `YYYY.MM.DD` is accepted for rewind.
3. `scripts/validate-spec.ts`: REQ-091 compares `serverVersion` to
   `pkgVersion` exactly; delete `canonical`; update the comment.
4. `scripts/validate-readme.ts`: pad both month and day in `expectedDate`;
   update the `(vYYYY.M.D)` message.
5. `src/server-manifest.test.ts`: exact equality for both manifest versions;
   comment explains the single identity.
6. `.github/workflows/publish.yml`: `LOCAL_VERSION=$(node -e
   "console.log(require('./package.json').version)")`; leave the idempotence
   comparison unchanged.
7. `scripts/version.test.ts`: fixtures `MAX` = `2026.11.7` and `LEGACY` =
   `2026.11.6`; assert `today(new Date(2026, 0, 5))` is `2026.1.5`;
   `setVersion("2026.11.7")` writes `server.json` `2026.11.7` and README
   `Last updated: 2026-11-07.`; round-trip to and from `2026.11.6`; `check`
   passes with a mixed CHANGELOG (`2026.11.7`, `2026.11.06`, `2026.09.30`);
   fails on a padded root; `set` CLI accepts both spellings and rejects
   `2026.11` and `2026.11.7.1`.
8. `scripts/test-push-pipeline.ts`: fixture `VERSION = "2026.11.7"` (keep
   `CHANGELOG.md` and all stamp files consistent). Add one unpadded case to
   the `split_commit_series` rewind test in
   `scripts/pipeline/pipeline-logic.test.ts`.

Verify: `npm run typecheck`, `npm run typecheck:scripts`, `npx vitest run
scripts/version.test.ts scripts/lib/release-policy.test.ts
scripts/pipeline/pipeline-logic.test.ts src/server-manifest.test.ts`.

### C2 — Re-stamp the tree (S)

1. Run `npm run version-bump`. Expected: `2026.11.7` in `package.json`,
   `package-lock.json`, `src/index.ts`, `AGENTS.md`, `infobroker.md`,
   `README.md`, and `server.json`; a seeded `## 2026.11.7 — ` CHANGELOG
   header.
2. Fill the seeded CHANGELOG body with the three changes (valid-SemVer
   spelling, removal of normalization, strict REQ-091 identity).
3. Confirm `git diff` touches only the enumerated stamp sites plus the
   CHANGELOG; no historical entry changed.

Verify: before the bump, `npm run version-sync` must fail on the padded root
(the new check is live); after the bump it must pass. `git diff --stat`
matches the blast radius.

### C3 — Spec, docs, and decisions (S)

1. `infobroker.md` REQ-091: replace "equal the npm-canonical form of the
   published package version" with "equal the published package version
   exactly"; keep the body inside the Appendix B limits (record the before
   and after character count).
2. `README.md` versioning bullet: `CalVer (YYYY.M.D)`; note that the package,
   tag, and npm-published version are the same string.
3. `CONTRIBUTING.md` and `scripts/pipeline/prompts/changelog.md`: `YYYY.M.D`.
4. `DECISIONS.md`: add D-094, "CalVer Is Valid SemVer (2026.11.7)",
   superseding D-086. Record the three retired transforms, the unchanged
   date convention, the same-day collision, and the Stage 2 closure evidence.
5. Grep for remaining `YYYY.MM.DD` guidance and stale `npm-canonical` prose;
   update only the live instructions, never historical CHANGELOG entries.

Verify: `npm run validate-spec`, `npm run validate-readme`,
`npm run check-non-goals`. Portability counts recorded at draft time: REQ-091
body 343 → 325 characters, 3 sentences, 4 SHALL clauses (Appendix B limits:
≤800/≤8/≤8); the README `## Contribute` section is 98 words and the edit adds
about ten (limit 350). A repo-wide grep for `Normalize CalVer` finds only
`ROADMAP.md` and historical plan files, so removing the section needs no other
register edit; D-094 supersedes D-086 in the same commit.

### C4 — Full verification (S)

1. `npm run check` (all gates) and `npm run check:fast`.
2. Run the gate suite on the re-stamped tree, then revert `package.json` in a
   scratch copy of the tree to `2026.11.07` and confirm `npm run version-sync`
   fails — the regression is actually blocked, not just asserted.
3. `npm run test-push-pipeline` (hermetic pipeline, unpadded fixture).
4. `npm run session:close` for this increment.

Verify: every gate green; the seeded failure produces exit 1.

### C5 — Stage 2: closing release (S, deferred to the first date ≥ 2026-11-08)

1. Run `npm run prep`; review the AI diff, split it into the convention
   commits, then `npm run release`. `version-bump` stamps the release date
   (`2026.11.8` or later).
2. Wait for the mirror publish workflow, then verify:
   - `npm view infobroker version` equals `package.json`;
   - `npm view infobroker@<version> gitHead` equals `git rev-parse v<version>`;
   - the MCP registry returns 200 for that version.
3. Remove the ROADMAP section (shipped work moves to CHANGELOG), run
   `npm run check-roadmap`, and close the AAR with `LOOP PAUSED`.

Do **not** run Step 1 on 2026-11-07: npm already serves `2026.11.7` from the
previous tag, and the mirror's publish gate would skip the new code.

## Commit series

One concern per commit; `npm run typecheck` after each; full `npm run check`
once on the final Stage 1 tree.

| # | Subject | Contents | Must pass |
|---|---|---|---|
| 1 | `2026-11-07 — Versioning: CalVer emits valid SemVer` | `lib/version.ts`, `version.ts`(+test), `validate-spec.ts`, `validate-readme.ts`, `server-manifest.test.ts`, `publish.yml`, all stamps, seeded CHANGELOG header, `test-push-pipeline.ts`, pipeline-logic test | `version-sync`, `validate-spec`, `validate-readme`, `npm test`, `typecheck:scripts` |
| 2 | `2026-11-07 — Docs: single version identity (REQ-091, D-094)` | `infobroker.md` REQ-091, `README.md` bullet, `CONTRIBUTING.md`, changelog prompt, `DECISIONS.md`, CHANGELOG body | `validate-spec`, `validate-readme`, `check-non-goals` |
| 3 | `Release: <version>` (Stage 2) | `version-bump` stamps, CHANGELOG entry, `ROADMAP.md` removal | full `check`, `check-roadmap` |

Commit 1 is atomic by necessity: the strict checks cannot go green until the
tree is re-stamped, and the re-stamp cannot go green until the strict checks
accept an unpadded root. It stays under the ~300-line split limit outside
`package-lock.json`.

## Verification summary

- **Unit:** `today()` format (injected clock), `set` both spellings, padded
  root rejection, mixed-spelling CHANGELOG ordering, strict `server.json`
  equality, `expectedDate` month padding via the live README gate.
- **Gate:** `version-sync`, `validate-spec` (REQ-091), `validate-readme`,
  `npm test`, `test-push-pipeline`, `check` and `check:fast`.
- **Behavioral:** a seeded padded root fails `version-sync` with exit 1; the
  mirror publish job no-ops on the re-stamp push (npm already has
  `2026.11.7`) and publishes on the Stage 2 bump.
- **Closure:** `npm view` version and `gitHead` equality on the Stage 2
  release; `check-roadmap` after removing the section.

## Risks, edge cases, rollback

| Risk | Mitigation |
|---|---|
| Releasing on 2026-11-07 tags new code as the already-published `2026.11.7`; npm rejects the duplicate and the mirror skips | Explicitly forbidden in C5; Stage 2 waits for the first unpublished date (≥ 2026-11-08). |
| Strict checks land before the re-stamp, leaving a red commit boundary | C1 and C2 are one commit; `version-sync` runs before the commit is recorded. |
| Pipeline rewind passes a padded historical version to `set` | The guard accepts `YYYY.MM.DD` and `YYYY.M.D`; `pipeline-logic.test.ts` covers both. Intermediate rewind commits may carry a padded `server.json`; they are never published, and the final tree is restored before the gated commit. |
| Mixed CHANGELOG history breaks `maxDate` under lexicographic compare | Numeric tuple compare with an explicit mixed-history unit test. |
| `2027.1.5` style versions break the README last-updated check | `expectedDate` pads month and day; the live `validate-readme` gate runs. |
| REQ-091 body exceeds Appendix B limits | Record before/after counts; `validate-spec` enforces the limits. |
| npm's publish-side normalization reappears | npm accepts the string we send; the Stage 2 `gitHead` check proves the tarball is the tag. |
| Timezone boundary flips `today()` mid-run | Behavior is unchanged (local date); the release is a deliberate same-day operation. |
| A future same-day release reuses a published version | Existing D-092 rule: publish a distinct version; unchanged by this plan. |

**Rehearsal (deep tier):** the new code is exercised in a scratch tree
(re-stamp forward, rewind back, version-sync pass/fail) and the hermetic
pipeline harness before any real commit. **Backout:** revert commit 1 to
restore normalization; revert commit 2 for prose. Stage 2 publishes, so its
backout is a new version, not a revert (D-092).

## Unknowns

- The exact Stage 2 date (first day ≥ 2026-11-08); it determines the published
  version string.
- Mirror CI propagation timing after the release (the publish job waits up to
  five minutes); `npm view` may lag and need a retry.
- Whether the MCP registry accepts the unpadded version without the previous
  normalized lookup; `publish.yml` queries by the raw version after the
  change, and the Stage 2 check confirms it.
