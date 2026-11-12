# AAR — R7 routing-citation remediation

**Status:** closed 2026-11-12 · terminal token at the end.

## Scope

Roadmap § R7 routing-citation remediation — F-R7-G-1 (hand-maintained routing
surface), F-R7-G-2 (renamed bare tool treated as prose), F-R7-G-3 (README points
at the shipped config instead of the user layer).

## What happened

1. The citation gate's surface was replaced with a directory-derived one: the
   instruction file, `SKILL.md`, and every `skills/infobroker/references/*.md`
   file, sorted and read by the gate. The parser module stayed I/O-free through
   `prefixPolicyFor(file)`. A missing or empty reference directory now exits 2.
2. A renamed bare tool is detected through three narrow signals measured on the
   corpus before wiring: Levenshtein ≤2 against a registered slug, a registered
   slug used as an affix, and citation-shaped `action:`/`operation:` arguments.
   The reordered/unrelated rename class stays prose by design (`D-108`).
3. The README provider-enable sentence now names the user layer, matching the
   deployment section 45 lines below.
4. Registers: worklist verdict and register rows resolved with evidence, both
   stale README line references corrected, the roadmap section removed, `D-108`
   recorded, and a CHANGELOG sibling entry added.

## What went right

- The false-positive budget was measured **before** the gate changed: 599
  backticked tokens across 16 files, 0 hits for all three signals, and seeded
  renames classified as citations while `teleport`, `manage`, and `web_search`
  stayed prose. The final gate result matched the probe exactly (172 citations,
  0 findings).
- Every probe was run red-first and recorded: the unparsed-file seed (exit 0
  before, `unknown_tool` after), the bare-rename seed, the new-file seed, and
  the missing-directory path (exit 2, not the uncaught exit 1).
- The surface extension needed no content repair: all 14 reference files parsed
  with 0 findings, so the change stayed one concern and shipped in six commits.

## What went wrong

- **The plan's worklist acceptance count was wrong.** Revision 1 required six
  matching worklist lines; the tree has five (no verdict row cites F-R7-G-1).
  The cold pass caught it, but it was a mechanical claim that a pre-draft grep
  should have settled.
- **The plan overclaimed REQ-107 conformance.** Revision 1 said the fix "makes
  the gate meet the sentence it already carries"; the bounded detector cannot
  catch a reordered rename. Revision 3 scopes the claim and records the residual
  in `D-108` as by-design.
- **The review cap was exceeded by one pass.** The cold pass and the single
  diff re-review were the recorded cap; the diff re-review left two mechanical
  items, and a bounded final-line verification was needed to satisfy the build
  gate. It was user-authorized by the execute instruction and touched only the
  corrected lines and the evidence sidecar. Consequently § Review-loop
  convergence is **not** retired: this increment recorded a cap and did not stop
  at it.

## Finding dispositions

| Finding | Severity | Disposition | Evidence |
|---|---|---|---|
| F-R7-G-1 | P2 | resolved in-session | derived surface in `scripts/check-intent-citations.ts`; new-file probe exit 1; missing-dir probe exit 2; D-108 |
| F-R7-G-2 | P1 | resolved in-session | three-signal detection in `src/intent-citations.ts`; 6 new unit cases; renames red→green; corpus 0 findings; D-108 |
| F-R7-G-3 | P2 | resolved in-session | `README.md:482-489` names the user layer and agrees with `:531-537`; `validate-readme` exit 0 |

No open P0/P1 beyond the scheduled roadmap. The next open roadmap section is
§ R7 client-artifact gate remediation.

## Review record

| Pass | Result | Notes |
|---|---|---|
| Self (revision 1) | passed | checklist applied in-context |
| Cold (revision 1) | `FAILED` — 1 Blocker / 2 Majors / 5 Minors / 5 Nits | `/tmp/opencode/r7-routing-cold-report.md`; four stages in one fresh context |
| Diff re-review (revision 2) | `FAILED` — 2 mechanical items | stale sub-count + sidecar bound to revision 1; `/tmp/opencode/r7-routing-diff-rereview.md` |
| Final line verification (revision 3) | `independent-review passed.` | `/tmp/opencode/r7-routing-final-verification.md`; post-cap, user-authorized |

Review-loop cap: one cold pass plus at most one diff re-review, recorded in the
plan. The cap was exceeded by one targeted verification after the re-review's
two mechanical items; the user authorized execution, so the verification ran.
§ Review-loop convergence remains open on `ROADMAP.md`.

## Step-to-evidence

| Step | Command | Result |
|---|---|---|
| Baseline | `npm run check` | PASS, 22 gates, 159.0 s, recorded for `0852120` |
| T2 | `npx tsx scripts/check-intent-citations.ts` (seed) | exit 0, 141 citations, 0 findings before the change |
| T5 | same (seed) | exit 1, `unknown_tool` at `troubleshooting.md:94` |
| T6 | same (new reference file) | exit 1, `unknown_tool` at `probe-surface.md:2`; exit 0 after deletion |
| T7 | same (bare rename seed) | exit 0 before the change |
| T9 | same (bare rename seed) | exit 1, `unknown_tool` at `troubleshooting.md:94` |
| T4 | gate with the directory renamed | exit 2, `cannot read skills/infobroker/references/` |
| T10 | `npx vitest run src/intent-citations.test.ts` | 32/32 passed |
| T11 | `npm run check-intent-citations` | 172 citations, 0 findings |
| T17 | 11-gate local suite + `npm run test` | all exit 0; 1435 tests passed |
| T19 | `npm run check` | PASS, full, 159.9 s, exit 0 (recorded after the terminal token) |

## Dispositions and next work

- Roadmap section removed; the next open section is § R7 client-artifact gate
  remediation.
- Standing decision: `D-108` (derived surface, bounded detector, by-design
  residual).
- No open P0/P1 for this increment.

LOOP PAUSED
