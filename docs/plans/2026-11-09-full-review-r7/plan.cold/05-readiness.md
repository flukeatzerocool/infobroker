# Stage 5 — readiness (cold pass, twice)

## First pass

Artifact sha256: 5c630b3d2dee3370bcbb520328f3e97ad0ee17bb911915f405bf35d8a1b85ba5
Reads: 8/8

NO-GO. Blockers, each [design]:

1. The loopback provider fixture had no consuming leg (dead fixture), because the watchlist live
   half was already `NOT_RUN`.
2. `--no-validate --report <defect fixture>` left the fixture unnamed; a `missing-*` fixture would
   fail before rendering.

Majors: `check-skill-harness`'s implementing file unnamed; D61 vs EV2 conflict on REQ-125's
evidence class; split-close tracker output unspecified. Nits: stale status header; D61 omitted
`report-render.test.ts`; watchlist fixture schema not restated; `check-pack` attribution mechanism
unstated.

All addressed in the second amendment.

## Re-audit

Artifact sha256: 4b7a1f2eb9f4ed809129f9a3e2a88fc1cafb4d32041d4162d3bd71f9c3339547
Reads: 6/6

NO-GO. Blockers:

1. [design] The watchlist fixture pinned only `last_run`, not `interval_hours`, so due-ness was
   still under-specified. **Fixed after the re-audit** — the fixture now pins two topics with
   explicit `interval_hours` and an expected summary.
2. [clarity] REQ-125's evidence class and severity were contradictory (static ⇒ finding vs
   pre-declared P2). **Fixed after the re-audit** — step 16 reads the test first; severity is
   assigned from the finding (missing/wrong branch P1, implemented-but-unobserved P2).
3. [design] Split-close tracker output not specified to an observable standard. **Fixed after
   the re-audit** — step 22 now names the two rows and their cells.

Majors fixed after the re-audit: EV8 wrongly denied a `render-report` package script; the
final-tree gate ran `check:fast` where AGENTS requires a full final check; `--json` not evidenced;
render-report output commands ambiguous; defect-fixture set unenumerated (now "every non-`good-*`
file"). Nits on D2/calibration-rule references and step ordering fixed.

## Status

The stage-5 re-audit cap (one re-audit) is reached. The corrected text has not been re-confirmed
by a third pass; per the independent-review cap this is escalated to the user rather than looped.
