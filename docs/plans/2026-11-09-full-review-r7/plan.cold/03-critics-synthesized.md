# Stage 3 — critics (synthesized, pre-amendment artifact)

Artifact sha256 reviewed: e764b54577c23796a5ea75ec075c4c6e164004a5cafb5564d2c8749ecdaee7b1

## Blockers

1. [Blocker][design] Probe (b) cannot run: `monitor-watchlist` requires `--watchlist` and `--out`
   (`scripts/monitor-watchlist.ts:82-86`); the plan named neither.
2. [Blocker][design] The split partition drops cluster H (§1 goal 5), so the split-close done bar
   is unsatisfiable.
3. [Blocker][design] R7 owns the §4.7 REQ bodies but no step reviews them as prose and no fix path
   permits editing `infobroker.md`.

## Majors

4. [Major][design] Offline-only makes REQ-125 per-topic error isolation and REQ-120/120a
   server-dependent branches unobservable, forcing findings by construction.
5. [Major][design] The split decision is recorded before the gate-assertion evidence that
   determines probe-dependence, with no re-evaluation point.
6. [Major][design] A red gate caused by another chunk's file has no D60 path, so it can force
   `LOOP OPEN` on work R7 does not own.
7. [Major][design] `test-debate-club` is called environmental although the Arena is deterministic
   and offline; a real regression could be absorbed as `NOT_RUN`.
8. [Major][design] The chunk's stated primary finding class (a defect class absent from the fixture
   corpus) is not procedurally detectable.
9. [Major][design] The pre-scan anchor count uses `grep -c 'REQ-'` mentions, not the D59 distinct-anchor
   unit, so the "well under 120" claim is not like-for-like.
10. [Major][design] On a split, REQ-115's cross-surface "one scale" clause spans clusters A and B
    and neither chunk can judge divergence.
11. [Major][clarity] D61 says artifact-exempt REQs are checked without tests, while EV4 lists tests
    for five of them.
12. [Major][design] Probe (b)'s due-selection is clock-dependent, contradicting D64's
    "no leg reads the wall clock".
13. [Major][design] Step 20 runs the gate-assertion check after verdicts with no re-open path.
14. [Major][design] Step 26's "final-tree" gate precedes the CHANGELOG/README authorship in step 27.
15. [Major][design] Phase 0 steps 2 and 4 have no failure branch.
16. [Major][design] The self pass and cold pass are promised but not in the numbered sequence.
17. [Major][design] Step 27's commit order is not the AGENTS order it cites.
18. [Major][design] File-level cluster ownership overlaps (SKILL.md, workflows.md, pipeline-map.md,
    test-fixtures/reports/) with no filing rule.
19. [Major][design] Cluster H is in neither split partition.
20. [Major][clarity] "Before the roadmap edit" is undefined and step 21 already edits ROADMAP.md;
    formatting repairs point at step 22 only.
21. [Major][clarity] The artifact-exempt count (13) is not reconciled with the 15-entry list.
22. [Major][clarity] EV6 does not support the anchor count.
23. [Major][design] `src/intent-citations.ts` has three claimant chunks and no declared owner.
24. [Major][design] REQ-052 is in cluster A but its four artifacts are read in cluster B.
25. [Major][clarity] Carrying-test/gate map drifts from the review-surface cells.

## Nits

26. `--claims-out` given without a path.
27. Naming drift: "App D"/"Appendix D"; "split" vs "split commits"; "chunk" vs "increment".
28. D62/step-20 gate lists differ.
29. EV9 does not mention the inverted R4/R5/R6 dates it is asked to correct.
30. Rollback units and the 0–2 scale are undefined.
31. REQ-117's revision/supersession clauses are unreachable from probe (a).
