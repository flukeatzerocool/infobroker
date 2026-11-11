# AAR — R6 config, dedup, and report remediation

**Date:** 2026-11-10 · **Plan:** `docs/plans/2026-11-10-r6-config-dedup-report/plan.md` (sha `13ae5c9c…`) · **Roadmap item:** retired

## What happened

1. Narrowed REQ-067 to the effective knowledge-base configuration, so an invalid user layer follows REQ-113's shipped-defaults fallback instead of contradicting it (F-R6-B-4).
2. Added the precedence clause to REQ-066 so a content class may declare indefinite retention, then made `runMaintenance` skip `source_type: "report"` (F-R6-B-6 retention half).
3. Replaced the report-only meaning-equivalence block with `resolveMeaningIdentity`: same class and collection, lexical gate, LSA best match, collapse event (F-R6-B-5).
4. Validated receipt revisions instead of inventing them: non-increasing revision, `revision > 1` without `supersedes`, self-supersedes, and inverted predecessor are rejected (F-R6-B-6 revision half). REQ-083 was updated with the same rule.
5. Added the reload evidence: a unit test that the re-initialized KB reads a changed default collection and tier, and an Arena test that drives the real `reload_config` → `manage_kb` path.
6. Retired the roadmap section, marked F-R6-B-4/5/6 `Resolved`, and added the CHANGELOG entry.

## What went right

- The cold pass caught the REQ-066/REQ-083 contradiction before any code was written. A `source_type` guard without the precedence clause would have re-created the defect class the increment exists to close.
- Every behavior fix was proven by a source mutation that fails the new assertion and was then reverted (dedup 4 tests, retention 1, monotonicity 1, reload wiring 2).
- The absent-KB evidence already existed in the Arena suite; the cold pass prevented a duplicate test.

## What went wrong

- The first drafted REQ bodies overran Appendix B (817 and 937 characters); measuring before the edit caught it, but the drafts should have been measured when written.
- Two test-authoring slips were caught by running the tests: a shared `events` list made `find` return an earlier dedup event, and a predecessor test reused the seeded report id. Both are cheap to avoid by asserting on the specific event/id.
- The cost measurement showed the accepted dedup risk is larger than the qualitative rationale implied: 36 of 200 templated documents collapsed. The seeded corpus is adversarial by construction, but the number is now recorded instead of assumed.

## Findings register

| ID | Severity | Disposition |
|---|---|---|
| A-1 — dedup collapses templated near-duplicates at the 0.92 threshold (36/200 in the seeded corpus) | P2 | `Resolved` — 2026-11-10, `docs/plans/2026-11-10-r6-dedup-false-positive-bound/` (distinguishing-identity guard; the roadmap section is retired) |
| A-2 — REQ body drafts initially exceeded Appendix B | P3 | Closed-P3 — caught by the measurement step; no output affected |
| A-3 — test-authoring slips (shared event list, reused report id) | P3 | Closed-P3 — caught by the test run; no output affected |
| A-4 — the Arena result-cap fixture also seeded templated documents and collapsed under the dedup (a second instance of A-1's class) | P3 | Closed-P3 — the fixture now seeds twelve distinct subjects; the underlying threshold risk stays scheduled as A-1 |
| A-5 — plan blast-radius cites `src/kb-model.test.ts:46-58`, the amended seed spans `:46-67` | P3 | Closed-P3 — cosmetic line range; editing the plan would break the review binding for no substantive gain |

## Gate evidence

| Gate | Result |
|---|---|
| `npm run check:fast` (baseline) | PASS (19 gates, 20.2 s) |
| `npm run validate-spec` | PASS (pre-edit and post-edit) |
| `npm run check-gate-coverage` | PASS (118 G1 REQs: 117 cited, 1 exempt) |
| `npm run check-intent-citations` | PASS (141 citations, 0 findings) |
| `npm run check-tdqs` | PASS (7 tools, 0 violations) |
| `npm run check-roadmap` | PASS |
| `npm run check:fast` (after Step 3) | FAIL only on the not-yet-written `aar.md` |
| `npm run test` (full suite) | PASS — 1133 tests, 108 files |
| `npm run check:fast` (final tree) | PASS (19 gates, 20.3 s) |
| `npm run check` (final tree) | PASS (full, 58.2 s) before the split commits; PASS (full, 59.8 s) on the committed tree, recorded for `f9ef2b2` |
| Mutation evidence | 4/4 mutations failed the intended assertions and were reverted |

## Recommendations

- None beyond the scheduled roadmap item; the remaining R6 remediation sections are untouched and keep their own triggers.

LOOP PAUSED
