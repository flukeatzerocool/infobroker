# Stage 2 — comprehension (cold pass)

Reviewer: fresh `review` subagent
Plan sha256: d518ab999f0e7cd4ea9dc3457d6f1b8c8961c4832fa46a060ba633ac6cbb92f2
Reads used: 1/5
Blockers: 0

## Paraphrase

This increment fixes three defects in the SQLite knowledge-base backend. (1) `rekey`/`disableEncryption` destroy event history because `resealAll` skips the `events` table; the fix decodes and rewrites events inside the key-switch transaction, and `events()` stops rendering ciphertext. (2) Stores gain a persisted format marker; a newer marker is refused with the bytes untouched, while pre-marker stores read as the current version and are never rewritten. (3) A corrupt live store is renamed to a backup, replaced by a working empty store, and reported as a status event; key-mismatch and newer-format failures remain lock errors. Only `src/kb-sqlite.ts` and `src/kb.ts` change, plus tests and bookkeeping. Done means each fix fails under a recorded mutation and passes restored; the three findings are marked Resolved; the ROADMAP section is retired; a CHANGELOG entry exists; `check:fast` is green; the increment record ends LOOP PAUSED/OPEN.

## Could not determine (Major unless noted)

- Error contract between the modules: class names, `code` values, messages, and remediation text for the typed errors.
- `inspectExistingStore()` returns or throws for the same cases.
- Recovery event shape: kind/severity token, template, ordering relative to store creation.
- Test file ownership: the encryption test is named as existing coverage but absent from the change set.
- No regression test for the must-stay-a-lock branch.
- Backup naming: `<ts>` format, collision behavior, and whether the archive sweep can reap a plaintext corruption backup.
- Nit: encrypted sidecar filenames; same-call retry semantics; commit ordering; marker encoding; the 100-event cap versus "verbatim"; who decides the audit probe answered.

## Disposition

All Majors resolved in the revision: error classes and codes named (D4/Phase 1), the probe returns a discriminated union (D4), the event template is fixed (D5), test files are committed in the blast radius, lock-branch regressions are Phase 2 steps 6 and 7, and the backup naming, sweep eligibility, and `.enc` non-archive property are asserted (Phase 2 step 8). Nits resolved: sidecar names, the one-retry rule, marker encoding (`user_version`), the cap note, and the audit-probe policy (C-2).
