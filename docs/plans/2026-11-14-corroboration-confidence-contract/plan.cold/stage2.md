# Stage 2 — comprehension (revision 1)

Verdict: passed with gaps — `faithful-with-gaps`, 1 Major, 2 Nits.

The reviewer paraphrased the increment correctly (what changes, in what order,
and what "done" means) and identified one contradiction: the artifact says both
that the calibration script feeds stored ladder values straight to the scorer
and that the gold entries are pre-weighted ladder values. Nits: the
single-source "below the floor" phrasing, and `DAMPING = 0.25` chosen without a
reason. Unknowns were the unread target files, as designed.

Resolution in revision 2: C4/C5 wording separated "stored ladder base" from
"pre-weighted", the single-source arithmetic was corrected, and D1 gained the
constant's derivation. The residual contradiction was then superseded by
Stage 3's finding B3 (the one-source branch never reaches `computeConfidence`).
