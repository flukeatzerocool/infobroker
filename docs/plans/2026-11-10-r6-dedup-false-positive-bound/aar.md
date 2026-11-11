# AAR — R6 dedup false-positive bound

**Date:** 2026-11-10 · **Plan:** `docs/plans/2026-11-10-r6-dedup-false-positive-bound/plan.md` · **Roadmap item:** retired

## What happened

1. Selected the top open roadmap section; its trigger's measured leg (36/200 = 18% > 10%) had already fired in the predecessor's cost measurement.
2. Committed a deterministic corpus where the predecessor's was lost: 200 documents for the bound (20 template groups of four plus 120 distinct), 40 for the recorded residual, and a 20-pair duplicate set split 15 positive / 5 negative.
3. Recorded the pre-change baseline by running the new suite on the unmodified tree: 131 of 200 stored (69 merged), all five identity-differing negatives merged, no event basis.
4. Added `identityTokens` to `src/embed.ts` (digits plus non-sentence-initial proper nouns) and made `resolveMeaningIdentity` refuse a match whose body identity sets differ, abstaining when neither body carries identity.
5. Added the REQ-072 clause, the README sentence, the CHANGELOG entry, the roadmap retirement, and the two register updates.
6. Proved the guard with four mutations; each failed its intended assertion and each revert was byte-identical.

## What went right

- Measuring before designing settled the threshold question: a genuine update at 0.9980 and a distinct template pair at 0.9992 share a range, so "raise the threshold" was ruled out by evidence rather than opinion.
- First probe results (1/200 collapses at the wrong moment) were caught by observing the stored count, not by trusting the design.
- The cold pass caught the title-identity defect before a line of production code existed; the diff re-review then caught the same class surviving on the candidate side.

## What went wrong

- **Corpus construction took six rewrites.** Each draft collapsed for a reason unrelated to the finding: a period-10 template generator reused groups, distinct documents shared a sentence pool, identifiers collided across groups (`5000 + group*2 + variant` overlapped), and a synthetic vocabulary distorted the hashed model (identical bodies scored 0.87 because the tokens collided). The lessons are cheap and worth stating: generate identifiers that cannot collide, keep the compared window in mind when placing the distinguishing content, and do not test a lexical model with invented words.
- **The plan's identity-window rule was asymmetric.** It scanned the full incoming body against the candidate's first chunk, which is capped at 512 characters including the title, so a trailing identity token reached one side only and a legitimate update was refused. Identity now reads the same 500-character window on both sides.
- **The README word budget was discovered by the gate, not before the edit.** The first sentence pushed the Knowledge Base section to 379 of 350 words; the fix shortened the addition and tightened two existing clauses. The plan said Step 0.3 would record the word cost; that cost was not compared against the section's current length.
- The bound suite's first version asserted collapse counts that only made sense after the corpora were isolated per pair, so several runs measured the previous draft's bug rather than the guard.

## Findings register

| ID | Severity | Disposition |
|---|---|---|
| A-1 — templated documents merge into one despite distinct identity (36/200 recorded; 69/200 in the committed corpus) | P1 | Resolved in-session — guard plus bound suite; roadmap section retired |
| B-1 — identity is unobservable outside the compared 500-character window | P2 | Resolved by narrowing the rule to a symmetric window and recording the residual in the CHANGELOG and REQ-072's evidence; not claimed as covered beyond the window |
| B-2 — a corpus whose slots differ only in ordinary lowercase words still merges (20 of 40 documents in corpus B) | P2 | Recorded as the accepted residual; the collapse event now says `basis similarity-only`, so an operator can see it. Not scheduled: no token-level signal separates those documents, and the same measurement shows a genuine update scoring below a distinct pair |
| B-3 — an update that introduces a new proper noun is now stored separately | P3 | Accepted direction (a duplicate is cheap, a lost document is not), documented in the plan's edge-case table and the CHANGELOG |
| B-4 — scripts without case distinction contribute only their numbers to identity | P3 | Closed-P3 — named in the CHANGELOG; no false collapse introduced, only a wider abstention |
| B-5 — two proper-noun matchers coexist (`src/analysis.ts:98-100` and `src/embed.ts`) | P3 | Closed-P3 — deliberate: analysis's extractor has no sentence-boundary rule and no digit rule, and unifying them would change analysis output outside this item |
| B-6 — short documents score below 0.92 on a one-token difference, so a short near-duplicate does not merge at all | P3 | Closed-P3 — observed while building the corpus; it is the conservative direction and predates this change |

## Gate evidence

| Gate | Result |
|---|---|
| `npm run check:fast` (baseline) | PASS (20.1 s) |
| `npx vitest run src/kb-dedup-bound.test.ts` (pre-change) | 5 failed — baseline 131/200, negatives merged |
| `npx vitest run src/kb.test.ts src/kb-dedup-bound.test.ts` (post-change) | PASS — 39 tests |
| Six-file KB/embed run | PASS — 115 tests |
| `npm run test` (full) | PASS — 1164 tests, 109 files |
| `npm run validate-spec` | PASS (pre- and post-edit) |
| `npm run check-gate-coverage` | PASS — 118 G1 REQs, 117 cited, 1 exempt |
| `npm run validate-readme` | FAIL then PASS — the section exceeded its 350-word budget; fixed before commit |
| `npm run check-roadmap` | PASS — 20 work items + `## Non-goals` |
| Mutation evidence | 4/4 failed the intended assertion; all reverts byte-identical |
| Bound suite wall time | ~3 s — C-4 not triggered |

## Recommendations

- None beyond the recorded residual. The next roadmap item is `§ R2 findings remediation` (the new top section); its trigger ("start after chunk R3 closes") is satisfied, and it is not started here.

LOOP PAUSED
