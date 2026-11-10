# Tasks — R6 encryption and capacity remediation

- [x] Step 0.0 Plan review: `plan-review passed.` — deep, independence fresh; five stages in fresh contexts over ten dispatches (readiness GO on the fourth check); cold report `plan.cold/report.md` sha256 `d978666d…`, plan sha256 `b47f262d…` (re-stamped after a formatting-only Done-bar amendment).
- [x] Step 0.1 HEAD `03cfc0d`, working tree clean apart from the increment directory.
- [x] Step 0.2 Probe re-run: structure identical to `probe-log.md`; only the sealed random bytes differ (fresh key/salt per run) — expected.
- [x] Step 0.3 `check-intent-citations` 141/0; `check-tdqs` 7 tools / 0 violations; `validate-spec` 142 REQs / 127 cited.
- [x] Step 0.4 Coverage discovery: `kb-encryption-sqlite`, `kb-sqlite`, `kb-hardening`, `kb-migrate` are the existing homes; no new test file added.
- [x] Step 0.5 `npm run test` baseline: 108 files / 1134 tests.
- [x] Step 0.6 REQ-085 measured before the edit: 657 chars, 3 prose sentences (4 terminal periods counting `_Check:_ G1.`), 5 SHALLs. After: 729 chars, 4 prose sentences, 6 SHALLs — within Appendix B (800/8/8).
- [x] Step 1.1 `SQLITE_FORMAT_VERSION`, header-first `probeStoreFile(path, open)` with `PRAGMA quick_check` and sidecar cleanup.
- [x] Step 1.2 `KbStoreFormatError` (`kb_store_newer_format` / `kb_store_unrecognized_format`), `KbStoreCorruptError` (`kb_store_corrupt`).
- [x] Step 1.3 `init()` closes the handle on every throw path; `new` writes `PRAGMA user_version = 1`, `ok` writes nothing; both enter the encryption bootstrap.
- [x] Step 1.4 `resealAll` decodes and re-seals readable events in the transaction, preserves unreadable rows; header comment rewritten.
- [x] Step 1.5 `events()` requires a non-empty key and a successful open for a marked row.
- [x] Step 1.6 Recovery in the store layer behind `allowRecovery` + `openDatabase`: rename, chmod, recreated-sidecar sweep, one creation open, verification, continuation, event, restore-on-failure.
- [x] Step 1.7 `src/kb.ts` passes `allowRecovery: true` and maps both error classes to the existing `config_error` lock shape.
- [x] Step 1.8 REQ-085 sentence appended.
- [x] Step 1.9 `npm run typecheck` clean; `validate-spec` passes.
- [x] Step 2.1 Rekey preserves events; reopened store returns them.
- [x] Step 2.2 Disable renders plaintext; an unreadable preserved row stays unreadable and is skipped.
- [x] Step 2.3 Newer `user_version` refused with an identical directory snapshot; no sidecar.
- [x] Step 2.4 Zero-byte file is `new` and gains the marker; `user_version = 0` stays 0; truncated header is `corrupt`.
- [x] Step 2.5 Tool-level corrupt store: no lock error, empty stats, archive with the original bytes, event with the absolute path, ingest succeeds.
- [x] Step 2.6 Non-SQLite file locks untouched with no archive; missing key locks and the store is readable with the right key.
- [x] Step 2.7 `locked` probe removes the sidecar it created and leaves a pre-existing one.
- [x] Step 2.8 Restore path: creation failure and post-creation bootstrap failure both restore the archive; one attempt per call (2 opens, then the same failure again).
- [x] Step 2.9 Existing corrupt-metadata, legacy-corrupt, encryption-archive tests green; `.enc` backup is not an archive artifact and `<ts>` is digits.
- [x] Step 3.1 No event rewrite → 2 failures (`reseals event history…`, `preserves an unreadable event row…`); restored.
- [x] Step 3.2 Original `events()` expression → 1 failure (`never renders an encrypted row as text…`); restored.
- [x] Step 3.3 No newer-format check → 1 failure (`refuses a newer store…`); restored.
- [x] Step 3.4 Corruption treated as a lock → 3 failures; restored.
- [x] Step 3.5 No rename-back → 2 failures (`restores the archive…`); restored.
- [x] Step 4.1 `worklist.md` F-R6-D-1/D-2/E-1 → `Resolved` with evidence; E-2 and E-4 left `Scheduled-roadmap`.
- [x] Step 4.2 `ROADMAP.md` section retired (23 work items → 22).
- [x] Step 4.3 `CHANGELOG.md` entry under `## 2026.11.7`.
- [x] Step 4.4 `tasks.md` completed.
- [x] Step 4.5 `aar.md` written before the gates, ending `LOOP OPEN`, finalized to `LOOP PAUSED` after them.
- [x] Step 5.1 Audit probe: registry answered (4 low advisories, no high/critical), so the full suite is terminal.
- [x] Step 5.2 `check:fast` PASS 21.4 s; `test-debate-club` 58 passed; `check` PASS 69.4 s (recorded for `81b37c2`); AAR finalized, `check-loop-artifacts` PASS.
- [x] Step 5.3 Split commits (below), typecheck after each.

## Commit series

`fix(kb): reseal event history, mark the store format, and recover a corrupt store` · `test(kb): assert event reseal, format refusal, and corruption recovery` · `spec(kb): scope REQ-085 to recognized formats and defer corruption to REQ-108` · `docs(kb): resolve the R6 encryption and capacity findings and retire the section`
