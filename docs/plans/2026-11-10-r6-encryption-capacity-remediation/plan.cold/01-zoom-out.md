# Stage 1 — zoom out (cold pass)

Reviewer: fresh `review` subagent
Plan sha256: d518ab999f0e7cd4ea9dc3457d6f1b8c8961c4832fa46a060ba633ac6cbb92f2
Reads used: 9/10

## Findings

- **[Blocker] [design]** The plan's central "no REQ edit needed" premise is contradicted by the REQ it cites. REQ-085 (`infobroker.md:610`) says that when the store cannot be read — "because the encryption key is unavailable, decryption fails, **or the file format is unrecognized** or newer than supported" — the server "SHALL NOT modify, overwrite, **rename**, or delete the store file". D4 renames it and creates a new store. D6 quotes only REQ-085's last sentence and never addresses the first; C-3 examines only the encryption-enabled sub-case.
- **[Major] [clarity]** D4's heading and body state opposite rules ("any read-only inspection failure" vs the enumerated `26`/`11`), and Phase 1 specifies a third detector.
- **[Major] [clarity]** The encryption-enabled corruption rule is simultaneously decided (D4 "Rejected: refusing") and undecided (C-3 "D4 is amended to refuse … assert whichever rule lands").
- **[Major] [clarity]** Phase ordering is circular against the plan's own gate: `aar.md` is written "after Phase 5's gates" while Phase 5 runs `check:fast`, which fails until the AAR exists.
- **[Major] [clarity]** `F-R6-E-3` and `F-R6-E-2` are asserted to be "scheduled", but no roadmap section names them.
- **[Major] [clarity]** `inspectExistingStore()` both returns and throws for the `newer`/`corrupt` cases, and no error type is given, so `kb.ts` cannot classify.
- **[Major] [clarity]** The zero-length-file edge case conflicts with the marker rule ("no rewrite" vs a schema-bearing store with no marker forever).
- **[Major] [design]** D1 and D2 give opposite answers for a legacy store: D1 aborts the transition on an undecodable event, so D2's ciphertext rows can never be repaired.
- **[Major] [design]** D5's restore-on-failure path is specified but never tested or verified.
- **[Major] [clarity]** The recovery rename leaves permissions, sidecar names, and archive registration to the implementer; the cited precedent (`src/kb-sqlite.ts:137-148`) copies rather than renames, and D5 rejects that technique without reconciling.
- **[Major] [clarity]** C-4's refusal proof is weaker than the rule: a main-file hash does not detect `-wal`/`-shm` creation.
- Nits: unlocated "existing single-row rule"; README claim not reconciled; roadmap-ordering basis unstated; cold-artifact location unnamed; "gone" overstates the event defect; rollback-cost scale undefined; test placement left open.

## Unknowns

Baseline counts and timings; the worklist row references; the cited code line ranges; the `events` cap; whether `rekey`/`disableEncryption` both route through `resealAll`; the `version-sync` heading rule; host-injected `AGENTS.md` weakens isolation.

## Disposition

Blocker resolved by the D6 REQ-085 sentence plus the D4 header split. All Majors resolved in the revision (v2). Nits resolved by relabeling, restating, and scoping; test placement is now committed to named files in the blast radius.
