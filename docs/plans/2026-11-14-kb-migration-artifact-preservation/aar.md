# AAR — KB migration artifact preservation under encryption

**Status:** complete
**Review cap:** 2 passes; used 1 pass (the standard-depth plan gate, cold pass, 5 stages)
**Increment:** `docs/plans/2026-11-14-kb-migration-artifact-preservation/`
**Plan:** sha256 `e91a8236…` at review; the stamped artifact is authoritative
**Roadmap:** § KB migration preservation decision retired (`ROADMAP.md` 5 → 4 sections incl. `## Non-goals`)
**Register:** `F-R6-E-2` → `Resolved`

## What happened

1. Read the roadmap item and the register row, then traced the defect to `src/kb-migrate.ts:171-176`, where an encryption-enabled migration renamed the legacy JSON and immediately unlinked it.
2. Established that both obligations are satisfiable: the plaintext bytes and the migration key are already in memory at that point, so the artifact can be preserved sealed.
3. Drafted the plan, ran the plan gate at standard depth with a cold pass, and resolved all nine cold findings before the stamp.
4. Implemented: `writeMigrationArtifact` (atomic), the seal branch, the event text, the benchmark seed selector, REQ-108's one-sentence contract, D-118, CHANGELOG, roadmap retirement, register closure.
5. Proved the assertions with four source mutations, each failing the intended test and passing on restore.

## What went right

- The defect was decided before it was coded. The roadmap item asked for a decision, and the plan's D1–D6 settle it, including the failure mode (D2), retention and rekey limits (D3), and the benchmark collision the cold reviewer found.
- The cold pass paid for itself: it caught that the `.enc` name would poison the benchmark's seed discovery, that the artifact write was non-atomic against REQ-085, and that the planned Appendix B arithmetic used the wrong counting rule.
- The named injection seam (`writeArtifact`) made the failure branch deterministically testable without depending on the runner's user.

## What went wrong

- The first draft of the plan asserted a mechanical-limit overflow that did not exist (733 vs the validator's 707) and justified a spec-prose trim with a false constraint. Caught by the cold pass, corrected before the stamp.
- `npm run check` was started before the increment directory existed, so `check-loop-artifacts` failed on a half-written increment. The baseline was re-established by moving the directory aside; the lesson is to create the increment directory (with its `aar.md`) before starting a full gate run, or attribute the failure explicitly.
- A first edit to REQ-108 was written with a duplicated body fragment and immediately corrected; `grep -c` confirms one occurrence of the new sentence.

## Findings

| ID | Finding | Severity | Disposition |
|---|---|---|---|
| A-1 | `src/kb-migrate.test.ts:77` was named "without deleting its source" while asserting deletion, so the defect read as intended behavior | P1 | Resolved in-session — test rewritten and renamed; `F-R6-E-2` closed |
| A-2 | `check-loop-artifacts` errors on an increment directory with no `aar.md`, so a full gate run cannot straddle plan drafting | P3 | Closed informational — contract is intentional; skeleton `aar.md` added at draft time |
| A-3 | `scripts/benchmark-kb-store.ts` selected the newest `vector-store.json.migrated-*`, which after this change can be a ciphertext artifact | P1 | Resolved in-session — `scripts/lib/kb-seed.ts` excludes `.enc`; regression test added (D6) |
| A-4 | The artifact write was specified non-atomically in the plan draft, contradicting REQ-085 | P1 | Resolved in-session — temp+fsync+rename+dir-fsync, inode-witness test |
| A-5 | Plan D4's Appendix B arithmetic used a non-validator counting rule | P2 | Resolved in-session — 707 → 772 measured with `scripts/validate-spec.ts:253-255` |
| A-6 | Unpushed backlog 4.7 d, past the 24 h AAR trigger | P3 | Recorded — the session's commit series addresses it; not an increment finding |

## Evidence

| Step | Command | Result |
|---|---|---|
| Baseline | `npx vitest run src/kb-migrate.test.ts` | 4/4 pass before the change |
| Baseline gates | `npm run check` | 21/22 pass; only `check-loop-artifacts` failed on the half-written increment; 0 errors with the directory aside |
| Tests | `npx vitest run src/kb-migrate.test.ts scripts/lib/kb-seed.test.ts` | 10/10 pass |
| Mutations | seal removed / `.enc` removed / direct write / seed filter removed | 3, 2, 1, 2 failures respectively; restored tree 7/7 and 3/3 |
| Spec | `npm run validate-spec` | pass; REQ-108 at 772 chars / 6 sentences / 8 SHALLs |
| Session gate | `npm run check:fast` | PASS, 19 gates, 28.8 s |
| Pre-push gate | `npm run check` | PASS, 22 gates, 163.9 s |

## Conditions

- C-1 (a failing assertion exposes a defect, never a weakened bar): upheld — the only pre-change failure was the mis-named test asserting the old behavior, and it was rewritten rather than relaxed.
- C-2 (envelope format unchanged): upheld — `sealEnvelope`/`openEnvelope` are used as-is.
- C-3 (named seam): upheld — `writeArtifact` injection, no permission simulation.
- C-4 (registry-backed audit): the audit gate ran and passed in the full check, so no substitute gate was needed.

## Follow-ups

Zero open P0/P1. The rekey-does-not-reseal limitation and the operator-only retention rule are recorded in D-118 as standing decisions, not roadmap items.

LOOP PAUSED
