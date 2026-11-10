# AAR — R6 encryption and capacity remediation

**Date:** 2026-11-10 · **Plan:** `plan.md` (sha256 `b47f262d…`; re-stamped after a formatting-only Done-bar amendment) · **Depth:** deep · **Independence:** fresh

## What happened

1. Plan drafted for the top `ROADMAP.md` section (F-R6-D-1, F-R6-D-2, F-R6-E-1) after a green baseline (`npm run check` PASS 22 gates / 72.7 s at `03cfc0d`; `npm run test` 108 files / 1134 tests).
2. A cold pass ran five stages in fresh contexts and forced three design changes (header-resident format marker, fail-closed classification, in-store recovery with restore-on-failure). Readiness returned NO-GO three times; the fourth check returned GO.
3. Build ran the plan in order: Phase 0 preflight, Phase 1 behavior, Phase 2 tests, Phase 3 mutation evidence, Phase 4 bookkeeping.
4. Mutation evidence: five mutations, each failing the intended assertions (2, 1, 1, 3, 2 failures) and clean on restore.

## What went right

- The cold pass paid for itself three times over: it caught a spec conflict (REQ-085 vs REQ-108), an unprovable "store untouched" claim (a `meta` marker would need an open), and a detection gap (`quick_check`, not an open, sees page damage). None of the three would have surfaced in a green build.
- Pinning the failure-injection seam (`openDatabase`) made the restore-on-failure path testable with no test-only branch in production code.
- Probe-first evidence (P1–P8) meant every mutation and every design claim had a reproducible source.

## What went wrong

- **A test asserted the wrong mechanism.** Mutation 2 (dropping the non-empty-key guard) initially passed because the synthetic row was random bytes, not a sealed envelope; `openRow` rejects both identically. The fixture was rebuilt as a validly sealed row inside a plaintext store, which is the real residue shape, and the mutation then failed as intended.
- **The cold pass overran its budget** (10 dispatches against 7) because readiness failed three times. Each extra pass found a real ambiguity, but the plan should have pinned the detection act and the error contract in the first revision.
- **Two plan counts were wrong** (`4 sentences` vs 3, `730` vs 729 chars). Re-measured at build time under C-6; the AAR records the measured values.

## Findings

- **P3** — `sqliteStoreFormat()` opens the store read-only, which creates `-wal`/`-shm` on a clean WAL store and reports `plaintext` for a corrupt-but-magic file (P6). Pre-existing, outside this increment's three IDs; recorded, no action.
- **P3** — A corrupt store's encryption state is unknowable, so the backup suffix follows `opts.encryptionEnabled`. A ciphertext backup named `.sqlite` can later be reaped by the plaintext sweep; a `.enc` backup is invisible to `isKbStoreArtifact`. Both are recorded in the F-R6-E-1 worklist row.
- **P3** — `events()` retention (newest 100) still applies to preserved rows; preservation is a transition guarantee, not an exemption from retention.

## Gate evidence

| Gate | Result |
|---|---|
| `npm audit --json` (C-2 probe, 60 s timeout) | answered (exit 1, 4 low-severity advisories; no high/critical) — so the full suite is the terminal gate |
| `npm run typecheck` | clean after every source edit |
| `npm run check:fast` | PASS (fast, 21.4 s) |
| `npm run test-debate-club` | PASS — 7 files / 58 tests |
| `npm run check` | PASS (full, 69.4 s; run recorded for `81b37c2`) |
| `npm run test` | 108 files / 1149 tests (baseline 1134; +15 new assertions) |
| `validate-spec` | PASS, 142 REQs / 127 cited; REQ-085 729 chars / 4 prose sentences / 6 SHALLs |

## Next

`ROADMAP.md` still carries 22 work items; the next section is R6 ledger and receipt remediation. The R6 dedup false-positive bound remains trigger-gated.

LOOP PAUSED
