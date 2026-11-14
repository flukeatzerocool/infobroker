# Cold review — plan gate (standard depth)

Plan: `docs/plans/2026-11-14-register-reconciliation/plan.md`
Plan sha256: 411e9bf2848bedba4cf243cfc1875b5888750d04efd435afe023f441b12e3bae
Reviewed plan sha256 at the passing pass: `07b9f1b39cf9a8c02efa8f203acad5770041ab1406e01fd474254df5d22548aa`
(the only later change is the header status/independence lines)
Reviewer: `independent-review` subagent, fresh context, no authoring conversation,
under `/home/fluke/.config/opencode/skills/plan-review` (sections 0–8,
`references/review-prompt.md`, `references/spec-project-checks.md`) plus
`AGENTS.md` and `docs/plans/README.md`.

Three passes were run. Pass 1 and pass 2 each returned `independent-review
FAILED.`; the findings were applied and pass 3 (user-authorized beyond the
standard one-re-review cap) returned `independent-review passed.` with
`stages 5/5 · reads 2/6`.

Post-review change to the plan artifact: the header status/independence lines
only (`Status`, `Review independence`, `Date`). No body, step, decision, or
done-bar text changed after the passing pass. The passing pass reviewed both
blockers' fixes and confirmed no new blocker.

---

## Pass 1 — `independent-review FAILED.`

1. **[design] The `src/batch.test.ts:1` slug-ownership premise is false, and step 9 would re-bind REQ-021b's branch slugs to REQ-021.** `plan.md:82` asserted the six slugs "follow `REQ-021b` but belong to `REQ-021`"; `infobroker.md:274` (REQ-021b) defines exactly that vocabulary, while REQ-021 (`:268`) defines none of it. Step 9 would have re-bound them.
2. **[design] The register rewrite was scoped to one line, leaving two other demonstrably false census counts in the same table.** `worklist.md:583` (272 rows / 272 IDs), `:588` (roadmap-home census), and `:894` (`F-M1-2` "re-disposition deferred") remained false while the roadmap's close condition is that the census and the live tree agree.
- Major: tag-line distribution did not reproduce (28/70 claimed against 116/171 measured).
- Major: done bar 6 unobservable (no recorded baseline, no command printing per-REQ counts).
- Major: done bars 1–2 circular (the script compared against itself).
- Major: D5 referenced a non-existent "D4a" and contradicted D4.
- Major: the census script sat outside every gate and had no self-check.
- Major: equivocal denominator in D5 ("10% of tagged slugs").
- Nits: "loses six slugs" was five; the repeat-pair form is not documented in §9.4; the projection is at 909-919, not 904-916; step 2 said the census lists IDs but the plan listed line numbers.

Confirmed by the reviewer: 276 rows; 167 / 93 / 16 / 0 dispositions; the stale
census at `:585`; the 16 row lines; `provenance.sources[]` omitting
`snapshot_tier` while `:973` writes it and REQ-122 requires it; five malformed
tag lines with run lengths 8/4/2/6/2; 289 tag lines; `F-M1-3` already Resolved;
the REQ-122 test mock; `src/index.ts:740` reporting the tier on the deep path.

## Pass 2 — `independent-review FAILED.`

- B1 resolved; B2 resolved.
- **Blocker:** the literal 16-ID self-check made step 12 and done bar 1
  unpassable after the dispositions move.
- **Major:** "224 named tag lines / 68 at line 1" overcounted; slug-bearing
  lines are 194, 40 at line 1, 89 in lines 1–5 (30 of the 224 were REQ-to-REQ
  citations with no slug).
- **Major:** done bar 6 still circular — it compared post-change counts to a
  number pinned by the same post-change parse.
- **Major:** step 9 named "the `validate-spec`-visible tags" as a comparator
  that does not exist (`scripts/validate-spec.ts:359-368` prints tags only for
  a violating REQ).

## Pass 3 — `independent-review passed.` (user-authorized beyond the cap)

- **P1 resolved:** `plan.md:103-108` pins only disposition-invariant quantities
  (276 rows / 276 distinct IDs) and states why the scheduled-ID constant was
  rejected; step 2a prints the IDs for hand comparison; done bar 1 requires exit
  0 before and after plus both ID-set comparisons. No other passage requires a
  constant scheduled-ID set.
- **P2 resolved:** 194 / 40 / 89 reproduced independently over
  `src/**/*.test.ts` — exact match; 289 − 194 = 95 bare citations.
- **P3 resolved:** step 9 builds a pre/post table from the step-2b parse; done
  bar 6 compares against the pre-change column with "+17 slug instances"
  (7+3+5+1+1), which is falsifiable.
- **P4 resolved:** step 9 names the step-2b `python3` parse and records why
  `validate-spec` cannot serve as the comparator.
- **No new hard blocker or Major** introduced by the changed passages.

`stages 5/5 · reads 2/6`
