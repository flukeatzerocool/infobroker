# AAR — R2b-ii user-layer write ordering

**Status:** execution complete 2026-11-11. Plan revision 2, cold-reviewed and
re-audited under a one-pass cap.

## What happened

The increment closed F-R2-2 and the roadmap's unset bullet. The patch and the
opt-in migration now read the user layer from disk when they are called instead
of merging over the startup snapshot; every config write backs up the exact
bytes it read through a new `backupBytes`; and a `null` leaf in a patch removes
the key, which is the config-level route to clear a declared auth field. REQ-040
and REQ-105 carry the obligations. Ten new test cases were written red first;
seven were red on the patch path and three on the migration path, and the three
that were already green are recorded as regression evidence.

## Done-bar evidence

| Clause | Evidence |
|---|---|
| DB-1 | `config-patch.test.ts` → "merges over an edit made to the layer after startup"; red before (external key lost), green after |
| DB-2 | `config-migrations.test.ts` → "applies migrations over an edit made after startup"; red before, green after |
| DB-3 | `backupBytes` unit case (exact bytes, 0600) plus byte-identity assertions on the patch, explicit-migration, and startup-auto-migration backups; race window recorded as unsimulated in D-099 |
| DB-4 | `config-patch.test.ts` → three field removals, shipped-restore, absent-key no-op, invalid-merged rejection; all green |
| DB-5 | `config-patch.test.ts` → "refuses to patch an unparseable on-disk layer"; `config-migrations.test.ts` → "refuses to migrate an unparseable on-disk layer" |
| DB-6 | REQ-040 measured 660 characters, REQ-105 746, both inside Appendix B; `validate-spec` all checks passed; four clause tags (`REQ-040 fresh-layer`, `backup-bytes`, `patch-null-removal`, `REQ-105 backup-bytes`) |
| DB-7 | `src/index.ts` tool description and `patch` schema description; `README.md` hot-reload paragraph; `DECISIONS.md` D-099 (which scopes D-098 explicitly); `validate-readme` 0 errors |
| DB-8 | § R2b-ii removed, § R2b-iii untouched; F-R2-2 `Resolved 2026-11-11`; CHANGELOG entry; `check-roadmap`, `check-non-goals`, `check-loop-artifacts` pass |
| DB-9 | `typecheck` 0; `validate-spec` passed; `check-intent-citations` 0 findings; `npm run check` PASS (full, 22 gates) |

## What went right

- The cold pass earned its cost: it caught that DB-3's original test proved
  nothing (`backupFile` already copies raw bytes) and that REQ-105 had only ~62
  characters of headroom. Both were fixed before the first edit.
- The one-pass cap held. Revision 1 failed, the single re-audit passed, and no
  third pass ran — the previous increment's seven-pass loop did not repeat.
- Writing the tests red first made the plan's naive `backupBytes` unit case the
  only genuine red for DB-3, and the other two backup assertions were recorded
  as regression evidence rather than being overstated.

## What went wrong

- The first append of the patch tests was written with a helper that read the
  env var before it was set and an invalid-removal case that could never fail
  (the base declared the provider). Both were caught by running the suite
  immediately, but a review of the test text before running would have been
  cheaper.
- The worklist predicate still cites the pre-change anchor `src/config.ts:308`;
  the disposition cell carries the post-change anchors, but the predicate cell
  was left as the finding record.

## Dispositions

| Item | Disposition |
|---|---|
| F-R2-2 | `Resolved` — this increment |
| F-R2-7 | Scheduled — § R2b-iii, untouched |
| Shipped-declaration masking | Closed as by-design — D-099 (standing fact, not scheduled work) |
| Read-to-write race (CAS) | Closed as accepted residual — D-099, no test simulates it |
| Worklist predicate anchor | P3 informational — the disposition cell carries the new anchors |

## Recommendations

None that start new work. The next increment for this area is § R2b-iii, whose
trigger waits on § R2c and § R8.

## Loop status

LOOP PAUSED
