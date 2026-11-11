# Tasks — R6 dedup false-positive bound

Plan: `plan.md`. One line per plan step, with the evidence recorded inline.

## Step 0 — Surface probes

- [x] 0.1 `git log -1` → `2784a70`; only this plan directory untracked; baseline `check:fast` PASS (20.1 s) and `npx vitest run src/kb.test.ts` 34 passed.
- [x] 0.2 `check-tdqs` 7 tools / 0 violations; `check-intent-citations` 141 citations / 0 findings; `validate-spec` pass. No Arena fixture asserts a collapse the guard would refuse (`kb-contract.test.ts:103-123` seeds distinct subjects for exactly that reason); `src/index.ts` has no `manage_kb` dedup claim.
- [x] 0.3 `README.md:330-355` read; D7 sentence drafted and the section's word budget checked.
- [x] 0.4 No `config.json` key governs the threshold; only REQ-072 binds KB document deduplication.
- [x] 0.5 REQ-072 body measured as `validate-spec` measures it: 677 chars / 5 sentences / 5 `SHALL` before the edit.
- [x] 0.6 `npm audit --json` answered (only low-severity findings), so C-2 is not triggered.

## Step 1 — Corpus and failing bound test

- [x] 1.1 `src/kb-dedup-bound.test.ts`: corpus A (20 template groups x 4 documents + 120 distinct = 200), corpus B (20 template pairs = 40), duplicate set (15 positive / 5 negative). Generation is deterministic from a 20-sentence pool; no clock, no randomness.
- [x] 1.2 Assertions (a) 200 stored for corpus A, (b) 15/15 positives collapse, (c) 5/5 negatives stay, (d) corpus B's rate pinned as a recorded value, (e) the collapse event carries a basis.
- [x] 1.3 Baseline on the unmodified tree: corpus A stored **131 of 200** (69 merged, 34.5%), corpus B stored **20 of 40** (20 merged), all 5 negatives merged (the defect), event basis absent, so all five assertions failed. C-1 satisfied (>= 10%). Corpus A's 120 distinct documents all survived.
- [x] 1.4 Wall time: the bound suite runs in ~3 s inside `npm run test`, well under C-4's 15 s; no corpus reduction.
- [x] 1.3b Title-carries-a-number case added to `src/kb.test.ts` (REQ-072 title-identity).

## Step 2 — The guard

- [x] 2.1 `identityTokens` in `src/embed.ts`: digit-bearing tokens plus non-sentence-initial capitalized runs, on the NFKC text, keeping single characters.
- [x] 2.2 `resolveMeaningIdentity` refuses a match when the body identity sets differ (both empty -> abstain, basis `similarity-only`); `chunkBody` strips the `${title}: ` prefix (only when a title is present); the collapse event names `basis <identity|similarity-only>`; the inert-LSA comments corrected at `src/kb.ts:609-610` and `:619-625`.
- [x] 2.3 `src/embed.test.ts`: six `identityTokens` cases (digits, mid-sentence proper noun, sentence-initial exclusion, single-digit retention, apostrophe/hyphen splitting, empty input, determinism).
- [x] 2.4 Regression suites: `kb.test.ts` 35 passed, `kb-model.test.ts`, `kb-hardening.test.ts`, `kb-report-receipt.test.ts` 60 passed, bound suite 5 passed; the six-file run 115 passed.

### Delta amendment (evidence-driven, within D4)

- [x] The plan specified identity on the *full* incoming body and the candidate's *first chunk*. Evidence showed the two spans are not comparable: the stored chunk is capped at 512 characters including the title, so an identity token near the end of a pasted body reached the incoming set but not the candidate's, and a legitimate update was refused. Identity is now read from `text.slice(0, 500)` and from `chunkBody(...).slice(0, 500)` — the same window the similarity comparison uses, on both sides. This is a condition-only amendment (no new file, gate, or destructive step); it narrows the documented residual to "identity outside the compared window is not compared" and is recorded in the AAR.

## Step 3 — Spec and README

- [x] 3.1 REQ-072 body: 787 characters / 6 sentences / 6 `SHALL` after the addition (limit 800/8/8); `validate-spec` pass; `check-gate-coverage` 118 G1 REQs, 117 cited, 1 exempt.
- [x] 3.2 README sentence added; `validate-readme` initially failed on the section word budget (379 > 350), so the addition was shortened and two redundant clauses in the same section tightened: the section is back inside the limit and the gate passes.

## Step 4 — Mutation evidence

- [x] 4.1 Guard call removed -> corpus A stored **167 of 200**; bound (a) failed; restored.
- [x] 4.2 `sameIdentity` forced true -> corpus A stored 167; bound (a) failed; restored.
- [x] 4.3 Sentence-boundary rule dropped -> the added-sentence positive was refused; recall (b) failed; restored.
- [x] 4.4 Title-prefixed candidate input -> the title-number case failed (chunk count 2 vs 1); restored.
- [x] 4.5 Reverts byte-identical: `src/kb.ts` sha `b7f814a3…`, `src/embed.ts` sha `56623fa2…` before and after all four mutations.

## Step 5 — Registers, roadmap, changelog, increment record

- [x] 5.1 `ROADMAP.md` section retired; `check-roadmap` passes; open items 21 -> 20 (21 sections including `## Non-goals`).
- [x] 5.2 Predecessor AAR A-1 disposition changed from `Scheduled-roadmap` to `Resolved`, naming this increment.
- [x] 5.3 `worklist.md:376` evidence cell refreshed with the bound suite, the guard, and `identityTokens`.
- [x] 5.4 `CHANGELOG.md` section added (no version bump; the file already carries 14 `## 2026.11.7` sections).
- [x] 5.5 `aar.md` written.

## Step 6 — Gates and commits

- [x] 6.1 `npm run test` 1164 passed (109 files); `check:fast` and the full `check` recorded in the AAR.
- [x] 6.2 Split commits with `typecheck` between them.
