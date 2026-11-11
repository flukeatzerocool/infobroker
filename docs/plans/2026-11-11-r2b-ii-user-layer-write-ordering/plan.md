# Plan — R2b-ii user-layer write ordering

**Status:** draft 2026-11-11 (revision 2) · **Depth:** standard
**Review independence:** self pass complete; cold pass on revision 1
**FAILED** (1 blocker, 2 majors, 4 minors, 3 nits), all corrected in this
revision. The single permitted re-audit of the changed stages follows
(§ Review-loop cap). Report `/tmp/opencode/r2b-ii-cold/report.md`.
**Rollback:** revert two commits. Production change is confined to
`src/config.ts` (three write paths), `src/lib/atomic-write.ts` (one new helper),
`src/index.ts` (tool description and one schema description); no persisted
state, schema, credential format, or response shape changes.
**Roadmap item:** `ROADMAP.md` § R2b-ii user-layer write ordering
**Predecessor:** `1505276` (`docs(roadmap): split R2b and record the R2b-i close`)

## Review-loop cap

Per `ROADMAP.md` § Review-loop convergence, the cap is stated here rather than
left to judgement: **one cold pass at standard depth, plus at most one
re-audit of the stages that pass failed.** If that re-audit still returns
blockers, stop and report to the user instead of running further passes. The
previous increment's seven-pass loop is the failure mode this cap exists to
prevent.

## Baseline (verified this session)

- `git log -1` → `1505276`; working tree clean.
- `npm run status` → version 2026.11.7, 25 roadmap items, 65 unpushed commits
  (oldest 39.8 h).
- `npm run check` → **PASS** (full, 22 gates, 118.6 s). The only finding is the
  pre-existing `check-loop-artifacts` warning for
  `2026-11-10-r6-encryption-capacity-remediation` (missing `**Done bar:**`),
  which does not fail the suite.
- Register row: `docs/plans/2026-11-09-full-review-sweep/worklist.md:618`
  (F-R2-2, P1, `Scheduled-roadmap` — § R2b-ii).
- Trigger satisfied: R2b-i shipped on 2026-11-11 (`0c94620`, AAR `LOOP PAUSED`).

## Finding in scope

| Finding | Severity | Disposition target |
|---|---|---|
| F-R2-2 | P1 | `Resolved` |

F-R2-7 stays `Scheduled-roadmap` under § R2b-iii; F-R2-9 and the R2c/R2d rows
are untouched.

## Predicate re-verified this session

- `patchUserConfigLayer` (`src/config.ts:295-318`) merges the patch into
  `userConfigLayer` (`:309`), the in-memory snapshot taken at the last
  `loadConfigFromDisk`. An external edit made after startup is therefore not in
  the merge base and is overwritten by the write at `:315`.
- `migrateUserConfigLayer` (`:270-286`) has the same base: it applies
  migrations to `userConfigLayer` (`:277-279`) and writes the result at `:283`.
- `loadConfigFromDisk` (`:168-227`) reads the layer once at `:177` and applies
  the startup auto-migration to that value (`:194`), but keeps no bytes: the
  backup at `:200` is `backupFile(userPath)`, which copies the file as it is at
  backup time (`src/lib/atomic-write.ts:61-68`).
- `backupFile` copies with `copyFileSync` and sets 0600; there is no helper that
  writes a supplied buffer to a backup path.
- `mergeLayer` (`:136-154`) replaces a leaf with the overlay value, including
  `null`; there is no delete semantics anywhere in the patch path. Combined with
  D-098 (a declared `auth_env`/`url_env`/`auth_optional` that is not a usable
  shape is rejected), a user layer that declares an auth field has no route to
  remove it.
- Shipped `config.json` declares `auth_env` for `core`, `exa`, and others, so a
  removal from the user layer restores the shipped declaration, not "unset".

## Done bar

**Done bar:** every clause below holds on the final tree, each with the
evidence named in § Verification summary.

- **DB-1** `patchUserConfigLayer` merges over the layer as it exists on disk at
  call time. A key written to the layer after `loadConfig()` and before the
  patch call survives the patch, and the patch's own key is applied. The test
  fails before the fix (the external key is lost).
- **DB-2** `migrateUserConfigLayer` applies migrations to the layer as it
  exists on disk at call time: a key added after `loadConfig()` survives the
  migration, and the migration's own changes are applied. The test fails before
  the fix.
- **DB-3** The backup at each of the three write sites — patch, explicit
  migration, and the startup auto-migration in `loadConfigFromDisk` — is
  written from **the buffer the operation read and merged**, not by copying the
  file at backup time. Evidence: `backupBytes` is unit-tested as a buffer
  writer (exact bytes, 0600, absent-source behaviour), and each of the three
  behavioural cases asserts the backup content is byte-identical to the layer
  the operation read, using a layer written with non-canonical whitespace.
  *Scope limit, recorded in D-099:* the race window between the read and the
  backup is not simulated; the tests prove the backup content equals the buffer
  that was read and merged, not that a mid-call external mutation is impossible
  (see D5).
- **DB-4** A `null` leaf in `reload_config`'s `patch` removes the corresponding
  key from the user layer, recursively. Asserted for `auth_env`, `url_env`, and
  `auth_optional` on a user-declared provider (the field is gone from the
  written layer and from the reloaded config), for a removal that restores the
  shipped declaration on a shipped provider, and for a removal of an absent key
  (no-op, no error). A `null` that would leave an invalid merged configuration
  still fails validation before any write.
- **DB-5** A patch against an unparseable on-disk layer throws before writing;
  the layer bytes are unchanged and no backup is created (REQ-113's "shall not
  write to a layer it could not read"). `migrateUserConfigLayer` follows the
  same rule: an existing layer that does not parse throws instead of silently
  returning `null` from a stale snapshot, and the file is untouched.
- **DB-6** REQ-040 carries the fresh-read, backup-bytes, and null-removal
  obligations; REQ-105 carries the backup-bytes obligation. Appendix B is
  checked by measurement, not assumption: REQ-040 measures 535 characters and
  REQ-105 738 before the amend (`wc -c` on the body line); the planned wording
  below lands at roughly 660 and 752, inside the 800 limit, and the AAR records
  the measured post-amend counts. A body that `validate-spec` rejects stops the
  increment rather than being compressed in the build. `npm run validate-spec`
  passes, and `src/config-patch.test.ts` carries named clause tags for the three
  REQ-040 obligations and `src/config-migrations.test.ts` for the REQ-105 one.
- **DB-7** The `patch` parameter description, the `reload_config` tool
  description, `README.md`, and a `DECISIONS.md` entry document the removal
  route and its shipped-declaration limit. The entry states in one sentence
  that D-098 governs a `null` stored in the layer while this decision governs a
  `null` in a patch document. `npm run validate-readme` passes.
- **DB-8** `ROADMAP.md` no longer carries § R2b-ii, and the close is recorded
  truthfully: a user-layer-declared field is clearable, a shipped-declared
  field is not, and masking it is refused by design rather than pending. The
  section is replaced by no successor because the remaining case is a standing
  fact recorded in D-099, not scheduled work; the AAR and `worklist.md` summary
  say so. § R2b-iii is unchanged; `worklist.md` marks F-R2-2 `Resolved
  2026-11-11`; `CHANGELOG.md` gains an entry under `## 2026.11.7`; the AAR
  carries the DB-clause-to-evidence table and ends `LOOP PAUSED`.
  `check-roadmap`, `check-non-goals`, and `check-loop-artifacts` pass.
- **DB-9** `npm run typecheck`, `npm run validate-spec`, `npm run
  check-gate-coverage`, `npm run check-intent-citations`, and `npm run check`
  exit 0 on the tree that ships.

**Non-closure rule.** The increment stops, the AAR ends `LOOP OPEN`, and the
surviving item is returned to § R2b-ii if it needs: a change to
`providerUsable`'s contract, a `config.json` value change, a new tool
parameter, a fixture edit, a change to `mergeLayer` as used for the
shipped-base merge, or any production edit outside the four files named in
§ Blast radius.

## Decisions

- **D1 — fresh read, not a refactor of load semantics.** `patchUserConfigLayer`
  and `migrateUserConfigLayer` read the layer file (bytes plus parsed value)
  directly instead of using the `userConfigLayer` snapshot. `loadConfigFromDisk`
  already reads once per invocation; it keeps its read and now retains the bytes
  it read. No new module-level cache and no change to the merge over the shipped
  base. *Alternative rejected:* a shared `readUserLayer()` helper threaded
  through all three paths — wider rework for the same evidence, and it would
  touch the REQ-113 recovery flow that this increment does not need to change.

- **D2 — backup is a buffer, not a copy.** Add `backupBytes(bytes, fpath)` to
  `src/lib/atomic-write.ts` (same timestamped sibling naming and 0600 mode as
  `backupFile`) and use it at the three sites. `backupFile` stays exported and
  tested because it is the generic copy helper; it simply stops being the path
  that records a config write. *Consequence:* the backup is the content that
  was merged, which is the only content a recovery needs. What the tests can
  and cannot distinguish is stated in DB-3: `backupFile` already copies raw
  bytes, so the observable contract is "the backup is the buffer that was
  read", proven by a `backupBytes` unit case plus a byte-identity assertion —
  not by a simulated race.

- **D3 — `null` in a patch removes the key.** A patch is a document, not a
  value setter: `null` means "remove this key from the user layer" (recursive,
  leaf-level), applied after the merge and before validation. This is the
  config-level route the roadmap asks for, and it needs no new tool parameter.
  *Alternatives rejected:* (a) a new `unset` array of dot paths — an additive
  tool-contract change that REQ-040's merge clause does not authorize; (b) a
  sentinel string — indistinguishable from data and would have to be rejected
  by validation everywhere; (c) deleting inside `mergeLayer` — that function
  also merges the shipped base, where a null from the layer must stay a
  validation error (D-098). *Consequence:* no config key may be set to `null`
  through a patch; validation already rejects nulls throughout the schema, so
  no capability is lost. Removal is a leaf rule over object-valued keys: a
  `null` inside an array is not a removal (arrays are replaced wholesale by
  REQ-010, and a null element still fails validation).

- **D4 — removal restores the shipped declaration; it does not mask it.**
  After a removal the merged configuration is re-derived from the shipped
  config, so a field the shipped config also declares comes back. That is
  intended: the shipped declaration is the provider's own requirement, and
  masking it would recreate the silent-bypass D-098 removed. README and
  `DECISIONS.md` state the limit and name `auth_optional: true` as the
  supported way to make a credential optional where the provider permits it.
  The roadmap bullet is delivered for a field the user layer declares;
  clearing a field the shipped configuration declares is refused by design and
  recorded as a standing fact in D-099, so § R2b-ii closes without a successor
  section (DB-8). *Out of scope:* a remove-with-mask sentinel.

- **D5 — no compare-and-swap this increment.** The window narrows from "since
  startup" to "between the fresh read and the atomic write". A re-read-and-retry
  loop would close that remaining window but adds a retry contract nothing in
  the roadmap asks for; the residual — including the fact that no test
  simulates a mid-call mutation — is recorded in `DECISIONS.md` so a later
  increment can schedule it deliberately.

- **D6 — the spec carries the obligations, in two REQs.** No new REQ: both
  bodies already own these operations (SR-011). The amendments are fixed
  wording, measured before and after (DB-6):
  - REQ-040 — `merge the patch into the user configuration layer` becomes
    `merge the patch into the user configuration layer as it exists on disk
    when the call is made`; `preserve a recoverable backup of the previous
    layer before writing` becomes `preserve a recoverable backup of the exact
    bytes it read before writing`; and one sentence is appended: *"A `null`
    value in a patch SHALL remove the corresponding key from the layer."*
  - REQ-105 — `preserve a recoverable backup of the user layer` becomes
    `preserve a recoverable backup of the exact bytes it read`.
  Appendix B limits are checked by hand before the amend and by
  `validate-spec` after; REQ-105's ~62-character headroom is the tight one, and
  the +9-character replacement above is what fits it.

   *Alternative rejected:* a new REQ for the patch document semantics — it
  would duplicate REQ-040's merge clause (SR-011, rule (c)).

## Blast radius

**Production (3 files).**
- `src/config.ts` — `patchUserConfigLayer`, `migrateUserConfigLayer`, the
  auto-migration branch of `loadConfigFromDisk`; no other function.
- `src/lib/atomic-write.ts` — one additive export (`backupBytes`).
- `src/index.ts` — `reload_config` tool description and the `patch` schema
  description only.

**Spec (1 file, two REQs).** `infobroker.md` — REQ-040 and REQ-105.

**Tests (3 files).** `src/config-patch.test.ts` (DB-1, DB-3, DB-4, DB-5 and the
clause tags), `src/config-migrations.test.ts` (DB-2, DB-3 for the migration and
startup paths, REQ-105 tag, `backupBytes` unit case), and the existing
`src/config.test.ts` REQ-113 recovery suite run as a regression (not edited).

**Documentation and bookkeeping (6 paths).** `README.md`, `DECISIONS.md`
(D-099), `CHANGELOG.md`, `ROADMAP.md`, `worklist.md`, and this increment
directory.

**Explicitly out of scope.** Credential-pool and dispatch-state rows (R2c/R2d),
the key-safety evidence and spawned-server harness (F-R2-7, R2b-iii),
`providerUsable`, the shipped `config.json`, every fixture, the validate/merge
semantics of the shipped-base merge, and any tool other than `reload_config`.

## Phases and steps

### Phase 0 — Discovery (no edits)

1. Confirm the baseline above: `git log -1`, `npm run status`, and the recorded
   `npm run check` result.
2. Confirm the three write sites and their backup calls (`src/config.ts:200`,
   `:282`, `:314`) and that no other source path calls `backupFile` for a
   config write.
3. Confirm `mergeLayer` has two calling functions — the shipped-base merges
   (`loadConfigFromDisk` and `patchUserConfigLayer`'s validation candidate) and
   the layer merge under change — across four call sites (`:196`, `:222`,
   `:310`, `:312`). A fifth call site stops the increment.
4. Discovery: sweep `src/**` and `config.json` for a config key whose legitimate
   value is `null`. A hit stops the increment (D3's consequence would be real).
5. Discovery: read REQ-040 and REQ-105 and draft the D6 sentences; count the
   amended bodies against Appendix B (≤800 characters, ≤8 sentences, ≤8 SHALL
   clauses, ≤5 backtick tokens) by hand.
6. Discovery: `src/config-migrations.test.ts` has no `migrateUserConfigLayer`
   fixture (its cases cover drift detection, `applyConfigMigrations`, and the
   atomic-write helpers); DB-2 builds its own temp-dir plus
   `INFOBROKER_CONFIG`/`INFOBROKER_CONFIG_LOCAL` fixture, using the drift
   round-trip at `:96-101` only as the reference for what counts as a change.
7. Discovery: confirm the README passages that describe `patch`
   (`README.md:386`, `:513`, the tool table at `:610`) and pick the one place
   the removal route belongs; do not add a second tutorial.
8. Sibling-contract discovery: grep the spec for every REQ binding
   `reload_config` or the patch/merge contract (REQ-037, REQ-040, REQ-105,
   REQ-113 at minimum; the §9.5 manifest row for `reload_config`) and confirm
   none contradicts fresh-read merge or null-removal. A conflict stops the
   increment rather than being resolved in the build.
9. Register discovery: confirm `docs/plans/` is tracked (`git check-ignore`
   exits 1) and that the register cross-references this plan must move together
   — `ROADMAP.md`, `worklist.md` row and any §9.5 row, `DECISIONS.md` — are all
   named in Phase 3.

### Phase 1 — Failing evidence first

1. `src/config-patch.test.ts`: DB-1 (external edit preserved), DB-3 (backup
   bytes equal the pre-patch layer with non-canonical formatting), DB-4 (three
   removal cases plus the absent-key no-op and the shipped-restore case), DB-5
   (unparseable layer refused). Run before the fix and record each observed
   result in `tasks.md`.
2. `src/config-migrations.test.ts`: DB-2 (external edit preserved across the
   migration), DB-3 for the explicit-migration and startup-auto-migration
   backups, and the `backupBytes` unit case (0600, exact bytes, absent source
   behaviour). Record the pre-fix results.

### Phase 2 — Fix

1. `src/lib/atomic-write.ts`: add `backupBytes`.
2. `src/config.ts`: fresh read in `patchUserConfigLayer` and
   `migrateUserConfigLayer`; bytes retained in `loadConfigFromDisk`; backups via
   `backupBytes` at all three sites; null-removal normalization in the patch
   path.
3. `infobroker.md`: REQ-040 and REQ-105 amendments (D6).
4. `src/index.ts`: tool description and `patch` schema description.
5. Re-run both suites; every Phase 1 case passes.

### Phase 3 — Verification and documentation

1. Audit `git diff --stat` **and** `git status --porcelain` (the plan directory
   is untracked and does not appear in the diff) against § Blast radius before
   any bookkeeping edit.
2. Targeted suites: `src/config-patch.test.ts`, `src/config-migrations.test.ts`,
   `src/config.test.ts`.
3. `npm run typecheck`, `npm run validate-spec`, `npm run check-gate-coverage`,
   `npm run check-intent-citations`.
4. `README.md`: the removal route and the shipped-declaration limit, in the one
   passage chosen in Phase 0; `npm run validate-readme`.
5. `DECISIONS.md`: D-099 (patch null-removal, backup bytes, residual
   read-to-write window).
6. `CHANGELOG.md`: one entry under `## 2026.11.7`.
7. `ROADMAP.md`: remove § R2b-ii, leave § R2b-iii; `npm run check-roadmap` and
   `npm run check-non-goals`.
8. `worklist.md`: F-R2-2 → `Resolved 2026-11-11` with a one-line summary;
   refresh its anchor to the post-change symbol or range.
9. `aar.md`: the DB-clause-to-evidence table, dispositions, and the LOOP token.
10. Final `npm run check` and `npm run check-loop-artifacts` on the tree that
    ships.

### Phase 4 — Commit series

1. **Write ordering and removal route** — `infobroker.md`, `src/config.ts`,
   `src/lib/atomic-write.ts`, `src/index.ts`, both test files, `CHANGELOG.md`,
   staged by explicit path. Gate: `npm run typecheck`, `npm run
   validate-spec`, the two targeted suites.
2. **Documentation and record** — `README.md`, `DECISIONS.md`, `ROADMAP.md`,
   `worklist.md`, this plan directory. Gate: `npm run check` on the tree that
   ships.

## Conditions

- **C-1** Pre-fix results are recorded as observed. A case already green is kept
  as regression evidence with its reason in `tasks.md`.
- **C-2** No fixture, shipped `config.json` value, or other tool is edited. A
  hit stops the increment.
- **C-3** The non-closure rule is audited by Phase 3 step 1, before bookkeeping.
- **C-4** The four clause tags are part of the deliverable: `REQ-040
  fresh-layer`, `REQ-040 backup-bytes`, `REQ-040 patch-null-removal` in
  `src/config-patch.test.ts`, and `REQ-105 backup-bytes` in
  `src/config-migrations.test.ts`.
- **C-5** The cold pass runs at standard depth once, and at most one re-audit
  of the failed stages runs after it. A second failure stops and reports.

## User impact

A configuration patch no longer discards an edit made to the user layer since
the server started; the backup it leaves is the layer it actually merged. A
patch may now set a key to `null` to remove it from the user layer — the
supported way to clear a declared `auth_env`, `url_env`, or `auth_optional` on
a provider the user layer declares. For a field the shipped configuration also
declares, removal restores the shipped declaration rather than disabling it;
`auth_optional: true` remains the supported route where the provider permits an
optional credential. A patch against an unreadable layer is refused instead of
overwriting it. No tool parameter, config key, environment-variable name,
response field, or wire format changes; a running server needs no restart
beyond the `reload_config` call it already makes.

## Rollback

Revert the two commits. The production change is one new helper and three call
sites; the spec change is three sentences; no persisted state, schema, or wire
format changes, so a revert restores the prior behavior with no data migration.
Backup files written by the new path are unchanged in content — they are the
same bytes `backupFile` would have copied in the absence of a concurrent edit —
and no code consumes them automatically.

## Verification summary

| Clause | How it is verified |
|---|---|
| DB-1 | `config-patch.test.ts` — external edit survives the patch; red before |
| DB-2 | `config-migrations.test.ts` — external edit survives the migration; red before |
| DB-3 | both test files — backup content equals the buffer read (byte-identical, non-canonical formatting); `backupBytes` unit case checks exact bytes and 0600; race not simulated (D5) |
| DB-4 | `config-patch.test.ts` — three field removals, shipped-restore, absent-key no-op, invalid-merged rejection |
| DB-5 | `config-patch.test.ts` — throw, bytes unchanged, no backup |
| DB-6 | `infobroker.md` diff; `validate-spec`; the four clause tags (C-4) |
| DB-7 | `src/index.ts` descriptions; `README.md`; `DECISIONS.md`; `validate-readme` |
| DB-8 | roadmap/worklist/changelog diffs; AAR table; `check-roadmap`, `check-non-goals`, `check-loop-artifacts` |
| DB-9 | `typecheck`, `validate-spec`, `check-gate-coverage`, `check-intent-citations`, `npm run check` |
