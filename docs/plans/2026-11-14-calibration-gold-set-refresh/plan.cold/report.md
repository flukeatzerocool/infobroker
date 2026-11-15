# Cold pass — report

Reviewer: review-agent (stage dispatches, fresh context each)
Plan sha256: `3d72ba374361af74af1d8a89b434ddec6f5e45396e0b4546f91a1922d0c46a50`
Pass: 1 of 1 (standard depth) plus one authorized Stage 5 re-audit past the read cap
Stages run: 5 of 5, Stage 5 twice

## Outcome

`independent-review FAILED.` — Stage 5 has failed twice (revision 3: 5
Blockers; revision 4: 3 Blockers). Per the stage rule, the pass is escalated to
the user rather than re-run a third time. Revision 5 resolves every finding,
but the cold pass issues no pass token.

## Stage results

| Stage | Verdict | Headline findings |
|---|---|---|
| 1 — zoom out | 3 Blockers, 12 Majors, 7 Nits | label re-derivation circular for constructed rows; excerpt pair unreproducible; `0.3-0.5` claimed structural while `0.3000` is in-band |
| 2 — comprehension | faithful-with-gaps, then faithful | "out-of-order/split results" undefined; claim wording unnamed |
| 3 — design | 8 Majors, 9 Nits | hardcoded weights vs `config.json`; C2's weight map absent from its file; loader untested; source-type typos silently re-band; `documented` vs `observed` provenance gap; `c09`/`c12` rung inconsistency |
| 3 — structural | 2 Blockers, 8 Majors, 3 Nits | `check:fast` includes `check-loop-artifacts`; pinned Brier committed before the run that produces it; source-type vocabulary unowned; `loadGold` untested; revert independence false for C2/C3 |
| 3 — style | 3 Blockers against a stale `tasks.md`, 10 Majors, 7 Nits | plan/tasks topology mismatch; revert coupling; `observed` overloaded; cap arithmetic; gate-set drift |
| 4 — re-zoom | 2 Majors, 5 Nits | C4 `aar.md` contents stated three ways; independence ledger premature; weights-key rule unconfirmed; per-basis rules lacked negative cases |
| 5 — readiness | NO-GO: 5 Blockers, 5 Majors, 6 Nits | required `CalibrationEntry` fields break existing literals; `0.3721` form unspecified; top-band guarantee depended on re-derivation; band assertions lacked a data flow; "both limbs met" had no owning step |
| 5 — authorized re-audit | FAILED: 3 Blockers, 5 Majors, 5 Nits | script replacement left `raw`/`weights` unbound; shingle-count annotation disputed; `0.2775` placed in different commits |

## Resolution in revision 5

- Labels are grounded in documented claims with `truth_sources` (`documented`);
  `parseGoldSet` enforces version, id, claim, rung, source-type membership and
  uniqueness, per-basis truth rules, and URL shape, with negative tests.
- The script replacement is written as literal code: settings load first,
  `JSON.parse(readFileSync(gold, "utf-8"))`, then `parseGoldSet(parsed, weights)`.
- `ValidatedGoldEntry` gives the parser a narrowed return type; the optional
  fields on `CalibrationEntry` keep existing literals compiling.
- The excerpt pair is fixed verbatim with its derivation: 46/43 vs 19/16 tokens
  and four-gram shingles, `16/43 = 0.3721`; `textSimilarity` and
  `assignSourceFamilies(pair, 0.9)` calls are stated.
- `n0` (true) and `n1` (false) make the top band's mixed outcome independent of
  re-derivation; the fixture is 18 rows, counts 4/2/3/5/4.
- Band counts use `report.reliability`; the top band's outcomes use
  `report.rows` filtered by `adjusted >= 0.9`.
- The drift guard reads `../config.json` by the script's path, compares the
  weight projection and the calibration block, and the stale comment is
  rewritten.
- `aar.md` is seeded before commit 1 with `LOOP OPEN`, `**Review cap:** 2
  passes; used 2`, and C4 finalizes it with probes, cap line, and the
  both-limbs sentence in the CHANGELOG.
- `c09`/`c12` rungs are corrected to `0.9`; the parser rejects repeated source
  types.
- The `0.2775` literal ships in commit 1; commit 2 touches only
  `src/source-family.test.ts`.
- Probe commands are spelled out with `--gold` and `$TMPDIR` paths.

## Escalation

The gate decision (proceed without a cold pass token, or authorize a third
targeted Stage 5 pass) is the user's. Content-wise, two independent Stage 5
passes found only mechanical defects, all now resolved; process-wise, the cold
pass is not certified.

## Unresolved

- No `independent-review passed.` token for revision 5.
- `config.json` keys were confirmed by a parent read, not by a reviewer.
