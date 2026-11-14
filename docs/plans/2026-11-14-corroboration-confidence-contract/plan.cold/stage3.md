# Stage 3 — critics (revision 2)

Three lenses, run in parallel. Synthesized: 5 Blockers, 14 Majors, 13 Nits.

## Blockers

- **[design]** `reconcileClaims` defaults `confidenceThreshold` to `0.5`
  (`src/corroborate.ts:225`), so the plan's `unverified` verdict assertions only
  hold if the tests pass `0.8` explicitly. The plan never said so.
- **[design]** C4 has no weight source: `scripts/calibrate-confidence.ts`
  imports no config, and `weights` is an undefined binding at the specified
  call site. Three candidate sources have different consequences for
  determinism.
- **[design]** The single-source edge case is wrong: count-1 findings
  short-circuit at `:289-293` and never apply a weight.
- **[clarity]** The done bar counts five assertions; §Verification lists six.
- **[clarity]** The roadmap close condition quotes one limb and drops "and each
  branch is asserted", which decides closure.

## Majors

- Weights above `1.0` invert the damping into amplification; the existing
  `{ academic: 2.0 }` test depends on the clamp the formula dropped.
- C4 destroys the evidence for the follow-up it files (the `0.92 / 0.80` band
  is re-binned).
- The measuring instrument is the measured code, so the close condition is
  satisfiable by construction without an independent pin.
- `familyWeightMean` is order-dependent for a mismatched-type family.
- D2's error direction flips (truncated republications stop merging), and the
  plan argues only the improvement.
- Verification 5's `confirmed` verdict depends on LSA clustering and the
  conflict lexicon, not on C1.
- No existing integration test exercises the weighted path; the mocked config
  never sets `authority_weights`.
- `src/calibration.ts` declares only REQ-123 while gaining REQ-026a behavior.
- Two token families (`C1…C5` changes, `C-1…C-6` assumptions) collide.
- The shipped weight table is never listed, so the numbers are not derivable.
- "Becomes confirmable at `0.8775`" is false: `0.81` already confirms.
- C3 pins the Confidence column but not the Rating column the dispute is about.
- "Excluded as gaps" has two opposite readings.
- C4 changes the measurement target with no decision entry.
- User impact omits the single-source movement.
- The red-before rule is claimed then retracted; assertion 3 cannot be red.

## Nits

Naming (`reported_before_cap`), a non-existent "cap event", the §8.2 range end,
undefined "reconcile level", "confirmation gate" vs a threshold value, §8.2
silent on contested, forward references, helper empty-array contract, the
follow-up roadmap section's undefined shape, the unowned README row, `toBe` vs
`toBeCloseTo`, and "delegate the product" carrying multiplier language.
