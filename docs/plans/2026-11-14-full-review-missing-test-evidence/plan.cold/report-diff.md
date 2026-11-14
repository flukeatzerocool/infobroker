# Diff re-review — plan revision 2

Reviewer: `review` subagent, fresh context, 10-read budget. Verdict: **independent-review FAILED.**

## Prior finding dispositions

| Prior finding | Verdict | Evidence |
|---|---|---|
| M1 no test home for four rows | resolved | `plan.md:44,45,46,50,64,143` name a concrete home per row |
| M2 rows 2/3 pointed at insufficient suites | **not resolved** | `tasks.md:26` still sent row 2 to `src/lib/bot-challenge.test.ts` or "the fallback test" (fixed in revision 3) |
| M3 circular tag proof | **not resolved** | `tasks.md:112,120` still proved tag rows by deleting the tag (fixed in revision 3) |
| M4 done bar vs blocked rows | resolved | `plan.md:156-159` splits `still-open` from `blocked`/`behavior-defect` |
| M5 AAR review-cap line | resolved | `plan.md:167-169` |
| M6 detector deferral owner | **not resolved** | `plan.md:108-109` pointed at step 8.2, which had no bullet (fixed in revision 3) |
| M7 row 5 REQ/branches | resolved | `plan.md:48`; `infobroker.md:295` lists resolved / not found / ambiguous / unavailable |

## New finding

- **N1 (Major):** revision 2 did not touch `tasks.md`; stale homes at `tasks.md:24,26,54-55,82-83`, and a three-verdict enum versus the four done-bar verdicts.

## Nits carried

- `plan.md:4` undercounted the test files (fixed: nineteen plus one new suite).
- `plan.md:46` cited `src/fetch-page-extraction.test.ts:279`; the test is at `:290` (fixed).
- Preflight sidecar stale.

## Verified non-defect

`src/providers/jina.ts:6` hardcodes `https://r.jina.ai/`, so row 2's `blocked` fallback is credible.

## Author response (revision 3)

`tasks.md` is rewritten against revision 2: row 2's home is `src/fetch-page-extraction.test.ts` with an explicit `blocked` fallback; the verdict enum carries four values; the tag rows are proved by naming the driving test, not by deleting the tag; step 8.2 carries the reconciliation bullet; the KB homes are named. The standard-depth cap allows one diff re-review and it is spent, so revision 3 is recorded as condition C-4 rather than sent for a third pass.

Plan sha256: dd8b328f6760e0deffe0e03288b5f5a137b3acdd81543841fdb2b46564e17414
