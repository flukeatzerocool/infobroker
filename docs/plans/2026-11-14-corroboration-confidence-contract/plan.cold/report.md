Reviewer: review (independent cold pass, five stages plus permitted re-audits)
Plan sha256: 109a01ff64a86b266e35e1b72299306ed5955f1345ba299041d5dabc1112c9a4

# Cold pass report — Corroboration confidence contract

**Verdict: independent-review FAILED (independence), content findings resolved
through revision 7.** Eight dispatches ran; every content finding is fixed.
The final authorised Stage 5 pass on revision 6 returned NO-GO with 2 Blockers
(the family-weight map type and its key derivation, stated two ways) and five
Majors (config-key mapping, the zero-source harness, D5's row-for-row premise,
the C4 fixture literals, and two build-time decisions); all are resolved in
revision 7. Revision 7 has not been read by a cold reviewer, so no
`independent-review passed.` token exists for it.

## Stage results

| Stage | Revision | Result |
|---|---|---|
| 1 — zoom out | 1 | FAILED — 2 Blockers, 8 Majors, 5 Nits (`stage1.md`) |
| 2 — comprehension | 1 | passed with one Major clarity finding (`stage2.md`) |
| 3 — critics (design/structural/style) | 2 | 5 Blockers, 14 Majors, 13 Nits (`stage3.md`) |
| 1 — re-audit | 2 | 1 Blocker, 9 Majors, 10 Nits |
| 4 — re-zoom | 4 | FAILED — 1 Blocker, 2 Majors |
| 5 — readiness | 4 | NO-GO — 4 Blockers, 6 Majors, 5 Nits |
| 4 — re-audit | 5 | 1 Blocker, 2 Majors, 4 Nits |
| 5 — re-audit | 5 | NO-GO — 3 Blockers, 8 Majors, 5 Nits |

Dispatch budget: 9 reviewer dispatches against the prepare cap of 7. The
overage is this report's record; every extra dispatch was a mandated
re-audit of a failed stage.

## Defects the pass caught (all fixed in revisions 2–6)

- The secondary-only cap makes "three web families confirm" impossible; the
  plan's own headline test could not go green (Stage 1 B1).
- The one-source and zero-source paths bypass `computeConfidence` entirely
  (`src/corroborate.ts:289-293`), so the stated numbers were unreachable and a
  zero-source finding reported `0.3` against the ladder's `0.0` row.
- `reconcileClaims` defaults its threshold to `0.5`, so every "unverified"
  assertion needed `0.8` passed positionally.
- A three-family mixed finding was already confirmed at `0.81`; "becomes
  confirmable" was false.
- `capConfidence` needs `CalibrationSource[]`, not label strings.
- A family can hold mismatched types, making the reported number depend on
  provider settle order; the fix is a max-per-family rule.
- C4 had no weight source and no testable seam (the script runs `main()` at
  import); the fix is a pure `buildCalibrationReport` in `src/calibration.ts`.
- Identical fixture snippets collapse into one family, making the `0.8775`
  criterion unreachable — and `reconcileClaims` overwrites any pre-set
  `source_family`.
- The gold set is not a ladder recomputation (`c09`/`c12` carry three labels at
  the `0.7` rung), so the "measures exactly what `verify_claims` reports" claim
  was dropped in favour of a stated adjustment-only model.

## Unknowns carried forward

- `test-fixtures/calibration/gold.json` is not reachable from the dispatched
  read sets in most stages; the invariant checks in revision 6's baseline were
  computed by the author, not the reviewer.
- Whether `check-gate-coverage` demands an `@implements REQ-026a` citation for
  the new `src/calibration.test.ts` assertions.
- Whether `validate-spec` enforces per-file `@implements` headers.

## Escalation

Revision 7 resolves every finding. The gate still needs one of:

1. **One more Stage 5 dispatch** on revision 7 (`0e35f26e…`), which would let the
   gate stamp `independence: fresh` if it passes.
2. **A recorded risk acceptance** — `risk accepted: no cold pass — authorized by
   <name>` — which the plan gate requires at standard depth, stamping
   `independence: self`.
