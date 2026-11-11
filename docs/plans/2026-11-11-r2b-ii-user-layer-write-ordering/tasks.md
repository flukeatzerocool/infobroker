# Tasks — R2b-ii user-layer write ordering

**Status:** executed 2026-11-11 (plan revision 2)
**Plan:** `plan.md` in this directory
**Finding:** F-R2-2 (P1) → `Resolved`

## Phase 0 — Discovery (no edits)

- [x] 0.1 Baseline confirmed: `git log -1` = `1505276`, clean tree, `npm run
      status` (25 roadmap items, 65 unpushed), `npm run check` PASS (118.6 s).
- [x] 0.2 Three write sites confirmed (`src/config.ts:200`, `:282`, `:314`);
      `backupFile` had no other config-write caller.
- [x] 0.3 `mergeLayer` has two calling functions and four call sites
      (`:196`, `:222`, `:310`, `:312` pre-change); no fifth.
- [x] 0.4 No shipped config key legitimately holds `null` (`config.json`
      carries none; `Config` declares no nullable field).
- [x] 0.5 Amendments drafted and measured: REQ-040 536 → 660 characters,
      REQ-105 738 → 746, both inside the 800 limit.
- [x] 0.6 `config-migrations.test.ts` had no `migrateUserConfigLayer` fixture;
      DB-2 built its own temp-dir plus env fixture.
- [x] 0.7 README passage chosen: the hot-reload paragraph (`README.md:511`).
- [x] 0.8 Cold pass at standard depth: rev-1 FAILED (1 blocker, 2 majors);
      rev-2 re-audit passed. Artifacts in `/tmp/opencode/r2b-ii-cold/`.
- [x] 0.9 Sibling REQs checked: REQ-037 (declared values only — removal leaves
      nothing declared), REQ-040 (patched), REQ-105 (patched), REQ-113 (refusal
      path preserved). No conflict.
- [x] 0.10 `docs/plans/` is tracked (`git check-ignore` exits 1); roadmap,
      worklist, and `DECISIONS.md` are all in Phase 3.

## Phase 1 — Failing evidence first

- [x] 1.1 `src/config-patch.test.ts`: DB-1 external edit survives the patch.
- [x] 1.2 `src/config-patch.test.ts`: DB-3 backup bytes.
- [x] 1.3 `src/config-patch.test.ts`: DB-4 six removal cases.
- [x] 1.4 `src/config-patch.test.ts`: DB-5 unparseable layer refused.
- [x] 1.5 `src/config-migrations.test.ts`: DB-2 external edit survives.
- [x] 1.6 `src/config-migrations.test.ts`: DB-3 for both migration paths and the
      `backupBytes` unit case.
- [x] 1.7 Pre-fix run recorded below.

### Pre-fix observations

Run: `npx vitest run src/config-patch.test.ts src/config-migrations.test.ts`
→ **10 failed, 22 passed** (config-patch 7/15 failed, config-migrations 3/17).

| Case | Observed before the fix |
|---|---|
| 1.1 DB-1 | FAIL — the patch wrote over the layer and `corroboration.kb_recall` was lost |
| 1.2 DB-3 patch | PASS — `backupFile` copies the same bytes; kept as regression evidence (nothing re-serializes today, so no stronger assertion was available) |
| 1.3 DB-4 `auth_env`/`url_env`/`auth_optional` | FAIL ×3 — a `null` merged as a declared `null` and validation rejected each field |
| 1.3 DB-4 shipped-restore | FAIL — threw `auth_env must be a non-empty string` |
| 1.3 DB-4 absent-key no-op | FAIL — threw `auth_optional must be a boolean` |
| 1.3 DB-4 invalid-merged | PASS — both paths throw before writing; kept as regression evidence |
| 1.4 DB-5 patch | FAIL — the unparseable layer was treated as `{}` and overwritten |
| 1.5 DB-2 | FAIL — the migration wrote the startup snapshot, `kb_recall` lost |
| 1.6 DB-3 migration | PASS ×2 — `backupFile` bytes equal the unchanged file; regression evidence |
| 1.6 `backupBytes` | FAIL — no such export |

## Phase 2 — Fix

- [x] 2.1 `src/lib/atomic-write.ts`: `backupBytes` added (`:76`).
- [x] 2.2 `src/config.ts`: `readUserLayerFile` (`:168`); fresh read in
      `migrateUserConfigLayer` (`:285`) and `patchUserConfigLayer` (`:352`);
      read bytes retained in `loadConfigFromDisk`; `backupBytes` at all three
      sites.
- [x] 2.3 `src/config.ts`: `splitNullRemovals` (`:310`) and `deleteAtPaths`
      implement null-removal.
- [x] 2.4 `infobroker.md`: REQ-040 (660 chars) and REQ-105 (746 chars).
- [x] 2.5 `src/index.ts`: tool description and `patch` schema description.
- [x] 2.6 Both suites re-run: 32 passed.

## Phase 3 — Verification and documentation

- [x] 3.1 `git diff --stat` and `git status --porcelain` audited against the
      blast radius; no orphan edit.
- [x] 3.2 Targeted suites: `config.test.ts`, `config-patch.test.ts`,
      `config-migrations.test.ts`, `key-pool.test.ts` → 146 passed.
- [x] 3.3 `npm run typecheck` 0, `npm run validate-spec` all checks passed,
      `npm run check-intent-citations` 0 findings.
- [x] 3.4 `README.md` hot-reload paragraph updated; `validate-readme` 0/0.
- [x] 3.5 `DECISIONS.md`: D-099.
- [x] 3.6 `CHANGELOG.md`: entry under `## 2026.11.7`.
- [x] 3.7 `ROADMAP.md`: § R2b-ii removed; `check-roadmap` OK,
      `check-non-goals` OK.
- [x] 3.8 `worklist.md`: F-R2-2 `Resolved 2026-11-11`; anchors refreshed to
      `config.ts:285`, `:352`, `lib/atomic-write.ts:76`.
- [x] 3.9 `aar.md`: evidence table, dispositions, `LOOP PAUSED`.
- [x] 3.10 Final `npm run check` and `npm run check-loop-artifacts`.

## Phase 4 — Commit series

- [x] 4.1 Concern 1: spec, source, tests, `CHANGELOG.md` (explicit paths).
- [x] 4.2 Concern 2: `README.md`, `DECISIONS.md`, `ROADMAP.md`,
      `worklist.md`, this directory.
