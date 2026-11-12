# Plan — R4 `fetch_page` classification remediation

**Status:** draft, cold pass complete (`independent-review passed.`), 5 majors and 6 nits applied and diff-confirmed; awaiting user approval · **Date:** 2026-11-11 · **Depth:** standard (three production modules plus one tool-description string, one spec gate, reversible edits, no destructive or publish surface)
**Review independence:** self pass plus one cold pass (Stages 1–5; blockers found in Stages 1, 3, 4, and 5 were resolved by revision; the targeted re-audit returned `independent-review passed.` with 5 majors + 6 nits, applied and diff-confirmed)
**Rollback cost:** 1 on a 0–2 scale (0 = pure addition, 1 = reversible edit, 2 = destructive). No state-format change, no schema or credential change, no new dependency.
**Roadmap item:** `ROADMAP.md` § R4 fetch-page classification remediation (retired to `CHANGELOG.md` when this increment closes)
**Predecessor:** `cd447d6` (R4 extraction close; its plan names § R4 classification and § R4 contract as the remaining R4 sections)
**Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md` § Finding register (F-R4-A-1, F-R4-B-2, F-R4-E-1; F-R4-E-4 is P2 and to be resolved on the same evidence)

## Why this section

R4 classification is the first open section in `ROADMAP.md`, and the ordering
rule is top section first. Its trigger ("start after chunk R5 closes") is met:
the R5 chunk AAR is closed (`docs/plans/2026-11-09-full-review-r5`), and the
predecessor plan recorded and relied on that reading when it shipped the R4
extraction slice (`docs/plans/2026-11-11-r4-fetch-extraction-remediation/plan.md:12-17`).
The section's close trigger is "every R4 **P1** row in the classification group
is `Resolved`" — F-R4-B-2, F-R4-E-1, F-R4-A-1. F-R4-E-4 is a **P2** row on the
same classification surface; this increment resolves it because the evidence
that fixes E-1 (a classification test block plus an end-to-end case) is the
evidence E-4 asks for. It is not required by the close trigger.

The worklist states F-R4-A-1 as: "REQ-021a's branch list has only one semantic
clause tag and `clause-coverage.ts` cannot see unparenthesized or-lists"
(`worklist.md:695`). Both limbs are in scope: visible list, tags present. The
worklist's **separate** P2 row F-R4-E-3 and the R9 row F-R9-A-1 govern tag-count
strength; this increment does not change the count rule (C-12).

- **Anti-bot classification (F-R4-B-2).** A page whose *title* merely contains "captcha" is treated as a challenge and the renderer is discarded.
- **Task classification (F-R4-E-1).** `area` and `elevation` are measurable attributes in the fact resolver but are missing from the classifier, so those queries never reach the resolver.
- **Clause-tag classification (F-R4-A-1).** REQ-021a's target classes are an unparenthesized `or`-list the G3 clause guard cannot see, so the guard cannot require a tag per branch.

The third row also changes the spec gate (`src/clause-coverage.ts` is consumed
by `scripts/validate-spec.ts:355`), which is why this increment's blast radius
includes a gate behavior change and a CHANGELOG entry.

## REQ text the plan is measured against (quoted)

**REQ-021a** (`infobroker.md:271-273`): "WHEN `fetch_page` receives a URL whose
host resolves to a loopback, private, link-local, or metadata address, the tool
SHALL refuse to fetch it … unless the configuration permits private-network
targets. The guard SHALL be reapplied after each redirect hop … A refused target
SHALL be reported with a code that distinguishes the safety refusal from a
general fetch failure."

**REQ-021f** (`infobroker.md:286-287`): "WHEN a `fetch_page` renderer returns
content that indicates an anti-bot challenge — a verification, CAPTCHA, or
challenge page rather than the target page — the tool SHALL treat that renderer
as failed and SHALL continue to the next renderer in the chain."

**REQ-021i** (`infobroker.md:295-298`): "WHEN a query names a measurable
attribute such as attendance, population, area, elevation, percentage, or date,
`search_web` SHALL classify it as a `structured_fact` query … WHEN no source
yields a value, `search_web` SHALL NOT compute or infer one." Six attributes are
named; `attendance`, `population`, `percentage`, and `date` have signals
(`src/task-type.ts:78-96`); `area` and `elevation` do not.

## Baseline (verified this session)

- `git log -1` → `cd447d6` (`docs(roadmap): resolve the R4 extraction findings and retire the section`); `git status --porcelain` shows only the new untracked increment directory this plan creates.
- `npm run status` → version 2026.11.11 (tag `v2026.11.07`), **95 unpushed commits, oldest 2.2 d**, 18 open roadmap items.
- `npm run check` → **PASS** (full, 22 gates, 153.8 s).
- Current detector baseline over the 142 REQ bodies in `infobroker.md`: `orBranches > 0` for exactly **REQ-013 (4)** and **REQ-020 (2)**. The post-change gate is expressed as *new* detections beyond this baseline.
- One pre-existing warning: `check-loop-artifacts` reports `2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:** line`. Warning only; out of scope (condition C-8).

## Predicates re-verified by reading the code this session

| Finding | Current code | What is wrong |
|---|---|---|
| F-R4-B-2 (P1) | `/captcha/i` is in `STRONG_TITLE_MARKERS` (`src/lib/bot-challenge.ts:15`) and is decisive with no length guard at `:59`; the module header promises "shorter markers only count when the page also has almost no textual content" (`:5-7`), and `visibleTextLength`/`MIN_TEXT_FOR_SCRIPT_SIGNAL` already exist (`:34,50-54`). No other test pins the current CAPTCHA-title verdict; the "captcha marker" test fixture's title is "Verify you are human", which matches the strong marker at `:13`. | An article titled "How CAPTCHA works" with real prose is discarded as an anti-bot page, so REQ-021f's "content that indicates a challenge rather than the target page" is over-matched. |
| F-R4-E-1 (P1) | `structured_fact` signals (`src/task-type.ts:78-96`) list `attendance`, `percentage`, `share of`, date phrases, but not `area` or `elevation`; the fact resolver already maps both (`src/structured-fact.ts:61-68,82-92,100-107`); enrichment is gated by `if (meta.task_type !== "structured_fact") return content;` (`src/index.ts:1799`) | A query naming `area` or `elevation` never classifies as `structured_fact`, so the resolver is never invoked and REQ-021i's "SHALL classify it" branch is dead for two of the six attributes it names. |
| F-R4-A-1 (P1) | `src/lib/url-guard.test.ts:1` carries one semantic tag (`resolved-address`); `detectClauseRequirements` scans only parenthesized groups (`src/clause-coverage.ts:14-35`), splitting on `/\s+or\s+/` only (`:28`); `evaluateClauseCoverage` requires ≥2 tags when `orBranches >= 2` (`:66-71`) | REQ-021a's branch list is `loopback, private, link-local, or metadata address` in prose, not parentheses, so the detector reports zero branches; the gate can never require the tags, and only one semantic tag exists. |

**Candidate-rule probe (dry run, this session; not the real detector).** A
throwaway Node script parsed the 142 `**REQ-NNN — …**` headings in
`infobroker.md`, took each first paragraph as the body, and applied two
candidate rules:

| Candidate rule | REQ bodies matched | Assessment |
|---|---|---|
| Any unparenthesized comma-`or` list | **49 / 142** | Unusable: matches value unions and plain conjunctions ("High, Medium, or Low", "asserted, reported, or speculative", "area, elevation, percentage, or date"). |
| Narrow shape: inside a `WHEN` clause, introduced by `a`/`an`, every leg but the last a single word or hyphenated compound, final leg a shared head noun | **2 / 142** | Bounded and true to the finding: REQ-021a (`loopback`, `private`, `link-local`, `metadata address`) and REQ-021f (`verification`, `CAPTCHA`, `challenge page`). |

These two rows are the **expected** scope; the authoritative check is the real
`detectClauseRequirements` run after Slice C (Phase 2 step 10a), compared
against the recorded baseline (REQ-013, REQ-020).

## Done bar

**Done bar:** all of the following hold on the final tree.

- F-R4-B-2, F-R4-E-1, F-R4-A-1, and F-R4-E-4 are `Resolved` in the worklist with a one-line summary; the F-R4-A-1 summary quotes the finding's two limbs (list visibility and tag presence), not tag-count strength.
- A page whose title contains "captcha" but whose visible text is long is not a challenge; a short CAPTCHA wall still is; every **remaining** strong marker keeps its current verdict (the demoted captcha marker is the deliberate exception). The >400-character boilerplate-wall case is covered by a test that records the accepted residual (D1).
- `classifyTaskType` returns `structured_fact` for all eight added signal forms (four area, four elevation, listed in D2); the existing regression rows' expected values are unchanged; "Bay Area news" does not return `structured_fact`; the accepted "area of law/study/expertise" misroute is asserted and stated in D2 and C-1.
- The real `detectClauseRequirements` run yields exactly the expected post-change map: baseline REQ-013 (4) and REQ-020 (2), plus REQ-021a (4 legs) and REQ-021f (3 legs). Any deviation follows D3's bounded repair rule; two failed adjustments stop the increment with `LOOP OPEN`.
- `src/lib/url-guard.test.ts` carries repeated-pair tags for the REQ-021a target classes (`loopback`, `private`, `link-local`, `metadata-address`) plus its two other asserted clauses, and `src/lib/bot-challenge.test.ts` carries `verification`, `captcha`, `challenge-page`; `npm run validate-spec` passes. The gate verifies tag *presence*, not one tag per branch — the per-branch count rule is F-R9-A-1 (C-12).
- The `search_web` description and README name area and elevation in the attribute examples; `npm run validate-readme` passes.
- `ROADMAP.md` no longer carries the R4 classification section; `CHANGELOG.md` carries one bullet under the top `## 2026.11.11 — R4 fetch-page extraction…` heading naming all three changes (CAPTCHA marker gate, area/elevation classification, detector extension — the last is a gate behavior change); the increment record carries plan, tasks, and an AAR ending `LOOP PAUSED` or `LOOP OPEN`.
- Every behavior change has a test that fails on the unmodified source and passes on the final tree; the red result is recorded in `tasks.md`.

**Non-closure rule:** a fix that needs a response-schema breaking change, a new
dependency, a production module beyond `bot-challenge.ts`, `task-type.ts`,
`clause-coverage.ts` (plus the description string in `index.ts`), or a REQ body
edit stops that slice. Shipped slices are recorded in `CHANGELOG.md`; unshipped
rows stay scheduled on a successor `ROADMAP.md` section, and the AAR ends
`LOOP OPEN`.

## Decisions

- **D1 — CAPTCHA becomes a weak title marker, gated on visible text length.** Remove `/captcha/i` from `STRONG_TITLE_MARKERS` and add `WEAK_TITLE_MARKERS = [/captcha/i]`, evaluated only when `visibleTextLength(content) < MIN_TEXT_FOR_SCRIPT_SIGNAL` (400) — the same threshold the challenge-script markers use (`src/lib/bot-challenge.ts:61-66`). Add a comment at the constant noting it now gates two marker families. **Alternative rejected:** delete the marker entirely — a title-only CAPTCHA wall served by `native_fetch` would then pass as content, weakening REQ-021f. **Alternative rejected:** add a title-length guard — title length is unrelated to whether the page is a wall.
  - Consequence: a short page whose title says "captcha" is still a challenge; a long page is not. **Accepted residual (tested):** a CAPTCHA wall with more than 400 visible characters of boilerplate and no strong/body/script marker is no longer detected. The test `bot-challenge.test.ts` asserts that residual with a comment, and the AAR records it as a P3 information item; the common walls carry "Just a moment"/"Attention Required" or a script marker and remain detected.
  - `visibleTextLength` strips tags from the whole content including the title, so a title-only wall with no body is short and still detected.
- **D2 — `area` and `elevation` classify through explicit measurable-attribute signals.** Add to the `structured_fact` signals, all weight 4: `area of`, `surface area`, `total area`, `land area`, `elevation`, `elevation of`, `elevation gain`, `elevation above` (eight forms; `elevation` bare covers "Denver elevation" and "what is Denver's elevation", which the `of` form misses). The classifier gates a **narrow** chain (`src/task-type.ts:198`), so a false positive costs a misrouted search. **Alternative rejected:** a bare `area` signal — "area" is polysemous ("Bay Area news", "area code", "dining area") and at weight 4 would beat the news signal; the fact resolver's own `\barea\b` rule stays broad because it runs only after classification. **Alternative rejected:** `elevation of` only — the bare-noun forms are common and `elevation` has no high-frequency non-attribute sense outside "angle of elevation".
  - Consequence: "area of Testville", "surface area of Testville", "total area of Testville", "land area of Testville", "elevation of Denver", "Denver elevation", "elevation gain", and "elevation above sea level" classify; "Bay Area news" stays on the news chain; the existing regression rows keep their expected values.
  - **Accepted misroutes (asserted, recorded):** "area of law", "area of study", and "area of expertise" contain `area of` and will route to `structured_fact`; the resolver returns `not_found`/`unavailable` and computes nothing (REQ-021i no-inference). "Angle of elevation" routes the same way because `elevation` is bare. All four are P3 information items recorded in the AAR, not defects this increment must solve.
  - **Weight note:** `scoreType` caps at 5 (`src/task-type.ts:268`), so weight 4 is decisive against a single generic signal but a query matching two added forms is capped, not summed beyond 5.
  - **F-R4-E-4 by the same evidence:** the test `it("routes measurable-attribute queries to structured_fact")` in `src/task-type.test.ts` gets the tag `REQ-021i measurable-attribute`, and `src/structured-fact.test.ts` gains one end-to-end case that calls `classifyTaskType` and then `enrichStructuredFacts` for an area query.
- **D3 — The clause detector recognizes one narrow unparenthesized shape.** `detectClauseRequirements` gains a second scan with an explicit algorithm:
  1. **Span.** For each sentence containing `WHEN`, take the text from `WHEN` to the sentence-ending period (not to `SHALL`). REQ-021a's and REQ-021f's lists both fall inside that span.
  2. **Introducer.** Find the last `a ` or `an ` before the first comma that is followed by a leg containing ` or `. The list starts immediately after that determiner.
  3. **Terminator.** The list ends at the first comma whose following segment begins with a determiner or pronoun (`the`, `this`, `that`, `these`, `those`, `its`, `their`, `it`, `they`, `he`, `she`, `we`, `you`), or at the sentence end. This stops REQ-021a at `, the tool SHALL`; REQ-021f ends at its sentence end and its final leg is trimmed at `rather` in step 4.
  4. **Legs.** Split the list span defined by step 3 (not the whole `WHEN` sentence) on commas and on the final `or` (`/\s*,\s*|\s+or\s+/`). Trim each leg at the stop words `rather`, `than`, `that`, `which`, `whose`, `when`.
  5. **Shape test.** Require ≥3 legs, every leg but the last a single word or hyphenated compound, and the last leg 1–3 words.
  6. **Accumulation.** `orBranches` **sums** the parenthesized and unparenthesized counts. No current REQ has both; the rule is stated so a future body cannot depend on an unspecified choice.
  - The parenthesized scan keeps its `/\s+or\s+/` split and its backticked-union exclusion, unchanged. The module header, `ClauseRequirements.orBranches` comment, and `OR_ENUM_RE` comment are updated in the same step.
  - **Expected scope:** exactly REQ-021a (4 legs) and REQ-021f (3 legs) as *new* detections over the baseline (REQ-013, REQ-020). Both are legitimate class enumerations; no value union or conjunction is captured.
  - **Bounded acceptance rule.** After the edit, run the real detector over all REQ bodies and compare the full post-change map against the expected map: baseline `{REQ-013: 4, REQ-020: 2}` plus `{REQ-021a: 4, REQ-021f: 3}`. Any deviation — an extra row, a missing row, a different pair, or a changed count on a baseline row — is a mismatch. More rows: narrow the rule (over-capture is never absorbed with tags). Fewer rows: widen the rule (for example, allow a two-word non-final leg) until both appear. Record each adjustment in `tasks.md`; after two adjustments without the exact map, stop with `LOOP OPEN` and report. There is no unbounded tuning loop.
  - **Tags are repeated pairs, not a token list.** `clauseTagsFromPayload` (`src/clause-coverage.ts:39-52`) registers the token after each `REQ-NNN` token, so the citation repeats the ID. Final line in `src/lib/url-guard.test.ts` (append to the existing `resolved-address` tag): `// @implements REQ-021a resolved-address REQ-021a loopback REQ-021a private REQ-021a link-local REQ-021a metadata-address REQ-021a configuration-opt-out REQ-021a per-redirect-reguard`. `src/lib/bot-challenge.test.ts` gets `// @implements REQ-021f verification REQ-021f captcha REQ-021f challenge-page`. The distinct-refusal-code clause is asserted by the Arena refusal test, not by a `src/` test, so it is not tagged here. Slug convention: lowercase, hyphenated rendering of the branch phrase.
  - **Alternative rejected:** define "any unparenthesized comma-`or` list" — measured at 49/142 REQ bodies, almost all benign; a gate whose findings are mostly false is not viable.
  - **Alternative rejected:** parenthesize REQ-021a's prose so the existing detector sees it — it rewrites a REQ body to fit the tool and leaves the detector blind to the shape.
  - **Alternative rejected:** report-only detection — it would not close F-R4-A-1's list-visibility limb.
  - **Boundary:** the gate still requires only "≥2 tags when branches exist" (`evaluateClauseCoverage:66-71`) and does not inspect names. The per-branch rule is R9's item (F-R9-A-1); the done bar states the limit.
- **D4 — The attribute examples follow the newly routed vocabulary.** The `search_web` description (`src/index.ts:1835`, "A measurable attribute (attendance, population, percentage, date)") and the matching README sentence gain `area` and `elevation`. The enumeration is illustrative, not a contract — it already omits the `percent` signal (distinct from the existing `percentage` keyword), `share of`, `birth`, `death`, `how many`, `statistic`, and `what date` — but the two attributes this increment makes routable should be discoverable. **Alternative rejected:** leave both texts — the new capability would be invisible in the tool list.
- **D5 — Slices and commit series.** Four commits, each `typecheck`-clean and green on its own tests: (1) `fix(fetch): gate the CAPTCHA title marker on page text` — `src/lib/bot-challenge.ts` and `src/lib/bot-challenge.test.ts` (D1); (2) `fix(search): classify area and elevation as structured facts` — `src/task-type.ts`, `src/task-type.test.ts`, `src/structured-fact.test.ts`, the `src/index.ts` description string, and `README.md` (D2, D4); (3) `fix(spec-gate): detect unparenthesized class lists and tag the branches` — `src/clause-coverage.ts`, `src/clause-coverage.test.ts`, `src/lib/url-guard.test.ts`, `src/lib/bot-challenge.test.ts` tags, and the `CHANGELOG.md` bullet (the gate behavior change and its entry land together); (4) `docs(roadmap): resolve the R4 classification findings and retire the section` — `ROADMAP.md`, `worklist.md` (tracked, owned by the full-review sweep increment; the cross-increment write is intentional and noted in the AAR), and the increment record. The Phase 1 red run is uncommitted evidence recorded in `tasks.md`.
- **D6 — No push.** Publication stays user-authorized. The 2.2 d, 95-commit backlog is recorded in the AAR and is not published by this increment.

## Slice map

| Slice | Findings | Files |
|---|---|---|
| A — Anti-bot marker | F-R4-B-2 | `src/lib/bot-challenge.ts`, `src/lib/bot-challenge.test.ts` |
| B — Task classification | F-R4-E-1, F-R4-E-4 (evidence) | `src/task-type.ts`, `src/task-type.test.ts`, `src/structured-fact.test.ts`, `src/index.ts` (description), `README.md` |
| C — Clause detector and tags | F-R4-A-1 | `src/clause-coverage.ts`, `src/clause-coverage.test.ts`, `src/lib/url-guard.test.ts`, `src/lib/bot-challenge.test.ts` |
| D — Evidence (no separate slice) | all findings above | the tests land inside A, B, and C |

## Blast radius

**Production (3 TS modules plus one description string).** `src/lib/bot-challenge.ts` (marker split and weak-marker gate), `src/task-type.ts` (eight measurable-attribute signals), `src/clause-coverage.ts` (narrow unparenthesized class-list detection), `src/index.ts` (the `search_web` description enumeration only — no handler logic).

**Tests.** Edited: `src/lib/bot-challenge.test.ts` (title-with-prose negative, short-wall positive, long-boilerplate residual, branch tags), `src/task-type.test.ts` (eight signal routes, negative polysemy case, accepted-misroute assertions, `REQ-021i measurable-attribute` tag on the `it("routes measurable-attribute queries to structured_fact")` block), `src/structured-fact.test.ts` (classify→enrich end-to-end), `src/clause-coverage.test.ts` (narrow-shape detection, over-capture negatives, unchanged parenthesized behavior), `src/lib/url-guard.test.ts` (appended branch tags; assertions already cover opt-out and per-redirect re-guard). Run-only: `src/tool-surface.test.ts`, `src/fetch-fallback.test.ts`, `src/structured-output.test.ts`, `src/search-*.test.ts`, and the `debate-club/` Arena lane (its fixtures pin the fetch and search surfaces).

**Documentation and bookkeeping.** `CHANGELOG.md` (one bullet under the top `## 2026.11.11 — R4 fetch-page extraction: date evidence and response metadata` heading; `version-sync` asserts the top entry's version equals `package.json`, so no new version heading and no `package.json` change), `README.md` (attribute enumeration), `ROADMAP.md` (retire the section), `docs/plans/2026-11-09-full-review-sweep/worklist.md` (four dispositions), `docs/plans/2026-11-11-r4-fetch-classification-remediation/{plan,tasks,aar}.md`. Thirteen tracked paths plus the increment record.

**Explicitly out of scope.** The R4 contract section (F-R4-F-1, F-R4-F-3, F-R4-F-4), which is a separate roadmap item with its own trigger; every R5, R7, R8, R9 row, including F-R9-A-1 (per-branch tag count) and F-R9-C-1 (taxonomy); the R4 rows with no owning section — F-R4-A-2, F-R4-A-3, F-R4-B-1, F-R4-B-3, F-R4-C-3, F-R4-C-4, F-R4-C-5, F-R4-C-6, F-R4-C-8, F-R4-C-10, F-R4-C-11, F-R4-D-4, F-R4-E-2, F-R4-E-3, F-R4-F-2 — all **P2**, which stay `Scheduled-roadmap`; and the R6 `check-loop-artifacts` warning (condition C-8, distinct from finding F-R4-C-8).

**Recorded, not fixed — roadmap coverage gap.** Fifteen **P2** `Scheduled-roadmap` R4 rows have no owning section. This plan does not invent a section for them; the AAR records the gap and the user is asked to schedule or defer them. Because no P0/P1 is left open, the expected terminal token is `LOOP PAUSED`; if the user wants the rows scheduled first, the token is `LOOP OPEN`.

## Phases and steps

### Phase 0 — Scaffold and baseline

0. Keep the increment directory carrying `plan.md`, `tasks.md`, and an in-progress `aar.md` whose final line is `LOOP OPEN`.
1. Re-confirm the baseline if execution starts on a different HEAD: `npm run check` un-piped, recording exit status, gate count, and wall time. **Red-baseline branch:** a failure caused by this increment's artifacts is fixed by step 0; a pre-existing failure is fixed as its own commit and Phase 0 restarts; a failure on the three classification surfaces stops the increment with `LOOP OPEN`.
2. Seam audit in `tasks.md`: enumerate callers of `isBotChallenge` (`src/index.ts:941`), the consumers of `TASK_TYPE_SIGNALS`/`TASK_TYPE_KEYWORDS` (classifier, semantic prototypes, config dispatch), and the consumers of `detectClauseRequirements` (`scripts/validate-spec.ts:355`). Confirm no other test or Arena fixture pins the current CAPTCHA verdict.
3. Record the detector baseline with the real function: a throwaway `npx tsx -e` invocation (no committed file, so not a script under AGENTS § Script Discipline) reads `infobroker.md`, extracts REQ bodies with the same heading regex `scripts/validate-spec.ts:157-168` uses, calls `detectClauseRequirements`, and prints every REQ with `orBranches > 0`. Re-confirm the § Baseline figure with this same invocation: REQ-013 (4), REQ-020 (2). Record the output in `tasks.md`; it is the diff base for step 10a.
4. Authoring pre-check: grep for sibling REQs binding the same surfaces (REQ-020a task classification, REQ-021a safety, REQ-021f anti-bot, REQ-021i facts, REQ-055 clause coverage) and confirm none conflicts.
5. Existing-check discovery: confirm no other script already detects unparenthesized branch lists (`grep -rn "or-list\|OR_ENUM\|detectClause" scripts src`); record the result.

### Phase 1 — Failing evidence first

6. Add one test per finding and run them **before** any production edit; record the failure text in `tasks.md`.
   - `src/lib/bot-challenge.test.ts`: (a) a page titled "How CAPTCHA works" with several paragraphs of prose is **not** a challenge (red: current marker returns true); (b) a short page whose title contains "captcha" and whose body is a wall is a challenge (stays green after the fix); (c) a documented residual: a >400-character boilerplate wall whose only marker is the captcha title is not detected (asserts the accepted trade-off, D1); (d) every remaining strong-marker case keeps its verdict.
   - `src/task-type.test.ts`: one route case per added form — "area of Testville", "surface area of Testville", "total area of Testville", "land area of Testville", "elevation of Denver", "Denver elevation", "elevation gain", and "elevation above sea level" → `structured_fact` (all eight are red today); negative "Bay Area news" → not `structured_fact` (green today and after); accepted-misroute assertions for "area of law", "area of study", "area of expertise", and "angle of elevation" (documented, D2); and one hermetic assertion that all eight keywords are present in the exported `TASK_TYPE_KEYWORDS.structured_fact` table (so a dropped signal fails even when another signal still routes the query).
   - `src/structured-fact.test.ts`: one case calls `classifyTaskType(query)` and asserts it returns `structured_fact` before `enrichStructuredFacts` resolves the mocked Wikidata area claim (F-R4-E-4).
   - `src/clause-coverage.test.ts`: (a) the REQ-021a sentence yields 4 legs (red today: 0); (b) the REQ-021f sentence yields 3; (c) "High, Medium, or Low", "asserted, reported, or speculative", a "such as" enumeration, a comma-`and` list, and a sentence whose only parenthesized group carries no `or` (e.g. `(see REQ-034)`) yield 0; (d) the existing REQ-013 parenthesized case still yields 4; (e) a synthetic body with both a parenthesized group and a prose list yields the summed count (D3 step 6).
7. Record every red result; a test that passes unmodified is either mis-aimed or the behavior already holds, and either is recorded before any source edit.

### Phase 2 — Fixes, in dependency order

8. **Slice A.** `src/lib/bot-challenge.ts`: remove `/captcha/i` from `STRONG_TITLE_MARKERS`, add `WEAK_TITLE_MARKERS`, and evaluate it under the existing `visibleTextLength < MIN_TEXT_FOR_SCRIPT_SIGNAL` gate; update the header comment to describe the strong-title, distinctive-body, and weak-title/script tiers by their existing constant names.
9. **Slice B.** `src/task-type.ts`: add the eight signals with weight 4. Update the `search_web` description enumeration in `src/index.ts` and the README sentence. Tag the `it("routes measurable-attribute queries to structured_fact")` block and add the classify→enrich case (D2, D4).
10. **Slice C.** `src/clause-coverage.ts`: add the narrow scan per D3's algorithm and update the module header and interface comments.
    10a. **Real-detector gate.** Run the step-3 invocation again and diff against the baseline. New rows must be exactly REQ-021a (4 legs) and REQ-021f (3 legs). Apply D3's bounded repair rule (more = narrow, fewer = widen, at most two adjustments recorded in `tasks.md`; otherwise stop with `LOOP OPEN`). Only then append the repeated-pair tags to `src/lib/url-guard.test.ts` and `src/lib/bot-challenge.test.ts`.
11. Fill in any remaining behavior the Phase 1 tests expose. A failing expectation is a real defect and is fixed, not weakened.

### Phase 3 — Verification and documentation

12. Run the targeted suites: `bot-challenge`, `task-type`, `structured-fact`, `clause-coverage`, `url-guard`, `tool-surface`, `fetch-fallback`, `structured-output`. Record counts.
13. Run `npm run typecheck`, then `npm run check:fast`, then `npm run check` (full, including the Arena lane). A gate failure is repaired inside this increment; an out-of-scope failure becomes an AAR cross-chunk note.
14. Run `npm run validate-spec` explicitly **after** the detector change and before the commit, and `npm run validate-readme` after the description edit. Record both results.
15. `CHANGELOG.md`: one bullet under the top `## 2026.11.11 — R4 fetch-page extraction: date evidence and response metadata` heading naming the CAPTCHA marker gate, the area/elevation classification, and the clause-detector extension (a gate behavior change), with REQ IDs and the tests that pin them. This lands with commit 3.
16. `ROADMAP.md`: remove the R4 classification section. Run `npm run check-roadmap`.
17. `worklist.md`: mark F-R4-B-2, F-R4-E-1, F-R4-E-4, and F-R4-A-1 `Resolved` with a one-line summary. The F-R4-A-1 summary quotes the finding's two limbs and states that the per-branch count rule remains F-R9-A-1.
18. Finish `aar.md` with dispositions, verification counts, the 95-commit/2.2 d backlog note (D6), the P2 roadmap coverage gap, cross-chunk notes, and a terminal `LOOP PAUSED` or `LOOP OPEN`.
18a. Run `npm run check` (full) once more on the final tree, after the CHANGELOG, ROADMAP, worklist, and AAR edits, and record the result in the AAR.
19. `npm run session:close`, then the commit series (D5), running `npm run typecheck` after each commit and stopping on red. Stop and report rather than commit a failing tree.

## Conditions

- **C-1** — no response shape changes. The CAPTCHA change removes a false positive and accepts the D1 long-boilerplate residual; the classification signals add routes and can re-route a query that matches them, with the `area of <abstract noun>` and `angle of elevation` misroutes explicitly accepted and asserted; the detector change only adds a gate requirement satisfied by the new tags.
- **C-2** — the detector change is proven by the real-function run after step 10a, compared against the expected map (baseline REQ-013/REQ-020 plus REQ-021a/REQ-021f); D3's bounded repair rule (at most two adjustments, then `LOOP OPEN`) is the only permitted response to a mismatch.
- **C-3** — every new test is hermetic: no network, no operator KB, quota file, or config layer. The existing harness and mocks are reused; no new fixture server is introduced.
- **C-4** — no REQ body change is planned; a REQ body edit is a non-closure event (the slice stops and is re-planned). If a body edit were ever authorized, Appendix B limits (≤800 chars, ≤8 sentences, ≤8 SHALL clauses, ≤5 backtick tokens) and a clause tag would be required in the same commit.
- **C-5** — no new dependency and no new production module beyond `bot-challenge.ts`, `task-type.ts`, and `clause-coverage.ts`; `src/index.ts` receives only the existing search-tool description string edit.
- **C-6** — the `REQ-021i measurable-attribute` tag is added to `it("routes measurable-attribute queries to structured_fact")`, not to a response-shaping block.
- **C-7** — the weak-marker threshold reuses `MIN_TEXT_FOR_SCRIPT_SIGNAL`; a comment records the second consumer and no new configuration key is introduced.
- **C-8** — the `check-loop-artifacts` warning for `2026-11-10-r6-encryption-capacity-remediation` is recorded, not fixed. (Distinct from finding F-R4-C-8, which is out of scope.)
- **C-9** — the roadmap coverage gap (fifteen **P2** `Scheduled-roadmap` R4 rows with no owning section) is recorded in the AAR and reported to the user; this increment does not create a roadmap section on the user's behalf.
- **C-10** — a cold pass is required at standard depth. If the harness cannot create fresh contexts, the increment does not proceed to approval; it may be re-stamped at `light` only if the user explicitly lowers the depth, with the reason recorded.
- **C-11** — the detector's parenthesized behavior is unchanged: REQ-013 still yields 4 and REQ-020 still yields 2. The new scan is additive and sums into `orBranches`.
- **C-12** — `evaluateClauseCoverage` is unchanged; it verifies tag presence, not names or one-per-branch counts. R9 owns the per-branch rule (F-R9-A-1). The increment tags every surfaced branch by convention and does not claim the gate proves it.
- **C-13** — the README edit is limited to the attribute enumeration; `validate-readme` must pass with no other section reflow.
- **C-14** — the classification change perturbs the semantic prototype vocabulary; no test pins real-LSA fallback scores, so the AAR records this as an unverified residual and the full suite is the check.

## Rollback

Every edit is a source-level behavior change plus tests and one description string. Reverting the four commits restores the prior tree; the KB store, credential pool, and quota file are untouched, so a downgrade reads prior state safely. No provider contract, schema migration, or dependency is involved.

## Verification summary

| Claim | How it is proven |
|---|---|
| A prose page with "captcha" in its title is not a challenge | `bot-challenge.test.ts` negative case (red before, green after) |
| A short CAPTCHA wall is still a challenge | `bot-challenge.test.ts` positive case |
| The long-boilerplate residual is deliberate | `bot-challenge.test.ts` residual case and the AAR note (D1) |
| Remaining strong-marker verdicts are unchanged | existing `bot-challenge.test.ts` cases |
| All eight area/elevation forms classify | `task-type.test.ts` route cases |
| "Bay Area news" does not misroute | `task-type.test.ts` negative case |
| Accepted `area of` / `angle of elevation` misroutes are bounded | `task-type.test.ts` assertions plus the no-inference behavior of the resolver |
| Classification reaches enrichment end to end | `structured-fact.test.ts` classify→enrich case |
| The detector sees REQ-021a's four classes and REQ-021f's three | `clause-coverage.test.ts` cases and the step-10a corpus diff |
| The detector does not over-capture value unions or conjunctions | `clause-coverage.test.ts` negative cases plus the bounded step-10a diff |
| The surfaced REQs carry a named tag per branch | appended repeated-pair tags; `validate-spec` (presence only, C-12) |
| Documentation matches the routed vocabulary | `npm run validate-readme` and a grep for the enumeration |
| Roadmap and bookkeeping are consistent | `npm run check-roadmap`, `check-loop-artifacts`, four worklist dispositions |
| Nothing else regressed | `npm run check` (22 gates, including the Arena lane) |
