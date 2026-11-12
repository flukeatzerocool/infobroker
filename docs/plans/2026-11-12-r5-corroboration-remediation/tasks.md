# Tasks — R5 corroboration remediation

**Plan:** `docs/plans/2026-11-12-r5-corroboration-remediation/plan.md`
**Status:** complete (executed 2026-11-12)

## Review record

- Plan gate: stamped `planned`, depth `standard`, independence `fresh`, verdict `passed`, plan sha `c7e0e5f8…`; artifact `~/.local/state/opencode/plans/3b34aea2…/2026-11-12T17-20-15-802Z-c7e0e5f8.md`.
- Self pass: applied against the drafted artifact.
- Cold pass: `independent-review FAILED.` — 1 Blocker, 2 Major, 3 Minor, and 7 Nit findings; all resolved in the revision (`/tmp/opencode/r5-cold-review.md`, sha `74a470b7…`).
- Diff re-review: `independent-review passed.` with two clarity-only nits, both applied (`/tmp/opencode/r5-diff-rereview.md`, sha `922acac2…`, 10/10 reads).

## Phase 0 — Baseline

- [x] Baseline at `5297630`: `npm run check` PASS (22 gates, 153.8 s); tree clean before the increment directory.
- [x] Seam audit: 19 `reconcileClaims` matches (18 call sites + the definition), three in production (`src/corroborate.ts:644,712,763`); `jaccardSimilarity` has exactly one production caller (`:216`), so the D1 filter cannot shift clustering.
- [x] Assertions depending on the old behaviour: `src/corroborate.test.ts` "keys findings on the caller claim" (2 sources at 0.8), "detects agreement across three providers" and "produces a narrative synthesis statement" (default 0.8), plus every reconcile-level `confirmed` case that omits the new parameter (kept at 0.5). Each is named in the report below.
- [x] Namespace: no new REQ, no new config key, no schema-shape change.

## Phase 1 — Failing evidence

Red run against the unmodified source: **12 failed / 82 passed (94)**, log `/tmp/opencode/r5-red.log`.

| Test | Red |
|---|---|
| jaccard: stopword-only overlap | failed |
| jaccard: lexicon content word | failed |
| `confirmationEligible` ×4 | failed (export absent) |
| reconcile: stopword-only attribution | failed |
| reconcile: threshold gate | failed (`confirmed` at 0.8) |
| reconcile: multi-cluster below threshold | failed (`confirmed`) |
| reconcile: KB-only dominant cluster | failed (`confirmed`) |
| corroborate: effective threshold | failed (`confirmed` at 0.8) |
| corroborate: KB-only | failed (`confirmed`) |
| Guards passing unmodified by design: content-token attribution, URL upgrade, KB+external companion | passed | The guards assert behaviour that the new code must preserve; they are not red evidence.

## Phase 2 — Fixes

- [x] Slice A: `STOPWORDS` filter in `jaccardSimilarity`.
- [x] Slice B: `confirmationEligible`; `confidenceThreshold` parameter; both `confirmed` branches gated with an explicit `unverified` fallback; three production call sites pass the effective value.
- [x] Slice C: `retrieval_origin` on `SearchResult`/`CorroborationSource`; KB mapping sets it; `attributeSource` copies it; live URL clears it in both attribution paths.

## Phase 3 — Prose, verification, bookkeeping

- [x] REQ-026 sentence added; body **762 chars, 7 sentences, 3 SHALL, 6 backtick tokens** (all pre-existing parameter tokens) — inside Appendix B.
- [x] §8.1 pseudocode eligibility condition + KB-alone comment; §8.2 verdict paragraph and rating-band clarification.
- [x] README `verify_claims` clause.
- [x] Targeted suites: `corroborate`, `kb-claims`, `source-family`, `calibration`, `tool-surface` → 5 files, 120 tests, all pass.
- [x] `npm run typecheck` → pass.
- [x] `npm run validate-spec` → all checks passed. `npm run validate-readme` → 0 errors, 0 warnings.
- [x] `npm run check-roadmap` → OK (17 sections). `npm run check-loop-artifacts` → 0 errors, 1 pre-existing warning.
- [x] `npm run check:fast` → PASS (22.7 s).
- [x] `npm run check` → PASS (full, 22 gates, 154.6 s).
- [x] CHANGELOG entry; ROADMAP section retired and the KB-provenance section added; four worklist dispositions.
- [x] AAR terminal token; `session:close`; commit series.

## Changed-expectation report (C-5)

- "keys findings on the caller claim (REQ-026)": fixture threshold set to 0.7 (was 0.8) so the two-family agreement still confirms; the claim-keying assertions are unchanged.
- "detects agreement across three providers": fixture threshold set to 0.7 for the same reason.
- "produces a narrative synthesis statement": fixture threshold set to 0.7 so the synthesis asserts the confirmation branch it was written for.
- Every reconcile-level test that omits the new parameter keeps the 0.5 bar and passed unmodified (C-5).
