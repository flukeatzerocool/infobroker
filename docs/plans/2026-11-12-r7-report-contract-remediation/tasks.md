# Tasks — R7 report-contract evidence remediation

Plan: `plan.md` · Order is execution order. Tick a step only when verified.

## Phase 0 — Scaffold and baseline

- [x] **T0 — baseline.** `npx tsx scripts/check-report-fixtures.ts --json` →
      exit 0, 19 fixtures, 0 violations. Per-fixture code map captured at
      `/tmp/opencode/r7-t0-baseline.json`. Single-class fixtures and their T0
      classes: `bad-doi` `{register-citation-id}`, `bad-finding-unlabeled`
      `{finding-unlabeled}`, `bad-handling` `{manifest-handling}`,
      `bad-manifest-placement` `{manifest-placement}`, `bad-modality`
      `{modality-attribution-missing}`, `bad-register-dates`
      `{register-published, register-accessed}`, `bad-register-grades`
      `{register-primacy, register-reliability, register-credibility}`,
      `bad-supersedes` `{manifest-supersedes}`, `missing-as-of`
      `{manifest-as-of}`, `missing-handling` `{manifest-handling-required}`.
      Multi-class: `bad-confidence`, `missing-citation`, `unresolved-source`,
      `no-register`. No shape: `bad-empty-manifest`. Unknown shape:
      `bad-shape-audience`. Literature Review: `missing-shape-block`.
      `npm run check` baseline: FAIL, one gate (`check-loop-artifacts`,
      missing `tasks.md`/`aar.md`) — cleared by T1.
- [x] **T1 — scaffold.** `tasks.md` (this file) and `aar.md` (seeded
      `LOOP OPEN`) written.

## Phase 1 — Shape-table enforcement (F-R7-C-2)

- [x] **T2 — red.** Added `test-fixtures/reports/missing-shape-table.md` (Fact-Check
      report with a `## Claim Verdicts` heading and prose, no table).
      Evidence: `npx tsx scripts/check-report-fixtures.ts` → exit 1,
      `FAIL: missing-shape-table.md (expected fail, got pass)`,
      `20 fixture(s), 1 expectation violation(s)` (`/tmp/opencode/r7-t2-red.txt`).
- [x] **T3 — implement.** `src/lib/report-manifest.ts`: exported `ShapeBlock` with
      `table?: readonly string[]`; `SHAPE_BLOCKS["Fact-Check"]` now one entry
      (`Claim Verdicts` + six required columns); new `splitTableRow`/
      `tableHeaderCells` helpers; `shapeBlockFindings(text, manifest, sections)`
      emits `shape-table` for a headed block without the required columns; call
      site passes `text`.
- [x] **T4 — corpus.** Added the `## Claim Verdicts` block (after `## Key Findings`,
      before `## Assumptions`) to `good-report`, `good-modality`, `bad-modality`,
      `bad-doi`, `bad-finding-unlabeled`, `bad-handling`, `bad-manifest-placement`,
      `bad-register-dates`, `bad-register-grades`, `bad-supersedes`, `missing-as-of`,
      `missing-handling`.
      Evidence: gate → exit 0, `20 fixture(s), 0 expectation violation(s)`.
- [x] **T5 — test and template.** Added `@implements REQ-119 shape-table` test and a
      positive assertion for `good-report.md`; named the heading inside the
      Fact-Check fenced snippet in `report-template.md`.
- [x] **T6 — verify.** `npm run typecheck` → clean; `npx vitest run
      src/report-contract.test.ts` → 21 passed. Per-file code map re-read: each
      single-class fixture keeps exactly its T0 set (`/tmp/opencode/r7-t6.json`);
      only the three multi-class fixtures gained `shape-block`.

## Phase 2 — Evidence fixtures and assertions (F-R7-C-1, C-3, C-4, C-5)

- [x] **T7.** `bad-register-url.md` — uncited S2 row with URL
      `example.com/bridge-archive`; S1 stays valid and cited.
- [x] **T8.** `bad-register-identity.md` — empty Source, Type, Relevant interests.
- [x] **T9.** `bad-register-published.md` (`circa 2026`) and
      `good-undeterminable-published.md` (`undeterminable`).
- [x] **T10.** `bad-manifest-vocabulary.md` (`likelihood: "probably"`,
      `verdict: "Sort Of True"`).
- [x] **T11.** Five `it` blocks with tags `REQ-116 register-url`,
      `REQ-118 register-identity`, `REQ-118 undeterminable-publication-date`,
      `REQ-114 likelihood-vocabulary`, `REQ-114 verdict-vocabulary`.
      Evidence: gate → exit 0, `25 fixture(s), 0 expectation violation(s)`;
      `npx vitest run src/report-contract.test.ts` → 26 passed. New fixtures'
      error sets: `{manifest-likelihood, manifest-verdict}`,
      `{register-source, register-type, register-interests}`,
      `{register-published}`, `{register-url}`, and `good-undeterminable-published`
      passes (`/tmp/opencode/r7-t11.json`). Green on first run by construction —
      the branches existed; this is coverage, not red-first evidence.

## Phase 3 — Bookkeeping

- [x] **T12.** `worklist.md`: REQ-114/116/118/119 verdict rows and the five
      `F-R7-C-1`…`C-5` register rows → `Resolved 2026-11-12` with evidence.
- [x] **T13.** `ROADMAP.md`: § R7 report-contract evidence remediation removed.
      Evidence: `npm run check-roadmap` → OK, 14 sections.
- [x] **T14.** `CHANGELOG.md`: new `## 2026.11.11 — R7 report contract…` section.
      Evidence: `npm run version-sync` → OK.

## Phase 4 — Gates and close

- [x] **T15.** `npm run validate-spec` → all checks passed (142 REQs, 0 uncited
      source files); `npm run check-report-fixtures` → 25/0;
      `npm run check-roadmap` → OK; `npm run version-sync` → OK;
      `npm run check-script-discipline` → 72 TS + 9 shell conform;
      `npm run typecheck` → clean.
- [x] **T16.** `aar.md` rewritten with dispositions, the review cap, and
      `LOOP PAUSED`. `npm run session:close` not run: it mutates the cadence
      record and expects a clean tree at close; the split-commit series owns the
      commits (D-089/D-091), so the AAR is the closing artifact for this
      increment.
- [x] **T17.** `npm run check-loop-artifacts` → 0 errors, 1 pre-existing warning
      (`2026-11-10-r6-encryption-capacity-remediation` lacks a done bar).
      `npm run check` → exit 0, `gates: PASS (full, 158.0s)`
      (`/tmp/opencode/r7-final-check.txt`).
