# Cold pass 2 — diff re-review report

**Protocol:** diff re-review (review only added/changed lines; no new full-lens
sweep).
**Previous artifact:** revision 1, sha256 `fad1c384…`
**Revised artifact:** revision 2, sha256 `32c1abc2…` (before the condition-only
amendment recorded below)
**Verdict:** `independent-review FAILED.` on one new Major; both prior Blockers
and all eight prior Majors resolved.
**Reads:** 10/10.

## Resolution table

| # | Prior finding | Status |
|---|---|---|
| B1 | Contradiction gate vacuous | Resolved — vacuity stated as the finding; sentence-scoped detector; classified dry run; unit cases |
| B2 | Nonexistent fixture suite in the done bar | Resolved — unit test proves the list; no fixture mode |
| M3 | Rollback unit stated three ways | Resolved — C1 as a unit, C2 independent |
| M4 | C1 committed a false spec sentence | Resolved — C1 carries spec + gate + tests + CHANGELOG + DECISIONS |
| M5 | "The conformance report" undefined | Resolved — carrier is "the conformance gate" |
| M6 | Appendix B counts wrong | Resolved — replacement quoted; 4 sentences / 5 SHALLs / 0 backticks; +10 char delta verified |
| M7 | Register coupling incomplete | Resolved in intent; execution defective — see M1 below |
| M8 | README absent from blast radius | Resolved |
| M9 | CHANGELOG after the gate change | Resolved — C1 step 5 |
| M10 | Self-fulfilling applicability rule | Resolved — rule redefined; `manage_kb` auth is a gap; justifications in `tasks.md` |
| N1–N5 | Earlier nits | Resolved |

## New findings

**M1 [Major][clarity] — the DECISIONS.md fragment swap produces a broken
sentence.** The revision quoted only the fragment
`"reports shadow candidates, annotation-contradiction candidates"`, which
leaves "and per-tool signals" without a verb, duplicates the precondition list,
and deletes the shadow-candidate reporting fact that REQ-106 requires and the
gate performs. Required: quote the complete replacement sentence and keep
shadow-candidate reporting.

**N1 [Nit][clarity]** — the `src/tdqs.ts:424-428` doc comment ("Report-only
candidates…") is not updated, though it is the text F-R9-B-2 cites as the drift
source.
**N2 [Nit][clarity]** — the `check-tdqs` `USAGE`/exit-code text is not updated
("1 = structural violation", "always exit 0").
**N3 [Nit][design]** — the `stored` rule names "temp files", which would make
the class universally applicable via the truncation output.
**N4 [Nit][clarity]** — the rollback parenthetical omits the test file and the
DECISIONS edit.
**N5 [Nit][clarity]** — "defines 'conformance gate'" overstates `:379`; the REQ
uses the term as a subject.
**N6 [Nit]** — the char count could not be shell-verified in the review context.

## Amendment after this report (condition-only)

Revision 3 applies exactly these changes and adds no file, gate, or destructive
operation, so per the plan-review cap rule it is re-stamped and verified by
`build-review` rather than re-reviewed:

- C1 step 6 now quotes the complete DECISIONS replacement sentence and keeps
  shadow-candidate reporting.
- C1 step 7 updates the `src/tdqs.ts` doc comment.
- C1 step 3 updates the `check-tdqs` `USAGE` and exit-code text.
- The `stored` applicability rule is narrowed to state under the tool's own
  control; transport-level truncation artifacts no longer make it apply.
- The rollback parenthetical names the test file and the DECISIONS edit.
- "defines 'conformance gate'" becomes "uses 'conformance gate' as its subject".

## Unknowns

- `git HEAD`, the `check:fast` baseline, the declared hash, and the character
  count were not shell-verifiable in the review context (shell denied). The
  parent measured them with `wc -c` and `sha256sum`.
- No repo-wide grep was available to the reviewer; the parent confirmed the
  removed report key has no consumer outside `src/tdqs.ts`,
  `scripts/check-tdqs.ts`, `src/tdqs.test.ts`, and `dist/` (build output).
