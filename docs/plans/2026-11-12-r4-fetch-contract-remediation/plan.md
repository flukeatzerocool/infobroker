# Plan — R4 `fetch_page` contract remediation

**Status:** draft, awaiting plan review and user approval · **Date:** 2026-11-12 · **Depth:** standard (five prose surfaces plus one schema-description surface and one test file; reversible edits, no destructive or publish surface)
**Review independence:** fresh — one cold pass (5 stages) plus one targeted diff re-review; both ended `independent-review passed.` The re-review's remaining Major was a done-bar/step wording mismatch, and its three prescribed clarifications are applied here after the passing pass (C-13), to be diff-confirmed by `build-review`.
**Rollback cost:** 1 — documentation and schema-description string edits in `src/index.ts`, `infobroker.md`, `README.md`, plus one test. No runtime behavior change, no state format, no schema shape, no dependency.
**Roadmap item:** `ROADMAP.md` § R4 fetch-page contract remediation (retired to `CHANGELOG.md` when this increment closes)
**Predecessor:** `d43192d` (R4 classification close; its AAR records that the R4 contract section is the next scheduled work)
**Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md` § Finding register (`worklist.md:734,736,737`)

## Why this section

`ROADMAP.md` § R4 fetch-page contract remediation is the first section in the
file, and the ordering rule is top section first. Its trigger — "start after
chunk R5 closes" — is met: the R5 chunk carries a closed AAR, and the later R4
extraction and classification increments both stated that chunks R5 through R9
and M1 are closed. The section names three rows, all on one surface: what
`fetch_page` says about its renderer and its parameters, versus what the tool
actually does.

The three rows share one prose contract — the renderer chain's default, the
fallback conditions, and the `raw` parameter's absence from the spec's
parameter enumeration. They are fixed together because a single consistent
statement has to hold across the tool schema, the tool description, REQ-021,
§6.4, the README, `AGENTS.md`, and the spec's migration table; fixing one
surface alone leaves the contradiction in place.

## Baseline (verified this session)

- `git log -1` → `d43192d`; `git status --porcelain` clean except this
  increment directory.
- `npm run status` → version 2026.11.11 (tag `v2026.11.07`), **99 unpushed
  commits, oldest 2.3 d**, 17 open roadmap items.
- `npm run check` → **PASS** (full, 22 gates, 154.5 s), recorded for
  `d43192dbf4ed`.
- One pre-existing warning: `check-loop-artifacts` reports
  `2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:**`.
  Warning only; out of scope (C-8).

## Predicates re-verified by reading the code and spec this session

| Finding | Current text | What is wrong |
|---|---|---|
| F-R4-F-1 (P1) | `renderer: z.enum([...]).optional()` with no `.default(...)` (`src/index.ts:1900`); its description says `jina (default)`; the tool description says `Jina Reader by default` (`:1897`); REQ-021 says `` `renderer` (`jina` default, ...) `` (`infobroker.md:268`) | Six surfaces advertise a default the schema does not declare: the `renderer` schema description and the tool description (`src/index.ts:1900,1897`), REQ-021 (`infobroker.md:268`), `AGENTS.md:16` ("Jina Reader (default)"), the spec's migration row (`infobroker.md:1431`, "Jina Reader as default renderer"), and `README.md:254` ("hands any URL to Jina Reader"). The handler is `renderer ? [renderer] : getDispatchChain("content_fetch")` (`src/index.ts:1131`) and the shipped chain is `["jina", "native_fetch"]` (`config.json:259`), so omitting the parameter runs the chain — it is not a `jina` default. |
| F-R4-F-4 (P1) | §6.4 says Jina "Falls back to native HTTP GET + HTML-to-text extraction when Jina returns 429 or an error." (`infobroker.md:841-845`) | It contradicts REQ-021's hedge (race a fallback renderer when the primary is slow, within a grace window) and REQ-021f's anti-bot fall-through (a challenge page is a failed render, not content). `README.md:780-796` already documents the hedge and the challenge fall-through, so the spec section is the outlier. |
| F-R4-F-3 (P2) | REQ-021 enumerates `url`, `renderer`, `max_length`, `question`, `passage_size`, `max_passages`, `detect_date`, `crawl`, `extract` (`infobroker.md:268`) | `raw` is declared in the schema (`src/index.ts:1908`) and mandated by REQ-021j (`infobroker.md:297-298`) but is missing from the tool-signature enumeration. |

Seams read this session: the `fetch_page` registration block
(`src/index.ts:1894-1930`), `doFetchPage`'s renderer selection
(`src/index.ts:1131`), the shipped dispatch chain (`config.json:259`), the
existing `search_web` schema-contract test whose shape the new test follows
(`src/tool-surface.test.ts:187-236`), the §6.4 section (`infobroker.md:841-845`),
REQ-021/REQ-021j, and the README's fetch and hedge paragraphs
(`README.md:256-258, 780-793`).

**Measured REQ-021 body (Appendix B).** 782 characters, 5 sentences, 4 SHALL
clauses, 15 backtick tokens. The tool-signature exception permits the backtick
count (the body carries `Parameters:`). The exact edit anchors are
`` and `extract`. `` → `` `extract`, and `raw`. `` (+7 characters) and
`` `jina` default `` → `` `jina` primary `` (0 characters), which yields
`` ..., `crawl`, `extract`, and `raw`. `` and **789 characters, 5 sentences,
4 SHALL, 16 backtick tokens** — inside the 800-character limit with 11
characters of headroom (7 even if the anchor is read the other way; C-2 fixes
the intended anchor). The post-edit body is measured again before commit.

## Done bar

**Done bar:** F-R4-F-1, F-R4-F-3, and F-R4-F-4 are fixed and marked `Resolved`
in `worklist.md` with a one-line summary; the renderer contract is stated
consistently across its surfaces — the `renderer` schema description, the tool
description, and REQ-021 say that omitting `renderer` runs the configured
`content_fetch` chain whose shipped primary is `jina` and that a named value
pins one renderer, while the README, `AGENTS.md`'s tool table, and the spec's
migration table name the chain's primary and fallback without advertising a
schema default, so no surface claims a default the schema does not declare;
the README's *Content Extraction* paragraph names the chain's
primary and the fallback conditions and leaves the challenge fall-through to
the existing *Hedged fallback* paragraph rather than restating it, staying
inside the section's 350-word budget (208 words before, about 218 after);
§6.4 names the hedge (a slow primary races the next renderer after the grace
window), the throttle/error fall-through, and the anti-bot challenge
fall-through, citing REQ-021 and REQ-021f; REQ-021's
parameter enumeration carries `raw` and its body stays within the Appendix B
limits at the measured 789 characters; one new test in
`src/tool-surface.test.ts` reads the live tool schema and asserts `renderer`
declares no default, its description names the omission-to-chain behaviour and
makes no default claim, and `raw` is advertised with `default: false` — the
test fails on the unmodified source (red recorded in `tasks.md`) and passes on
the final tree; `npm run check` passes (22 gates), together with
`npm run validate-spec`, `npm run validate-readme`, `npm run check-roadmap`,
and `npm run check-loop-artifacts` (0 errors; the one pre-existing warning
remains); the R4 contract section is gone from `ROADMAP.md`;
`CHANGELOG.md` carries one bullet under the existing `## 2026.11.11` heading;
the increment record carries plan, tasks, and an AAR ending `LOOP PAUSED` or
`LOOP OPEN`.

**Non-closure rule:** a fix that changes runtime dispatch behaviour, adds a
schema default to `renderer`, edits production logic beyond the two
description strings in `src/index.ts`, touches another tool's parameter
contract, or needs a new dependency stops that slice. Shipped slices are
recorded in `CHANGELOG.md`, unshipped rows stay scheduled on the successor
`ROADMAP.md` section, and the AAR ends `LOOP OPEN`.

## Decisions

- **D1 — F-R4-F-1 is resolved by removing the false default claim, not by
  declaring a default.** `renderer` stays `.optional()` with no schema default.
  The schema description, tool description, REQ-021 and README instead state
  the real contract: omitting the parameter runs the configured
  `content_fetch` chain (shipped primary `jina`, `native_fetch` next), and a
  named value pins a single renderer. **Alternative rejected:** adding
  `.default("jina")`. The handler is `renderer ? [renderer] : chain`
  (`src/index.ts:1131`), so a schema-supplied default would make `renderer`
  always defined, collapse the dispatch to the single `jina` renderer, and
  silently disable REQ-021's hedge and the `native_fetch` fallback — a
  behaviour regression disguised as a schema fix. **Alternative rejected:**
  adding the default and special-casing `"jina"` in the handler. The handler
  cannot distinguish a caller who pinned `jina` from a value injected by the
  default, so the documented ability to pin one renderer would disappear.
  **Consequence:** the defect is real on the prose side; the code path is the
  authority, and the prose is what gets corrected. This reverses the roadmap's
  first suggested remedy ("declare the schema default") and records why the
  opposite direction is the correct one.
- **D2 — F-R4-F-3 adds `raw` to REQ-021's enumeration only.** No default note
  is added for `raw`: the schema already declares `default: false`, and the
  character budget is the binding constraint (C-2). The behaviour remains owned
  by REQ-021j; REQ-021's list becomes exhaustive for the advertised surface.
  **Alternative rejected:** adding `` `raw` (default false) `` — it adds 16
  characters and would push the body to 805, over the Appendix B limit, buying
  no contract that REQ-021j and the schema do not already carry.
- **D3 — §6.4 describes the chain, not a single conditional.** The section
  states: Jina returns Markdown and is the primary renderer in the shipped
  `content_fetch` chain; when it is slow the chain hedges to the next renderer
  after the grace window; when it returns 429 or another error, or serves an
  anti-bot challenge, the tool falls through to the next renderer instead of
  returning the challenge; the shipped fallback is a native HTTP GET with
  HTML-to-text extraction, citing REQ-021 and REQ-021f. The README's *Content
  Extraction* paragraph gets two surgical changes: "hands any URL to Jina
  Reader" → "hands any URL to the renderer chain, which starts with Jina
  Reader", and "falls back to native HTTP when Jina is throttled" → "falls back
  to native HTTP when the primary renderer is slow, throttled, or errors". It
  does **not** restate the anti-bot fall-through, because the *Hedged fallback*
  paragraph (`README.md:780-796`) already owns that sentence and
  `validate-readme` has a near-duplicate check. **Alternative rejected:**
  leaving the README's fallback sentence alone — it says only "when Jina is
  throttled", which understates the implemented fall-through; **alternative
  rejected:** copying the §6.4 fall-through sentence into the README — it
  duplicates the hedge section and risks the near-duplicate gate.
- **D3a — The auxiliary prose surfaces are aligned too, without expanding the
  contract.** `AGENTS.md:16` ("Jina Reader (default)") and the spec's migration
  table (`infobroker.md:1431`, "Jina Reader as default renderer") are reworded
  to name the chain's primary instead of a default, because both repeat the
  claim this increment is removing. The bundled skill references
  (`skills/infobroker/SKILL.md:76,203`, `skills/technical-writing/SKILL.md:39`)
  are **not** edited: they name Jina as the common path ("Jina Reader for
  Markdown") without asserting a parameter default, and
  `skills/infobroker/references/journeys.md:33` already says "renderer chain
  (Jina → native)", which is the target statement. Phase 0 step 2 enumerates
  every match and the slice list is the authority for which ones are edited
  (C-12).
- **D4 — Evidence is a live-schema test, not a spec-text test.** A new test in
  `src/tool-surface.test.ts` reuses the existing spawned-server `listTools()`
  helper and asserts: `renderer` has no declared `default`; its description
  contains the omission-to-chain wording and does not claim a default; `raw`
  is present with `default: false`; the `renderer` enum still carries the six
  values. The description assertions are red on the unmodified source. A test
  that reads `infobroker.md` prose is rejected — it would pin editorial wording
  without proving the advertised surface, and §6.4 has no behavioural
  counterpart to assert. §6.4 and the README are verified by read-back against
  REQ-021/REQ-021f and marked as inspection-verified in the AAR (C-6).
- **D5 — Slices and commit series.** Three commits, each `typecheck`-clean and
  green on its own tests, so no commit carries a failing suite: (1)
  `fix(fetch): state the renderer chain instead of a schema default` —
  `src/index.ts` (two description strings) and `src/tool-surface.test.ts`
  (D1, D4); (2) `docs(spec): align the renderer chain across the spec and
  README` — `infobroker.md` (REQ-021 body, §6.4, migration row), `README.md`,
  and `AGENTS.md` (D2, D3, D3a); (3)
  `docs(roadmap): resolve the R4 contract findings and retire the section` —
  `CHANGELOG.md`, `ROADMAP.md`, `worklist.md`, and the increment record. The
  Phase 1 red run is uncommitted evidence recorded in `tasks.md`.
- **D6 — No push.** Publication stays user-authorized. The 2.3 d, 99-commit
  backlog is recorded in the AAR; it is not published by this increment.

## Slice map

| Slice | Findings | Files |
|---|---|---|
| A — Renderer contract | F-R4-F-1 | `src/index.ts` (tool description, `renderer` schema description), `src/tool-surface.test.ts` |
| B — Spec, README, agent docs | F-R4-F-3, F-R4-F-4 | `infobroker.md` (REQ-021 body, §6.4, migration-table row), `README.md`, `AGENTS.md` |
| C — Evidence and closeout | all three | `CHANGELOG.md`, `ROADMAP.md`, `worklist.md`, increment record |

## Blast radius

**Production (1 TS module, string literals only).** `src/index.ts`: the
`infobroker_fetch_page` tool description (line 1897) and the `renderer` schema
description (line 1900). No logic, default, type, or config edit. `doFetchPage`
and the dispatch chain are untouched (C-1).

**Tests.** New one test block in `src/tool-surface.test.ts` (live-schema
assertions). Run-only: `src/fetch-page-extraction.test.ts`,
`src/fetch-fallback.test.ts`, `src/fetch-cache.test.ts`,
`src/structured-output.test.ts`.

**Documentation and bookkeeping.** `infobroker.md` (REQ-021 body, §6.4, the
migration-table row at `:1431`), `README.md` (two sentences in the *Content
Extraction* paragraph, 208 words before and about 218 after against the
350-word section budget), `AGENTS.md` (the fetch-page row of the tool table),
`CHANGELOG.md` (one bullet under the existing
`## 2026.11.11` heading; `version-sync` requires the top entry's version to
equal `package.json`, so no new heading and no `package.json` change),
`ROADMAP.md` (retire the section), `worklist.md` (three dispositions),
`docs/plans/2026-11-12-r4-fetch-contract-remediation/{plan,tasks,aar}.md`.

**Explicitly out of scope.** F-R4-F-2 (a full G0 parameter-contract gate for
`fetch_page`) stays `Scheduled-roadmap` and unowned; the new test asserts the
renderer/raw surface only (C-6). The three R5 sections, the R7/R8/R9 sections,
and `Review-loop convergence` are untouched. The R6 `check-loop-artifacts`
warning is recorded, not fixed (C-8). The fifteen unowned R4 P2 rows remain a
recorded roadmap coverage gap (C-9).

## Phases and steps

### Phase 0 — Scaffold and baseline

0. Keep the increment directory carrying `plan.md`, `tasks.md`, and an
   in-progress `aar.md` whose final line is `LOOP OPEN`.
1. Re-confirm the baseline if execution starts on a different HEAD:
   `npm run check` un-piped, recording exit status, gate count, and wall time.
   **Red-baseline branch:** a failure caused by this increment's artifacts is
   fixed by step 0; a pre-existing failure is fixed as its own commit and
   Phase 0 restarts; a failure on the `fetch_page` surface stops the increment
   with `LOOP OPEN`.
2. Seam audit in `tasks.md`: read `doFetchPage`'s renderer selection and the
   shipped dispatch chain, and grep every surface that states the renderer
   default (`src/index.ts`, `infobroker.md`, `AGENTS.md`, `README.md`,
   `skills/**/*.md`). Record each match and its disposition: edit it (the slice
   list below is the authority) or leave it with a reason. A match the plan did
   not anticipate is added to the slice map before Phase 2 (C-12).
3. Authoring pre-check: read REQ-021j and REQ-021f, confirm the planned
   REQ-021 body neither duplicates nor contradicts them, and measure the
   post-edit body against Appendix B (C-2). Record the result in `tasks.md`.

### Phase 1 — Failing evidence first

4. Add the new test block to `src/tool-surface.test.ts` and run it **before**
   any edit; record the failing assertion text in `tasks.md`. The description
   assertions must fail on the unmodified source; if the `default`-absence
   assertion is the only green one, that is expected and stated.

### Phase 2 — Edits, in dependency order

5. **Slice A.** `src/index.ts`: rewrite the tool description's first sentence
   and its `renderer` clause, and rewrite the `renderer` schema description
   (D1). Do not add `.default(...)`, do not touch `.optional()`, and do not
   edit `doFetchPage`.
6. **Slice B.** `infobroker.md`: rewrite REQ-021's renderer parenthetical and
   append `raw` to the parameter list with the anchor fixed in the Appendix B
   paragraph (D2), rewrite §6.4 (D3), and reword the migration-table row at
   `:1431` (D3a). Measure the REQ-021 body immediately after the edit and
   record the counts. `README.md`: apply the two sentence changes in the
   *Content Extraction* paragraph and record the section's post-edit word count
   (D3). `AGENTS.md`: reword the fetch-page row of the tool table (D3a).
7. Fill in any remaining behaviour the Phase 1 test exposes. A failing
   expectation is a real defect in the prose and is fixed, not weakened.

### Phase 3 — Verification and documentation

8. Run the targeted suites: `tool-surface`, `fetch-page-extraction`,
   `fetch-fallback`, `fetch-cache`, `structured-output`. Record counts.
9. Run `npm run typecheck`, then `npm run check:fast`, then `npm run check`
   (full), plus `npm run validate-spec`, `npm run validate-readme`,
   `npm run check-roadmap`, and `npm run check-loop-artifacts`.
10. `CHANGELOG.md`: one bullet under the existing `## 2026.11.11` heading
    naming the renderer-contract alignment, the `raw` enumeration fix, and the
    §6.4 fall-through prose, with the REQ IDs and the new test (C-4).
11. `ROADMAP.md`: remove the R4 fetch-page contract section. Run
    `npm run check-roadmap`.
12. `worklist.md`: mark F-R4-F-1, F-R4-F-3, and F-R4-F-4 `Resolved` with a
    one-line summary each, following the F-R4-D-1 row's form. Leave F-R4-F-2
    `Scheduled-roadmap` and record the unowned-row gap (C-9).
13. Finish `aar.md` with dispositions, verification counts, the 99-commit /
    2.3 d backlog note (D6), the roadmap coverage gap, the inspection-verified
    documentation edits (C-6), and a terminal `LOOP PAUSED` or `LOOP OPEN`.
14. `npm run session:close`, then the commit series (D5). Stop and report
    rather than commit a failing tree.

## Conditions

- **C-1** — no runtime behaviour change: `doFetchPage`'s `renderer ? [renderer]
  : getDispatchChain("content_fetch")` line, the shipped dispatch chain, and
  the `renderer`/`raw` zod shape (`.optional()`, no `.default`) are unchanged.
  The diff in `src/index.ts` is limited to description strings; `git diff`
  confirms it.
- **C-2** — the post-edit REQ-021 body is measured (characters, sentences,
  SHALL clauses, backtick tokens) and reported in `tasks.md`; expected 789
  characters, 5 sentences, 4 SHALL, 16 backtick tokens. The body must stay
  ≤800 characters or the wording is tightened before commit.
- **C-3** — the REQ-021 edit adds no `or`-joined outcome branch and no
  "when … declares" conditional, so no new named clause tag is required;
  `validate-spec` and the clause-coverage gate confirm the existing tag set is
  unchanged.
- **C-4** — the CHANGELOG bullet goes under the existing `## 2026.11.11`
  heading; `version-sync` requires the top entry's version to equal
  `package.json`, so `package.json` and the version stamps are not edited.
- **C-5** — the README edit stays inside the design limits and the voice
  checks: the *Content Extraction* section is measured before and after
  (208 words before, about 218 after, against a 350-word budget), the
  challenge fall-through is not restated because the *Hedged fallback*
  paragraph owns it, and `npm run validate-readme` is the authority for the
  near-duplicate and numeric-claim checks.
- **C-6** — the new test asserts the renderer/raw surface only, not F-R4-F-2's
  full parameter contract; the §6.4 and README edits are inspection-verified
  against REQ-021/REQ-021f and marked as such in the AAR rather than claimed
  as gate-verified.
- **C-7** — independence: the cold pass and its targeted diff re-review both
  returned `independent-review passed.`; the artifacts and hashes are recorded
  in the plan header and the stamp. If a later artifact edit changes scope
  (not wording), that is a new review, not a re-stamp.
- **C-13** — the three post-pass clarifications are exactly: the done-bar
  split between the surfaces that carry both clauses and those that carry the
  chain/fallback statement, the six-surface count in the F-R4-F-1 row, and the
  depth rationale wording. `build-review` confirms nothing else changed
  between the reviewed artifact and the stamped one.
- **C-8** — the `check-loop-artifacts` warning for
  `2026-11-10-r6-encryption-capacity-remediation` is recorded, not fixed.
- **C-9** — the roadmap coverage gap (R4 rows with no owning section) is
  recorded in the AAR and reported to the user; F-R4-F-2 was already unowned
  and stays `Scheduled-roadmap`, and this increment does not create a roadmap
  section on the user's behalf.
- **C-10** — the new test runs against the spawned server through the existing
  `listTools()` helper and `isolatedConfigEnv()`; it reads no operator KB,
  quota file, or config layer, and makes no outbound request.
- **C-11** — the six `renderer` enum values and the `raw` default are asserted
  as advertised surface, so a future enum or default change trips the test
  rather than silently drifting from REQ-021.
- **C-12** — the Phase 0 surface sweep is the completeness gate for the prose
  fix: every match in `src/index.ts`, `infobroker.md`, `AGENTS.md`,
  `README.md`, and `skills/**/*.md` is either edited or recorded with a reason,
  and the slice list is updated before Phase 2 if a match was missed. Skill
  references that name Jina as the common path without asserting a parameter
  default are recorded as out of scope (D3a).

## Rollback

Every edit is a documentation or schema-description string plus one test.
Reverting the three commits restores the prior tree; no KB store, credential
pool, quota file, or config file is touched, and no provider contract,
migration, or dependency is involved.

## Verification summary

| Claim | How it is proven |
|---|---|
| `renderer` advertises no schema default | `tool-surface.test.ts` live-schema assertion (`default` is undefined) |
| The description states the omission-to-chain contract and makes no default claim | `tool-surface.test.ts` description assertions (red before the edit) |
| `raw` is advertised with `default: false` | `tool-surface.test.ts` live-schema assertion |
| REQ-021 enumerates `raw` and stays within Appendix B | measured body counts recorded in `tasks.md`; `validate-spec` |
| §6.4 no longer contradicts the hedge or the anti-bot fall-through | read-back against REQ-021 and REQ-021f, recorded in the AAR (C-6) |
| The README names the chain's primary and the fallback conditions without duplicating the hedge section | section word count recorded in `tasks.md`; `validate-readme` near-duplicate check (C-5) |
| `AGENTS.md` and the spec migration row no longer advertise a default | Phase 0 surface sweep plus read-back (C-12) |
| No behaviour changed | `git diff` limited to description strings; `fetch-page-extraction`, `fetch-fallback`, `fetch-cache`, `structured-output` suites stay green (C-1) |
| Nothing else regressed | `npm run check` (22 gates), `validate-spec`, `validate-readme`, `check-roadmap`, `check-loop-artifacts` |
