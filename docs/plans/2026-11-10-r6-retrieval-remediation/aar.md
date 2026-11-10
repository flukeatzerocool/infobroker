# AAR — R6 retrieval remediation

**Date:** 2026-11-10 · **Plan:** `docs/plans/2026-11-10-r6-retrieval-remediation/plan.md` (sha `c4a9e28f…`) · **Roadmap item:** retired

## What happened

1. A research compile now reports `kb_recall: "not_applicable"`, and the KB block initializes recall from `deep` and orders deep/research before skip, so a deep request reports the same state with or without a KB and when `fresh: true` is also set (F-R6-C-5, REQ-076a).
2. A `fresh: "blend"` search selects the unfiltered `kbSearch` row set, while the default mode keeps the sufficiency thresholds; the all-external-fail branch now receives the sub-threshold cached rows and returns them (F-R6-C-6, REQ-076a/REQ-076).
3. `configureModel` appends a remediation naming the configured reference, the supported references, the built-in fallback, and the `kb.embedding_model` reload action; the degradation test asserts the stats state and the event (F-R6-C-7, REQ-103/REQ-060c).
4. Added `debate-club/src/kb-retrieval.test.ts` (six Arena cases: sub-threshold precondition, blend, default-mode contrast, deep+skip, research, deep with no KB) and a degradation case in `src/kb-model.test.ts`.
5. Retired the roadmap section, marked all three findings `Resolved`, refreshed the three affected REQ evidence rows, and added the CHANGELOG entry.

## What went right

- The cold pass caught the unprobed sub-threshold premise and the seed-URL ambiguity before any test existed; both became explicit preconditions.
- The 599 replay path needed no new fixtures: `general_web` providers have no fixture hosts, and the deep read is served by the existing Wikipedia `action=parse` fixture after confirming `renderersForUrl` selects the Wikipedia renderer first.
- Every behavior fix was proven by a mutation that failed its intended assertion and was reverted.

## What went wrong

- The plan's C-3 required `freshness_score < 0.99`, but a freshly ingested stable row scores ≈1.0; the sufficiency filter is an AND, so only the relevance leg is probeable. Caught while writing the precondition, recorded as a delta amendment, and the plan was re-stamped before the test was written.
- The first research test used the shared `expectOk` helper, which requires a top-level `results` array; a research compile returns `groups`. The test now parses the envelope directly.
- The diff re-review asserted `example.com` is not a fixture host; it is one. No effect, because the seed is ingested from supplied text and never fetched.

## Findings register

| ID | Severity | Disposition |
|---|---|---|
| A-1 — plan C-3 required an unprovable freshness leg | P2 | Resolved in-session — condition narrowed to the relevance leg and the plan re-stamped with a delta amendment |
| A-2 — research response shape differs from the standard OK body | P3 | Closed-P3 — caught by the first test run; the test parses the envelope |
| A-3 — cold re-review misread the fixture-host list | P3 | Closed-P3 — no functional effect; the seed is never fetched |
| A-4 — all-empty external chain does not consult the cache | P3 | Closed-P3 — D3a records it as out of scope with REQ-031 (empty ≠ failure); no action |

## Gate evidence

| Gate | Result |
|---|---|
| `npm run check:fast` (pre-plan baseline) | PASS (19 gates, 20.1 s) |
| `npm run test` (pre-edit) | PASS — 1133 tests, 108 files |
| `npm run validate-spec` | PASS (pre-edit and post-edit; 142 REQs, 127 cited) |
| `npm run check-intent-citations` | PASS (141 citations, 0 findings) |
| `npm run check-tdqs` | PASS (7 tools, 0 violations) |
| `npm run test` (post-edit) | PASS — 1134 tests, 108 files |
| `npm run test-debate-club` | PASS — 7 files, 58 tests |
| `npm run check:fast` (post-edit) | PASS once `aar.md` exists (the only failure before it was written was that missing file) |
| `npm run check` (final tree) | PASS — full, 22 gates, 72.6 s |
| Mutation evidence | 4/4 mutations failed the intended assertions and were reverted |

## Recommendations

- None beyond the scheduled roadmap items; the remaining R6 sections (encryption/capacity, ledger/receipt) keep their own triggers.

LOOP PAUSED
