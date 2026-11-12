# AAR — R7 report-contract evidence remediation

**Increment:** `docs/plans/2026-11-12-r7-report-contract-remediation/` · **Date:** 2026-11-12
**Findings:** F-R7-C-1, F-R7-C-2, F-R7-C-3, F-R7-C-4, F-R7-C-5 · **Gate depth:** standard (cold pass + diff re-review)
**Plan sha256 (reviewed):** 679895fa…c507 · **Independent review record:** `/tmp/opencode/r7-independent-review.md` sha256 6cc2ee1e…a83c (cold pass, diff re-review, two binding checks)

## What happened

The first open roadmap section was the R7 report-contract evidence remediation,
triggered by R8 closing on 2026-11-10. Four findings were evidence gaps — the
rejection branches already existed in `src/lib/report-manifest.ts` with no fixture
or assertion. The fifth was a behavior gap: `SHAPE_BLOCKS["Fact-Check"]` was empty
while the bundled template and three skill documents promised a verdict table, so a
Fact-Check report without its table validated clean.

Execution followed the plan's four phases:

1. **Baseline (T0–T1).** `check-report-fixtures` was green at 19 fixtures / 0
   violations; the per-fixture error-code map was captured before any edit. The
   `npm run check` baseline was red on `check-loop-artifacts` only, caused by this
   increment's own directory (no `tasks.md`/`aar.md` yet) — recorded, not a tree
   defect.
2. **Shape-table enforcement (T2–T6).** `missing-shape-table.md` was added first
   and passed the gate (`FAIL: missing-shape-table.md (expected fail, got pass)`,
   exit 1) — the red transcript. The validator then gained a `table` entry type,
   the Fact-Check entry, a table-header helper, and the `shape-table` code; the
   call site now passes the report text. Twelve fixtures gained the block so each
   keeps a single failure class, and the template names the heading inside its
   Fact-Check snippet.
3. **Evidence (T7–T11).** Five fixtures and five assertions cover `register-url`
   (uncited S2 row, so no cascade), `register-source`/`-type`/`-interests`, a
   guessed versus `undeterminable` publication date, and the manifest likelihood
   and verdict lexicons.
4. **Bookkeeping (T12–T14).** The five R7 finding rows and four verdict rows read
   `Resolved 2026-11-12`; the roadmap section is removed (14 remain); the CHANGELOG
   carries one section.

## Finding dispositions

| Finding | Severity | Disposition |
|---|---|---|
| F-R7-C-1 `register-url` | P1 | **Resolved in-session** — `bad-register-url.md` + assertion |
| F-R7-C-2 Fact-Check block | P1 | **Resolved in-session** — `shape-table` rule, template heading, red→green fixture |
| F-R7-C-3 `undeterminable` | P1 | **Resolved in-session** — positive and negative fixtures + assertions |
| F-R7-C-4 register identity | P2 | **Resolved in-session** — `bad-register-identity.md` + three code assertions |
| F-R7-C-5 manifest vocabularies | P2 | **Resolved in-session, narrowed** — both manifest codes asserted; the *finding-level* Likelihood cell is enforced as a required column, not by lexicon membership per cell. The narrowing is deliberate: cell-level lexicon validation is a new rule, not evidence for an existing branch, and belongs in its own increment if wanted |

## Review loop

- Cold pass (revision 1) returned `independent-review FAILED.` with 3 Blockers,
  4 Majors, 4 Minors, 3 Nits. All three Blockers were real: the positive
  `undeterminable` fixture would have failed after the rule landed, the gate order
  ran `check-loop-artifacts` before `aar.md` existed, and `bad-register-url` could
  not be single-class because an invalid URL cascades.
- Revision 2 returned `independent-review passed.` (5 reads). Its one count nit and
  three clarity nits were applied after the passing pass as C-6; no design
  decision changed.
- **Cap recorded and spent:** one cold pass plus one targeted diff re-review. No
  second full pass ran. The cap is what stopped the loop at revision 3 rather than
  re-auditing wording.
- **Two binding-only checks ran after the cap.** The plan gate requires the review
  report to carry the hash of the exact plan it accompanies. The C-6 clarifications
  changed that hash, so a fresh reviewer confirmed in two ≤5-read passes that the
  final text differs from the reviewed artifact only in wording and counts, and
  emitted the final hash. These are integrity checks, not new judgement; no design
  item was reopened, and the plan's own C-6 records the arrangement.
- § Review-loop convergence stays on the roadmap: this increment recorded the cap
  but did not exercise the "narrow at the first blocker" bullet, matching the two
  prior increments that recorded a cap and left the section open. Retiring it is a
  user decision.

## What went wrong

1. **Plan-time baseline claim.** The first plan draft said the `npm run check`
   baseline was "recorded", but the run was red for a self-inflicted reason and no
   artifact existed yet. The cold pass caught it; the plan now states the red
   explicitly. Lesson: a baseline taken after creating the increment directory is
   never clean, and the plan must say so up front.
2. **Fixture isolation was under-specified.** The first draft listed a 17th
   Fact-Check fixture nowhere and mis-stated the untouched count. The rule that
   fixed it — every edited fixture keeps exactly one failure class, verified by
   code-set comparison — is now in the plan and the tasks.

## What went right

1. **Red fixture first.** Adding `missing-shape-table.md` before the rule produced
   a recorded, non-fabricated red (`expected fail, got pass`).
2. **Per-file code map before and after.** Comparing `--json` output at T0, T6, and
   T11 proved no single-class fixture lost its isolation, which a pass/fail gate
   cannot show.
3. **Uncited malformed row.** Making the bad URL `S2` instead of corrupting `S1`
   kept the fixture single-class and avoided a citation cascade.

## Gate evidence (final tree)

| Command | Result |
|---|---|
| `npx tsx scripts/check-report-fixtures.ts` | 25 fixtures, 0 violations, exit 0 |
| `npx vitest run src/report-contract.test.ts` | 26 passed |
| `npm run typecheck` | clean |
| `npm run validate-spec` | all checks passed (142 REQs, 0 uncited source files) |
| `npm run check-roadmap` | OK, 14 sections |
| `npm run version-sync` | OK, 2026.11.11 |
| `npm run check-script-discipline` | 72 TS + 9 shell scripts conform |
| `npm run check-loop-artifacts` | see tasks.md T17 |
| `npm run check` | see tasks.md T17 |

## Recommendations

None open. The only deferred idea (finding-level likelihood cell validation) is a
new rule, not a defect, and would start from a roadmap entry if the maintainer
wants it.

LOOP PAUSED
