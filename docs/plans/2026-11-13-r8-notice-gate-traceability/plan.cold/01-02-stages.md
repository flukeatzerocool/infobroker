# Cold pass — stage 1 (zoom-out) and stage 2 (comprehension)

Reviewed revision 1 (`a38a4807…`). Two fresh reviewers, artifact only.

## Stage 1 — zoom-out

- **[Blocker][design]** "evidence gap, not behaviour gap" contradicted by the
  weaker-shape fallback: if the first response lacks the notice, REQ-111a is
  violated in production yet the done bar still permits `Resolved`.
- **[Major][clarity]** "four assertions" vs five enumerated new checks.
- **[Major][clarity]** regression-fixture count: three vs four messages.
- **[Major][design]** the new §E.5 table would satisfy the old §E-wide
  reference check, making it non-discriminating.
- **[Major][design]** `injectNotices` is conditional; the second probe tool's
  payload was never established to have no `notices` of its own.
- **[Major][clarity]** `search`, `parse`, `writeHermeticConfig`, `cfg.root`,
  `cleanups` used but not in the reused inventory.
- **[Major][clarity]** cooldown-window source unresolved (`retry-after` vs
  config).
- **[Major][clarity]** provider dispatch order asserted without support.
- **[Major][clarity]** neither parsed table's column schema stated.
- **[Major][clarity]** test placement stated as two different describes.
- **[Major][clarity]** phase order (T6 before T7) contradicted commit order.
- **[Major][clarity]** done bar demanded a full suite on a tree T17 mutates.
- **[Major][clarity]** baseline provenance self-contradictory.
- **[Major][clarity]** R9 both closed and named as the deferral target.
- **[Major][clarity]** CHANGELOG top heading unspecified.
- Nits: sizing, change-set enumeration, findings order/message names, commit
  order claim, rollback claim, evidence anchors, unattributed counts, id
  format, slice hardening, unknown attribution.

## Stage 2 — comprehension

Faithful-with-gaps; no clarity Blocker. The paraphrase reproduced the goal,
steps, and done bar. One Major: the done bar does not say whether the
weakened-shape variant closes F-R8-C-1. Nits: the regression property is
transient evidence; §E.5 equality is verified only by the checker itself.

## Disposition in revision 3

The weaker-shape fallback is removed (C-1 stops the increment); counts,
anchors, slices, hedge, request delta, column schemas, commit ownership,
rollback unit, and the bookkeeping row set are corrected; the §E.5 table is
dropped in favour of the non-duplicating manifest check (Alternative H).
