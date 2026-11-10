# AAR — chunk R3 (`search_web`)

**Status:** complete · **Date:** 2026-11-09 · **Loop:** `LOOP PAUSED`
**Plan:** `docs/plans/2026-11-09-full-review-r3/plan.md` (standard; fresh cold pass 4/5 stages, 35/40 reads, diff re-review passed).
**Predecessor:** chunk R2, closed 2026-11-09.

## What happened

1. Baseline at `6d7f437`: `npm run check:fast` PASS (20.3 s); 18 carrying test files / 201 tests PASS; tree clean except the R3 plan directory.
2. Six fresh-context cluster reviews (routing, query/suggest/batch, reconciliation/source-quality/language, deep reading/research, analysis, handler/§7.4). Split trigger did not fire.
3. Deterministic evidence: `npm run test-debate-club` 3 files / 36 tests PASS. Isolated live probe (`/tmp/r3-probe-*`, temp `TMPDIR`, config layer, KB path) exercised suggest, expand, `ignored_params`, and provider + priority precedence.
4. Verdicts: 14/14 REQs carry a finding (no `holds`), plus §7.4. The severity spread is mostly evidence gaps and small contract defects; the load-bearing P1s cluster around metadata omissions, batch error shape, reconciliation, research variants, truncation, and compact-mode deep reading.
5. 30 findings: 10 P1 and 5 P2 scheduled on `ROADMAP.md` § R3 findings remediation; 3 P2 evidence gaps and 12 P3 closed. Zero P0.

## What went right

- The live probe produced the decisive evidence for F-R3-1: `provider:"marginalia"` with `priority:"privacy"` was served by `duckduckgo`. Code reading alone would have left it as an inference.
- Splitting the review into six fresh contexts kept each cluster's read set small and surfaced four green gates that assert less than their REQ (`batch-run`, `expand`, `dedup`, `tool-surface`).
- The deterministic Arena run gave an end-to-end contract check without network dependency.

## What went wrong

- The cold reviewer and the six cluster reviewers had no shell or write access, so the cold report was returned inline and persisted by the parent; every cluster review relied on static evidence. The plan's live-probe step therefore fell to the parent, which is why only four probes ran.
- Every in-scope REQ produced a finding. That is a signal about spec stringency versus test depth, not just about the code: several findings are "branch tested but untagged" or "pure function tested, response not".
- The KB-first path defect (F-R3-3) crosses the R6 boundary; the plan's cross-chunk rule kept it under R3 because it violates R3 REQ metadata, which is the right filing but worth watching when R6 runs.

## Findings

The register is `worklist.md` § Finding register (F-R3-1 … F-R3-30). Terminal dispositions:

| Disposition | Count |
|---|---|
| Resolved in-session | 0 (no P0) |
| `Scheduled-roadmap` (P1) | 10 |
| `Scheduled-roadmap` (P2) | 5 |
| `Closed-P3` (P2 evidence gaps, closed as P3) | 3 |
| `Closed-P3` (P3) | 12 |

## Verification

- `npm run check:fast` → exit 0 (20.3 s) at baseline.
- 18 carrying test files → 201/201 PASS.
- `npm run test-debate-club` → 36/36 PASS.
- Live stdio probe → suggest/expand OK, `ignored_params:["time_range"]` on the wikipedia path, explicit provider overridden by priority (F-R3-1).
- `npm run check` → PASS (22 gates, 53.6 s) before the AAR; post-AAR `check:fast` green.

## Next

Chunk R4 (`fetch_page`) is the next sweep item. `ROADMAP.md` now carries R2 and R3 remediation sections; R2's remediation starts after R3 closes, R3's after R4 closes.

LOOP PAUSED
