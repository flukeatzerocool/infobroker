# Stage 5 — readiness (cold pass)

Reviewer: fresh `review` subagent, two dispatches (initial + one re-audit)

## Run 1 — NO-GO

Plan sha256: 7bd3844abe244ac66a6bf26f60e483cbb5dc3c451d57c7a8e40a9f34a460e348 · reads 8/8

Blockers:

1. The injectable open signature could not express a read-only probe open, a read-write creation open, and a continuation, so the test stubs had no stable contract.
2. No ordering rule between the header probe and the existing encryption bootstrap; "nothing is written on open" contradicted the pragma/DDL path and the missing-key claim.
3. The recovery lifecycle was undefined (which instance, when the handle closes, whether the retry reopens).
4. The `.enc` backup is invisible to every artifact predicate and no owner/reporting rule existed.
5. The corruption event's `<path>` was unspecified, so the assertion was not checkable.

Majors: `allowRecovery` semantics stated two ways; `.enc` suffix selection ambiguous; the REQ-085 baseline contradicted itself (3 vs 4 sentences); the two source commits left a half-wired intermediate tree.

## Run 2 — re-audit, still NO-GO

Plan sha256: 1bccf5628c59a054f4b93c1ab4a5c7eb131a496766e605901a79b0cd65f1b4fd · reads 6/6

Blockers:

1. `probeStoreFile(path)` was one-parameter while D5 made the opener "used for every open" — the call indices in the stubs depended on which reading held.
2. The recovery step order archived sidecars in step 1 and then deleted "sidecars the failed attempt recreated" in step 3, which was unreachable as written; the archive set size was undefined.

Majors: the blast radius omitted a `kb-migrate.ts` change implied by the `allowRecovery` default; the `locked` and restore-failure throw contracts were undefined.

Nits: the event's ISO formatter was unpinned; the `new` path's route into the encryption bootstrap was unstated; `probeStoreFile` visibility was unstated; archive-name collision was unhandled.

## Disposition

Every item is resolved in the revision: `probeStoreFile(path, open = defaultOpen)` is exported and its read-only call is call 1 while creation is call 2; `allowRecovery` defaults to `false` with only `src/kb.ts` opting in, so the blast radius stays two source files; `locked`/`unrecognized`/`newer` rethrow the original error unchanged and only `corrupt` gains a class; step 1 archives the probe's sidecars, step 3 deletes only what reappears, and an existing archive name aborts before any move; the event uses `new Date().toISOString()` and the test asserts the prefix plus the path; `new` also enters the encryption bootstrap.

**The stage is not re-audited after these edits.** The independent-review skill caps a failed stage at one re-audit and caps the pass at seven dispatches; this run used eight. The stage is therefore reported as failed-pending-escalation, and the verdict belongs to the user.

## Run 3 — final pass (user-authorized), still NO-GO

Plan sha256: 117e96dfcc8536deaa9e30f875198bd19470a5f5559074de360b3b424d90bfb1 · reads 6/6

Blockers:

1. The `corrupt` classification named no detection act beyond "the read-only open fails"; a 600-byte store can open and pass a schema read, so the recovery branch was unprovable.
2. The `newer`/`unrecognized` error contract contradicted itself between D5 and Phase 1 step 2.
3. Phase 2 step 8(b) required a stub to throw from a stage that makes no open call.

Nits: the `new` branch omitted the configured pragmas; two prose citations were not file-qualified.

## Disposition (final revision)

1. **Settled by probe, not wording.** `probe.ts` gained **P5**: a read-only open plus `SELECT count(*) FROM sqlite_master` succeeds over a store with page 2 zeroed, while `PRAGMA quick_check` throws `errcode 11`. The probe now runs `quick_check`, and it is the only read that detects latent page damage.
2. `newer`/`unrecognized` → `KbStoreFormatError` (distinct codes, header-only, no open); `locked` → rethrow the original error; `corrupt` → `KbStoreCorruptError` when recovery is off.
3. A continuation failure is induced with an existing configuration — `{ allowRecovery: true, encryptionEnabled: true, secret: null }` — so the empty store is created and the encryption bootstrap then throws; no new seam.
4. `new` applies the configured pragmas (including `journalMode`), and the citations are file-qualified.

The final revision (sha `ed31a821…`) has not been put to a fourth reviewer. The skill's cap is one re-audit per failed stage and seven dispatches per pass; this pass used nine. The verdict therefore stays failed-pending-escalation.
