# AAR — chunk R2 (config, providers, resilience)

**Status:** complete · **Date:** 2026-11-09 · **Loop:** `LOOP PAUSED`
**Plan:** `docs/plans/2026-11-09-full-review-r2/plan.md` (deep; cold pass 7 dispatches, 51/80 reads; two post-cap amendments C-1/C-2 recorded and verified; execution authorized by the user without a passing cold token).
**Predecessor:** chunk R1 and its remediation, commit `3cba54c`.

## What happened

1. Baseline at `3cba54c`: 26 carrying test files / 247 tests PASS; `npm run check:fast` PASS (20.1 s); only the untracked R2 plan directory. Split trigger did not fire.
2. Five cluster reviews (config, secrets/registration, reporting, resilience, prose drift) plus live stdio probes in an isolated `TMPDIR` and temp config layer.
3. One P0 found and fixed in-session: a user layer with `"providers": null` crashed startup with a raw `TypeError` before validation (`src/config.ts:223,325`). Guard added in `applyDefaults`, `loadConfig` recovery now wraps `loadConfigFromDisk`, and `config.test.ts` gained the regression test. Re-probe starts on shipped defaults with `invalid_merged_user_layer`.
4. Live probes: `inspect_providers` list/spec/health (including the health-without-provider error path and `last_success` after a fresh search), and an invalid `reload_config` patch followed by a still-serving list.
5. Verdicts: 25 REQs — 5 `holds` (REQ-014, REQ-031a, REQ-070, REQ-071, REQ-024), 20 findings. Prose: 13 surfaces — 9 `holds`, 4 findings.
6. 48 findings: 1 P0 resolved, 19 P1 and 8 P2 scheduled on `ROADMAP.md` § R2 findings remediation, 3 P2 closed, 16 P3 closed, 1 tracker-drift P3 fixed. Tracker drift corrected (R2 spec column, R8 code line).

## What went right

- The cold pass paid for itself: it turned an unexecutable probe plan and an overlapping split rule into an executable one before any review ran.
- The live probes produced positive evidence for the clauses that matter most (`inactive_reason`, `inline_fallback`, KB block, `last_success`, retention after a refused patch) instead of relying on citations.
- The P0 was demonstrated, not inferred: a one-line user layer reproduced it, and the fix was verified by test, typecheck, and a re-probe.

## What went wrong

- The cold pass ended at its re-review cap with two text blockers; they were fixed after the cap and verified by reading, not by a third cold review. That is a process debt carried into R3.
- The plan named `debate-club/src/client.ts` as the probe client; it is replay-only. The purpose-written probe worked but cost a detour.
- Trial and error on the P0 fix: the guard's first placement missed the `defaults`-less path used by the test fixture.

## Findings

The register is `worklist.md` § Finding register (F-R2-1 … F-R2-48). Terminal dispositions:

| Disposition | Count |
|---|---|
| Resolved in-session | 2 (F-R2-1 P0, F-R2-44 tracker drift) |
| `Scheduled-roadmap` (P1) | 19 |
| `Scheduled-roadmap` (P2) | 8 |
| `Closed-P3` | 19 (3 P2 evidence gaps, 16 P3) |

## Verification

- `npx vitest run` on the 26 carrying files → 26 files / 247 tests PASS.
- `src/config.test.ts` → 74/74 PASS after the fix.
- `npm run typecheck` → 0.
- `npm run check:fast` → PASS (20.1 s).
- Live probes → list 27 entries, spec 26/22/21 counts with KB block, health error path and `last_success`, refused patch then serving list.
- `npm run check` → PASS (see run log).

## Next

Chunk R3 (`search_web`) is the next sweep item. The R2 P1 remediation is scheduled on `ROADMAP.md` and starts after R3 closes.

LOOP PAUSED
