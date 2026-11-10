# Plan — R6 encryption and capacity remediation

**Status:** plan-review passed — deep, independence fresh (`plan.cold/report.md`); conditions to confirm at build time are listed under Conditions · **Date:** 2026-11-10
**Depth:** deep — a store-format marker, a security-transition fix, and a corruption-recovery rule in the SQLite backend
**Review independence:** fresh — five stages in fresh contexts across ten dispatches; readiness GO on the fourth check
**Rollback cost:** 2 — a commit revert restores the code, but the corruption branch renames a user's store file, so the change is not a pure add
**Roadmap item:** `ROADMAP.md` § R6 encryption and capacity remediation (retire on close)
**Predecessor:** `03cfc0d` (R6 retrieval close, `LOOP PAUSED`). Every review-sweep chunk (R1–R9, M1) is closed, so the section's trigger — "start after chunk R7 closes" — is satisfied; it also sits first among the scheduled sections.

**Scope note.** The section's name is inherited from the R6 register. Its three IDs are F-R6-D-1, F-R6-D-2, and F-R6-E-1; the capacity row F-R6-E-4 (heap-bounded search) is **not** in this section and stays `Scheduled-roadmap`. No capacity behavior changes here.

## Baseline (verified this session)

- `git log -1` → `03cfc0d`; 48 unpushed commits, oldest 22.5 h; version 2026.11.7; 23 open roadmap items (24 `##` sections including `## Non-goals`); last pipeline run 2026-11-07.
- `npm run check` → PASS, 22 gates, 72.7 s, run recorded for `03cfc0d`.
- `npm run validate-spec` → 142 REQs (15 artifact-exempt), 127 cited, 0 source files without `@implements`.
- Working tree clean before the plan artifacts were written; the increment directory is the only addition.
- `ROADMAP.md:17-23` is the first scheduled section and names exactly F-R6-D-1, F-R6-D-2, and F-R6-E-1.
- `docs/plans/2026-11-09-full-review-sweep/worklist.md` carries those three rows as `Scheduled-roadmap` (R6 register block).

### Probe evidence (`probe.ts` / `probe-log.md`, run this session)

| Probe | Result |
|---|---|
| **P1** zero-length `vector-store.sqlite` | `init()` succeeds, creates `-wal`/`-shm`, leaves `meta` empty — no marker, and the read-write open already wrote to the directory |
| **P2** seeded store truncated to 600 bytes (header intact) | `init()` throws `ERR_SQLITE_ERROR` `errcode 11` ("database disk image is malformed"); no backup, no event; `src/kb.ts:418-426` turns it into `config_error` "could not be opened" and the store stays unusable |
| **P3** 38 bytes of text in `vector-store.sqlite` | `errcode 26` `SQLITE_NOTADB` ("file is not a database"); no backup, no event |
| **P4** page 2 of a seeded store zeroed | `errcode 11`; the failed open still left `-wal`/`-shm` behind while the main file's sha256 was unchanged — hashing the main file alone does not prove the store was untouched |
| **P5** `PRAGMA quick_check` on a read-only handle over a store with page 2 zeroed | throws `errcode 11`; a plain `SELECT count(*) FROM sqlite_master` returns successfully, so an open plus a schema read does **not** detect page damage — only an integrity read does |
| **P6** `sqliteStoreFormat()` on a cleanly closed WAL store | the read-only open creates `-wal`/`-shm`; it reports `plaintext` for a corrupt-but-magic file |
| **P7** first 100 bytes read with `openSync`/`readSync` | magic `SQLite format 3\0` and `user_version` at offset 60 are readable with no SQLite handle and no sidecar; a store written today reports `user_version = 0` |
| **P8** enable encryption, append 2 events, `rekey` | `events()` returns `[]`; after reopening, still `[]` — the rows remain but no longer open under any current key |
| **P8 (cont.)** re-open after rekey, then `disableEncryption` | `events()` renders `INFOKB1…` ciphertext strings: rows keep `encrypted = 1`, the row key becomes `Buffer.alloc(0)`, and `events()` opens garbage with an empty key |

This reproduces F-R6-D-1 (event history lost on rekey, ciphertext after disable), F-R6-D-2 (no marker; the read-write open touches the directory before any verification), and F-R6-E-1 (a corrupt live store has no REQ-108 recovery path) by observation, not by reading code alone.

## Done bar

**Done bar.** All of the following hold on the final tree:

1. F-R6-D-1, F-R6-D-2, and F-R6-E-1 are marked `Resolved` in `worklist.md`, each naming the test that proves it.
2. Each fix fails under a recorded source mutation and passes on the restored tree.
3. A rekey preserves every readable event message verbatim; an unreadable legacy row is left byte-for-byte intact and still unreadable; a disable renders every readable message as plaintext (never `INFOKB1` ciphertext).
4. A store whose header `user_version` is newer than this build is refused with the directory listing and every `vector-store.sqlite*` hash unchanged, and no sidecar created by `init()`.
5. A recognized-but-corrupt live store is renamed to a `vector-store.corrupt-<ts>.sqlite` or `.sqlite.enc` backup, replaced by an empty working store in the same call, and reported by a status event carrying the backup's absolute path.
6. A non-SQLite file still produces a lock error and leaves the file untouched; a missing or wrong key still fails before any row is written.
7. `ROADMAP.md` drops the section (23 work items → 22); `CHANGELOG.md` gains one entry naming the three behavior changes; REQ-085 carries the one-sentence clarification from D6.
8. `npm run check:fast` exits 0 on the final tree, `npm run test-debate-club` passes, and `npm run check` exits 0 when the audit probe answers (C-2 otherwise).
9. `docs/plans/2026-11-10-r6-encryption-capacity-remediation/` carries `plan.md`, `tasks.md`, and an AAR ending `LOOP PAUSED` or `LOOP OPEN`.

**Conditions:**

- **C-1** — an assertion that fails on the unmodified tree exposes a real defect; the defect is fixed in this increment and the plan amended, never weakened to green.
- **C-2** — the audit probe is one `npm audit --json` run with a 60 s timeout, executed as Phase 5 step 0 and recorded in `probe-log.md`. If it cannot reach the registry, the full `npm run check` is recorded as not-run for that reason and `check:fast` plus `test-debate-club` are the terminal gates; the AAR says so.
- **C-3** — the recovery rule is decided in this plan, not deferred: the header split in D4 plus the REQ-085 sentence in D6. If a reviewer shows that renaming a recognized-but-corrupt store still contradicts the amended REQ-085, the branch is narrowed to the encryption-disabled case (mirroring `src/kb-migrate.ts:110-123`) and the limitation is written into the F-R6-E-1 worklist row and the AAR. Silent narrowing is not permitted.
- **C-4** — the refusal proof is directory-level: before and after a refused `init()`, every name matching `vector-store.sqlite*` and its sha256 are identical, and no sidecar appears (P4 shows the main hash can be unchanged while sidecars appear). The guarantee is scoped to `init()`; P6 shows `sqliteStoreFormat()`'s pre-existing read-only open creates sidecars on the no-key path, which is recorded as a P3 informational finding in the AAR rather than widened into this increment.
- **C-5** — the cold pass runs in fresh contexts; if the harness cannot create one, the run records `independent-review NOT_RUN.` and the plan does not claim `independence: fresh`.
- **C-6** — D6 edits one REQ-085 sentence. Before commit, the body is re-measured against Appendix B (currently 657 chars, 3 sentences, 5 SHALLs; the addition is 73 chars and 1 SHALL), `npm run validate-spec` is re-run, and the push pipeline's spec→README binding applies when the change ships through `npm run prep`.

## Findings in scope

| ID | Predicate (verified by reading the code and by the probes above) | Fix |
|---|---|---|
| F-R6-D-1 | `resealAll` decodes and re-encodes chunks, claims, claim sources, and report receipts, but never reads or rewrites the `events` table (`src/kb-sqlite.ts:702-808`); rekey leaves the history unreadable, and disable leaves `encrypted = 1` rows that `events()` opens with the empty row key (`:407-423`) | Behavior change (`src/kb-sqlite.ts`), unit test |
| F-R6-D-2 | There is no persisted store-format marker; `init()` opens the file read-write and runs `PRAGMA journal_mode` plus the DDL before any verification (`src/kb-sqlite.ts:105-111`), so a newer store would be rewritten (P4: even a failed open creates sidecars), contrary to REQ-085's last sentence | Behavior change (`src/kb-sqlite.ts`), unit test |
| F-R6-E-1 | A corrupt live store surfaces as `config_error` "could not be opened" with no backup, no empty-store continuation, and no event (`src/kb.ts:418-426`); the legacy JSON path already has that shape (`src/kb-migrate.ts:110-123`) | Behavior change (`src/kb-sqlite.ts`, `src/kb.ts`), unit + tool-level test |

## Design decisions

**D1 — Event history reseals in the same transaction as every other row, and an already-unreadable row never blocks the transition.** `resealAll` decodes the `events` rows under the current key before the key switch, then rewrites `message` and `encrypted` under the next key inside the existing transaction. A row marked encrypted that does not open under the current key — the residue any build without this fix leaves behind, including today's — is preserved byte-for-byte and keeps its flag; it is not dropped by the transition, not re-encoded, and does not abort it, because a store that already holds such a row could otherwise never be rekeyed or disabled. The newest-100 retention (`src/kb-sqlite.ts:404`) still applies to every row, preserved ones included, so the row survives the transition but is not exempt from ordinary retention. The `resealAll` header comment (`src/kb-sqlite.ts:694-701`) is rewritten in the same commit: it currently promises that "any undecodable row aborts the transition", which stays true for chunks, claims, edges, and receipts and becomes false for events, and the asymmetry is stated there with the reason. Preserving the row is accepted *because it was already unreadable* — the transition still replaces the salt and check (`src/kb-sqlite.ts:795-799`, `:850`), so the row remains undecodable, and the test asserts exactly that rather than assuming the bytes are also interpretable. Rejected: dropping unreadable history and reporting it — REQ-084 and REQ-086 both require a secret change "without loss of stored content". Rejected: aborting on any undecodable event, mirroring chunks — it would make the pre-existing defect permanent. Rejected: resealing events outside the transaction — a failure would leave the key switch recorded in `meta` while history stays under the old key.

**D2 — `events()` never renders ciphertext as text.** A row is opened only when it is marked encrypted, a non-empty row key is present, and decryption succeeds; otherwise the row is skipped — the behavior the existing catch already declares ("a single unreadable event is skipped", `src/kb-sqlite.ts:407-423`). Row opening is authenticated: `openRow` → `openEnvelope` seals with AES-256-GCM (`src/kb-row-crypto.ts:1-30`), so a wrong key throws rather than returning plausible bytes; the non-empty-key check covers the exact empty-`Buffer` residue P8 exhibits. This closes the mojibake leg for any store the reseal rule cannot reach. Rejected: throwing when a marked row cannot be opened — REQ-103's degrade-don't-fail posture and the existing skip both say one unreadable event is not fatal to `stats`. Rejected: rewriting the flag to `encrypted = 0` — that would surface ciphertext as if it were plaintext.

**D3 — The persisted marker is the SQLite header's `user_version`, read without opening the database.** `SQLITE_FORMAT_VERSION = 1` is set with `PRAGMA user_version = 1` at creation (the pragma is transactional, so it commits with the schema). Detection reads the first 100 bytes with `openSync`/`readSync` and parses `user_version` at offset 60 — the P7 probe shows this needs no SQLite handle and creates no sidecar. Every store written before this change reports 0 (P7), so 0 is the reserved legacy marker and is read as version 1: `marker ≤ SQLITE_FORMAT_VERSION` is supported, `marker > SQLITE_FORMAT_VERSION` is a fail-closed refusal (D4). Nothing is written on open, so REQ-108's upgrade-backup clause is not triggered; the `ok` branch still runs the existing `PRAGMA journal_mode` / `PRAGMA secure_delete` and the idempotent `CREATE TABLE IF NOT EXISTS` DDL (`src/kb-sqlite.ts:108-111`), which changes no marker and no row. **Ordering rule:** `init()` runs the probe first, then opens read-write and applies the pragmas and DDL on an `ok` result, and only then enters the existing encryption bootstrap (salt/marker read, key verification, `enableEncryption`, `removePlaintextArchives`). "Nothing is written on open" therefore means no marker and no stored row; the header bytes and journal mode that today's build already writes on an `ok` open are not part of the guarantee, and a missing or wrong key still fails before any row is written, exactly as it does today. Rejected: a `meta` row — determining it requires a SQLite open, which creates `-wal`/`-shm` on a WAL store (P6) and makes the "not touched" guarantee unprovable. Rejected: retro-writing the marker on first open — that is an upgrade and would owe a recoverable artifact plus an event, widening this increment into F-R6-E-3.

**D4 — Classification is header-first, fail-closed, and decides recovery vs lock.** `probeStoreFile(path, open)` returns a discriminated result and does not throw for a classified state. The read-only open is followed by `PRAGMA quick_check`, because P5 shows an open plus a schema read succeeds over a store with a damaged page — only the integrity read detects it:

| Observation | State | Outcome |
|---|---|---|
| no file, or a zero-byte file | `new` | create read-write, schema, marker |
| non-empty file whose first 16 bytes ≠ `SQLite format 3\0` — which includes any file shorter than the 16-byte magic | `unrecognized` | lock error, file untouched (REQ-085; `SQLITE_NOTADB` is this case) |
| magic present, `user_version` > `SQLITE_FORMAT_VERSION` | `newer` | lock error, file untouched (REQ-085 last sentence) |
| magic present, fewer than 100 readable bytes (marker unreadable, truncated header) | `corrupt` | REQ-108 recovery |
| magic present, supported marker, `readOnly: true` open fails with `SQLITE_CORRUPT` 11 | `corrupt` | REQ-108 recovery |
| magic present, supported marker, open succeeds but `PRAGMA quick_check` returns any row other than `ok` or throws 11 | `corrupt` | REQ-108 recovery |
| magic present, supported marker, any other open failure — `SQLITE_IOERR` 10, `SQLITE_BUSY` 5, `SQLITE_LOCKED` 6, `SQLITE_PERM` 3, `SQLITE_CANTOPEN` 14, or an unclassified error | `locked` | lock error; **never renamed** |
| magic present, supported marker, read-only open and marker read succeed | `ok` | open read-write, no marker or data write until a mutation |

The probe records which `-wal`/`-shm` names already existed and, on a `locked` or `unrecognized` outcome, removes any sidecar it created itself, so "file untouched" is directory-observable (C-4); the `corrupt` branch renames or deletes them as part of recovery (D5). `SQLITE_IOERR` is deliberately **not** corruption: a transient I/O fault or a full disk is not evidence that the store is damaged, and recovery would rename a healthy store on a failing volume. The default outcome is `locked`, so an unforeseen error can never reach the rewrite path. Rejected: treating every init failure as corruption — it would rename a store whose key is merely missing. Rejected: restricting to `SQLITE_CORRUPT` only and treating `SQLITE_NOTADB` as corrupt — a non-SQLite file is exactly REQ-085's "unrecognized format", and the magic check settles it before any open.

**D5 — Recovery lives in the store layer, closes the failed handle first, and runs at most once per `init()`.** `SqliteStore` receives two options: `allowRecovery` (default `false`; `src/kb.ts` passes `true` for the live store, and `kb-migrate.ts`, the test fixtures, and every other construction site keep the default) and `openDatabase?: (path: string, opts?: { readOnly?: boolean }) => DatabaseSync` (default `(p, o) => new DatabaseSync(p, o)`), the single opener every call goes through. `probeStoreFile(path, openDatabase)` takes the opener as its second parameter and is exported for direct unit assertions; its read-only call is call 1 of the sequence, the creation call is call 2, and the continuation opens nothing. `init()` closes `this.db` on every throw path before any file operation, then, when `allowRecovery` is set and `probeStoreFile` reports `corrupt`, runs one recovery on the same instance:

1. rename the store and any existing `-wal`/`-shm` — including any the probe's read-only open created — to `vector-store.corrupt-<ts>.sqlite[-wal|-shm]`, or to `vector-store.corrupt-<ts>.sqlite.enc[-wal|-shm]` when `opts.encryptionEnabled` is true; the config flag is the only available input, since a corrupt store's `metadata` cannot be read; `<ts>` is `Date.now()` digits, not an ISO string, because `ARCHIVE_RE` (`src/kb-store.ts:79-80`) accepts only `\d+` and the plaintext archive must stay eligible for the sweep; if that name already exists, abort before moving anything and report a lock error;
2. `chmod 0o600` every moved file;
3. delete any sidecar recreated at the live path between the rename and the creation (the probe-created ones are already archived by step 1, so this is normally a no-op);
4. open the new store once through `openDatabase(path)` (call 2), run the pragmas, the schema, and `PRAGMA user_version = 1`, verify with `SELECT count(*) FROM chunks`, and keep that handle as `this.db`;
5. continue `init()` from the encryption bootstrap with recovery disabled — no second open, so a failure there is reported, not recursed;
6. only after step 5 succeeds, append `Storage corruption detected at <new Date().toISOString()>. Backup: <absolute path>. Starting with an empty knowledge base.` — the absolute path is the string the rename used.

If any of steps 4–5 fails, close the new handle, remove the new store and its sidecars, rename the archives back to the live path, and rethrow the original error unchanged (so `src/kb.ts:418-426` renders it as it does today); the event is never written for a recovery that did not complete. The error contract is: `newer` and `unrecognized` throw `KbStoreFormatError` with their distinct `code` (the probe settles both from the header, before any open); `locked` rethrows the original SQLite error unchanged; `corrupt` throws `KbStoreCorruptError` when `allowRecovery` is false and recovers otherwise. The backup file is reported through the status event and left on disk deliberately; it is **not** recorded in `corruptionBackup` (that field belongs to the metadata-corruption copy) and no store-artifact predicate is extended to match it, which is why a `.enc`-named backup survives the plaintext sweep. `src/kb.ts` keeps only the mapping from `KbStoreCorruptError` / `KbStoreFormatError` to the existing `config_error` lock shape, so the tool contract is unchanged. Rejected: doing the rename in `src/kb.ts` — file naming, archive eligibility, and sidecar handling all belong to the layer that owns the store layout (`LIVE_SQLITE_STORE`, the suffix rule at `src/kb-sqlite.ts:137-148`, the sweep filter at `src/kb-sqlite.ts:826-841`), and `src/kb-store.ts` is the declared seam. Rejected: copy-then-delete — the live path must be clear before the new store is created, and the copy precedent applies only where the original remains valid.

**D6 — REQ-085 gains one sentence so the spec states the split the code implements.** Current text (657 chars, 3 sentences, 5 SHALLs) says that when the store cannot be read — key unavailable, decryption fails, or format unrecognized/newer — the server SHALL NOT modify, overwrite, rename, or delete the store file, and that an unrecognized or newer store is not rewritten. REQ-108 separately requires that a corrupt store be backed up, replaced by an empty one, and reported. The two collide on a corrupt store, so the text is clarified by appending: `A recognized store with corrupt content SHALL be recovered per REQ-108.` (73 chars, 1 SHALL → 730 chars, 4 sentences, 6 SHALLs; Appendix B limits are 800/8/8). No other REQ changes, and no REQ-084 edit: REQ-084's sentence "changing the secret without loss of stored content" and REQ-086's "rekeying the store to a new secret without loss of stored content" are distinct clauses and both apply to D1. `README.md:583-588` stays true as written — a missing or wrong key still locks without touching the data, an unrecognized or newer format is still never overwritten, and only a recognized-but-corrupt store is moved aside with its bytes preserved.

## Blast radius

Size: **S** ≤ 50 changed lines in one file, **M** 51–200, **L** > 200 or a cross-module contract change.

| File | Change | Size |
|---|---|---|
| `src/kb-sqlite.ts` | Header probe, `SQLITE_FORMAT_VERSION`, error classes, marker write, `events` reseal + comment, `events()` guard, recovery with `allowRecovery`/`openDatabase` | M |
| `src/kb.ts` | Pass `allowRecovery`; map `KbStoreCorruptError` / `KbStoreFormatError` to the existing lock shape | S |
| `infobroker.md` | REQ-085: one appended sentence (D6) | S |
| `src/kb-encryption-sqlite.test.ts` | Reseal, ciphertext, unreadable-row preservation | M |
| `src/kb-sqlite.test.ts` | Marker write, newer-format refusal with the directory snapshot, zero-length classification | M |
| `src/kb-hardening.test.ts` | Tool-level corrupt store, non-SQLite lock branch, restore-on-failure | M |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | F-R6-D-1/D-2/E-1 → `Resolved` with evidence | S |
| `ROADMAP.md` | Retire § R6 encryption and capacity remediation | S |
| `CHANGELOG.md` | One entry naming the behavior changes | S |
| `docs/plans/2026-11-10-r6-encryption-capacity-remediation/` | `plan.md`, `tasks.md`, `aar.md`, `probe.ts`, `probe-log.md`, `plan.cold/` | S |

No config-key, dependency, tool-surface, or provider change.

## Steps

### Phase 0 — preflight (no edits)

1. Confirm `git status --porcelain` lists only the increment directory; confirm HEAD is `03cfc0d`.
2. Re-run `npx tsx docs/plans/2026-11-10-r6-encryption-capacity-remediation/probe.ts` from the repository root and diff against `probe-log.md`; a difference changes the plan, not the log.
3. Run and record `check-intent-citations`, `check-tdqs`, and `validate-spec` — measured, not carried forward.
4. Coverage discovery: `grep -rn "rekey\|disableEncryption\|user_version\|not a database\|corrupt-" src/*.test.ts`. Expected homes are `src/kb-encryption-sqlite.test.ts`, `src/kb-hardening.test.ts:194-208`, `src/kb-migrate.test.ts:113-120`. Extend those; add no duplicate file.
5. Record the `npm run test` baseline (files/tests).
6. Measure the REQ-085 body before the edit (expect 657 chars, 3 sentences, 5 SHALLs) and record the post-edit value in the AAR (C-6).

### Phase 1 — behavior

1. `src/kb-sqlite.ts`: `SQLITE_FORMAT_VERSION = 1`; `export function probeStoreFile(path, open = defaultOpen)` → `{ state: "new" | "ok" | "unrecognized" | "newer" | "corrupt" | "locked"; marker?: number; detail?: string }`, header-first, no throw for a classified state. It parses `user_version` as a 4-byte big-endian integer at offset 60 of a 100-byte header read, records the pre-existing `-wal`/`-shm` names internally, runs `PRAGMA quick_check` on the read-only handle, and removes only the sidecars it created when the outcome is `locked` or `unrecognized`.
2. `src/kb-sqlite.ts`: `KbStoreFormatError` (`code: "kb_store_newer_format" | "kb_store_unrecognized_format"`) and `KbStoreCorruptError` (`code: "kb_store_corrupt"`, `path`, `sqliteCode`); `init()` throws `KbStoreFormatError` for `newer` and `unrecognized`, rethrows the original SQLite error unchanged for `locked`, and throws `KbStoreCorruptError` directly when `allowRecovery` is false.
3. `src/kb-sqlite.ts` `init()`: close `this.db` on every throw path; probe first; on `ok` run the pragmas and DDL only; on `new` run the configured pragmas (including the `journalMode` option), the schema, and `PRAGMA user_version = 1`; both `ok` and `new` then enter the existing encryption bootstrap, so a fresh store with encryption enabled still calls `enableEncryption`.
4. `src/kb-sqlite.ts` `resealAll`: decode `events` before the switch, rewrite readable rows in the transaction, preserve unreadable rows unchanged; rewrite the header comment (D1).
5. `src/kb-sqlite.ts` `events()`: require a non-empty row key and a successful open for a marked row (D2).
6. `src/kb-sqlite.ts`: the D5 recovery sequence behind `allowRecovery` and `openDatabase(path, opts?)`, with the one-open rule, the continuation after step 4, and restore-on-failure.
7. `src/kb.ts`: construct the live store with `allowRecovery: true` and map the two error classes to the existing `config_error` lock shape; leave every other branch untouched. No other construction site changes, because the option default is `false`.
8. `infobroker.md`: append the REQ-085 sentence (D6).
9. `npm run typecheck` after each source file; `npm run validate-spec` after the spec edit.

### Phase 2 — tests

1. `src/kb-encryption-sqlite.test.ts`: enable encryption, append two events, `rekey`, assert `events()` equals the messages verbatim and a reopened store still returns them; then `disableEncryption` and assert the same messages come back as plaintext (no `INFOKB1` prefix, no non-UTF-8 bytes), and the reopened store still returns them.
2. `src/kb-encryption-sqlite.test.ts`: close the store, insert a synthetic `encrypted = 1` row with random bytes through a raw `DatabaseSync` (DELETE journal for the fixture so no sidecar lingers), reopen, `rekey`, and assert the transition succeeds, `events()` omits that row, the stored bytes are unchanged, and the row is still undecodable after the salt change.
3. `src/kb-sqlite.test.ts`: snapshot `{names, hashes}` of every `vector-store.sqlite*` entry, set `user_version` to `SQLITE_FORMAT_VERSION + 1` through a raw `DatabaseSync` handle (DELETE journal for the fixture so no sidecar lingers), close it, then assert `init()` throws `KbStoreFormatError` and the snapshot is identical (C-4). Keep `snapshotStoreDir()` local to this file; no shared helper is introduced.
4. `src/kb-sqlite.test.ts`: a zero-byte file is `new`, gains `user_version = 1`, and survives a reopen; a store with `user_version = 0` — the shape every pre-marker store has, P7 — is read as version 1, left at 0, and stays readable; a store with magic but fewer than 100 bytes is `corrupt`, not `new`.
5. `src/kb-hardening.test.ts`: truncate a seeded store to 600 bytes (P2's shape), initialize the KB, and assert `getKbLockError()` is `null`, `kbStats()` reports zero chunks, a `vector-store.corrupt-*` main archive exists and its bytes equal the pre-probe main file, the last event starts `Storage corruption detected at ` and contains the absolute backup path, and `kbIngest` succeeds in the same call. The archive set may be one name or three depending on whether the probe created sidecars; assert on the main name, not the count.
6. `src/kb-hardening.test.ts`: a 38-byte non-SQLite `vector-store.sqlite` (P3, under the 100-byte header read) yields a non-null `getKbLockError()`, leaves the file bytes and the directory listing unchanged, and creates no `vector-store.corrupt-*` artifact — proving the sub-header file reaches `unrecognized`, not `new`. Add the missing-key branch: an encrypted store opened through `configureKb` with no key yields the existing `config_error` "encrypted but no key" lock (`src/kb.ts:408-412`), and the store is still readable with the correct key afterwards (assert a previously ingested chunk is returned). No assertion is written for a plaintext store with `encryptionEnabled: false`, where today's bootstrap takes no branch at all.
7. `src/kb-sqlite.test.ts`: a `locked` outcome — inject `openDatabase` so the `{ readOnly: true }` call throws a non-corruption error — removes any sidecar the probe created, so the directory matches its pre-probe snapshot; a pre-existing sidecar is left alone.
8. `src/kb-hardening.test.ts`: force the restore path twice. (a) Inject `openDatabase` so the creation open (call 2) throws. (b) Induce a continuation failure without a new seam: construct the store with `{ allowRecovery: true, encryptionEnabled: true, secret: null }` over a corrupt store, so the recovery creates the empty store and the encryption bootstrap then throws "encryption is enabled but no key is available". Each case asserts the archive is back at the live path, no empty store replaces it, no corruption event is recorded, and the lock error is reported; then a second `init()` reports the corrupt classification again rather than looping.
9. Keep the existing corrupt-metadata, legacy-corrupt, and encryption-archive tests green — the suffix rule and the archive sweep must not change for them. Add one assertion that `isKbArchiveArtifact` is false for a `.sqlite.enc` backup and true for the plaintext form, and that `<ts>` is all digits.

### Phase 3 — mutation evidence

1. Remove the `events` decode/rewrite from `resealAll` → the rekey and disable assertions must fail; restore.
2. Revert the `events()` key guard → the ciphertext assertion must fail; restore.
3. Remove the `user_version` check from `probeStoreFile` → the refusal assertion must fail; restore.
4. Treat `corrupt` as `locked` → the recovery assertion must fail; restore.
5. Remove the rename-back step from the restore path → Phase 2 step 8 must fail; restore.
6. Record each mutation, the failing test name, and the restored diff in the AAR.

### Phase 4 — bookkeeping

1. `worklist.md`: mark F-R6-D-1, F-R6-D-2, and F-R6-E-1 `Resolved` with the test file and line that proves each; leave F-R6-E-2 and F-R6-E-4 as `Scheduled-roadmap` in the same register block and do not claim a roadmap home for them (the F-M1-2 census already records that gap).
2. `ROADMAP.md`: remove § R6 encryption and capacity remediation; confirm 22 work items remain (23 before removal).
3. `CHANGELOG.md`: add `## 2026.11.7 — R6 review: event reseal, store-format marker, corrupt-store recovery` with a bullet per behavior change. The heading date must equal the version date (`version-sync` compares the top entry to `package.json`).
4. Complete `tasks.md` — every box resolved or explicitly recorded as not-run — as the last Phase 4 action.
5. Write `aar.md` before the Phase 5 gates, ending `LOOP OPEN` for the first pass: `check-loop-artifacts` fails on the increment directory until the file exists, and Phase 5 step 2 finalizes the terminal token.

### Phase 5 — verification and commits

1. Run the audit probe (C-2) and record the outcome in `probe-log.md`.
2. `npm run check:fast`, `npm run test-debate-club`, and `npm run check` when the probe answered. Finalize `aar.md` with the terminal token, then re-run `check-loop-artifacts` and `check:fast` because the AAR changed after the first run.
3. Split commits in the repo's convention order — spec, source, tests, docs — each followed by `npm run typecheck`:
   - `spec(kb): scope REQ-085 to recognized formats and defer corruption to REQ-108` — `infobroker.md`;
   - `fix(kb): reseal event history, mark the store format, and recover a corrupt store` — `src/kb-sqlite.ts`, `src/kb.ts` in one commit, so no intermediate tree carries the new error classes without the `kb.ts` mapping;
   - `test(kb): assert event reseal, format refusal, and corruption recovery` — the three test files;
   - `docs(kb): resolve the R6 encryption and capacity findings and retire the section` — `worklist.md`, `ROADMAP.md`, `CHANGELOG.md`, the increment record.
4. Report the commit list and stop before `npm run release`.

## Alternatives considered (summary)

- **A sidecar file for the marker.** Rejected: not atomic with the database, and it reintroduces the touch problem the header read avoids.
- **A `meta` row for the marker.** Rejected: detection would need a SQLite open, which creates sidecars on a WAL store (P6) and makes the refusal guarantee unprovable.
- **Versioning by comparing the observed table set to `SQLITE_SCHEMA`.** Rejected: cannot distinguish a newer additive schema from a hand-edited one, and would refuse a store that merely lacks an unrelated table.
- **Renaming the store before the header probe.** Rejected: the probe is what distinguishes corrupt from newer-format, key-locked, and unrecognized; renaming first would break REQ-085 for those cases.
- **Reporting recovery through the tool response instead of an event.** Rejected: `stats.encryption` and the event log are the existing operator surfaces (REQ-060i, REQ-103), and the legacy corruption path already reports this way.
- **Fixing the F-R6-E-2 tension (encryption-enabled upgrades unlink the legacy JSON) here.** Rejected: it needs a separate REQ-084/REQ-108 decision that this section does not own; the row stays as it is.

## Edge cases and rollback

- **A zero-length `vector-store.sqlite`.** `new`: SQLite treats an empty file as a new database, so it gains the schema and the marker and no recovery runs (P1).
- **A corrupt `-wal` with a readable main file.** The read-only open can fail on the sidecar; the classification treats it as corruption and the recovery moves all three names. Salvage is out of scope; the bytes are preserved.
- **Clean close leaves `-shm`/`-wal` absent.** The rename step tolerates missing sidecars (`existsSync` per name).
- **Encryption enabled at recovery time.** `opts.encryptionEnabled` is the only selector available (a corrupt store's `meta` cannot be read), the resumed store is created encrypted, and the backup uses the `.enc` suffix so the plaintext-archive sweep never reaps it. That name is also invisible to `isKbStoreArtifact`, so a `.enc` backup inside the repository would not trip `check-shipped-kb-empty`; the storage path is user-scoped outside the tree by design (AGENTS state model) and the file holds no plaintext, so the omission is accepted and recorded in the AAR. If the corrupt store was ciphertext but the config says encryption is disabled, the backup is named `.sqlite` and a later encrypted open may reap it as a plaintext archive — accepted for REQ-084's no-plaintext rule, recorded in the F-R6-E-1 row and the AAR.
- **A corrupt store whose key state is unknowable.** The store cannot be read, so the server cannot tell whether a key was required; recovery creates a store under the configured state. This is a checked limitation of F-R6-E-1, not a claim of key detection.
- **`SQLITE_BUSY` from a live process.** `locked`; nothing is renamed, so a second server cannot cause data loss.
- **Rollback:** revert the commits and drop the new assertions. The store gains `user_version = 1` that older builds ignore, so a rollback does not strand a user's store.

## Verification

| Claim | How verified |
|---|---|
| Rekey preserves readable event history | Unit test: two events, `rekey`, `events()` equals the messages; reopen returns them |
| An unreadable legacy event row is preserved, not dropped | Unit test: synthetic `encrypted = 1` row, rekey succeeds, row omitted from `events()`, bytes unchanged, still undecodable |
| Disable renders events as plaintext, never ciphertext | Unit test: same store after `disableEncryption`, messages equal, no `INFOKB1` prefix |
| A newer store is refused and not touched | Unit test: `user_version + 1`, `KbStoreFormatError`, directory snapshot identical, no sidecar |
| A corrupt recognized store recovers empty with a backup | `src/kb-hardening.test.ts`: no lock error, zero chunks, backup holds the original bytes, event names it, ingest succeeds |
| A non-SQLite file stays a lock | `src/kb-hardening.test.ts`: non-null `getKbLockError()`, bytes and listing unchanged, no archive |
| Recovery cannot strand the store | Forced `openDatabase` failure restores the archive and reports the error; a second `init()` does not loop |
| Store format marker costs no open | P7 header read plus the zero-sidecar assertion in Phase 2 step 3 |
| Spec text matches behavior | `validate-spec` after the REQ-085 edit; Appendix B measurement in the AAR |
| No regression in the tool surface | `check-tdqs`, `check-intent-citations`, `validate-spec`, `npm run test`, `npm run test-debate-club` |
| Gates green | `check:fast`, `test-debate-club`, then `check` (audit-conditioned) |
