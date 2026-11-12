# AAR — R5 snapshot and family remediation

**Status:** complete · **Date:** 2026-11-12 · **Plan:** `plan.md`

## What happened

The top `ROADMAP.md` section (R5 snapshot and family remediation) was planned,
reviewed through three independent passes, and executed. Three P1 findings
closed:

- **F-R5-C-1** — archiving now follows `preservation.enabled` with a new
  `preservation.archive` opt-out, so the shipped default archives;
  `corroboration.archive_sources` is gone. The wave runs under one abortable 2 s
  budget with the 4 s per-request ceiling beneath it.
- **F-R5-C-3** — deep reading keeps the `snapshotSource` result and reports the
  hash, tier, basis, URL, and truncation on the result.
- **F-R5-B-1** — the 20-token gate is replaced by a five-content-token,
  two-shingle floor, so short republished wire copy collapses into one family
  while a single shared shingle or a shared title does not.

D-026 was superseded by D-106, REQ-026c gained the opt-out clause, and the
roadmap section was retired.

## What went right

- **The cold pass earned its cost three times.** It caught the live-network
  Blocker (two REQ-122 tests override `preservation` after `mockConfig`'s spread),
  a wave budget that bounded nothing, and a spread that would have emitted
  `hash_basis`/`truncated` while typecheck stayed quiet. Each was fixed before
  any implementation.
- **The red run was genuinely red.** Stashing the pre-change `src/corroborate.ts`
  made the rewritten archive test fail (1 failed / 98 skipped) — the test does
  not pass on the old gate.
- **The abort test models abort.** The hanging fixture rejects on
  `signal.abort`, so the wall-clock assertion measures the wave rather than a
  mock that resolves early.
- **The Arena behaved as documented.** Its egress interceptor logged
  `web.archive.org/save/` as unmatched, and the log is exactly what surfaced the
  missing fixture instead of a silent live call.

## What went wrong

- **The plan's Arena fallback was needed.** Verification step 3 predicted no
  fixture change; the unmatched log filled with save requests because
  `web.archive.org` is already a fixture host. One `^/save/` entry returning a
  302 fixed it.
- **The dispatch test's first negative case was wrong.** `setup()` forwards only
  `chains` and `output`, so `preservation: { enabled: false }` was silently
  dropped and the assertion failed against default-on preservation. Written
  through `config.local.json` instead.
- **The README addition overran the 350-word section limit** twice before the
  third, tighter pass; `validate-readme` caught both.
- **The gate stamp needed the review report to carry `Plan sha256: <hex>`** on
  its own line; the prose form did not satisfy the binder.

## Findings

- **Hermetic `setup()` drops unknown config options (P2).** `setup()` in
  `src/dispatch-orchestration.test.ts` accepts only `chains` and `output`, so any
  other option a test passes is discarded without an error. It cost one failing
  assertion here and would silently weaken a future fixture.
  **Disposition: scheduled** on `ROADMAP.md` § Hermetic test option forwarding.
- **`family_count` test landed in the C1 commit (P3).** The reconcile-level
  assertion lives in `src/corroborate.test.ts`, which commit 2 already staged, so
  the test shipped one commit before `src/source-family.ts`. Same file, same
  concern; no behavioral gap. **Disposition: closed as informational.**
- **Pre-existing gate warning (P3).** `check-loop-artifacts` still reports the
  missing `**Done bar:**` in the 2026-11-10 r6-encryption plan.
  **Disposition: closed as informational.**
- **Unpushed backlog (P1 operational).** 108 commits before this increment,
  oldest 2.8 d, now 113. Publication remains user-authorized.
  **Disposition: deferred by user.**

## Verification

| Command | Result |
|---|---|
| Red run (pre-change `src/corroborate.ts`) | 1 failed / 98 skipped |
| `vitest src/corroborate.test.ts` | 99 passed |
| `vitest src/deep-search.test.ts` | 9 passed |
| `vitest src/dispatch-orchestration.test.ts` | 20 passed |
| `vitest src/source-family.test.ts src/corroborate.test.ts` | 107 passed |
| Full `vitest run` | 119 files / 1394 tests passed |
| `npm run test-debate-club` | 8 files / 61 tests passed |
| `npm run validate-spec` | passed (142 REQs) |
| `npm run validate-readme` | 0 errors, 0 warnings |
| `npm run version-sync` | OK |
| `npm run check` | PASS (full, 22 gates) |
| `npx tsc --noEmit` | clean after each commit |

## Commits

- `docs(spec): make the archive opt-out explicit in REQ-026c` — `infobroker.md`
- `fix(corroborate): gate archiving on preservation and bound the wave` —
  `src/corroborate.ts`, `src/types.ts`, `src/config.ts`, `config.json`,
  `src/corroborate.test.ts`
- `fix(fetch): report deep-reading snapshots` — `src/deep-search.ts`,
  `src/index.ts`, two test files
- `fix(corroborate): collapse short republished snippets` — `src/source-family.ts`,
  `src/source-family.test.ts`
- `test(debate-club): serve the Wayback save endpoint from fixtures` —
  `debate-club/fixtures/index.json`
- `docs(roadmap): resolve the R5 snapshot and family findings` — `DECISIONS.md`,
  `CHANGELOG.md`, `README.md`, `ROADMAP.md`, `worklist.md`
- This record.

No push was performed. Branch `main` is 113 commits ahead of `origin/main`.

LOOP PAUSED
