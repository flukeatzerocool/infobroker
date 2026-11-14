# AAR — Close the handler-level evidence rows, re-scope the seam-blocked residual

**Date:** 2026-11-14 · **Plan:** `plan.md` revision 3 · **Roadmap item:** `ROADMAP.md` § Missing test evidence across R4–R6 (kept, reduced to one row)
**Review cap:** 2; used 3 passes (third findings-closure dispatch authorized 2026-11-14)

## What happened

1. Drafted the plan and ran the plan gate. The cold pass returned **FAILED** (1 Blocker, 5 Majors, 8 Nits); revision 2 applied all of them. The diff re-review returned **FAILED** (0 Blockers, 1 Major, 6 Nits); revision 3 applied all of them. The maintainer authorized a third, over-cap findings-closure dispatch, which returned `independent-review passed.` (0 Blockers, 0 Majors, 4 Nits), all applied.
2. Executed steps 1–2: two spawned-server suites, each branch mutation-proved.
3. Executed step 3's probe: the reduced-heap measurement **blocked** the row rather than closing it.
4. Re-scoped rows 4–5 into a named seam section and reduced the evidence section to row 3.

## What went right

- The pre-execution census held: all four previously cited anchors were accurate, and the two "drivable" verdicts produced passing suites on the first or second attempt.
- Every mutation isolated its own case as designed: the sentinel in the both-inputs branch, the literal cap in the refusal message, the disabled lock gate, the forced `key_resolvable`, the ignored key file, and the environment fallback each failed only the assertions they were meant to falsify.
- D6 paid off: a blocked row 3 with recorded numbers was reachable because the probe ran outside vitest. The plan's decision rule then made "blocked" a legitimate outcome instead of an in-session judgement call.
- The re-review's Major (Child B's dual key source) would have produced an unfalsifiable test; removing the env key from that child made the success path provable.

## What went wrong

- **The plan gate took three cold dispatches.** The first two found real defects, but the standard depth allows one re-review; the third needed explicit authorization. The plan should have budgeted a closure pass from the start when the first pass fails with a Blocker.
- **Step 3's probe was under-specified.** The plan assumed one probe; six variants were needed (`kb-heap-probe{,2..6}.mts`) to separate boot cost, build cost, and read determinism, and the last one hung past 15 minutes. Two plan details were wrong against the tree: there is no close API for the KB store, and `generateKeyFile` refuses a path outside the keys directory. Both were absorbed inside their steps (recorded in `tasks.md`), but the plan asserted a seam that does not exist.
- **A non-deterministic crash surfaced.** At a 48 MB heap, one `get` run on a 99 MB store died with a V8 heap trace while five comparable runs passed. It is recorded, not diagnosed; the row's blocker now names it.
- The first suite run asserted the wrong envelope shape (`code` at top level instead of under `error`), costing one cycle.

## Findings and dispositions

| # | Finding | Severity | Disposition |
|---|---|---|---|
| 1 | Child B carried two key sources, so its success path could not fail under the cited mutation | P0 (plan) | Resolved in revision 3; the key file is the child's only source |
| 2 | `F-R6-E-3` needs a reduced-heap suite; the probe missed the build budget and the read path is not yet deterministic | P1 (normative gap) | Scheduled on `ROADMAP.md` § Missing test evidence with the measurements |
| 3 | One `get` run at 48 MB crashed where five others passed — a possible REQ-108 clause (a) violation | P1 | Scheduled with row 3; the next attempt must first show the read path stable, then decide defect vs harness |
| 4 | `F-R4-B-3` and `F-R4-C-3`'s per-hop guard need production seams | P2 | Moved to `ROADMAP.md` § Hermetic seam for the fetch-renderer chain and the crawl guard |
| 5 | `makeIsolatedConfig()` rewrites only the `kb` block, so tests must write other settings back | P3 | Recorded in `tasks.md`; the two new suites do it |
| 6 | The spawned-server `withServer` helper is now duplicated in ten suites | P3 | Closed as informational; a shared `src/lib/mcp-stdio.ts` is a follow-up, not a defect |
| 7 | Six probe variants for one measurement — the plan under-budgeted discovery | P2 | Recorded here; the roadmap row now names the two blockers instead of "needs a spawned process" |

## Evidence

- `npx vitest run src/verify-claims-bounds.test.ts` → 4 passed; `npx vitest run src/kb-handler-lock.test.ts` → 3 passed (4.2 s).
- `npx tsc --noEmit` → exit 0 after each step; `git diff src/` empty after every mutation revert.
- `npm run validate-spec` → 142 REQs, 127 cited, 0 source files without `@implements`, all checks passed.
- `npm run check-gate-coverage` → 118 G1 REQs: 117 cited, 1 exempt, 0 waived.
- `npm run check-roadmap` → admission rule satisfied (5 sections); `npm run check-non-goals` → OK.
- Probe measurements: boot floor 48 MB (32 MB aborts); payload 111.8 MB in 16.9 s, 103.8 MB in 21.9 s, 135.1 MB in 24.5 s; reads at 48 MB passed 5 of 6 attempts.
- Commits: `1c94410` (verify), `d94ae17` (kb), plus the tracker commit.

## Residual

The increment did not retire its roadmap section. Row 3 stays open with measured blockers, and rows 4–5 now live in the seam section. The roadmap's close condition ("no open evidence-only row") is therefore still unmet, by design and by measurement rather than by omission.

LOOP OPEN
