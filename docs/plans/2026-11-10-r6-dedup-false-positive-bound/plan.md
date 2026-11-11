# Plan — R6 dedup false-positive bound

**Status:** reviewed · **Date:** 2026-11-10 · **Depth:** standard
**Review independence:** fresh — cold pass 1 FAILED (2 Blockers, 9 Majors, 6 Nits), all resolved; diff re-review FAILED (1 new Blocker, 1 new Major, 1 Nit), both resolved by amendment at the standard-depth cap; C-7 carries the residual verification to `build-review`. Cold report `/tmp/opencode/r6-dedup-cold.md` (`c7ca2f8d…`), diff re-review `/tmp/opencode/r6-dedup-rereview.md` (`3747e30a…`), stages 1–5, reads 26/40 and 8/10.
**Rollback cost:** 1 — one production module plus its tokenizer helper, one REQ body, one README sentence, and tests; no schema, config-key, or dependency change
**Roadmap item:** `ROADMAP.md` § R6 dedup false-positive bound (retire on close)
**Predecessor:** `2784a70` (R6 ledger and receipt remediation; `LOOP PAUSED`)

## Why this section

This is the first section in `ROADMAP.md` (`:17-22`), and the ordering rule is
top section first. Its trigger has two legs — "a user reports a collapsed
document" **or** "the seeded templated corpus collapses more than 10% of its
documents". The recorded measurement in
`docs/plans/2026-11-10-r6-config-dedup-report/tasks.md:26` is 36 of 200
templated documents (18%), so the second leg is already met. Deferring would
require amending the trigger the predecessor wrote, which this plan does not
do. Every later section (`R2 findings remediation` onward) stays queued.

## Baseline (verified this session)

- `git log -1` → `2784a70`; the tree is clean except for this untracked plan
  directory.
- `npm run check:fast` → PASS (fast, 20.1 s).
- `npm run status` → version 2026.11.7, 21 open roadmap items, 56 unpushed commits (oldest 24.9 h).
- `ROADMAP.md:17-22` is the section; `docs/plans/2026-11-10-r6-config-dedup-report/aar.md:30` records the finding (A-1, P2, scheduled).
- The dedup path is `resolveMeaningIdentity` (`src/kb.ts:607-652`), called from `sqliteIngest` (`src/kb.ts:675-687`). `MEANING_SIMILARITY_THRESHOLD = 0.92` (`:608`), `MEANING_LEXICAL_GATE = 0.5` (`:610`).
- `pairwiseSimilarity([incoming, candidate], "lsa")` is called with **two** documents, and `effectiveModel` (`src/embed.ts:447-452`) falls back to `signed-hash-tfidf` below `LSA_MIN_DOCS = 8`. The comparison is therefore always the lexical cosine, not LSA, despite the comments at `src/kb.ts:609-610` and `:619-625`. (The comment at `:584-586` is the search prefilter and is accurate.)
- Both sides of the comparison are title-prefixed strings: `incoming` is built as `` `${title}: ${text.slice(0,500)}` `` (`src/kb.ts:634`) and stored chunks keep the title at `src/kb.ts:283`, `:294`.
- REQ-072's body (`infobroker.md:586`) measures **677 characters, 5 sentences, 5 `SHALL` clauses** as `validate-spec` measures it (body with the `_Check:_` tail stripped) — 123 characters of Appendix B headroom.
- `src/kb.test.ts:359-369` collapses a near-duplicate report whose **title differs** ("Solar Flare Report" vs "Solar Flare Activity Report") — the case that must keep passing.
- The seeded corpus from the predecessor is **not recoverable**: no generator or fixture exists in the tree, and `git log --all -S"templated"` only reaches the plan/AAR prose and the committed source change. "Re-measure with the same seeded corpus" cannot be executed literally.

### Measurements taken this session (throwaway probes, no repo change)

Using the shipped `tokenize` and `pairwiseSimilarity("lsa")` — i.e. the real
effective comparison:

| Case | Measured similarity |
|---|---|
| Eight-section template pair, different **lowercase** slot (`harbour lease` vs `museum roof`) | **0.9992** |
| Long document + **one added sentence** (a true update) | **0.9980** |
| Long document + two added sentences | 0.9968 |
| Template pair, identity-bearing slot, over a 200-document simulated store | 0.9683 – 0.9948 |

Two facts follow. **The distributions invert:** a pair of *distinct*
templated documents scores **higher** than a *genuine* duplicate that gained a
sentence. No threshold separates them — raising the constant high enough to
reject 0.9992 also rejects the 0.9980 update, and the current 0.92 already
rejects an update in a short body (0.87 measured). A distinguishing-token
guard is the only mechanism in the roadmap's own list that can.

A third probe, on the D2 corpus with the D1 guard implemented as specified:
199 documents offered to a growing store after the first, **0 accepted
collapses and 199 stored**, and the probe's 20 positive duplicate pairs all
pass the guard. (The probe exercised no negatives; the committed set adds five,
which Step 1 measures for the first time.) The done bar is therefore
satisfiable rather than aspirational. These are probes, not evidence: Step 1
re-measures on the committed corpus, including those negative cases.

## Done bar

**Done bar:** a committed, deterministic corpus (D2) and a bound test exist;
the test fails on the pre-change tree with the identity segment collapsing at
the recorded baseline and passes after the change with **zero** collapses on
that segment, **15/15** recall on the positive duplicate pairs, and **5/5**
specificity on the negative pairs (or C-4's reduced
corpus, with both rates recorded); REQ-072 carries the distinguishing-content
clause and `npm run validate-spec` passes; the section is retired from
`ROADMAP.md` (21 → 20 items) and the predecessor's A-1 register row points at
this increment; `CHANGELOG.md` and `README.md` carry the narrowing;
`npm run check:fast` exits 0 on the final tree (full `npm run check` once, or
C-2 recorded); the increment record under
`docs/plans/2026-11-10-r6-dedup-false-positive-bound/` carries plan, tasks,
and an AAR ending `LOOP PAUSED` or `LOOP OPEN`.

**Conditions:**

- **C-1** — the committed corpus is substituted, not recovered (D2). If the
  reconstructed baseline collapses **fewer than 10%** of the corpus's
  documents, the reconstruction is not comparable to the recorded 18%: stop
  and re-characterize the corpus rather than ship a guard that fixes a
  non-defect.
- **C-2** — if `npm audit --json` cannot reach the registry, the full
  `npm run check` is recorded as not-run and `check:fast` is the terminal gate.
- **C-3** — the REQ-072 body stays within Appendix B (≤800 characters,
  ≤8 sentences, ≤8 `SHALL`), measured the way `scripts/validate-spec.ts:250-266`
  measures it (body only, `_Check:_` tail stripped). Current: 677/5/5.
  Measure before the first edit; trim the added sentence, never the existing
  clauses, on an overrun.
- **C-4** — the bound test's 200 + 40 document ingests must stay under 15 s in
  `npm run test`. If they do not, reduce to 100 + 20 documents, re-measure
  both rates on the smaller corpus, and record both — do not weaken the bound
  or skip the test.
- **C-5** — if `src/clause-coverage.ts` demands a named tag for the revised
  body, the tag ships in the same commit. (The detector reads only
  parenthesized "or" enumerations and "when … declares" conditionals; the
  drafted sentence adds neither.)
- **C-6** — if the diff re-review finds that the lexical-vs-semantic gap (the
  inert LSA path) is normative rather than informational, it is scheduled on
  `ROADMAP.md` as its own item instead of being folded into this one.
- **C-7** — the standard-depth re-review cap is reached, so the diff review's
  own two findings are resolved by plan amendment and are not re-audited by a
  third pass: candidate-side prefix stripping (Step 2.2, mutation 4.4) and the
  positive/negative split of the duplicate set (Step 1.2). `build-review`
  verifies both against the source diff before the first commit; if either
  recurs, the run stops and escalates rather than starting another pass.

## Findings in scope

| ID | Predicate (verified this session) | Fix |
|---|---|---|
| A-1 (from the R6 AAR) | Meaning-equivalence collapse is unbounded on templated corpora: 36/200 documents collapsed in the predecessor's measurement, and the measurement itself is not reproducible because the generator was never committed | Committed corpus + bound test + distinguishing-token guard |
| New — S-1 | `resolveMeaningIdentity` cannot use LSA: it always passes two documents to a model that requires eight (`src/embed.ts:447-452`), so the "LSA best match" attested at `src/kb.ts:619-625` is lexical in every call | Correct the comments; record the observation P3 (D6). Not a behavior change here. |
| New — S-2 | Appendix B headroom is 123 characters, so the contract sentence must be one clause | Drafted and measured in Step 3 |

## Design decisions

**D1 — Identity is read from the document body, never from the title.**
Identity tokens are (a) any token containing a digit — dates, counts, case ids
— and (b) any token that is capitalized away from a sentence boundary in the
raw body text, i.e. a proper noun. Let `I(d)` be that set for document `d`'s
body. The guard accepts a collapse only when `I(incoming) = I(candidate)`; when
**both** sets are empty it abstains and the similarity threshold alone decides.
The title is excluded deliberately: REQ-072 says a document is recognized as
the same "even when its title or source URL differs", so a title token must
not veto a body match, and `src/kb.test.ts:359-369` (a different titled
variant of the same body) must keep passing. Rationale for the guard: identity
is what makes a templated document *that* document, it is corpus-independent,
and it is exactly the signal a cosine over shared boilerplate discards.
Measured on the D2 corpus: equality accepts **0 of 199** offered templated
documents; the probe's 20 positive duplicate pairs all pass the guard. Rejected:
title-inclusive identity (cold pass 1, Blocker 1 — it breaks the REQ's own
title clause and that test); a *share* threshold on identity sets (at 0.5 it still collapsed
56/200 in the probe, because a template's name pool repeats); a
corpus-relative document-frequency "rare token" guard (it degenerates while
the store is small — the first templates' tokens are all rare — and it
re-admits every template token: 199/200 in the probe); a normalized
unique-token ratio (the distinguishing slot is ~1% of the token mass, so any
ratio wide enough to admit a real update admits the template pair too).

**D2 — The measurement becomes a committed artifact, and the substitution is
declared.** The predecessor's generator is gone; the plan does not pretend
otherwise. A deterministic generator lives in the new test file (no
randomness, no wall clock), producing two corpora:

- **Corpus A (identity-bearing, 200 documents):** 40 template groups of two
  documents each (80 documents, each pair sharing a long multi-section
  template and differing in unique case ids, names, and dates placed inside
  the first chunk) plus 120 unrelated single documents. Pre-change, each
  template pair collapses → ~20% of the corpus, comparable to the recorded
  18%. This is the corpus the bound is stated on.
- **Corpus B (common-word, 40 documents):** 20 template pairs whose slots
  differ only in ordinary lowercase words ("harbour lease" vs "museum roof").
  D1 makes no claim here; the rate is **recorded, not bounded**.

The duplicate set is 20 pairs: **15 positives** — 10 identical bodies under a
different title, 5 long bodies with one added sentence — and **5 negatives**
that differ in one identity token and must **not** collapse. The bound is
stated per corpus because the two test different things. The plan records the
original 18%, the reconstructed pre-change rate, and the post-change rate side
by side; the roadmap's intent (infer before/after with one corpus) is
preserved even though its corpus is not.

**D3 — The threshold stays 0.92; raising it is ruled out by measurement, not
by taste.** A true update measures 0.9980 and a distinct template pair 0.9992
— the distinct pair scores higher. Any constant that rejects the second
rejects the first. The threshold is not the lever, and changing it would trade
the defect for an equal and opposite one. This is a *decided* alternative, not
an unconsidered one.

**D4 — The guard is one extra regex pass over text already in hand, and its
tokenizer is specified.** The candidate scan already holds the incoming body
and each candidate's first chunk; `identityTokens` scans those bodies — no new
store walk, no new embedding, no schema change. The function is specified as
follows, so an implementer cannot silently change the bound:

- input is the raw **body** text on both sides, NFKC-normalized, never
  lowercased before the capitalization pass. The incoming body is `text`; the
  candidate body is the stored first chunk with its `` `${title}: ` `` prefix
  removed when a title is present (`src/kb.ts:283` omits the prefix for an
  empty title; `:294` builds both forms), so a number in a stored title can
  never enter the identity set;
- digit rule: any maximal token containing `\p{N}`;
- proper-noun rule: maximal runs of up to four capitalized words
  (`\p{Lu}[\p{L}\p{N}'’.&-]*`), skipping a run whose first character is at a
  sentence start — string start, or preceded only by whitespace, quote, or
  bracket characters after one of `.!?:`;
- emitted tokens are lowercased for set comparison, keep single characters
  (a bare `7` is identity), and are de-duplicated;
- determinism: pure function of the input string, no store state, no clock.

Two proper-noun matchers will therefore coexist: this one and
`src/analysis.ts:98-100`'s entity extractor. That is deliberate rather than an
oversight — analysis's regex has no sentence-boundary rule and no digit-token
rule, and unifying them would change analysis output, which is outside this
item's bound. The divergence is recorded in the AAR.

**D5 — The contract sentence names identity, so the bound is G1-verifiable.**
REQ-072 gains: "Documents SHALL NOT be recognized as the same document when
their identifying names, dates, or numbers differ." A gate can observe that;
"substantially matches" alone could not distinguish the two outcomes the
finding names.

**D6 — The inert LSA path is corrected in prose and recorded, not re-armed.**
Fitting an LSA model over the store on every ingest is a cost and behavior
change outside this item's bound, and it would not fix the false positive
(LSA also rates template-dominated documents as similar). The comments at
`src/kb.ts:609-610` and `:619-625` are corrected to name the effective model
and the reason; the observation is a P3 row in the AAR. If the diff re-review
calls it normative, C-6 schedules it.

**D7 — Behavior change, so README and CHANGELOG are committed edits.** The
narrowing is user-visible, and AGENTS.md's spec→README binding fails the push
pipeline when a REQ body changes with no README diff. `README.md:335-347`
describes KB ingest dedup and claim-record updates; it gains one sentence
stating that meaning-level dedup is bounded by distinguishing identity (names,
dates, numbers). `CHANGELOG.md` gains a new `## 2026.11.7 — R6 review: dedup
false-positive bound` section at the top: entries are version-keyed, and
`version-sync` compares version references to `package.json`, so no version
bump is made here and the existing version heading is reused (the file already
carries 14 `## 2026.11.7` sections, so a new one follows convention).

## Blast radius

| File | Change | Size |
|---|---|---|
| `src/embed.ts` (`:61-69` area) | Add `identityTokens(text)` per D4; one regex plus the sentence-boundary rule | S |
| `src/kb.ts` (`:607-652`) | Apply the D1 guard inside `resolveMeaningIdentity` (body text only); record the collapse basis in the event; correct the comments at `:609-610` and `:619-625` | M |
| `infobroker.md` (`:586`) | Add the D5 sentence to REQ-072; measure per C-3 | S |
| `src/kb-dedup-bound.test.ts` (new) | Deterministic corpus A and B, per-corpus bound, duplicate recall, guard unit cases, event-basis assertion, `// @implements REQ-072` | L |
| `src/embed.test.ts` | `identityTokens` unit cases: digits, mid-sentence capitals, sentence-initial run excluded, single-character digit kept, apostrophe/hyphen runs, empty input, determinism | S |
| `src/kb.test.ts` (`:350-444`) | Add one title-carries-a-number case (Step 1.3); every existing case must stay green, including the different-title collapse at `:359-369` | S |
| `src/kb-model.test.ts`, `src/kb-hardening.test.ts`, `src/kb-report-receipt.test.ts` | No edit expected; re-run as regression evidence (Step 2.4) | — |
| `src/index.ts` | No edit expected; Step 0.2 greps the `manage_kb` description for a dedup claim and adds it here if one exists | S (conditional) |
| `README.md` (`:335-347`) | One sentence naming the identity bound (D7) | S |
| `CHANGELOG.md` | New `## 2026.11.7` section naming the narrowing (D7) | S |
| `ROADMAP.md` (`:17-22`) | Retire the section | S |
| `docs/plans/2026-11-10-r6-config-dedup-report/aar.md` (`:30`) | Update A-1's disposition from `Scheduled-roadmap` to resolved-here, naming this increment (register coupling) | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` (`:376`) | Refresh the REQ-072 evidence row with the bound test and guard location | S |
| `debate-club/src/kb-contract.test.ts` | Read-only probe at Step 0.2; edited only if a fixture there **asserts a collapse the guard would now refuse** | S (conditional) |
| `docs/plans/2026-11-10-r6-dedup-false-positive-bound/{plan,tasks,aar}.md` | Increment record | S |
| `scripts/lib/gate-manifest.ts` | No change: the new file is a test, not a gate, so `check-gate-table` is unaffected | — |

No `config.json`, schema, dependency, or routing-file change is expected.

**Mutation targets (no committed change):** the guard call in
`resolveMeaningIdentity`; the identity-set equality; the `identityTokens`
sentence-boundary rule; the body-only input (replacing it with the
title-prefixed compare string must fail the different-title test).

## Implementation steps

**Step 0 — Surface probes (read-only unless stated).**

1. Record `git log -1`, `git status --porcelain`, and that `check:fast` was green at the baseline above.
2. `npm run check-tdqs`, `npm run check-intent-citations`, `npm run validate-spec`; record counts. Grep `debate-club/src/` for a fixture that **asserts** a collapse the guard would refuse, and grep `src/index.ts` for a `manage_kb` description stating deduplication behavior (a description edit then enters the blast radius).
3. Read `README.md:330-350`; draft the D7 sentence and record its word cost against the README's budget.
4. Confirm no `config.json` key governs the threshold (grep `MEANING_SIMILARITY|dedup`) and record that REQ-067's config surface is untouched. Grep `infobroker.md` for any second REQ binding KB document deduplication (sibling-contract check); today only REQ-072 does.
5. Measure the drafted REQ-072 body the way `scripts/validate-spec.ts:250-266` measures it (C-3).
6. Probe `npm audit --json` once (C-2).

**Step 1 — Write the corpus and the failing bound test (uncommitted until Step 6).**

1. Write `src/kb-dedup-bound.test.ts` with the deterministic generators (D2), using the temp-KB pattern at `src/kb.test.ts:9-40`.
2. Assertions: (a) corpus A's identity-bearing segment collapses **zero** documents; (b) all **15 positive** duplicate pairs collapse to one stored document (15/15 recall); (c) all **5 negative** pairs, which differ in one identity token, do **not** collapse (5/5 specificity); (d) corpus B's rate is recorded by an event assertion that reports but does not bound it; (e) a collapse names its basis (`identity` or `similarity-only`) in the event.
3. Add a title-carries-a-number case to `src/kb.test.ts`'s dedup describe: a stored document titled `Solar Flare Report 2024` and an incoming body-identical document titled `Solar Flare Report 2025` collapse, because neither title enters the identity set. It must fail if the candidate prefix is left in place (mutation 4.5).
3. Run it on the unmodified tree and record in `tasks.md`: stored counts, collapse counts per corpus, and wall time. It must fail on (a) with a baseline of at least 10% of corpus A (C-1). If it does not, stop.
4. If wall time exceeds 15 s, apply C-4 and re-record before continuing.

**Step 2 — The guard.**

1. `src/embed.ts`: `export function identityTokens(text: string): Set<string>` per D4, with a header comment naming REQ-072 and the body-only contract.
2. `src/kb.ts`: in `resolveMeaningIdentity`, build the identity sets from the **bodies** (never the title-prefixed compare string; D1), refuse when they differ, and append the basis to the dedup event. Keep the threshold and the lexical gate unchanged. Correct the comments (D6).
3. `src/embed.test.ts`: the D4 unit cases.
4. Re-run `src/kb.test.ts`, `src/kb-model.test.ts`, `src/kb-hardening.test.ts`, `src/kb-report-receipt.test.ts`, and the bound test.

**Step 3 — Spec and README.**

1. Add the D5 sentence to REQ-072; measure characters, sentences, `SHALL` count (C-3); run `npm run validate-spec` and `npm run check-gate-coverage`.
2. Add the D7 README sentence; run `npm run validate-readme` and re-check the word budget.

**Step 4 — Mutation evidence (C-1, C-6).**

1. Remove the guard call → bound assertion (a) fails; restore.
2. Force the identity sets to compare equal → (a) fails; restore.
3. Treat every capitalized token as a proper noun (drop the sentence-boundary rule) → duplicate recall (b) fails on the added-sentence pairs; restore.
4. Feed `identityTokens` the title-prefixed compare string instead of the body on either side → the different-title case at `src/kb.test.ts:359` fails (incoming side) or the new title-with-a-number case fails (candidate side); restore.
5. Verify each revert restores the exact pre-mutation bytes (`git diff --stat` empty).

**Step 5 — Registers, roadmap, changelog, increment record.**

1. `ROADMAP.md`: retire `:17-22`; confirm `npm run check-roadmap` passes and the count is 20.
2. `docs/plans/2026-11-10-r6-config-dedup-report/aar.md:30`: change A-1's disposition from `Scheduled-roadmap` to resolved in this increment, naming this plan directory (register coupling; the AAR is the finding register).
3. `docs/plans/2026-11-09-full-review-sweep/worklist.md:376`: refresh the REQ-072 evidence cell with the bound test and the guard's location.
4. `CHANGELOG.md`: new `## 2026.11.7 — R6 review: dedup false-positive bound` section; the residual (P3/D6 note) stays in the AAR, not the changelog.
5. Write `tasks.md` and `aar.md`; the AAR carries the measured table (original 18%, reconstructed pre, post, corpus B's uncapped rate) and ends `LOOP PAUSED` or `LOOP OPEN`.

**Step 6 — Gates and commits.**

1. `npm run check:fast` after Step 3, after Step 5, and on the final tree; full `npm run check` once on the final tree (or C-2); `npm run test` once.
2. Split commits: spec + README → source + tests → docs (roadmap, changelog, two register rows) → increment record; `npm run typecheck` between commits. No red commit: the test is written in Step 1 but committed green in the source+test commit.

## Edge cases and failure modes

| Case | Mitigation |
|---|---|
| Both documents have no identity tokens (lowercase slots) | The guard abstains; similarity decides; corpus B records the rate and the event says `similarity-only`. This is the documented residual, and it is observable. |
| A true update adds a proper noun (`The Ministry of Transport approved…`) | The sets differ → the update is stored as a second document. Accepted direction: a duplicate is cheap, a lost document is not. Recorded in the AAR. |
| A title differs but the body matches (`kb.test.ts:359`) | Identity is body-only, so the title cannot veto; the case stays green. |
| Identity appears **after** the first 500 characters | Identity is scanned over the full body on the incoming side and the full first chunk on the candidate side, so a later-in-chunk name is seen. Identity beyond the first chunk of a long stored document is still invisible — named as a residual in the AAR, not claimed as covered. |
| A script without capitalization (CJK, Arabic) | Only the digit rule fires; the guard abstains more often. Named residual; no false collapse is introduced. |
| A sentence-initial proper noun (`Parliament debated…`) | Excluded by the boundary rule, so a template varying only its opening word is not distinguished. Deliberate: including it would catch the first word of every sentence and fire on any update. |
| A capitalized heading or an ALL-CAPS token | Counted as identity; stable across re-ingests of the same page, so recall is unaffected. |
| The identity sets agree but a name is written differently (`USA` vs `United States`) | Collapse proceeds; identity-string normalization is out of scope and recorded in the AAR. |
| The store is empty or has one document | The guard has no candidate; unchanged behavior. |
| A corpus run is slow in CI | C-4 reduces to 100 + 20 documents with both rates recorded. |
| The reconstructed corpus collapses under 10% pre-change | Stop (C-1); the guard would be fixing a non-defect. |
| The predecessor's 18% cannot be reproduced exactly | Expected and stated (D2); the plan compares against the reconstructed pre-change rate and cites 18% as the original. |

## Verification

- Per step: `npx vitest run src/kb-dedup-bound.test.ts src/kb.test.ts src/embed.test.ts` plus the three adjacent KB suites named in Step 2.4.
- Mutation evidence (Step 4), each reverted with an empty diff.
- `npm run validate-spec`, `npm run check-gate-coverage`, `npm run check-intent-citations`, `npm run check-tdqs`, `npm run check-roadmap`, `npm run validate-readme` after their inputs change.
- Final: `npm run check:fast` three times as scheduled, `npm run check` once on the final tree (or C-2), `npm run test` once.

## User impact

- A templated document that differs from a stored one in a name, date, or
  number is now stored as its own document instead of being merged.
- A near-duplicate update that introduces a new proper noun is likewise kept
  separately — the deliberate conservative direction.
- A collapse that rests on similarity alone is now labelled as such in the KB
  event stream.
- No restart, migration, or reconfiguration; no stored data is deleted.
- Rollback: revert the `src/embed.ts` and `src/kb.ts` hunks, the REQ-072
  sentence, and the README sentence.

## Evidence and review record

- Baseline: HEAD `2784a70`, `check:fast` PASS (20.1 s).
- Roadmap: `ROADMAP.md:17-22`; finding A-1 at
  `docs/plans/2026-11-10-r6-config-dedup-report/aar.md:30`.
- Spec: REQ-072 (`infobroker.md:585-586`), REQ-067 (`:582-583`), REQ-066,
  REQ-083 for the class/collection scope, REQ-113 for configuration fallback.
- Code: `src/kb.ts:283`, `:294`, `:607-652`, `:675-687`; `src/embed.ts:61-69`,
  `:447-452`; `src/analysis.ts:98-100`; `src/clause-coverage.ts:23-35`;
  `scripts/validate-spec.ts:250-266`; `README.md:335`, `:347`.
- Measurements this session: the similarity table, the 0/199 sequential-ingest
  probe, and the probe's 20 positive pairs all passing the guard, from
  throwaway probes in `/tmp/opencode/` (not committed).
- Cold pass 1: 2 Blockers (title-inclusive identity breaks REQ-072's title
  clause and `kb.test.ts:359`; blast-radius omissions), 9 Majors (tokenizer
  under-specification, unnamed residuals, non-comparable baseline, red-commit
  ordering, stale predecessor register row, spec→README binding, inverted
  Arena probe, REQ-body measurement basis, "0 of 199" denominator), 6 Nits.
  All resolved in this revision; C-1/C-4/C-6 record the residual uncertainty.
- Diff re-review (standard-depth cap, one pass, 8 reads): 1 new Blocker
  (candidate-side input still title-bearing, so a number in a stored title is
  identity), 1 new Major (recall stated over a set that includes the negative
  pairs), 1 Nit (the "templated documents" label). Resolved by amendment:
  candidate prefix stripping (D4, Step 2.2, mutation 4.4), the 15/5 split
  (D2, done bar, Step 1.2), and the label. C-7 records that the cap is
  reached and `build-review` verifies the two amendments.
