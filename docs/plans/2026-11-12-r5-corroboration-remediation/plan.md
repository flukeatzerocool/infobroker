# Plan — R5 corroboration remediation

**Status:** draft, awaiting plan review and user approval · **Date:** 2026-11-12 · **Depth:** standard (one production module, one type module, one spec prose surface, one README clause, one test file; reversible behavior edits, no destructive or publish surface)
**Review independence:** fresh — one cold pass (5 stages) returned `independent-review FAILED.` with 1 Blocker, 2 Major, and 10 Minor/Nit findings; every finding is resolved below, and a targeted diff re-review returned `independent-review passed.` with two clarity-only nits that are applied here. Cold report: `/tmp/opencode/r5-cold-review.md`; re-review: `/tmp/opencode/r5-diff-rereview.md`.
**Rollback cost:** 1 — behavior edits inside `src/corroborate.ts` plus one additive type field and one additive parameter, prose alignment, tests, and bookkeeping. No state format, credential, dependency, or schema-shape change.
**Roadmap item:** `ROADMAP.md` § R5 corroboration remediation (`ROADMAP.md:17-22`; retired to `CHANGELOG.md` when this increment closes)
**Predecessor:** `5297630` (R4 contract close; `ROADMAP.md` now opens on the R5 section)
**Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md:740,741,769,770` (F-R5-A-1, F-R5-A-2, F-R5-D-1, and F-R5-D-2 as an in-slice by-product)

## Why this section

`ROADMAP.md` § R5 corroboration remediation is the first section in the file,
and the ordering rule is top section first. Its trigger — "start after chunk R6
closes" — is met: `ROADMAP.md` carries no R6 section, and the last R6 increment
in the series (`docs/plans/2026-11-10-r6-encryption-capacity-remediation/`,
whose plan names the retrieval close as its predecessor) ends `LOOP PAUSED` in
its AAR; the retrieval AAR's "the remaining R6 sections keep their own
triggers" (`…r6-retrieval-remediation/aar.md:51`) is now satisfied because every
one of those sections has closed.

The section names three P1 rows on one surface, `verify_claims`: what makes a
source count as support for a claim (F-R5-A-1), what makes a finding
`confirmed` (F-R5-A-2), and whether a knowledge-base-only corroboration may
claim confirmation (F-R5-D-1). They are one concern — the verdict-producing
predicate — and they interact: stopword-only overlaps inflate a claim's source
set, the inflated set raises confidence, and the fixed 0.5 cutoff turns the
result into `confirmed`. Fixing one without the others leaves a reachable
false confirmation path, so they ship together.

F-R5-D-2 (the tautological KB-alone test) rides along because the corrected
KB-only test replaces exactly the assertion it complains about; leaving it
scheduled would be a stale row.

## Baseline (verified this session)

- `git log -1` → `5297630`; `git status --porcelain` clean before this
  increment directory.
- `npm run check` → **PASS** (full, 22 gates, 153.8 s, run record for
  `5297630652b2`). One pre-existing warning: `check-loop-artifacts` reports
  `2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:** line`;
  warning only, out of scope (C-6).
- `npm run status` → version 2026.11.11 (latest tag `v2026.11.07`), **102
  unpushed commits, oldest 2.8 d**, 16 open roadmap items.
- Current config: `corroboration.confidence_threshold` 0.8, `kb_recall` true,
  `archive_sources` false (`config.json:332-338`); the tool schema declares the
  same 0.8 default (`src/index.ts:1994`).
- The four register rows were re-read and re-verified against the working tree
  this session (table below); none has been fixed since the R5 review. Line
  numbers in the register have drifted by up to 18 lines; the table uses
  current ones.

## Predicates re-verified by reading the code this session

| Finding | Current code | What is wrong |
|---|---|---|
| F-R5-A-1 (P1) | `jaccardSimilarity` tokenizes with `s.toLowerCase().split(/\W+/).filter((t) => t.length > 2)` (`src/corroborate.ts:101-113`); attribution accepts any `bestScore > 0` (`:222-228`). A `STOPWORDS` set exists (`:66-79`) but only `extractTopic` uses it (`:97`) | A snippet sharing only "the"/"was"/"and" with a claim is attributed to it, so an unrelated page becomes support and raises the family count, violating REQ-026b's unrelated-SHALL-NOT clause |
| F-R5-A-2 (P1) | The single-cluster confirm gate is the literal `finding.confidence >= 0.5` (`:308`); the multi-cluster branch confirms with no confidence test at all, and its non-confirmed fallback is `contested` (`:313-322`). `confidence_threshold` is read (`:540-541`) and used only for gap selection, early exit, agreement map, and the `corroboration` status | The tool description promises "findings below it are reported unverified" (`src/index.ts:1989`); with the shipped 0.8 threshold, two independent sources (0.7, or 0.49 after the web-search authority weight) are reported `confirmed` |
| F-R5-D-1 (P1) | The KB recall maps `kbSearch` hits to `{ title, url, snippet, source_type }` (`:638-643`) and reconciles them through the same path as external results (`:644`). The mapping drops `provider` entirely, so a recalled source is indistinguishable from an external one and carries no provenance provider | Two KB hits from different families reach 0.7 and, under any threshold at or below 0.7, `confirmed` with no external source, violating REQ-026e's "SHALL NOT be served from the knowledge base alone" |
| F-R5-D-2 (P2) | The KB-alone test spans `src/corroborate.test.ts:893-914`; its assertions (`:911-913`) check only that `providers_used` does not contain `knowledge_base` and that `total_sources >= 2`; no KB-only finding is exercised | The assertions are tautological — `providers_used` is populated only by dispatches — so a KB-only confirmation would pass them |

Seams read this session: the reconcile signature and its three call sites
(`src/corroborate.ts:196-205,644,712,763`), `computeConfidence` and its
family/authority math (`:344-379`), `assignSourceFamilies` (`src/source-family.ts`),
`CorroborationSource`/`KbSearchResult` (`src/types.ts:270-300,618-628`), the
`verify_claims` handler pass-through (`src/index.ts:2046`), and the corroborate
suites (`src/corroborate.test.ts:114-140,230-345,398-570,890-935`).

## Done bar

**Done bar:** F-R5-A-1, F-R5-A-2, F-R5-D-1, and F-R5-D-2 are fixed and marked
`Resolved` in the worklist with a one-line summary; every behavior change ships
a test that fails on the unmodified source and passes on the final tree (the red
result recorded in `tasks.md`). Specifically: a source whose only token overlap
with a claim is a stopword is not attributed to it (finding keeps zero sources),
while a single shared content token outside the lexicon still attributes, and
the lexicon's removal of a content-bearing word is pinned as an accepted
trade-off; the effective `confidence_threshold` — configuration value or caller
override — gates every `confirmed` assignment, so a two-family finding at the
fixture's unscaled 0.7 base reports `unverified` at 0.8 and `confirmed` at 0.7,
and a below-threshold multi-cluster finding reports `unverified` with its
computed confidence, never `contested`; a finding whose agreeing cluster
contains only knowledge-base sources is never `confirmed` at any threshold,
while the same finding with one additional external source can be;
knowledge-base sources report a `retrieval_origin` marker distinguishing them
from external ones, and an external result for an already attributed KB URL
upgrades that source; `ROADMAP.md` no longer carries the R5 corroboration
section; `CHANGELOG.md` carries one entry; REQ-026's body, §8.1, §8.2, and one
README clause state the threshold and external-source conditions;
the increment record carries plan, tasks, and an AAR ending `LOOP PAUSED` or
`LOOP OPEN`; `npm run typecheck`, `npm run check:fast`, `npm run check`,
`npm run validate-spec`, and `npm run check-loop-artifacts` exit 0 on the final
tree.

**Non-closure rule:** a slice stops if the threshold gate requires changing the
confidence ladder (§8.2 tiers), reworking `computeConfidence`, changing the
agreement-map bands, or spilling into the scheduled authority-weight
reconciliation (F-R5-B-9). Shipped slices are recorded in `CHANGELOG.md`, the
unshipped rows stay scheduled on a successor `ROADMAP.md` section, and the AAR
ends `LOOP OPEN`.

## Decisions

- **D1 — Attribution filters stopwords, not just short tokens.** `jaccardSimilarity`
  builds its token sets from tokens longer than two characters that are not in
  the existing `STOPWORDS` set, reusing the lexicon `extractTopic` already
  applies. The attribution rule stays "best score > 0": after filtering, any
  overlap is a content overlap, which is exactly REQ-026b's clause.
  **Alternative rejected:** a minimum Jaccard cutoff (a snippet sharing one
  distinguishing term is legitimate support, and picking a cutoff changes more
  of REQ-026b than the finding names); raising the length filter to four (misses
  the actual class — English stopwords are three characters or longer).
  - Trade-off, accepted and pinned: the shared lexicon also removes
    content-bearing words ("work", "use", "made", "new", "well", "many",
    `src/corroborate.ts:76-79`), so a snippet whose only link to a claim is one
    of those words is no longer attributed. That is a smaller error than
    attributing an unrelated page, and the closest-claim arbitration
    (`:216-221`) keeps its shape because every claim is filtered the same way.
    A Phase 1 test pins one such token as not attributing.
  - Consequence: a snippet made only of stopwords and short words scores 0 and
    is never attributed; the existing "filters short words" test still holds
    because its tokens are one character long.
- **D2 — The confirmation threshold is a shared predicate, not a constant.**
  `reconcileClaims` gains a trailing `confidenceThreshold = 0.5` parameter and a
  pure `confirmationEligible(members, confidence, threshold)` helper that
  encodes all three conditions: at least two agreeing members, confidence at or
  above the threshold, and at least one member without the knowledge-base
  marker. Both `confirmed` branches call it, and both get an explicit
  `unverified` fallback that keeps the computed confidence. The multi-cluster
  branch's existing `else` (dominant cluster smaller than two) stays
  `contested`; only the dominant-cluster case gains the fallback, so a finding
  whose agreeing cluster has two or more members is never reported `contested`
  (REQ-026f reserves that verdict for contradiction). A non-conflicting
  multi-singleton finding can still be `contested` through that `else`; that is
  pre-existing behavior outside this increment's findings and stays unchanged. `corroborate` passes the effective threshold at
  all three call sites. **Alternative rejected:** converting the eight
  positional parameters into an options object — 18 call sites plus the
  definition change for no behavioral gain; that refactor belongs to its own
  increment.
  - Consequence: direct unit callers that omit the parameter keep the legacy
    0.5 bar; the helper is unit-tested for each condition, so the multi-cluster
    fallback is provable without depending on LSA cluster formation.
- **D3 — Knowledge-base sources carry an explicit `retrieval_origin` marker.**
  `SearchResult` and `CorroborationSource` gain an optional
  `retrieval_origin: "knowledge_base"` field; the KB recall mapping sets it;
  `attributeSource` copies it. Absence means external, so every existing source
  and caller remains valid. **Alternatives rejected:** overwriting `provider`
  with `"knowledge_base"` (a KB hit's `provider` is the ingest provider, and the
  current mapping drops it, so the field is both absent today and semantically
  the wrong axis); naming the field `origin` (the glossary already defines
  provenance as "the recorded origin of a result", `infobroker.md:175`, so a
  second "origin" axis would collide). `retrieval_origin` is the
  KB-versus-live-retrieval axis and does not amend REQ-026d's provenance field
  list; the dropped ingest `provider` is scheduled separately (Phase 3 step 15).
  - Dedupe and precedence: attribution keeps one source per URL. When a live
    provider later returns a URL already attributed from the KB, the existing
    source's marker is cleared, because the URL was retrieved externally in this
    run; the reverse (KB first, external never) leaves the marker in place. A
    Phase 1 test pins the upgrade.
- **D4 — The threshold contract is anchored in REQ-026, not only in a tool
  description.** REQ-026 gains exactly one sentence: "A finding SHALL be
  reported as confirmed only when its confidence meets the effective confidence
  threshold." (107 characters, one SHALL, no backtick token; the body moves from
  654 to 762 characters, 7 sentences, 3 SHALL clauses — measured this session). §8.1's pseudocode gains the eligibility condition and a KB-alone
  comment; §8.2's prose states that the verdict follows the same bar and that
  the Rating column names a confidence band, not the verdict (the table itself
  is unchanged). The README gains one clause. The KB-alone rule stays owned by
  REQ-026e, which already states it. **Alternative rejected:** editing only the
  implementation — the description is not the normative surface, and the
  register row names the promise as unfulfilled, not merely the code as wrong.
- **D5 — A below-threshold finding keeps its computed confidence and reports
  `unverified`.** No clamping and no new verdict value; `contested` is unchanged
  because REQ-026f makes contradiction decisive, and the explicit fallback in
  both confirmation branches prevents a non-conflicting finding from falling
  into it. The agreement map already bands on the threshold, so it needs no
  edit. **Alternative rejected:** clamping confidence to the threshold — it
  would hide the measured value that `provenance` and the ledger record.
- **D6 — Commit series and publication.** Five convention buckets, in order:
  (1) spec + README threshold/external-source wording; (2) stopword-filtered
  attribution plus its tests; (3) the shared eligibility predicate,
  threshold-gated confirmation, explicit fallbacks, and the updated
  `confirmed` expectation at `src/corroborate.test.ts:438`; (4) the KB
  `retrieval_origin` marker, the URL-upgrade rule, and the KB-only verdict rule
  plus the rewritten KB test; (5) the increment close — CHANGELOG, ROADMAP
  retirement and the one new scheduled section, worklist dispositions, AAR.
  Each commit is `typecheck`-clean; the final tree runs the full gate. **No
  push:** publication stays user-authorized; the 102-commit, 2.8 d backlog is
  recorded in the AAR, not published here.

## Slice map

| Slice | Findings | Files |
|---|---|---|
| A — Attribution | F-R5-A-1 | `src/corroborate.ts` (`jaccardSimilarity`), `src/corroborate.test.ts` |
| B — Confirmation gate | F-R5-A-2 | `src/corroborate.ts` (`confirmationEligible`, `reconcileClaims`, three call sites), `src/corroborate.test.ts` |
| C — Knowledge-base origin | F-R5-D-1, F-R5-D-2 | `src/types.ts`, `src/corroborate.ts` (KB mapping, `attributeSource`, URL upgrade, verdict rule), `src/corroborate.test.ts` |
| D — Contract prose | F-R5-A-2 | `infobroker.md` (REQ-026, §8.1, §8.2), `README.md` |

## Blast radius

**Production (2 TS modules).** `src/corroborate.ts` (tokenizer, the
`confirmationEligible` helper, reconcile signature and gates, KB mapping and
marker, URL upgrade, verdict predicate); `src/types.ts` (`retrieval_origin` on
`SearchResult` and `CorroborationSource`).

**Tests.** `src/corroborate.test.ts` — new attribution, threshold, helper,
multi-cluster, URL-upgrade, and KB-only cases, plus the updated expectation for
the existing two-source `confirmed` test. Run-only: `src/kb-claims.test.ts`,
`src/source-family.test.ts`, `src/calibration.test.ts`,
`src/tool-surface.test.ts` (the description and schema are unchanged, so this
is a check, not an edit).

**Documentation and bookkeeping.** `infobroker.md` (REQ-026 one sentence, §8.1
pseudocode, §8.2 paragraph), `README.md` (one clause in the `verify_claims`
paragraph), `CHANGELOG.md` (one entry), `ROADMAP.md` (remove the R5
corroboration section; add one section for the newly found KB-provider
provenance gap), `worklist.md` (four dispositions),
`docs/plans/2026-11-12-r5-corroboration-remediation/{plan,tasks,aar}.md`.
No `AGENTS.md`, `config.json`, or schema change.

**Explicitly out of scope.** F-R5-A-3/A-4/A-5, F-R5-B-3/B-4/B-5/B-8/B-9/B-10,
F-R5-C-4…C-8, and F-R5-D-4…D-7 (their own roadmap homes or the F-M1-2 census);
the R5 snapshot/family, citation/prose, R7, R8, and R9 sections; the
`check-loop-artifacts` warning (C-6).

## Phases and steps

### Phase 0 — Scaffold and baseline

0. The increment directory carries `plan.md`, `tasks.md`, and an in-progress
   `aar.md` whose final line is `LOOP OPEN`.
1. Re-confirm the baseline if execution starts on a different HEAD: `npm run check`
   un-piped, recording exit status, gate count, and wall time. **Red-baseline
   branch:** a failure caused by this increment's artifacts is fixed by step 0;
   a pre-existing failure is fixed as its own commit and Phase 0 restarts; a
   failure on the `verify_claims` surface stops the increment with `LOOP OPEN`.
2. Seam audit in `tasks.md`: enumerate every `reconcileClaims` caller (18 call
   sites plus the definition; three in production) and confirm which existing
   assertions depend on the 0.5 constant, on the multi-cluster branch, or on an
   absent `retrieval_origin`. Confirm `jaccardSimilarity` has exactly one
   production caller (claim attribution; cluster formation uses
   `pairwiseSimilarity`), so the D1 filter cannot shift clustering. This audit's
   result is what C-5 is conditioned on.

### Phase 1 — Failing evidence first

3. Add one test per finding and run it **before** its fix; record the failure
   text in `tasks.md`.
   - `src/corroborate.test.ts` `jaccardSimilarity`: a claim and a snippet that
     share only stopwords score 0; a shared content token outside the lexicon
     still scores above 0; one lexicon-removed content word ("work") is pinned
     as not attributing, recording the D1 trade-off (F-R5-A-1). Tag the block
     `// @implements REQ-026b unrelated-result`.
   - `src/corroborate.test.ts` reconcile-level: a seeded finding plus a result
     whose only overlap is a stopword keeps zero sources; a result sharing one
     content token is attributed (F-R5-A-1).
   - `src/corroborate.test.ts` helper-level: `confirmationEligible` returns false
     for one member, for confidence below the threshold, and for a KB-only
     member set; true for two external members at or above it (F-R5-A-2,
     F-R5-D-1).
   - `src/corroborate.test.ts` reconcile-level threshold: two untyped sources on
     different registrable domains give the unscaled 0.7 base (no
     `authority_weights` in the fixture, no `source_type`), are `unverified`
     when reconciled at 0.8, and `confirmed` at 0.7 (F-R5-A-2; C-4).
   - `src/corroborate.test.ts` `corroborate`-level: the shipped 0.8 threshold
     leaves a two-provider agreement `unverified` while
     `provenance.confidence_threshold` reports 0.8, and a caller override of 0.7
     makes the same agreement `confirmed` — same untyped-source fixture, so the
     assertion is on the post-scaling value (F-R5-A-2).
   - `src/corroborate.test.ts` multi-cluster: a finding whose dominant cluster
     holds two agreeing sources (0.7) and whose second, non-conflicting cluster
     holds one is `unverified` at 0.8 with that confidence, never `contested`
     (F-R5-A-2; C-10).
   - `src/corroborate.test.ts` KB-only: two agreeing KB hits on different
     registrable domains, snippets short enough that REQ-121's 20-token family
     gate cannot collapse them, giving two families and the unscaled 0.7 base
     (the mocked config omits `authority_weights`, so nothing scales it); with
     `confidence_threshold: 0.3` the finding is `unverified` after the fix
     and both sources report `retrieval_origin: "knowledge_base"` (F-R5-D-1).
     This fixture is red before the fix because the old fixed 0.5 gate confirms
     0.7 — the verdict, not confidence, is what changes (C-3).
   - `src/corroborate.test.ts` KB companion: one agreeing external source added
     makes the same finding `confirmed` at 0.3, and no KB slug appears in
     `providers_used`, replacing the tautological assertion (F-R5-D-2). Tag the
     KB block `// @implements REQ-026e kb-alone`.
   - `src/corroborate.test.ts` URL upgrade: a KB hit and a later external result
     for the same URL leave one source with the marker cleared (D3).
4. Record every red result; a test that passes unmodified is either mis-aimed
   or the behavior already holds, and either is recorded before any source edit.

### Phase 2 — Fixes, in dependency order

5. **Slice A.** `src/corroborate.ts`: filter `STOPWORDS` in `jaccardSimilarity`
   (D1). Keep the attribution rule at `> 0`.
6. **Slice B.** `src/corroborate.ts`: add `confirmationEligible(members,
   confidence, threshold)`, the trailing `confidenceThreshold` parameter, and
   the explicit `unverified` fallback in both `confirmed` branches; pass the
   effective threshold from all three call sites (D2).
7. **Slice C.** `src/types.ts`: add `retrieval_origin` to `SearchResult` and
   `CorroborationSource`. `src/corroborate.ts`: set
   `retrieval_origin: "knowledge_base"` in the KB recall mapping, copy it in
   `attributeSource`, clear it when an external result repeats an attributed KB
   URL, and route both confirmation branches through the eligibility helper
   (D3).
8. Fill in anything the Phase 1 tests expose. A failing expectation is a real
   defect and is fixed, not weakened.

### Phase 3 — Contract prose, verification, and bookkeeping

9. `infobroker.md`: REQ-026's one-sentence threshold contract; §8.1's
   pseudocode eligibility condition and a KB-alone comment; §8.2's verdict
   paragraph and the rating-band clarification (D4, D5). Re-measure the
   REQ-026 body (characters, sentences, SHALL clauses, backtick tokens) and
   record the numbers in `tasks.md` before commit (C-2).
10. `README.md`: one clause in the `verify_claims` paragraph naming the
    threshold and external-source conditions. Run `npm run validate-readme`.
11. Run the targeted suites: `corroborate`, `kb-claims`, `source-family`,
    `calibration`, `tool-surface`. Record counts.
12. Run `npm run typecheck`, then `npm run check:fast`, then `npm run check`
    (full). A gate failure is repaired inside this increment; an out-of-scope
    failure becomes an AAR cross-chunk note.
13. `CHANGELOG.md`: one entry naming the attribution filter, the threshold gate,
    the KB-alone rule, and the retrieval-origin marker, with REQ IDs and the
    tests that pin them.
14. `ROADMAP.md`: remove the R5 corroboration section. Run
    `npm run check-roadmap`.
15. `ROADMAP.md`: add one section for the newly found KB-provider provenance gap
    (recalled sources report no `provider` in the provenance record though
    REQ-026d requires one per source); the AAR carries the finding, the section
    carries the action and trigger. Re-run `npm run check-roadmap`.
16. `worklist.md`: mark F-R5-A-1, F-R5-A-2, F-R5-D-1, and F-R5-D-2 `Resolved`
    with a one-line summary each, in the existing row form.
17. Finish `aar.md` with dispositions, the new finding's roadmap disposition,
    verification counts, the backlog note, and a terminal `LOOP PAUSED` or
    `LOOP OPEN`.
18. `npm run session:close`, then the commit series (D6). Stop and report rather
    than commit a failing tree.

## Conditions

- **C-1** — `retrieval_origin` is additive and optional; no declared output shape
  is narrowed, and a source without it is an external source.
  `tool-surface.test.ts` is the check.
- **C-2** — the drafted REQ-026 sentence is 107 characters and one SHALL, and
  the body must stay inside Appendix B: ≤800 characters, ≤8 sentences, ≤8 SHALL
  clauses, and no new backtick token. The measured numbers are recorded in
  `tasks.md` in the same commit. If the measured total exceeds 800, the sentence
  is shortened rather than splitting the comma-free clause.
- **C-3** — the KB-only test fails before the fix for the *verdict* reason, not
  for confidence: the two hits sit on different registrable domains with
  snippets short enough that the 20-token family gate cannot collapse them (so
  the family count is 2 and the unscaled base is 0.7), their snippets are
  similar enough to form one cluster, and the configured threshold is 0.3. A
  pre-fix `unverified` caused by low confidence or by `contested` is a mis-aimed
  test.
- **C-4** — the threshold fixtures pin the unscaled base: untyped sources, no
  `authority_weights`, so 0.7 is asserted exactly rather than assumed. The
  shipped `web_search:0.7` weight (0.49) is F-R5-B-9 and stays out of scope.
- **C-5** — the signature change is additive at the call boundary: every
  `reconcileClaims` caller that omits the new parameter keeps the 0.5 bar.
  Existing reconcile assertions that depend on the old multi-cluster behaviour
  are updated only where they assert the contract this increment changes, and
  each one is named in `tasks.md` from the Phase 0 audit; an unexplained
  expectation change is a blocker.
- **C-6** — the `check-loop-artifacts` warning for
  `2026-11-10-r6-encryption-capacity-remediation` is recorded, not fixed.
- **C-7** — no test reads the operator's real KB or quota state: the KB cases
  mock `kbSearch`/`isKbConfigured` as the existing suite does, and set `TMPDIR`.
- **C-8** — F-R5-A-3, A-4, A-5, B-3…B-10, C-4…C-8, and D-4…D-7 stay scheduled;
  the F-M1-2 census (`worklist.md:893`) already records that most of them have
  no roadmap home, and this increment does not re-file them.
- **C-9** — the cold pass ran and returned findings; every one is resolved in
  this revision, and a targeted diff re-review (one pass, standard-depth cap)
  confirms the revisions. The AAR records both artifacts and their hashes.
- **C-10** — the multi-cluster fixture is shaped so a merged cluster cannot
  produce the expected verdict: if the third source joined the dominant cluster
  the confidence would be 0.9 and the post-fix verdict `confirmed`, so a green
  run proves the dominant cluster stayed at two members.

## Rollback

Every edit is reversible. Reverting the source commits restores the previous
tokenizer, the 0.5 constant, and the unmarked KB path; the added type field is
optional, so a downgrade that reads a response carrying `retrieval_origin`
ignores it. No persisted state schema, credential, or dependency is involved.
The ledger written by later `verify_claims` runs may hold more `unverified`
verdicts under the corrected gate; that is the contract, not state that must be
migrated.

## Verification summary
| Claim | How it is proven |
|---|---|
| Stopword overlap alone does not attribute | `jaccardSimilarity` unit case plus a reconcile-level zero-source finding |
| A shared content token still attributes | Positive control alongside the stopword case |
| The D1 trade-off is recorded | A lexicon-removed content word is pinned as not attributing |
| The effective threshold gates `confirmed` | Reconcile-level 0.8/0.7 pair plus the `corroborate`-level override case |
| Provenance reports the effective threshold | `provenance.confidence_threshold` in both threshold tests |
| A below-threshold multi-cluster finding is `unverified`, not `contested` | Multi-cluster case with the C-10 fixture discipline |
| KB-only corroboration never confirms | KB-only case with two families, one cluster, and a 0.3 threshold |
| KB plus external can confirm | Companion case with one agreeing external source |
| KB sources are distinguishable | `retrieval_origin: "knowledge_base"` asserted on the returned sources |
| A live URL upgrades a KB-attributed source | URL-upgrade case |
| The tautological KB test is replaced | Rewritten test exercises a KB-only finding (F-R5-D-2) |
| Contract prose matches behavior | REQ-026 body, §8.1, §8.2, README clause; `validate-spec` and `validate-readme` |
| Nothing else regressed | `npm run check` (22 gates), `npm run check:fast`, `npm run typecheck` |
