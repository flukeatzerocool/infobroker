# Tasks — CalVer as valid SemVer

**Done bar:** see `plan.md`. Stage 1 finishes this session green; Stage 2 is
the first release on/after 2026-11-08.

## C0 — Baseline and increment record
- [x] Record `status`, `check`, `check:fast`, and `npm view` baseline.
- [x] Confirm the three normalization sites still exist.
- [x] Increment record passes `check-loop-artifacts`.

## C1 — One spelling in code and tests
- [x] `scripts/lib/version.ts`: unpadded `today(now)`; delete `normalizeSemver`.
- [x] `scripts/version.ts`: padded ISO date; exact `server.json` write;
      canonical-root rejection; numeric CHANGELOG parse; `set` accepts both
      spellings.
- [x] `scripts/validate-spec.ts`: strict REQ-091 comparison.
- [x] `scripts/validate-readme.ts`: pad month and day; message wording.
- [x] `src/server-manifest.test.ts`: exact equality.
- [x] `.github/workflows/publish.yml`: read the version verbatim.
- [x] `scripts/version.test.ts`: new and legacy spelling cases.
- [x] `scripts/test-push-pipeline.ts` and pipeline rewind test: unpadded fixture.

## C2 — Re-stamp the tree
- [x] `npm run version-bump` → `2026.11.7` everywhere.
- [x] Fill the seeded `## 2026.11.7` CHANGELOG entry.
- [x] `npm run version-sync` green; diff limited to enumerated sites.

## C3 — Spec, docs, decisions
- [x] REQ-091 body: exact published-version equality.
- [x] `README.md`, `CONTRIBUTING.md`, changelog prompt: `YYYY.M.D`.
- [x] `DECISIONS.md`: D-094 supersedes D-086.
- [x] Grep for stale `YYYY.MM.DD` / `npm-canonical` guidance.

## C4 — Full verification
- [x] `npm run check` and `npm run check:fast`.
- [x] Seeded padded-root failure exits 1 (`version.test.ts` case).
- [x] `npm run test-push-pipeline`.
- [x] `npm run session:close`.

## C5 — Stage 2: closing release (≥ 2026-11-08)
- [ ] `npm run prep`, review, split, `npm run release`.
- [ ] Verify `npm view` version and `gitHead` against the tag.
- [ ] Remove the ROADMAP section; `check-roadmap`.
- [ ] Close the AAR with `LOOP PAUSED`.
