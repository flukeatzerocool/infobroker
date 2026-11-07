# Plan — Loop and gates (increment A)

**Status:** Approved (user, 2026-11-07).
**Mode:** planned. **Gate:** build-review.
**Review artifact:** `~/.local/state/opencode/plans/3b34aea2bce9fb4da60d99c296e2000157a146aca988b48969a73d1a3d3aec94/2026-11-07T15-33-02-346Z-22038df9.md`
(sha256 `22038df92a745186355fed1c357cb3eb15197a951fbda16b77da7cf2761b0be6`).

**Done bar:** `npm run check` and `npm run check:fast` green;
`check-gate-table` and `check-loop-artifacts` green; the AAR carries a LOOP
token; `npm run session:close` passes for this increment; the commits land.

## Why

ROADMAP item 1 asks for one vocabulary and cadence across Infobroker and
Holonovel. Increment A builds the Infobroker half of the shared commands:
`check:fast`, a manifest-driven gate runner with a run record, tracked
increment artifacts with `session:close`, and the loop audit. Increment B
(next session) adds the hermetic pipeline harness and the tag policy.

## Decisions

D1–D9 are in the reviewed artifact. Two were amended during the build:

- **D8 amended.** `.infobroker/` is rejected by `check-shipped-kb-empty` as
  shipped KB data, so loop state lives in `$TMPDIR/infobroker/`, keyed by a
  hash of the repository root, in a 0700 directory.
- **A2 extended.** `npm run typecheck` covers `src/**` only, so the new
  tooling was not typechecked. `tsconfig.scripts.json` plus a
  `typecheck:scripts` gate closes that, with seven pre-existing type errors
  fixed in place.

## Blast radius

New: `docs/workflow-cadence.md`, `docs/plans/README.md`, this increment;
`scripts/lib/{gate-manifest,gate-run-manifest,loop-artifacts,loop-audit}.ts`
and their tests; `scripts/{run-gates,check-gate-table,check-loop-artifacts,session-close,loop-audit}.ts`;
`tsconfig.scripts.json`.

Modified: `package.json` (gates, check, check:fast, check-gate-table,
check-loop-artifacts, check-shipped-kb-empty, session:close, loop-audit,
typecheck:scripts), `AGENTS.md` (gates table, loop governance),
`DECISIONS.md` (D-091), `scripts/lib/args.ts` (shared flag parsing),
`scripts/validate-spec.ts` (REQ-101 reads the manifest; the AGENTS table check
moves to `check-gate-table`), `.githooks/pre-push` (run record),
`scripts/push-pipeline.sh` (writes the record after the commit),
`scripts/{audit-session-logs,benchmark-kb-store,check-shipped-kb-empty,validate-readme}.ts`
(type fixes), `scripts/lib/release-policy.test.ts` (union access).

Rollback cost: 1 (each phase is a commit; revert it). No remote state changes.

## Verification

- `npm run check:fast` → PASS, 17 gates, 7.3 s (4 in flight).
- `npm run check` → PASS, 20 gates, 31.9 s.
- Seeded type error → FAIL `typecheck:scripts`, exit 1 (attribution proven).
- `run-gates --list` first 18 gates → identical to the retired `&&` chain.
- `run-gates --record-only` → `--recorded` reports `full`; after a file edit it
  reports `none`; after restoring it reports `full` again.
- `npm run loop-audit` → 10 historical heading-vs-commit date drifts found.
