# Tasks — R7 confidence and technique remediation

Increment record for `plan.md` (revision 2, 2026-11-12). Executed
2026-11-12; every step checked, transcripts verbatim.

## Phase 0 — Scaffold and baseline

- [x] **T0 — baseline.** `npm run status` and a green `npm run check`.
- [x] **T1 — scaffold.** `plan.md`, this file, `aar.md` (`LOOP OPEN` seeded,
      a valid terminal token).

### T0 transcript

`npm run status` → version 2026.11.11 (latest tag `v2026.11.07`), 130 unpushed
commits, oldest 3.0 d, 12 open roadmap items.

`npm run check` → **PASS** (full, 22 gates, 156.9 s), recorded for `8138fe9`.
Pre-existing warning only: `2026-11-10-r6-encryption-capacity-remediation:
plan.md has no **Done bar:** line`.

## Phase 1 — Confidence scale (F-R7-B-1)

- [x] **T2.** Extended the REQ-115 block: block present, canonical citation
      present, label sequence exactly `High`, `Medium`, `Low`, each label a row
      in the `## Confidence (strength of the judgment)` section.
- [x] **T3 — red.** `npm run validate-spec` → exit 1 naming `No confidence`.
- [x] **T4.** Replaced `SKILL.md:176-180`: three labels, no band numbers, bands
      cited from `confidence.md`, unsourced claims routed to the finding's
      `**Gaps:**` field and the `## Uncertainty Register`.
- [x] **T5 — partial green.** REQ-115 pair cleared; only the expected REQ-088
      red remains.

### T3 red transcript

Checks were added before any content change. `npm run validate-spec` → exit 1,
three errors:

```
ERROR: skills/analysis-loop/references/techniques.md: missing '## Families' index (REQ-088)
ERROR: skills/analysis-loop/SKILL.md: confidence-scoring block does not cite skills/infobroker/references/confidence.md (REQ-115)
ERROR: skills/analysis-loop/SKILL.md: confidence-scoring labels are [High, Medium, Low, No confidence], expected [High, Medium, Low] — unexpected label(s): No confidence (REQ-115)
```

The REQ-115 pair is exactly the two errors T3 expects; the REQ-088 error is T7's.

### T5 transcript

After the skill fix: `npm run validate-spec` → exit 1 with **one** error, the
expected REQ-088 red (`missing '## Families' index`). The REQ-115 pair is gone.

## Phase 2 — Technique families (F-R7-B-2)

- [x] **T6.** Extended the REQ-088 block: pinned `## Families` grammar, absence
      short-circuit, ≥3 families, ≥6 techniques, duplicate and empty-cell
      rejection.
- [x] **T7 — red.** `npm run validate-spec` → exit 1 with one error: missing
      `## Families` section.
- [x] **T8.** Rewrote the preamble, added the index and eight `**Family.**`
      lines. Mapping (also `D-107`):
      - hypothesis generation and testing — `Analysis of Competing Hypotheses (ACH)`
      - challenge analysis — `Key Assumptions Check; Devil's Advocacy; Premortem Analysis; Structured Self-Critique`
      - scenarios and indicators — `Indicators`
      - diagnostics — `Quality-of-Information Check`
      - decision support — `Decision Matrix`
- [x] **T8b.** Added `### D-107` under `## Active Decisions` in `DECISIONS.md`.
- [x] **T9 — green.** `npm run validate-spec` → exit 0.
- [x] **T10 — probes.** Six mutations, each red then restored.

### T7 red transcript

`ERROR: skills/analysis-loop/references/techniques.md: missing '## Families'
index (REQ-088)` — emitted alone because the cross-checks short-circuit when the
section is absent.

### T9 transcript

`npm run validate-spec` → exit 0, `All checks passed.`

### T10 probe transcripts

All probes restored byte-identically (`diff -q` clean).

| Probe | Mutation | Gate result |
|---|---|---|
| (a) | delete `**Family.** diagnostics` | `technique 'Quality-of-Information Check' declares 0 families, expected exactly one` |
| (b) | add `Indicators` to the decision-support row | `listed under 'decision support' but declares family 'scenarios and indicators'` + `appears in 2 index rows` |
| (c) | add `assessment of cause and effect \| Indicators` row | cross-check + duplicate membership, same pair |
| (c2) | add `Bogus Technique` to the diagnostics cell | `index names technique 'Bogus Technique' absent from the catalog` |
| (d) | delete the confidence-scoring block | `missing confidence-scoring block (REQ-115)` |
| (e) | add `- **Very low** — …` | `labels are [High, Medium, Low, Very low] … unexpected label(s): Very low` |

## Phase 3 — Bookkeeping

- [x] **T11.** Worklist verdict + register rows → `Resolved 2026-11-12`.
      Acceptance: `grep -n "F-R7-B-1\|F-R7-B-2" <worklist>` returns four lines
      (two verdict rows, two register rows); `grep -n "F-R7-B-" ROADMAP.md`
      returns nothing.
- [x] **T12.** Removed the roadmap section; `npm run check-roadmap` exit 0.
- [x] **T13.** Inserted the new `## 2026.11.11 — …` section under
      `# Changelog`; top date unchanged; `npm run version-sync` exit 0.

## Phase 4 — Gates and close

- [x] **T14.** `validate-spec`, `check-roadmap`, `version-sync`,
      `check-script-discipline`, `check-non-goals`, `check-loop-artifacts`,
      `typecheck`, `typecheck:scripts` — all exit 0.
- [x] **T15.** Final `aar.md`; `npm run session:close` → `gates: PASS (fast,
      29.6s)`, `Session sealed.`
- [x] **T16.** `npm run check` (full, un-piped) → exit 0, `gates: PASS (full,
      158.3s)`.

### T16 transcript

```
gates: PASS (full, 158.3s)
```
