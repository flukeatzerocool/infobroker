Reviewer: review
Plan sha256: ee943465ed0feac9e1b3bb3355301d49659cf95463d368448c0ce117a032e36b

# Cold pass — chunk R7 plan

independent-review passed. plan.md — 5 stages (1, 2, 3, 4, 5), 3 stage-3 lenses, 2 stage-5 audits.

## Outcome

- Stage 1 (zoom out): 2 Blockers, 12 Majors, 9 Nits — all addressed.
- Stage 2 (comprehension): faithful; no clarity Blocker.
- Stage 3 (critics: design, structural, style): 3 Blockers, 22 Majors, 6 Nits — all addressed.
- Stage 4 (re-zoom): 6 Majors + 4 Nits — all addressed; partition arithmetic verified
  (11 + 6 = 17, disjoint, cluster H included).
- Stage 5 (readiness): first pass NO-GO (2 Blockers, 3 Majors, 4 Nits) — addressed.
  Re-audit NO-GO (3 Blockers) — addressed. A user-authorized third targeted confirmation
  returned **GO**, with two executable Majors recorded as conditions below.

## Residual conditions (not blockers; build-review verifies)

- **C-1 — `Next trigger` semantics at a split close.** Step 22 prescribes
  `R7b … Next trigger: R7a closed`, a predecessor-naming cell that EV9 classifies as drift.
  Pick one convention before exercising the split path: successor-naming (`R7b` on the R7a
  row, `R8` on the R7b row) is preferred and consistent with the column's other rows.
- **C-2 — P-level for the "script-only runner" judgement.** D61 says a script-only surface is
  reported with the spec line but assigns no P-level. When step 16 makes that judgement,
  assign P1 if the rule requires an MCP tool, P2 if the script satisfies the intent and only
  the wording diverges, and record a roadmap section only for P1.

## Unknowns

- `parseWatchlist`/`dueTopics` validation bounds were not read; if `interval_hours: 1000000`
  is rejected, adjust the fixture's not-due topic rather than the expectation.
- Whether `src/lib/watchlist.test.ts` asserts per-topic isolation decides P1 vs P2 for a
  REQ-125 behavior finding, per D61.
- No gate inspects worklist status-row shape; the split representation is verified by reading
  the two rows against step 22.

## Coverage note

Stages ran in fresh `review` subagents with only the artifact, the named targets, and the cited
standards. The parent did not pass authoring context. Project instructions were visible in the
child context; that weakens isolation but did not change the findings.
