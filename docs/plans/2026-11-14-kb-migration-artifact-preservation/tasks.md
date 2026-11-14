# Tasks — KB migration artifact preservation under encryption

- [x] Step 0.1 `npm run status` and `npm run check` baseline recorded in `plan.md`; tree clean apart from the increment directory.
- [x] Step 0.2 Plan review: `plan-review passed.` — standard depth, independence fresh, five stages in a cold context (30/40 reads), cold report `plan.cold/report.md` sha256 `2989d76b…`, plan sha256 `e91a8236…`. Nine findings (3 Major, 5 Minor, 1 Nit), all resolved before the stamp.
- [x] Step 0.3 REQ-108 measured before the edit: 707 chars / 5 sentences / 7 SHALLs (validator definition, `scripts/validate-spec.ts:253-255`). After: 772 / 6 / 8.
- [x] Step 1.1 `src/kb-migrate.ts`: `writeMigrationArtifact` (temp → fsync → rename → dir fsync, mode 0600, temp cleanup on failure) and the seal branch; plaintext source removed in `finally`; event names the artifact or the discard reason.
- [x] Step 1.2 Already-encrypted legacy source: re-sealed uniformly under the migration key and written with the `.enc` suffix.
- [x] Step 1.3 `infobroker.md`: `A preserved artifact SHALL be sealed when encryption is enabled.` appended to REQ-108; `npm run validate-spec` passes.
- [x] Step 1.4 D6: `scripts/lib/kb-seed.ts` extracted; `scripts/benchmark-kb-store.ts` uses it and skips `*.enc` seeds; `--help` updated.
- [x] Step 2.1 Rewrote `src/kb-migrate.test.ts` encrypted-migration test: no plaintext left, one `.enc` artifact, round-trips through `openEnvelope`, survives a re-open.
- [x] Step 2.2 Added the already-encrypted legacy case.
- [x] Step 2.3 Added the seal-failure case through the injected `writeArtifact` seam.
- [x] Step 2.4 Added the atomicity case (inode changes on replacement; no partial final name).
- [x] Step 2.5 Added `scripts/lib/kb-seed.test.ts` (sealed artifact sorting newer, live store preference, sealed-only directory).
- [x] Step 2.6 Mutation proofs, all recorded: seal step removed → 3 failed; `.enc` suffix removed → 2 failed; temp+rename replaced by a direct write → 1 failed; benchmark `.enc` filter removed → 2 failed; restored → 7/7 and 3/3 pass.
- [x] Step 3.1 `DECISIONS.md` D-118; `CHANGELOG.md` entry; `worklist.md` `F-R6-E-2` → `Resolved`; `ROADMAP.md` section removed (5 → 4 sections including `## Non-goals`).
- [x] Step 3.2 `npm run check:fast` → PASS, 19 gates, 28.8 s. `npm run typecheck` and `npm run typecheck:scripts` clean.
- [x] Step 4.1 Split commits: source+tests, spec, docs (DECISIONS/CHANGELOG/ROADMAP/worklist), plan artifacts.
- [x] Step 4.2 `aar.md` with findings and dispositions, ending `LOOP PAUSED` or `LOOP OPEN`.
