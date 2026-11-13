# Cold pass 1 — independent review report

**Artifact reviewed:** `plan.md` revision 1, sha256
`fad1c384137a98818a4ddee4c11266206a4cec7ee6ac22851b8fe9b959add44f`
(stored as `2026-11-13T22-37-46-502Z-fad1c384.md`)
**Verdict:** `independent-review FAILED.`
**Stages:** 4/5 (1 zoom-out, 2 comprehension, 3 critics, 5 readiness; stage 4
not triggered — no author edits during the pass). Four stages ran sequentially
in one cold context because nested subagents were unavailable; the authoring
context was absent.
**Reads:** 22/40.

## Blockers

1. **[design] The promoted contradiction gate is vacuous — F-R9-B-2 is not
   closed by the plan's own mechanism.** `plan.md:140-148` keeps
   `annotationContradictionCandidates` unchanged and folds it into
   `conformanceViolations`; `plan.md:162-163` promises `check-tdqs` exits 0 on
   the live tree. The detector is `MUTATION_VERBS.test(desc) &&
   !NEGATIONS.test(desc)` (`src/tdqs.ts:434`) with `NEGATIONS =
   /\b(never|not|no|without|cannot|…)\b/i` (`src/tdqs.ts:390`). Every
   conformant description is required to contain "Do NOT use"
   (`scripts/validate-spec.ts:1089`, `src/tool-surface.test.ts:143`), which
   matches `\bnot\b`, so the function returns `[]` on any surface that passes
   the existing bar. (a) The dry run is guaranteed by construction; (b)
   promotion adds zero detection power; (c) the only fixture that can fire
   lacks the mandatory phrase and is already rejected by other gates.
2. **[design] Done bar #2 demands a contradiction fixture suite that does not
   exist and no task creates.** `plan.md:206`; `scripts/check-tdqs.ts:25-28`
   accepts only `[--report] [--help]` and `listTools()` (`:88-98`) spawns the
   real server, so the tool list is not injectable.

## Majors

3. **[clarity] Rollback unit stated three incompatible ways.**
   `plan.md:5-7` vs `:234-237` (C1–C3 as a set vs C3 independently
   revertible).
4. **[design] C1 commits a knowingly false spec sentence**, since the report
   fields land in C2; AGENTS.md requires the REQ update in the same commit.
5. **[design] "The conformance report" is an undefined term in the spec.**
   `infobroker.md` defines "conformance gate" only.
6. **[design] Appendix B compliance claimed with wrong counts** — the body is
   4 sentences and 5 SHALL clauses; the replacement keeps 5, not 6; the
   replacement is never quoted.
7. **[design] Register coupling incomplete** — `worklist.md:532` and `:534`
   cite F-R9-B-3 and go stale; `DECISIONS.md:1190` says the gate "reports
   … annotation-contradiction candidates", falsified by C2.
8. **[design] README is named as changing but absent from the blast radius.**
9. **[design] Gate behavioral change ships two commits before its CHANGELOG
   entry** (AGENTS.md Script Discipline).
10. **[design] The applicability rule makes the disclosure matrix
    self-fulfilling** ("or explicitly disclaims"), and `manage_kb` auth is
    `n/a` although the tool dispatches through the provider chain; the `n/a`
    justifications are never written.

## Nits

- `plan.md:127` counts "5 documentation files" but enumerates 4.
- `plan.md:150` "always exit 0" contradicts the script's fatal exit 2.
- `plan.md:186`'s `## 2026.11.11` heading duplicates `CHANGELOG.md:3`.
- Line anchors disagree with `worklist.md:532` (`tool-surface.test.ts:130-180`
  vs `:140-205`; `validate-spec.ts:1076-1104` vs `:809-838`).
- `plan.md:5` "Rollback cost: 1 of 2" uses an undefined scale.

## Unknowns

- `git HEAD 27abc6c` and the `check:fast` 19/19 baseline were unverifiable
  without a shell.
- The "0 candidates" figure was inferred from the regex and the mandatory
  phrase, not executed (confirmed by the parent in revision 2).

## Resolution in revision 2

Blocker 1 — sentence-scoped negation plus exclusion of the guidance sentence;
verb list unchanged; classified dry run recorded in the plan. Blocker 2 — bar
restated: the unit test proves the violation list and the script's only failure
condition is a non-empty list; no fixture mode. Majors 3–10 — rollback unit
fixed to C1; C1 and C2 merged (spec + gate + tests + CHANGELOG + DECISIONS);
carrier renamed to "the conformance gate"; Appendix B counts re-derived to 681
chars / 4 sentences / 5 SHALLs / 0 backticks with the replacement quoted;
worklist rows 532/534/535/536 added and the DECISIONS sentence corrected;
README added to the blast radius; CHANGELOG moved into C1; applicability rule
redefined and `manage_kb` auth marked applicable. Nits — counts, exit-2
wording, CHANGELOG convention, anchors, and the rollback scale are corrected.
