# AAR — R5 citation and prose remediation

**Plan:** `docs/plans/2026-11-12-r5-citation-prose-remediation/plan.md`
**Findings:** F-R5-E-3, F-R5-G-1 · **Gate depth:** standard (cold pass + diff re-review)

## What happened

1. **Red first.** Added the `citations()` helper and two spawned-server cases to
   `src/dispatch-orchestration.test.ts`; both failed on the pre-change tree
   (`2 failed | 20 skipped`, `payload.meta` undefined). Condition C-1 met.
2. **Shaper seam.** Parameterized `compactEnvelope`/`pickRequiredMeta` in
   `src/verbosity.ts`, exported `CITATION_REQUIRED_META_KEYS`, threaded an
   optional required-key set through `finalizeToolResult`
   (`src/structured-output.ts`), and gave `instrumentTool` a one-entry
   `TOOL_REQUIRED_META` map. The `get_citations` handler now always emits its
   full meta; the `compact ? undefined : …` branch and the dead `meta ? …`
   spread are gone.
3. **Spec.** §8.2 independence rewritten around source families, the
   configurable `corroboration.family_similarity_threshold`, and the family
   count (C-3: "enough substance for the comparison to be evidence of
   republication" keeps the minimum-substance qualifier without naming a token
   count).
4. **Records.** CHANGELOG bullet under `2026.11.11`; roadmap section retired;
   both register rows and both verdict rows (`worklist.md:314`, `:324`)
   dispositioned `**Resolved 2026-11-12**`. The dated M1 census snapshot was
   left untouched (C-2).

## What went right

- The cold pass caught a design blocker the self pass missed: a handler-local
  meta helper is inert because `finalizeToolResult` re-compacts the envelope.
  The revision moved the fix to the real seam, and the diff re-review verified
  each prior finding against the code before passing.
- The red-first cases were cheap and decisive: the same assertion that failed
  before the change passed after it, with no test double for the shaper.
- The tool-scoped key set kept compact `search_web` and `compactEnvelope`
  output unchanged; the default-set unit case pins that.

## What went wrong

- The first plan named the wrong seam and cited a `src/cite.ts` helper that
  would have been stripped. Cost: one cold pass plus one diff re-review.
- The delegated cold reviewer had no write tool, so the review artifact could
  not be written in its session; the parent transcribed it into
  `plan.cold/review.md` and appended the diff re-review. The artifact hash in
  the stamp covers the transcribed text, not the subagent's own buffer.

## Verification evidence

| Command | Result |
|---|---|
| `npx vitest run src/dispatch-orchestration.test.ts -t "compact get_citations metadata"` (pre-change) | 2 failed / 20 skipped — `meta` undefined |
| same, post-change | 2 passed / 20 skipped |
| `npx vitest run src/verbosity.test.ts src/structured-output.test.ts src/dispatch-orchestration.test.ts` | 54 passed |
| `npm run typecheck` | pass |
| `npm run validate-spec` | All checks passed |
| `npm run validate-readme` | 0 errors, 0 warnings |
| `npm run check-roadmap` | OK |
| `npm run version-sync` | OK |
| `npm run test` | 119 files, 1401 tests passed |
| `npm run test-debate-club` | 8 files, 61 tests passed |
| `npm run check` (final tree) | PASS (full, 158.9 s) |

## Findings register

| ID | Severity | Disposition |
|---|---|---|
| F-R5-E-3 | P1 | Resolved in-session — red-first spawned-server cases plus tool-scoped required meta |
| F-R5-G-1 | P1 | Resolved in-session — §8.2 aligned with REQ-121 |
| Cold-pass blocker (revision 1) | P0-equivalent for the plan | Resolved in-session — fix moved to the shaper seam; diff re-review passed |
| Review artifact could not be written by the cold reviewer | P3 | Closed as informational — parent transcription, hash-stamped |

No new roadmap items. No push was performed; publication stays
user-authorized.

## Loop status

LOOP PAUSED
