# AAR — R6 `manage_kb` action-evidence remediation

**Date:** 2026-11-10 · **Item:** `ROADMAP.md` § R6 `manage_kb` action-evidence
remediation · **Depth:** light · **Status:** closed — the section is retired.
**Plan:** `plan.md` (stamped `adb9e390…f19e3`, light, `self`; preflight: 5
targets, 11 REQs, 0 missing; evidence sidecar in the plan-gate state dir).

## What happened

1. **Baseline.** `npm run check` PASS (full, 22 gates, 54.3 s) at `a9c756c`,
   tree clean except the plan artifact; `status` 26 roadmap items.
2. **Probes.** `validate-spec` and `check-intent-citations` passed unchanged
   (142 REQs / 141 citations, 0 findings), confirming no spec or routing edit.
   All six mutation anchors were re-read before editing.
3. **Tests.** Added an isolated unit file (`src/kb-action-evidence.test.ts`,
   6 tests), an Arena file (`debate-club/src/kb-action-tools.test.ts`, 4 tests),
   and two legs in `src/kb-report-receipt.test.ts`.
4. **Conformance run.** All new tests passed on the unmodified tree — the
   findings were missing evidence, not defects, so no production change or
   CHANGELOG entry was needed.
5. **Mutation proof.** Six mutations (five findings, absent-source twice) each
   produced the expected failure, and every mutation was reverted with a clean
   `git diff`.
6. **Close.** Retired the roadmap section (26 → 25 work items), marked
   F-R6-A-4/5/6 `Resolved`, and wrote this record.

## What went right

- Reading each branch before writing a test kept the change evidence-only; the
  plan's assumption that the code already conformed held on the first run.
- Mutation proof replaced an impossible fail-first run without weakening the
  evidence: every assertion is shown to constrain the behavior it names.
- The isolated store avoided the shared-state drift in `src/kb.test.ts` and
  made the newest-first ordering deterministic through a `Date.now` sequence
  instead of a wall-clock sleep.

## What went wrong

- The first Arena lock-test attempt ran from `debate-club/` with a relative
  Python path, so that mutation never applied and the test passed; the run was
  discarded and repeated with an absolute target. The discard cost one call and
  changed no artifact.
- Plan preflight reported a nonexistent external path (`/invalid_input/`) — a
  prose false positive, not a path in the plan.

## Findings

| ID | Severity | Predicate | Disposition |
|---|---|---|---|
| F-AAR-1 | P3 | Preflight's absolute-path scan reads `/invalid_input/` out of plan prose as a path | `Closed-P3` — informational; preflight output treated as advisory for prose spans |
| F-AAR-2 | P3 | The roadmap says "tool-level assertions" for REQ-060i, but `stale` cannot be aged deterministically in the Arena subprocess | `Closed-P3` — unit-level `stale` plus tool-level absent-source, recorded as decision D4 |

No P0, P1, or P2 findings. No new action item is opened.

## Gate evidence

| Gate | Result |
|---|---|
| `npm run validate-spec` | PASS (142 REQs, 0 uncited) |
| `npm run check-intent-citations` | PASS (141 citations, 0 findings) |
| `npm run typecheck` / `tsc -p debate-club` | PASS |
| Unit (`kb-action-evidence` + `kb-report-receipt`) | PASS (37 tests) |
| `npm run test-debate-club` | PASS (5 files, 48 tests) |
| Mutation proof | 6/6 named failures; tree clean after each revert |
| `npm run check:fast` | PASS (fast, 22.1 s) |
| `npm run check` (full) | PASS (full, 22 gates, 60.2 s) |
| `check-roadmap` / `check-loop-artifacts` | PASS (25 sections / increment contract) |

## Next

The remaining R6 remediation sections stay scheduled in their roadmap order
(auto-index/scoping/expiry is next). No new action item is opened by this
increment.

LOOP PAUSED
