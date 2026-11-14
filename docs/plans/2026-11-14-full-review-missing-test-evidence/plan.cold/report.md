# Cold review — 2026-11-14-full-review-missing-test-evidence

Reviewer: `review` subagent, one fresh context. Verdict: **independent-review FAILED.** — 7 Majors, 0 Blockers, 5 Nits, 21/40 reads.

Disclosure recorded by the reviewer: all five independent-review stages ran in one cold context rather than five dispatches; inherited host instructions were present. Findings were produced without the authoring conversation.

## Majors

1. Four rows name no test file for the driving assertion (`plan.md:44,46,50,64`; "handler test" at `:122,125`). No `src/index.test.ts` exists; the handler home for crawl behavior is `src/fetch-page-extraction.test.ts`.
2. Rows 2 and 3 pointed at the helper suites their predicates call insufficient (`src/lib/bot-challenge.test.ts` is detection-only; `src/extract.test.ts` "exercised helpers only"). `src/fetch-fallback.test.ts` exists; the real home was left open in `tasks.md:26`.
3. Tag-only rows (5, 13, 18) had a circular mutation proof: removing a tag proves only that `validate-spec` counts slugs, not that the tagged file drives the branch.
4. Done bar 2 ("every still-open row") contradicted step 0.5 / C-2, which allow `blocked` rows.
5. The plan's own terminal gate was written red: an increment dated 2026-11-14 must record `**Review cap:** … used <n> passes` in `aar.md` (`scripts/lib/loop-artifacts.ts:109-121`).
6. The F-R4-E-3 detector deferral had no owner and no roadmap home.
7. Row 5 named no REQ ID and no branch set.

## Nits

- "eight test files" was wrong (15 + a handler suite).
- `## Done bar` heading instead of a line-initial `**Done bar:**`.
- C5 commit title mismatch; `url-guard.test.ts` vs `src/lib/url-guard.test.ts`.
- D4 forbade source edits while D5 requires temporary mutations — the revert-only rule was unstated.
- Preflight evidence sidecar stale (plan sha `d19a89…` vs current `b94678…`).

## Verified against the tree

- All 22 cited worklist lines match their rows and are `Scheduled-roadmap`; the 6 / 13 / 3 split holds.
- `src/corroborate.ts:701` is the failing-KB `catch` (worklist cites `:629-631`) — the plan's drift note is accurate.
- `clauseTagsFromPayload` registers only the token after the REQ ID.
- Every named test file exists.
- 22 manifest gates, consistent with "21 of 22 passed".

## Disposition (author, 2026-11-14)

Revision 2 applies every Major and Nit: test homes are named per row (including `src/verify-claims-bounds.test.ts` for row 7 and the KB suites for row 21); row 2 is marked a feasibility risk that resolves to `blocked` rather than an approximation; tag rows are bound to a driving test; done bar 2 splits `still-open` from `blocked`/`behavior-defect`; the AAR review-cap line is in done bar 6; the detector limitation is scheduled as a roadmap bullet; row 5 names REQ-021i and its four status slugs. A standard-depth run gets one cold pass, so revision 2 is not independently re-read; a diff re-review is confined to the changed lines.
