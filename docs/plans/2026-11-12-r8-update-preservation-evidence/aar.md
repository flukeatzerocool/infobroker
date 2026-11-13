# AAR — R8 update-preservation evidence

**Date:** 2026-11-12 · **Plan:** `plan.md` · **Status:** closed

## Findings

| ID | Severity | Predicate | Disposition |
|---|---|---|---|
| F-R8-A-1 | P1 | REQ-043 had no test that simulates an update; §2 F11's "G1 update-preservation tests guard the guarantee" had no carrier | **Resolved 2026-11-12** — `src/update-preservation.test.ts` (six assertions, mutation-checked); register rows and `CHANGELOG.md` updated; `ROADMAP.md` section retired |
| F-R2-4 cross-note | P3 | The R2 row's "update-preservation … no asserting test" phrase was superseded, not rewritten | **Closed** — cross-note added at `worklist.md:146` and `:620`; the row's REQ-010 defaults-inheritance subject stays `Closed-P3` |

## What went right

- The plan's hermeticity work paid off before execution: pinning `HOME` inside the temp root meant the mutation checks could not touch the real user store, and the `maintenance_interval_minutes: 0` release re-init left no timer over a deleted directory.
- Two independent mutation checks were run and reverted byte-identically (`sha256 20a4b4ca…`), so the test is demonstrated to fail on the exact defects it claims to catch, not merely to pass.
- The cold pass changed the artifact materially: the drift assertion (`hasDrift === false`, not `null`), the KB release contract, the quota teardown, and the six-assertion enumeration all came from review findings and all held at execution.
- The register reconciliation covered every live copy of the finding, including two rows (`:146`, `:547`) a first pass would have missed.

## What went wrong

- **The first run failed on a wrong assertion, not a wrong system.** Assertion 4 compared the stored chunk to the raw body, but ingestion stores it title-prefixed (`Update survival: …`). Changed to containment; recorded here rather than quietly edited.
- **Mutation 2 was broader than predicted.** Deleting the user layer failed assertions 1–4, not the planned 1–3: the KB path also came from the layer, so the store fell back to the shipped default under the pinned `HOME`. The plan's done bar remains true (those assertions fail); `tasks.md` records the actual set. This is an evidence refinement, not a design change.
- **`check:fast` in the baseline predated the increment directory** while the full check followed it; the plan now states the order explicitly, and the style critic was right that the original wording was contradictory.

## Gate evidence

| Gate | Result |
|---|---|
| `npm run check` (baseline, after T0) | PASS — 22 gates, 157.8 s |
| `npx vitest run src/update-preservation.test.ts` | PASS — 6/6 |
| `npx vitest run src/update-preservation.test.ts src/config.test.ts src/quota.test.ts src/kb.test.ts` | PASS — 4 files / 156 tests |
| `npm run typecheck` | PASS |
| Mutation 1 (KB path under `install/`) | FAIL as expected — assertions 4 + 6 |
| Mutation 2 (`xdg/` deleted) | FAIL as expected — assertions 1–4 |
| `npm run test` (commit 3) | PASS — 123 files / 1453 tests |
| `npm run validate-spec` | PASS — 142 REQs, 0 source files without `@implements` |
| `npm run check-gate-coverage` | PASS — 117/118 G1 cited, 1 exempt |
| `npm run check-roadmap` / `check-non-goals` / `check-shipped-kb-empty` | PASS |
| `npm run check-loop-artifacts` | PASS — 0 errors, 1 pre-existing warning |
| `npm run check` (final tree) | PASS — exit 0, 22 gates, full, 158.2 s (log `/tmp/opencode/r8-check-final.log`) |

## Review loop

- Cap recorded in `plan.md` § Review-loop cap and honoured: one cold pass (5 stages, 3 Blockers + 30 Majors resolved across revisions), no additional loop.
- The cold pass's read count exceeded the standard budget (61 vs ≤40) because the plan names ten source files; recorded in `plan.cold/report.md` and accepted as a soft flag.

## Commit series

1. `b490d54` `test(preservation)` — the simulated-update test.
2. `5739b96` `docs(decisions)` — D-111.
3. `db53eeb` `docs(plans)` — sweep register resolutions and cross-notes.
4. `2e5596a` `docs(changelog)` — the R8 section.
5. `58650f5` `docs(roadmap)` — the retired roadmap item.
6. _increment docs_ — this AAR, `tasks.md`, `plan.md`, `plan.cold/`.

## Recommendations

None outside `ROADMAP.md`. The next section in file order is § R8 notice and
gate-traceability evidence (F-R8-C-1, F-R8-D-1), whose trigger is already
satisfied.

LOOP PAUSED
