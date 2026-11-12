# After-action report — R7 confidence and technique remediation

**Date:** 2026-11-12 · **Plan:** `plan.md` (revision 2, sha256 `eabc0255…d64f9`) ·
**Outcome:** both findings resolved, every gate green.

## What happened

1. Both client-artifact defects were fixed at their source: the gated-analysis
   skill now names only the canonical three confidence labels and cites
   `confidence.md`, and every catalog technique declares one family against a
   new `## Families` index.
2. Two check groups were added to the existing REQ-088/REQ-115 blocks in
   `scripts/validate-spec.ts`. They were written first and run against the
   unfixed tree, so the red evidence is the live tree rather than a sample.
3. The family claim was narrowed from six to the five families the catalog
   actually covers, recorded as `D-107`, and the roadmap section was retired.

## Findings

| ID | Severity | Disposition |
|---|---|---|
| F-R7-B-1 | P1 | **Resolved 2026-11-12** — three-label block, canonical citation, unsourced claim routed to `**Gaps:**` / Uncertainty Register; gate asserts set equality, citation, and canonical table rows |
| F-R7-B-2 | P2 | **Resolved 2026-11-12** — one family per technique, bidirectional index cross-check, five-family claim recorded as D-107 |

No finding was deferred, downgraded, or closed as informational.

## What went right

- Gate-first ordering produced real reds: the first `validate-spec` run after
  adding the checks failed with exactly the three expected errors, and the
  subsequent green run proved the fixes rather than a vacuous pass.
- The cold pass caught a genuinely vacuous check (a one-directional label
  membership test would have passed on a deleted block) and a self-contradictory
  acceptance grep. Both were fixed before execution.
- Mutation probes exercised every new predicate: missing family line, duplicate
  membership, a bogus family row, a technique absent from the catalog, a deleted
  confidence block, and a re-introduced fourth label all failed the gate, and
  each was restored to green.

## What went wrong

- The first plan revision claimed a "confirmed" absence of competing checks that
  a repo-wide grep did not support (`scripts/lib/parse-readme.ts` enumerates the
  skill; a debate-club fixture carries the skill prompt). The claim was narrowed
  after the cold pass.
- The commit series initially split the gate from the content it checks, which
  cannot be green in either order. It is now one atomic commit.
- The diff re-review returned `FAILED` on a single wording defect (a grep
  acceptance that stated two lines where four match). The wording was corrected
  and a targeted line verification produced the passing token; that extra
  verification was executed after the recorded cap, authorized by the user's
  "execute plan".
- The plan's review-independence record needed three artifacts (cold report,
  diff report, final verification) because the first two did not pass. This is
  the process working, but it is also evidence that the artifact was under-
  specified on first draft.

## Review record

| Pass | Result | Notes |
|---|---|---|
| Cold (revision 1) | `FAILED` — 3 Blockers / 12 Majors / 8 Nits | `/tmp/opencode/r7-confidence-cold-report.md` |
| Diff re-review (revision 2) | `FAILED` — 14/15 prior items resolved; 1 residual wording Major | fixed in text (C-5) |
| Final line verification (post-cap, user-authorized) | `independent-review passed.` | `/tmp/opencode/r7-final-verification.md` |

Review-loop cap: recorded in the plan (one cold pass + at most one diff
re-review). The cap was exceeded by one targeted verification after the
escalation; the user authorized execution, and the extra pass touched seven
corrected lines only. The § Review-loop convergence roadmap section is **not**
retired by this increment.

## Step-to-evidence

| Step | Command | Result |
|---|---|---|
| Baseline | `npm run check` | PASS, 22 gates, 156.9 s, recorded for `8138fe9` |
| T3/T7 red | `npm run validate-spec` | exit 1 — missing `## Families`, missing citation, `No confidence` label |
| T5 partial green | `npm run validate-spec` | exit 1 — only the expected `## Families` error remained |
| T9 green | `npm run validate-spec` | exit 0, all checks passed |
| T10 (a) | delete `**Family.**` line | red: `Quality-of-Information Check` declares 0 families |
| T10 (b) | technique in two rows | red: listed under `decision support`, declares `scenarios and indicators`; 2 rows |
| T10 (c) | bogus family row | red: cross-check + duplicate membership |
| T10 (c2) | unknown technique in index | red: `Bogus Technique` absent from the catalog |
| T10 (d) | delete confidence block | red: missing confidence-scoring block |
| T10 (e) | fourth label | red: labels `[High, Medium, Low, Very low]` |
| T14 | `validate-spec`, `check-roadmap`, `version-sync`, `check-script-discipline`, `check-non-goals`, `check-loop-artifacts`, `typecheck`, `typecheck:scripts` | all exit 0 |
| T16 | `npm run check` | PASS, full, 158.3 s, exit 0 |

## Dispositions and next work

- Roadmap section § R7 confidence and technique remediation removed; the next
  open section is § R7 routing-citation remediation.
- Standing decision: `D-107` (five families, cause-and-effect deliberately
  unclaimed).
- No open P0/P1 remains for this increment.

LOOP PAUSED
