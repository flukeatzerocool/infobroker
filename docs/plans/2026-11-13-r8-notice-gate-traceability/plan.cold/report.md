Reviewer: review (independent-review cold pass, five fresh dispatches)
Plan sha256: dc5578e54befe63c975a30c0068052e4dfa94ba212434d74fdf083a77b061be5

# Cold pass report — R8 notice and gate-traceability evidence

Token: **independent-review FAILED.** (stage 5, NO-GO, cap reached)

Stages run: 5/5 (stage 5 twice, per the cap).
Reads: stage 1 (1), stage 2 (2), stage 3 design (10), structural (5),
style (1), stage 4 (9), stage 5 pass 1 (10), stage 5 re-audit (10).

## Synthesis

- **Stage 1 (zoom-out):** one Blocker (the "evidence gap" premise vs the
  weaker-shape fallback), fifteen Majors, nits. Revision 3 removed the
  fallback and corrected the anchors, counts, slices, and commit ownership.
- **Stage 2 (comprehension):** faithful-with-gaps; no clarity Blocker.
- **Stage 3 (critics):** three lenses. Two Blockers — a REQ-attribution
  challenge (refuted against `infobroker.md:653-654`, which places the
  cooldown clause in REQ-111a) and the §E.5 step contradiction. The §E.5 table
  was dropped as duplicative (Alternative H); the test now asserts the
  non-duplicating chain (body scope → manifest gate).
- **Stage 4 (re-zoom):** no Blockers; five Majors (fixture counts, a red-first
  claim with no mechanism, "single source of truth" ungrounded, a
  hand-maintained scope list, a misleading retained message). Revision 4/5
  derived the scope, resolved the §9.5/`_Check:_` question, and re-derived
  anchors.
- **Stage 5 (readiness), pass 1:** NO-GO — step/commit order, check-4 message
  specified two ways.
- **Stage 5 (re-audit):** NO-GO again — the commit-series numbers had not been
  renumbered; C-2 still described the old scope source; a preserved-message
  count regression; a check-numbering drift; C-1 falsified by the control call;
  T8's restore had no baseline; and check 4 was stricter than REQ-096's
  "controlling requirements or named residual risks" wording.

## Terminal disposition

The cap was reached at stage 5's second failure and escalated to the user.
Revision 6 applies every remaining finding: commit-series renumbering, body-
derived scope in C-2 and the verification table, check 4 restored to the
unchanged §E reference assertion (so four messages stay verbatim and three
checks are new), one check number for the out-of-standard category case, C-1
scoped to post-cooldown responses, T8's sha256 restore baseline, the §9.2
bullet added to the done bar, and a local `toolPayload()` helper for the
inspect calls.

**The user approved revision 6 as-is**, accepting the residual risk that the
editorial fixes were not independently re-audited. The design premise —
drive a real cooldown through the tool boundary; assert OWASP category
completeness and §4.11→§9.5 gate presence — was accepted by stages 1–4
against revision 4 and is unchanged in substance.

## Unknowns carried forward

- Whether the first successful fallback response already carries the notice
  (T3 settles it; C-1 defines the stop).
- Whether `check-gate-coverage` treats the added `REQ-111a` citation additively
  (T13 confirms).
- The plan's own test-visible assumption that `inspect_providers action=list`
  carries no `notices` key (the control call proves it at run time).
