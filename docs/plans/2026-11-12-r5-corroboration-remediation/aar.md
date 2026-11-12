# AAR — R5 corroboration remediation

**Status:** complete · **Date:** 2026-11-12 · **Plan:** `plan.md`

## What happened

The top `ROADMAP.md` section (R5 corroboration remediation) was planned, cold
reviewed, approved, and executed. Three P1 findings and one coupled P2 finding
were fixed on the `verify_claims` verdict path:

- **F-R5-A-1** — `jaccardSimilarity` now judges overlap on content tokens only
  (short tokens and the `STOPWORDS` lexicon excluded), so a stopword-only
  overlap cannot attribute an unrelated result to a claim.
- **F-R5-A-2** — `confirmationEligible` gates both `confirmed` branches on the
  effective `confidence_threshold`, with an explicit `unverified` fallback in
  the multi-cluster branch (previously it fell through to `contested`). The
  three production call sites pass the effective threshold.
- **F-R5-D-1** — recalled sources carry `retrieval_origin: "knowledge_base"`,
  at least one agreeing source must be external, and a live result for the
  same URL clears the marker.
- **F-R5-D-2** — the tautological KB test was replaced by a KB-only finding
  that asserts the verdict and the marker.

REQ-026 gained the threshold contract, §8.1/§8.2 and the README were aligned,
and the roadmap section was retired.

## What went right

- The cold pass caught a real Blocker before any edit: gating the multi-cluster
  branch as first drafted would have reported non-conflicting findings
  `contested`. The shared predicate fixed it.
- The red run was genuinely red (12 failures) before the first source edit, and
  three pre-fix guards documented the behaviour the fix must preserve.
- Typecheck and the targeted suites passed on the first post-fix run; only the
  three documented fixture thresholds needed aligning.

## What went wrong

- The first version of the KB-only corroborate-level tests failed for a mock
  reason (`resolveProvider` was absent from the providers mock because the
  default fixture enabled providers with no searcher). Restricting the fixture
  to `duckduckgo` fixed it; the failure was fixture noise, not evidence, and is
  recorded here rather than counted as red evidence.
- The URL-upgrade test initially seeded no finding, so `claimSeeded` produced
  none; the seed was added. Its first failure was therefore not red evidence
  for the fix.
- Three existing tests asserted `confirmed` at the default 0.8 threshold with
  two-family confidence 0.7 — exactly the defect being fixed. Their fixtures
  were pinned to 0.7 and the change is named in `tasks.md` (C-5).

## Findings

- **KB recalled-source provenance (P1).** The recall mapping drops each hit's
  ingest `provider`, so REQ-026d's per-source provider field is absent for
  recalled sources. Discovered by the cold reviewer; not in scope for this
  section. **Disposition: scheduled** on `ROADMAP.md` § KB recalled-source
  provenance.
- **STOPWORDS false negatives (P3).** The shared lexicon removes content-bearing
  words ("work", "use", "made", "new", "well", "many"), so a snippet linked to a
  claim only by one of them is not attributed. Accepted as the smaller error and
  pinned by a test. **Disposition: closed as informational.**
- **Pre-existing gate warning (P3).** `check-loop-artifacts` reports a missing
  `**Done bar:**` in `2026-11-10-r6-encryption-capacity-remediation`.
  **Disposition: closed as informational** (recorded, not fixed).
- **Unpushed backlog (P1 operational).** 102 commits before this increment,
  oldest 2.8 d, now 107. The AAR trigger fired; publication remains
  user-authorized and was not performed. **Disposition: deferred by user** (the
  push decision is the maintainer's).

## Verification

| Command | Result |
|---|---|
| Red run (`vitest run src/corroborate.test.ts`) | 12 failed / 82 passed (94) — `/tmp/opencode/r5-red.log` |
| Post-fix targeted suites (5 files) | 120 passed |
| `npm run typecheck` | pass |
| `npm run validate-spec` | pass (142 REQs, 127 cited, 0 uncited source files) |
| `npm run validate-readme` | 0 errors, 0 warnings |
| `npm run check-roadmap` | OK (17 sections) |
| `npm run check:fast` | PASS (22.7 s) |
| `npm run check` | PASS (full, 22 gates, 154.6 s) |

REQ-026 body after the edit: 762 characters, 7 sentences, 3 SHALL clauses, six
pre-existing backtick parameter tokens — inside Appendix B.

## Commits

- `docs(spec): state confirmation threshold and KB-alone contract`
  — `infobroker.md`, `README.md`
- `fix(corroborate): gate confirmation on evidence and origin` — `src/corroborate.ts`, `src/types.ts`, `src/corroborate.test.ts`
- `docs(roadmap): resolve R5 corroboration findings, retire section`
  — `CHANGELOG.md`, `ROADMAP.md`, `worklist.md`
- This record update.

**Deviation from D6:** the plan called for five buckets, splitting the
attribution, threshold, and knowledge-base fixes into separate commits. The
three changes share one predicate and one test file, and the test hunks
interleave (the `jaccardSimilarity` block and the `confirmationEligible` block
land in one hunk; the five reconcile cases land in another), so a typecheck-clean
per-fix split would require hand-splitting patch hunks with no review benefit.
The three findings shipped as one source-plus-tests commit under the plan's own
"one concern — the verdict-producing predicate" framing. Scope is unchanged.

No push was performed. Branch `main` is 107 commits ahead of `origin/main`.

LOOP PAUSED
