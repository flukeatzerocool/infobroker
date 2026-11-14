# Stage 1 — zoom out (revision 1)

Verdict: FAILED — 2 Blockers, 8 Majors, 5 Nits.

## Blockers

1. **[design]** D1 does not discharge its own premise. `capConfidence`
   (`src/calibration.ts:34-43`) pins every all-`web_search` finding at `0.7`, so
   the plan's "three web families → confirmed" assertions and its "generic web
   sources can now reach confirmed" impact claim cannot hold, and the rejection
   argument for alternative (c) applies equally to D1.
2. **[design]** The done bar is unreachable from the listed steps: no step
   changes the cap, the weights, or the config.

## Majors

3. Invariant 1's title ("tier membership survives every shipped weight") is
   false on the plan's own numbers (`0.8325` is in the `0.7-0.9` band).
4. C5 removes a roadmap section whose close condition ("shipped defaults and
   prose agree") the increment does not satisfy.
5. Two §8 line cites are off by ~16 lines (`963-969` → `979-985`; `986` →
   `1002`).
6. The single-source worked example is arithmetically wrong (`0.2475` vs
   `0.2775`) and invents a "0.3-tier floor".
7. C4's averaging basis (per source) contradicts `computeConfidence`'s (per
   family).
8. The provider/`source_type` claim is unsupported by `config.json`.
9. `applyAuthorityWeight`'s contract is underspecified for both callers.

## Nits

10. Depth line says two production modules; the blast radius names three.
11. Review bookkeeping is self-contradictory.
12. The red-before instruction for the `0.49` assertion is self-cancelling.
13. D2's "a superset still clears `0.9`" is narrower than stated.
14. D1's rejection of alternative (b) cites REQ-026, which does not forbid it.
15. The trust-boundary paragraph overstates its own sourcing.
