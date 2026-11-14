# Plan — KB migration artifact preservation under encryption

**Status:** plan-review passed (standard, cold pass) — conditions in `## Conditions` · **Date:** 2026-11-14
**Depth:** standard — one migration function, one benchmark seed selector, one spec sentence, one test file; one branch deletes user data, so the change is not purely additive
**Review independence:** fresh — five stages in a cold context (30/40 reads), no Blockers; report under `plan.cold/`
**Rollback cost:** 2 — a commit revert restores both behaviors, but the shipped behavior deletes a user artifact, so the branch must be decided deliberately (D-092 precedent: a corrected behavior is a new version, not a rewrite)
**Roadmap item:** `ROADMAP.md` § KB migration preservation decision (retire on close)
**Predecessor:** `487c597` (fetch/KB resource bounds close, `LOOP PAUSED`)
**Finding:** `F-R6-E-2` (`docs/plans/2026-11-09-full-review-sweep/worklist.md:822`, `Scheduled-roadmap`)

## Scope

One decision and one behavior. When at-rest encryption is enabled at upgrade time, the legacy-JSON migration currently renames the plaintext store to `vector-store.json.migrated-<ts>` and immediately unlinks it (`src/kb-migrate.ts:171-176`). That satisfies REQ-084's no-plaintext rule and violates the register's clause (b) — REQ-108's preservation sentence. The increment decides which rule wins, implements it, and closes the register row.

Not in scope: the `.sqlite.enc` corruption-backup naming (decided in the R6 increment), the rekey path, the plaintext-archive sweep's behavior for leftovers, and any change to how a legacy store is read.

## Baseline (verified this session)

- `git log -1` → `487c597`; `npm run status` → 213 unpushed commits, oldest 4.7 d, version 2026.11.11 (latest tag v2026.11.07), 4 open roadmap items, last pipeline run 2026-11-07.
- The 4.7 d unpushed backlog is past the 24 h AAR trigger in AGENTS; the trigger is noted here and handled at session close, not folded into this increment.
- `npm run check` → 21 of 22 gates passed; the single failure was `check-loop-artifacts`, caused by this increment directory existing without an `aar.md` mid-run. With the directory moved aside, `npm run check-loop-artifacts` reports 0 errors at `487c597` (one pre-existing warning: `2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:** line`).
- Working tree clean before the plan artifacts were written.
- `ROADMAP.md:17-21` is the first scheduled section and names `F-R6-E-2` only.

### Evidence read this session

| Claim | Evidence |
|---|---|
| Encryption-enabled migration deletes the artifact | `src/kb-migrate.ts:171-176` — rename, then `unlinkSync` only when `encryptionEnabled` |
| The deletion is unconditional, even when the legacy file was already ciphertext | `src/kb-migrate.ts:75-101` decrypts an `INFOKB1` envelope into `clear`, but `:173` unlinks the (already sealed) source regardless |
| A surviving plaintext archive would be reaped on the next encrypted open | `src/kb-sqlite.ts:1155-1170` `removePlaintextArchives()` tests `isKbArchiveArtifact` / `ARCHIVE_RE` (`src/kb-store.ts:79-88`), which includes `vector-store\.json\.migrated-\d+` |
| A non-archive suffix is the established convention for a ciphertext artifact | `src/kb-sqlite.ts:339-346` writes an encrypted store's corruption backup as `.sqlite.enc` so the sweep does not reap it; `src/kb-sqlite.test.ts:72-73` asserts `.sqlite.enc` is *not* an archive artifact |
| The benchmark selects the newest `vector-store.json.migrated-*` as its legacy seed | `scripts/benchmark-kb-store.ts:141-150`, copied in at `:236` |
| The current test asserts the deletion while its name claims preservation | `src/kb-migrate.test.ts:77-92` — title says "without deleting its source", assertions demand `existsSync(...json) === false` and no `.migrated-` file |
| REQ-084 requires no plaintext persistence when encryption is enabled | `infobroker.md:613` |
| REQ-108 requires the prior store be preserved as a recoverable artifact at upgrade time | `infobroker.md:625` |

## Decision

**D1 — REQ-084 wins over plaintext preservation; REQ-108 still wins on recoverability, because the artifact is preserved sealed.** A plaintext artifact is not an option: REQ-084 says the server SHALL NOT persist KB content in plaintext when encryption is enabled, and the migrated JSON is exactly that content. Deleting it, however, also loses the upgrade artifact REQ-108 requires. Both are satisfiable at once because the plaintext bytes are already in memory (`clear`, `src/kb-migrate.ts:74-101`) and the migration key is already resolved (`:131-144`): the artifact is written as a sealed envelope under the migration key, named `vector-store.json.migrated-<ts>.enc` — it keeps the `migrated-` prefix and adds `.enc`, because the trailing suffix is what keeps the name out of `ARCHIVE_RE` (`src/kb-store.ts:79-80`) and therefore out of the plaintext sweep. The write is atomic (temp file → `fsync` → `rename` → directory `fsync`) per REQ-085, so an interrupted write leaves no partial artifact. The event reports the artifact path and states that it is sealed.

- Rejected: keep the plaintext artifact — violates REQ-084 outright.
- Rejected: keep the current delete-and-report — violates REQ-108's preservation sentence and destroys the only recoverable copy at the moment the store format changes.
- Rejected: amend REQ-108 with an encryption carve-out — cheapest, but the sealed branch costs one `sealEnvelope` call on bytes already in memory and keeps both guarantees. A carve-out would be chosen only if sealing could not complete; that fallback is D2.
- Rejected: leave the already-encrypted legacy source in place with its current name — the name matches `ARCHIVE_RE`, so the next encrypted open would delete it anyway (`src/kb-sqlite.ts:1155-1170`); it must carry the `.enc` suffix too.

**D2 — A failed seal loses the artifact, never the guarantee.** If sealing or writing the artifact throws, the plaintext migrated file is still unlinked, the migration still reports `migrated`, and the event says the artifact could not be preserved and why. REQ-084 is a security invariant and REQ-108 is a recoverability property; the failure mode must fall toward the invariant. The test proves the no-plaintext half on that branch; the lost-artifact half is reported, not silent.

**D3 — Retention and key binding are recorded, not engineered.** The sealed artifact is a complete copy of the migrated content, is bound to the key in effect at migration, and is never reaped automatically (its name is outside `ARCHIVE_RE`). A later `rekey` does not reseal it, so it stops opening under the new secret and becomes dead weight equal to the legacy store's size. Resealing archives on rekey and an automatic reclaim policy are both out of scope, so the decision record states the retention rule plainly: the artifact is removed only by the operator, the event names its absolute path so that is possible, and the migration-time secret is the recovery secret. No roadmap item is filed — this is a standing decision, not scheduled work.

**D4 — REQ-108 gains one sentence so the contract states what the code does.** Appended: `A preserved artifact SHALL be sealed when encryption is enabled.` Measured with the validator's definition (`scripts/validate-spec.ts:253-255`: body trimmed, sliced at `_Check:`): 707 chars / 5 sentences / 7 SHALLs today → 772 / 6 / 8 after, inside Appendix B (800 / 8 / 8). No trimming of existing prose, and no REQ-084 edit: its no-plaintext clause is already the winning rule and does not need to name artifacts.

**D5 — The `.enc` artifact stays out of `ARCHIVE_RE` / `isKbArchiveArtifact`.** That predicate is what `removePlaintextArchives()` tests, so adding the artifact to it would make the next encrypted open delete the artifact — the opposite of the intent. `isKbStoreArtifact` is only the shipped-KB gate's predicate and is not the deletion mechanism. The artifact holds no plaintext and the storage path is user-scoped outside the repository tree, so `check-shipped-kb-empty` is unaffected — the same omission already accepted for `vector-store.corrupt-<ts>.sqlite.enc` (`docs/plans/2026-11-10-r6-encryption-capacity-remediation/plan.md:200`).

**D6 — The benchmark's seed selector must ignore sealed artifacts.** `scripts/benchmark-kb-store.ts:141-150` picks the lexicographically newest `vector-store.json.migrated-*` as its legacy-JSON seed; after this change that can be a ciphertext `.enc` file, and the plaintext benchmark lane would parse garbage, take the corrupt branch, and measure an empty store. The selector adds an `.enc` exclusion, and a test proves a sealed artifact is never chosen as a legacy seed.

## Blast radius

- `src/kb-migrate.ts` — artifact seal/write branch (atomic, `.enc` name), event text, one exported `writeMigrationArtifact` helper so the failure branch is testable at a named seam.
- `src/kb-migrate.test.ts` — the mis-named encrypted-migration test is rewritten; three cases added (already-encrypted legacy, survives-reopen, seal failure).
- `scripts/benchmark-kb-store.ts` — `.enc` excluded from seed selection (D6).
- `infobroker.md` — one sentence on REQ-108.
- `DECISIONS.md` — one decision record (D1–D3, D5, D6).
- `CHANGELOG.md`, `ROADMAP.md`, `docs/plans/2026-11-09-full-review-sweep/worklist.md` — release notes, section retirement, row closure.
- Not touched: `src/kb-sqlite.ts`, `src/kb-store.ts`, `src/kb.ts`, `src/kb-crypto.ts`.

## Done bar

**Done bar:** All of the following hold on the final tree:

1. `F-R6-E-2` is marked `Resolved` in `worklist.md`, naming the test and line that prove it.
2. After a plaintext legacy store is migrated with encryption enabled, the directory contains no plaintext `vector-store.json` and no `vector-store.json.migrated-*` without the `.enc` suffix, and exactly one `vector-store.json.migrated-<ts>.enc` artifact.
3. That artifact opens with the migration key through `openEnvelope` and round-trips byte-identical to the original legacy JSON; the status event names its path and reports the seal.
4. A legacy store that was already an `INFOKB1` envelope is preserved as a ciphertext artifact under the `.enc` suffix, and the artifact survives a re-open of the encrypted store (the sweep does not reap it).
5. A seal or artifact-write failure leaves no plaintext behind, still reports `migrated`, and the event states that the artifact was discarded and why.
6. The encryption-disabled migration test (`src/kb-migrate.test.ts:58-75`) and the corrupt-store test (`:113-124`) pass unmodified.
7. The artifact is written atomically: an interrupted write is not observable as a partial `*.enc` file (a temp file may remain, never a truncated final name).
8. A benchmark store directory whose newest `vector-store.json.migrated-*` name is a sealed `.enc` artifact never yields that artifact as a legacy seed (D6).
9. `ROADMAP.md` drops the section (4 work items → 3); `CHANGELOG.md` gains one entry; REQ-108 carries the D4 sentence and re-measures to 772 chars; `DECISIONS.md` records D1–D3, D5, and D6 including the retention rule and the rekey caveat.
10. Each new assertion fails under a recorded source mutation (seal step removed; `.enc` suffix removed; atomic rename replaced by a direct write; benchmark `.enc` filter removed) and passes on the restored tree.
11. `npm run check:fast` exits 0 on the final tree and `npm run validate-spec` passes.
12. `docs/plans/2026-11-14-kb-migration-artifact-preservation/` carries `plan.md`, `tasks.md`, and an `aar.md` ending `LOOP PAUSED` or `LOOP OPEN`.

**Review cap:** 2 passes (the plan gate, and the post-build AAR review). A third dispatch needs user authorization recorded in the AAR.

## Conditions

- **C-1** — an assertion that fails on the unmodified tree exposes a real defect; fix the defect and amend the plan, never weaken the assertion to green.
- **C-2** — if `sealEnvelope` or the envelope format would also need to change, the increment stops and reports; the format is shared with the live store.
- **C-3** — the seal-failure test uses a named seam: `writeMigrationArtifact` is exported from `src/kb-migrate.ts`, and the test replaces it (module mock or injected callback) so an artifact write throws deterministically. A read-only-directory simulation is *not* the primary proof, because a root-run runner would silently skip it. If proving the branch needs a signature change beyond exporting the helper, that is out of scope and the case is reported as unproven rather than approximated.
- **C-4** — `npm run check` (full) is the pre-push gate; if the registry-backed audit cannot run, `check:fast` plus `test-debate-club` are the terminal gates and the AAR says so.
