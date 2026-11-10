# Stage 3 — critics (cold pass)

Reviewers: three fresh `review` subagents (design, structural, style), run in parallel
Plan sha256: 1ca7840dcb50b6cc77f7e882675c9f3a14c6de6a75dc8132aa78115f92849c43

## Design critic

Reads used: 9/10.

**Blockers**

1. The legality claim is contradicted by REQ-085's text: "cannot be read … because…" is exemplary, so a corrupt store is covered by the SHALL NOT rename clause, and C-3 hands the adjudication to a later reviewer while D6 forecloses the clean resolution.
2. The "no sidecar on refusal" assertions cannot pass: the marker lived in `meta`, so the refusal needs a SQLite open, and a read-only open of a WAL store creates `-shm`; `kb.ts:384` also calls `sqliteStoreFormat` first.
3. D5 renames while a SQLite handle may still be open, and never closes it first; sidecars can be recreated at the live path.

**Majors**

4. The backup suffix is keyed off configured encryption rather than the detected format, so a ciphertext backup can be named `.sqlite` and reaped by the plaintext-archive sweep.
5. The classification table's default falls through to "open read-write"; `SQLITE_ERROR` 1 and an older marker are unhandled.
6. `SQLITE_IOERR` treated as corruption renames a healthy store on a full disk.
7. "A missing key still locks" cannot hold for a corrupt store whose encryption state is unreadable.
8. D2's guard is only sufficient if `openRow` is authenticated.
9. D1 changes a documented invariant and needs the comment, the asymmetry, and an "unreadable after reseal" assertion.
Nits: marker write cannot sit inside the existing pragma block; D5's rollback must close the new handle and clear new sidecars.

## Structural critic

Reads used: 9/10.

**Blocker**

1. Phase 2 step 8 and mutation 5 depend on a failure-injection seam no step creates (`SqliteStoreOptions` has no opener).

**Majors**

2. The recovery sequence is decomposed into `src/kb.ts`, which owns no store-layout knowledge; the blast radius sizes it "S" and omits the seam.
3. The "one attempt per init" budget cannot be enforced where D5 puts it; nothing prevents a second recovery.
4. The verification table promises `test-debate-club`, which no phase runs and which `check:fast` excludes.
5. The C-4 directory invariant is asserted twice across two files with no named helper.
6. `tasks.md` has no completion point before the Phase 5 gate that reads it.
Nits: the audit probe is a condition, not a recorded step; the synthetic-row fixture must close the store before the raw insert.

## Style critic

Reads used: 2/3.

**Blocker**

1. "without loss of stored content" is attributed to REQ-086 in D1 and REQ-084 in D6.

**Majors**

2. Probe labels are referenced but undefined, and C-4 cites the wrong row.
3. "Capacity" appears in the title and retirement step but nothing addresses it.
4. C-3 delegates a spec adjudication to the style critic, which does not adjudicate.
5. D1 calls the residue "legacy" when the current build produces it.
6. Phase 0's parenthetical conflates "REQ citations" with `check-intent-citations` counts.
Nits: three notations for one backup name; two ranges for `src/kb-migrate.ts`; "register" vs `worklist.md`; "preflight" used for two things; undefined rollback/size scales; ungrounded `F-R6-E-3`; a 200-word done-bar sentence; two "read-only inspection" functions; `NOT_RUN.` inside a code span; mixed numerals.

## Disposition

Every Blocker and Major is resolved in the revision (v3); the style Blocker is a real double citation — both REQ-084 and REQ-086 contain the clause, and D6 now says so explicitly. Resolutions:

- D6 → one appended REQ-085 sentence, measured against Appendix B (C-6), instead of "no spec change".
- D3 → the marker moves to the SQLite header `user_version`, read from the first 100 bytes with no handle (P6), so refusal is provably sidecar-free; D4's table becomes header-first and fail-closed.
- D5 → recovery moves into the store layer behind `allowRecovery`, closes the handle first, reaps recreated sidecars, retries with recovery disabled, and takes an injectable `openDatabase` for the restore test.
- D4 → `SQLITE_IOERR` and every unclassified failure become `locked`; an older or below-1 marker is a fail-closed refusal.
- D1 → the comment is rewritten in the same commit and the test asserts the preserved row stays undecodable.
- D2 → authenticated open cited (`src/kb-row-crypto.ts` AES-256-GCM).
- Structural → `test-debate-club` and the audit probe become explicit Phase 5 steps; `tasks.md` completion is Phase 4 step 4; the C-4 snapshot stays local to one file.
- Style → probe rows labeled P1–P7 matching `probe.ts`; a scope note explains "capacity"; scales and notation defined; the done bar is enumerated.

The C-3 spec-adjudication ambiguity is removed: the decision is made in the plan and the escalation path names the user, not a stage.
