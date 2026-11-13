# Tasks — R7 client-artifact gate remediation

Source plan: `plan.md` (revision 2). Depth: standard. Rollback cost: 1.

## Phase 0 — Scaffold and baseline

- [x] **T0** Baseline recorded.
  - `npm run status` → version 2026.11.11 (latest tag `v2026.11.07`), 141
    unpushed commits, oldest 3.0 d, 10 open roadmap items.
  - `npm run check` → PASS (full, 164.0 s, 22 gates, recorded for `936fb99`),
    run before this plan directory existed. Pre-existing warning:
    `check-loop-artifacts` → `2026-11-10-r6-encryption-capacity-remediation:
    plan.md has no **Done bar:** line`. `npm run audit` → 4 low advisories.
- [x] **T1** `tasks.md` and `aar.md` (seeded `LOOP OPEN`) present.

## Phase 1 — REQ-050 content gate (F-R7-A-1)

- [x] **T2** Red: KB-first paragraph removed → exits **0** (warn-only).
  Restored.
- [x] **T3** Implemented: absence error + three clause assertions.
- [x] **T4** Green on the tree; T2's deletion exits **1**
  (`does not direct knowledge-base-first retrieval … (REQ-050)`).

## Phase 2 — REQ-051 content gate (F-R7-A-2)

- [x] **T5** Red: Phase-0 escalation imperative replaced → exit 0.
  Restored.
- [x] **T6** Implemented: absence error, both pipeline headings, per-pipeline
  KB phase, Phase-0 imperative escalation anchor, file-level manifest /
  quality gate; ARCHIVE-step `receipt` + `verify_report`; token message
  `(REQ-051/REQ-052, §9.4)`.
- [x] **T7** Green; escalation deletion exits 1; **both** ARCHIVE receipts
  removed exits 1. The first receipt probe stayed green because the tool table
  (`SKILL.md:221`) satisfied the file-level check, so the assertion moved into
  the per-ARCHIVE-step check.

## Phase 3 — pipeline tail (F-R7-D-1)

- [x] **T8** Red: `translate` removed from TAIL → exit 0. Restored.
- [x] **T9** TAIL and FC chain carry `translate`.
- [x] **T10** TAIL sequence + chain-label rule; `TRANSLATE` added to
  `REPORT_TAIL`.
- [x] **T11** Green; T8's removal exits 1; a shape-pipeline `TRANSLATE`
  removal exits 1.

## Phase 4 — unsupported-claim wording (F-R7-D-4)

- [x] **T12** Red: old soften-to-modality wording restored → exit 0.
  Restored.
- [x] **T13** Both SKILL.md blocks and the `workflows.md` bullet reworded.
- [x] **T14** Enumerating helper with per-file anchors; the three blocks are
  asserted. Old wording exits 1 (two errors: no removal, softening).
  The first `/soften/i` rule rejected the correct "never rescued by …
  softening" sentence; narrowed to `soften … modality`.

## Phase 5 — manifest language after translation (F-R7-D-3)

- [x] **T15** Red: `--expect-language` exited **2** (unknown flag).
- [x] **T16** `validateReport(text, { expectLanguage })` and
  `validateManifest(manifest, options)`.
- [x] **T17** CLI flag, USAGE, pass-through.
- [x] **T18** SKILL.md (both pipelines) and `workflows.md` instructions.
- [x] **T19** Gate asserts TRANSLATE names the manifest language and REVALIDATE
  names `--expect-language`, in both SKILL pipelines and the reference.
- [x] **T20** `en` → 0; `de` → 1 `manifest-language-mismatch`; key removed →
  1 `manifest-language-required`; instruction removal → `validate-spec` 1.
- [x] **T21** Three cases in `src/report-contract.test.ts`; 29/29 in the file.

## Phase 6 — Documentation and registers

- [x] **T22** §9.4 client-artifact bullet names the new content checks.
- [x] **T23** `### D-109: The Manifest-Language Staleness Check Is
  Caller-Declared (2026.11.12)`.
- [x] **T24** Eight worklist lines resolved (three verdict rows + five register
  rows), finding IDs retained, `D-109` named in the F-R7-D-3 cell.
- [x] **T25** § R7 client-artifact gate remediation removed; § Review-loop
  convergence **kept** (cap exceeded, see AAR).
- [x] **T26** CHANGELOG sibling section, date `2026.11.11`.

## Phase 7 — Gates and close

- [x] **T27** Local gate suite green (see the AAR step-to-evidence table).
- [x] **T28** `aar.md` dispositions, cap record, terminal token;
  `npm run session:close`.
- [x] **T29** `npm run check` on the final tree (full, un-piped).

## Red/green transcript log

| Probe | Before | After |
|---|---|---|
| T2/T4 REQ-050 KB paragraph deleted | exit 0 (warning) | exit 1, `(REQ-050)` ×2 |
| T5/T7 Phase-0 escalation imperative deleted | exit 0 | exit 1, `(REQ-051)` |
| T7 both ARCHIVE `receipt` mentions deleted | exit 0 | exit 1, `(REQ-051/REQ-120a)` |
| P4 `translate` removed from TAIL | exit 0 | exit 1, `(REQ-120)` ×2 |
| T11 `TRANSLATE` removed from a shape `Pipeline:` paragraph | exit 0 | exit 1, `(REQ-120)` |
| T12/T14 softening-to-modality wording restored | exit 0 | exit 1, `(REQ-120)` ×2 |
| T20 TRANSLATE manifest-language instruction removed | exit 0 | exit 1, `(REQ-120)` |
| T15/T20 `--expect-language de` on an `en` report | exit 2 (unknown flag) | exit 1, `manifest-language-mismatch` |
| T20 language key removed with an expectation | n/a | exit 1, `manifest-language-required` |
