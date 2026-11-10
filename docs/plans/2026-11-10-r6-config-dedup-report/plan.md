# Plan — R6 config, dedup, and report remediation

**Status:** reviewed · **Date:** 2026-11-10 · **Depth:** standard
**Review independence:** fresh — cold pass 1 FAILED (1 Blocker, 5 Majors, 6 Minors), all resolved; diff re-review passed with one clarity nit, resolved here. Reviewed at plan sha `2e2d8579…6e14db6`; cold report `/tmp/opencode/r6-cd-cold.md` (`8ac86d5a…a6b4`); diff re-review `/tmp/opencode/r6-cd-rereview.md` (`d0afe7af…c6b7`), read budget 10/10.
**Rollback cost:** 1 — production behavior edits in one module plus spec narrowing; no schema, config-key, or dependency change
**Roadmap item:** `ROADMAP.md` § R6 config, dedup, and report remediation (retire on close)
**Predecessor:** `c7b0089` (R6 evidence resolution; `LOOP PAUSED`). Every review-sweep chunk (R1–R9, M1) is closed, so this section's trigger — "start after chunk R7 closes" — and the ordering rule (top section first) both select it.

## Baseline (verified this session)

- `git log -1` → `c7b0089`, working tree clean.
- `npm run check:fast` → PASS (19 gates, 20.2 s).
- `npm run status` → version 2026.11.7, 24 open roadmap items, 40 unpushed commits (oldest 20.9 h), last pipeline run 2026-11-07.
- This section is the first roadmap entry; the section ahead of it in the file (`R6 auto-index…`) is already retired.
- `debate-club/src/kb-contract.test.ts:131-143` already asserts the absent-KB `config_error` with remediation (`configLayer: () => ({ kb: null })`), so F-R6-B-4's absent half is covered today.

## Done bar

**Done bar:** F-R6-B-4, F-R6-B-5, and F-R6-B-6 are fixed and marked `Resolved` in the sweep worklist; the two behavior findings (B-5, B-6) are each shown to fail under a recorded source mutation and to pass on the shipped tree, and the spec finding (B-4) is evidenced by a reload test that fails when the KB re-init call is removed; REQ-066, REQ-067, REQ-072, and REQ-083 are reconciled with shipped behavior and `validate-spec` passes; the R6 config/dedup/report section is retired from `ROADMAP.md` (24 work items → 23); `CHANGELOG.md` gains an entry that names these three behavior changes; `npm run check:fast` exits 0 on the final tree and `npm run check` exits 0 when the `npm audit` probe answers (otherwise recorded under condition C-2); the increment record under `docs/plans/2026-11-10-r6-config-dedup-report/` carries plan, tasks, and an AAR ending `LOOP PAUSED` or `LOOP OPEN`.

**Conditions:**
- **C-1** — if a new assertion fails on the unmodified tree, it is not weakened; the exposed defect is fixed within the same increment and the plan is amended.
- **C-2** — if the `npm audit --json` probe cannot reach the registry, the full `npm run check` is recorded as not-run for that reason and `check:fast` is the terminal gate; the AAR says so rather than claiming a green full run.
- **C-3** — every REQ body edit stays within Appendix B's mechanical limits (≤800 characters, ≤8 sentences, ≤8 `SHALL` clauses). Drafted bodies are measured in Step 0.4; an overrun is trimmed before commit, not waived.
- **C-4** — if the clause-coverage detector (`src/clause-coverage.ts`) demands named tags for a revised body, the tags are added in the same commit.
- **C-5** — the cold pass was one context, so this plan is re-reviewed by a diff-only cold pass (budget 10 reads) before presentation; if that pass raises a new Blocker in changed text, the run stops and escalates rather than starting a third pass.

## Findings in scope

| ID | Predicate (verified by reading the code and tests this session) | Fix |
|---|---|---|
| F-R6-B-4 | REQ-067 says an absent **or invalid** KB configuration makes every KB tool error, but `loadConfig` deliberately falls back to shipped defaults when a user layer is invalid (`src/config.ts:968-995`, REQ-113) and `config.test.ts:614-625` asserts that fallback; KB config reload after `reloadConfig` is untested (`src/index.ts:2408-2415`, `:2585-2590`) | Spec narrowing + reload test |
| F-R6-B-5 | REQ-072's meaning-equivalence dedup runs only for `report://` identities (`src/kb.ts:604-621`), so a web or text document re-ingested under a different URL duplicates; the loop also takes the **first** candidate over the 0.92 threshold rather than the best match | Behavior change (`src/kb.ts`) |
| F-R6-B-6 | `runMaintenance` removes any chunk whose tier expires (`src/kb.ts:1103-1121`), including `source_type: "report"`, contradicting REQ-083's indefinite retention; `revision`/`supersedes` are caller-supplied receipt metadata with no monotonicity or predecessor check (`src/kb.ts:931-959`, `src/kb-receipt.ts:123-140`, `src/lib/report-manifest.ts:287-292`) | Behavior change (`src/kb.ts`, `src/kb-receipt.ts`) |

## Design decisions

**D1 — REQ-067 is narrowed to the *effective* configuration; the code is not changed.** REQ-113 requires an invalid user layer to start on shipped defaults without rewriting it, so REQ-067's "absent **or invalid**" cannot hold for the user layer without contradicting REQ-113. The body becomes: error only when the effective KB configuration is absent; an invalid user layer follows REQ-113. The absent path already behaves per REQ-002 (`isKbConfigured()` guard plus `config_error` with remediation at `src/index.ts:2058-2059`, asserted by `kb-contract.test.ts:131-143`). Rejected: making an invalid KB block fatal — that reverses REQ-113 and breaks update preservation.

**D2 — KB reload is proven at both seams.** A unit test writes a user layer that changes `kb.default_collection` and `kb.freshness.default_tier`, calls `reloadConfig()`, runs `initKb(newConfig.kb)`, and asserts `resolveCollection(undefined)` returns the new collection and a fresh ingest lands in the new default tier. An Arena test drives the real wiring: `reload_config` with a patch that changes `kb.default_collection`, then a `manage_kb` ingest with no `collection`, asserting the stored entry's collection. The Arena half is what proves `src/index.ts` re-inits rather than only that the resolver re-reads. Rejected: unit test alone — it does not observe the tool path the finding names.

**D3 — Meaning-equivalence extends to every content class, but never across class or collection.** The incoming document is compared only with stored documents that share its resolved `collection` and its resolved `source_type`. Substituting a cross-class identity would let a text note overwrite a report's chunks (violating REQ-083's distinct class) or move a chunk into another tier (violating REQ-066). REQ-072's body gains "of the same content class and collection". **This also changes the report path:** the existing block filters on neither, so a cross-collection report no longer collapses; that is the intended unification and is recorded in the CHANGELOG. Rejected: class-blind matching — it makes the report class unenforceable.

**D4 — Best match wins; a two-stage filter bounds cost, and every collapse is recorded.** The current loop breaks at the first candidate at or above 0.92, so identity depends on iteration order. The fix enumerates documents once, keeps the first chunk per document, filters by class and collection, applies a cheap token-set Jaccard gate (≥0.5 on the first 500 characters), runs `pairwiseSimilarity(..., "lsa")` only on survivors, and takes the highest similarity at or above 0.92. A tie resolves deterministically because `iterateChunks` reads `ORDER BY ingested_at, rowid` (`src/kb-sqlite.ts:220`). Rejected: capping the candidate pool at the N most recent documents — it silently drops the guarantee for older content; rejected: embedding every stored document per ingest — the lexical gate removes that cost.

**D4a — Accepted risk: a false positive is visible, not silent.** Two genuinely distinct documents above 0.92 on their prefixes (syndicated copies, boilerplate-heavy pages) still collapse. The mitigation is observability: every collapse appends a KB event naming the incoming identity, the retained identity, and the similarity, so `manage_kb stats` shows what was merged. The alternative — a stricter gate — would trade this risk for missed true duplicates, which is the defect being fixed. Step 2 tests both directions: a true duplicate collapses, and a boilerplate pair below 0.92 stays distinct.

**D5 — Report retention is a `source_type` guard, with REQ-066 narrowed to allow it.** REQ-066 governs the removal *interval* and says it follows the tier, not `source_type`; REQ-083 says a report is never auto-removed. Both are in force and contradict. The reconciliation: REQ-066 gains a precedence clause — "a content class whose own requirement declares indefinite retention SHALL NOT be removed by tier expiry" — and `runMaintenance` skips `source_type === "report"` before tier evaluation. The existing `src/kb-hardening.test.ts:118-151` test ("expires by freshness tier, not by source_type") stays valid and unchanged: it uses `fetch_page` and `corroborate` chunks, neither of which declares indefinite retention. Confidence decay is untouched, which is REQ-083's split between retention and confidence. Rejected: exempting the `report` tier by name — a report stored under any tier must survive.

**D6 — Monotonicity and predecessor identity are validated, never auto-stamped.** At receipt-store time for a report id:
- a supplied `revision` not greater than the stored revision for that id is rejected with `invalid_input` plus remediation naming the stored revision; an absent revision keeps the prior revision (an in-place update per REQ-072, not a new revision);
- `revision > 1` requires a `supersedes`, mirroring `report-manifest.ts:290-291` — that rule is added to the receipt normalizer (`src/kb-receipt.ts`), which lacks it today;
- a `supersedes` naming the same report id is rejected (a same-id re-ingest is an in-place update, so it has no distinguishable predecessor); a `supersedes` naming a different stored report requires that report's revision to be lower;
- a `supersedes` naming an unknown id is accepted and recorded (the predecessor may have been deleted explicitly).

A corrected report that must remain distinguishable therefore takes a new identity and names the predecessor. This is stated in REQ-083 so the contract matches the rule. Rejected: server-side auto-increment — it cannot produce a `supersedes` identity for a same-id row (the predecessor is overwritten), so it would stamp a revision with no recorded predecessor, which REQ-083 forbids; rejected: appending revision rows to `report_receipts` — a schema migration for a contract the link satisfies.

**D7 — Behavior changes get a CHANGELOG entry; spec edits ride the same commits.** Four REQ bodies change (066, 067, 072, 083), so this is semantic-impact work.

## Blast radius

| File | Change | Size |
|---|---|---|
| `infobroker.md` (`:579-580`, `:582-604`) | Narrow REQ-067; add the class/collection clause to REQ-072; add the retention-precedence clause to REQ-066; add the revision/predecessor rule to REQ-083 | M |
| `src/kb.ts` (`:604-621`) | Replace the report-only similarity block with a class/collection-scoped, best-match, two-stage dedup used by every ingest; append a dedup event | M |
| `src/kb.ts` (`:1103-1121`) | Skip `source_type: "report"` in the maintenance predicate | S |
| `src/kb.ts` (`:931-959`) | Enforce monotonic revision and predecessor identity before replacing the receipt | M |
| `src/kb-receipt.ts` (`:100-145`) | Require `supersedes` when `revision > 1`; reject a self-referencing `supersedes` | S |
| `src/kb.test.ts` (`:350-380`) | Non-report meaning-equivalence, best-match identity, cross-class and cross-collection non-collapse, dedup event, boilerplate non-collapse (REQ-072) | M |
| `src/kb-model.test.ts` (`:46-58`) | Delta amendment: the seed fixture used ten templated near-identical documents, which the intended dedup now collapses; the fixture supplies ten distinct subjects so it still seeds ten documents (REQ-082) | S |
| `src/kb-hardening.test.ts` (`:33-140`) | Report survives expiry while a web chunk in the same tier does not (REQ-083, REQ-066) | S |
| `src/kb-report-receipt.test.ts` (new describe) | Reject non-monotonic, reject self-supersedes, reject inverted predecessor, accept absent revision as an in-place update, accept an unknown predecessor (REQ-083) | M |
| `src/config.test.ts` (`:600-640`) | KB reload at the resolver/tier seam (REQ-067, REQ-040) | S |
| `debate-club/src/kb-contract.test.ts` | Add `reload_config` → `manage_kb` collection assertion; the absent-KB case at `:131-143` stays as F-R6-B-4's absent-half evidence | S |
| `README.md` | Only if Step 0.3 finds a retention/dedup/revision claim | S (conditional) |
| `src/index.ts` | Only if Step 0.2 finds a tool-description claim; otherwise read-only mutation target | S (conditional) |
| `CHANGELOG.md` | Entry naming the three behavior changes and the cross-collection report change | S |
| `ROADMAP.md` (`:17-22`) | Retire the section | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` (`:375-377`, `:808-810`) | Mark F-R6-B-4/5/6 `Resolved`; refresh citations | S |
| `docs/plans/2026-11-10-r6-config-dedup-report/{plan,tasks,aar}.md` | Increment record | S |

No schema, `config.json`, dependency, or routing-file change is expected; Step 0.2 confirms the routing surface before the claim is relied on.

**Mutation targets (no committed change):** `src/kb.ts` dedup call, `src/kb.ts` maintenance guard, `src/kb.ts` revision check, `src/index.ts:2415` KB re-init.

## Implementation steps

**Step 0 — Surface probes (read-only unless stated).**

1. `git log -1` and `git status --porcelain`; record the baseline already verified above.
2. `npm run check-intent-citations` and `npm run check-tdqs`; record counts. If a `manage_kb` description states retention, dedup, or revision behavior, add `src/index.ts` to the committed blast radius before editing.
3. Grep `README.md` for report retention, dedup, and revision claims; record whether a `README.md` row becomes a committed edit.
4. Measure the four drafted REQ bodies with `wc -c` plus sentence and `SHALL` counts against Appendix B; trim before the first source edit (C-3).
5. Run `npm run validate-spec` to record the pre-edit citation and coverage state.
6. Probe `npm audit --json` once and record whether the registry answers (C-2).
7. Read `src/clause-coverage.ts` and confirm none of the four revised bodies introduces an "or"-joined branch or a "when … declares" conditional; if one does, schedule the named tags (C-4).

**Step 1 — REQ-067 narrowing and the reload tests.**

1. Replace the REQ-067 body per D1 and measure it again.
2. Unit test in `src/config.test.ts` per D2, tagged `// @implements REQ-067` and `// @implements REQ-040`: change `kb.default_collection` and `kb.freshness.default_tier` through the user layer, `reloadConfig()` + `initKb`, assert the resolver returns the new collection and a new ingest lands in the new tier.
3. Arena test in `debate-club/src/kb-contract.test.ts`: `reload_config` with a patch that sets `kb.default_collection`, then `manage_kb` ingest without `collection`; assert the stored entry's collection. No new file is needed; the absent-KB case already exists at `:131-143`.

**Step 2 — Dedup (F-R6-B-5).**

1. Replace the report-only block at `src/kb.ts:604-621` with one helper used by every ingest: `resolveMeaningIdentity(title, text, collection, sourceType, sourceUrl)`.
2. Contract: enumerate `iterateChunks()` once, keep the first chunk per distinct `source_url`, skip the incoming identity and any document with a different collection or source type, apply the lexical gate on the first 500 characters, run `pairwiseSimilarity(..., "lsa")` on survivors, return the highest match at or above 0.92, and append a dedup event naming both identities and the similarity when it returns one.
3. Tests in `src/kb.test.ts`: (a) a web document re-ingested under a different URL collapses to one identity and the stats chunk count does not increase; (b) two candidates both above threshold resolve to the higher one; (c) a text-class document matching a report does not collapse into it; (d) a same-class document in a different collection does not collapse; (e) a boilerplate pair at roughly 0.8 stays distinct; (f) the collapse is visible as a KB event. The existing report tests (`:350-380`) stay green.

**Step 3 — Report retention and revision chain (F-R6-B-6).**

1. `runMaintenance`: return `false` for any chunk with `source_type === "report"` before the tier lookup, with a comment citing REQ-083 and the REQ-066 precedence clause.
2. `kbPutReportReceipt`: apply D6's rules; reject with the existing `invalid_input` shape and a remediation naming the stored revision.
3. `src/kb-receipt.ts` (the normalizer, which has no report id): require `supersedes` when `revision > 1`. The self-reference check stays in `kbPutReportReceipt`, the only layer that knows the report id.
4. Tests: (a) `src/kb-hardening.test.ts` — a report in an expiring tier survives `runMaintenance` while a `web_search` chunk in that tier is removed; (b) `src/kb-report-receipt.test.ts`, new describe — reject non-monotonic, reject self-supersedes, reject inverted predecessor, accept absent revision as in-place update, accept an unknown predecessor.

**Step 4 — Mutation and cost evidence (C-1).**

1. Remove the dedup call for non-report identities → the new `src/kb.test.ts` cases fail; restore; verify the diff is the intended change only.
2. Remove the report guard in `runMaintenance` → the retention test fails; restore.
3. Remove the monotonicity check → the reject tests fail; restore.
4. Remove `initKb(newConfig.kb)` at `src/index.ts:2415` → the Arena reload test fails; restore.
5. Seed a 200-document store and record ingest wall time and LSA candidate count for one duplicate and one novel document in `tasks.md` (D4's cost claim).

**Step 5 — Tracker, roadmap, changelog, increment record.**

1. `worklist.md`: mark F-R6-B-4/5/6 `Resolved`; update the three REQ evidence rows with the new test paths and line numbers.
2. `ROADMAP.md`: retire the section.
3. `CHANGELOG.md`: entry naming the dedup extension, the cross-collection report change, report retention, and revision validation.
4. Write `tasks.md` and `aar.md`; the AAR ends with `LOOP PAUSED` or `LOOP OPEN`.

**Step 6 — Gates and commits.**

1. `npm run check:fast` after Step 3, after Step 5, and on the final tree; the full `npm run check` once on the final tree.
2. Split commits: spec → source + tests → docs (worklist, roadmap, changelog) → increment record. Typecheck between commits per AGENTS.md.

## Edge cases and failure modes

| Case | Mitigation |
|---|---|
| The lexical gate suppresses a true near-duplicate that LSA would catch | The gate is deliberately low (token-set Jaccard ≥ 0.5 on 500 characters); Step 2 test (a) proves the intended case passes it. If a legitimate case falls below, lower the gate and record the measured value rather than removing it. |
| A false positive collapses distinct documents | Accepted risk D4a: the collapse is recorded as a KB event naming both identities, so `stats` exposes it; test (e) pins the below-threshold direction. |
| Two stored documents both exceed 0.92 | Highest similarity wins; a tie keeps the `ORDER BY ingested_at, rowid` order, stable across runs. |
| A cross-collection report that collapsed before now does not | Intended behavior change (D3), named in the CHANGELOG; no stored data is deleted by the change. |
| A report is stored under a custom expiring tier by an existing deployment | The retention guard fixes it without a migration; the test uses exactly that configuration. |
| `supersedes` names a report deleted with the `delete` action | Accepted and recorded (D6). |
| A same-id re-ingest is meant as a new revision | Rejected (self-supersedes); the remediation tells the caller to ingest under a new identity. This is the rule REQ-083 now states. |
| `validate-spec` fails on a revised body's limits | Step 0.4 measures first; an overrun is trimmed before editing (C-3). |
| The Arena reload patch cannot write the user layer in CI | Fall back to the unit test as the terminal evidence and record the Arena case as not-run; the unit test still observes the resolver and tier. |

## Verification

- Per step: the tests named in the step, run with `npx vitest run <file>`.
- Mutation evidence for B-5, B-6, and B-4's reload wiring (Step 4); each mutation is reverted and the diff verified.
- Cost measurement (Step 4.5) recorded in `tasks.md`.
- `npm run validate-spec`, `npm run check-intent-citations`, `npm run check-report-fixtures`, and `npm run check-tdqs` after the spec and source edits.
- Final: `npm run check:fast` three times as scheduled, `npm run check` once on the final tree (or C-2 recorded).
- The full Arena suite (`npm run test-debate-club`) because `kb-contract.test.ts` changes.

## User impact

- No restart, reload, or migration is required by the change itself.
- Caller-visible behavior: a non-report duplicate under a new URL now updates the original document instead of adding a copy; a cross-collection report no longer collapses; a report is never auto-removed; a non-monotonic or self-superseding revision is rejected.
- Rollback: revert the source hunks and the spec edits; stored data is unaffected (no schema change).

## Evidence and review record

- Baseline: HEAD `c7b0089`, tree clean, `check:fast` PASS (20.2 s).
- Roadmap: `ROADMAP.md:17-22`; findings `worklist.md:375-377`, `:808-810`.
- Spec: REQ-040 (`infobroker.md:434`), REQ-066 (`:579`), REQ-067 (`:582`), REQ-072 (`:585`), REQ-083 (`:603`), REQ-113 (config fallback).
- Code: `src/config.ts:968-995`; `src/kb.ts:604-621`, `:931-959`, `:1103-1121`; `src/kb-receipt.ts:123-140`; `src/lib/report-manifest.ts:287-292`; `src/index.ts:2058-2059`, `:2200-2290`, `:2408-2415`, `:2585-2590`; `src/kb-sqlite.ts:220`; `debate-club/src/kb-contract.test.ts:131-143`.
- Cold pass 1: 1 Blocker (REQ-066/REQ-083 contradiction), 5 Majors (duplicate Arena test, unbacked auto-stamp, dedup false-positive risk, done-bar mutation scope, D3/Step 2.3 ambiguity), 6 Minors. All resolved in this revision; release decisions recorded in D1–D7 and D4a.
- Delta amendment during execution: the model-reconciliation fixture (`src/kb-model.test.ts`) seeded ten templated near-identical documents, so the intended dedup collapsed them and `Set{9}` became `Set{0}`. The fixture now supplies ten distinct subjects; no production change. This is a condition-only amendment (no new files, gate, or destructive operation), re-stamped with the same review artifacts.
