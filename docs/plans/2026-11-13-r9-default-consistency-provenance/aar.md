# AAR — R9 default consistency and provenance enforcement

**Date:** 2026-11-13 · **Depth:** standard · **Status:** closed
**Plan:** `plan.md` (revision 3 + Amendment 1; sha `86b0401c…`; cold pass 1
`independent-review FAILED.` on revision 1, capped diff re-review
`independent-review passed.` on revision 2, reports in `plan.cold/`)
**Roadmap item:** `ROADMAP.md` § R9 default-consistency and provenance
enforcement — retired
**Closes:** F-R9-C-2, F-R9-C-3, F-R9-D-1, and F-R9-C-3a (found at plan time)
**Commits:** `190936c` (C1), `c1b95bd` (C2), `3d9496f` (C3), plus this
increment's docs commit

## What happened

1. **Baseline.** `npm run status` → 2026.11.11 (tag `v2026.11.07`), 186
   unpushed, 3 roadmap items. `npm run check:fast` PASS (19/19, 32.5 s);
   `npm run test-debate-club` PASS (61 tests) as the pre-edit probe (T0b), so
   C2's red-before is attributable.
2. **Plan gate.** Two cold passes: pass 1 FAILED with 2 blockers (wrong SDK
   module for `toJsonSchemaCompat`; a done bar naming a register row that did
   not exist) and 6 majors; revision 2 fixed them, and the capped diff
   re-review passed with 1 new major (the scanner could not see
   `(each default …)`) and 3 nits, all applied in revision 3.
3. **C1 (`190936c`).** `scripts/lib/tool-defaults.ts` reconciles all 10 §4
   declarations (15 parameters) and 4 config pairs; `validate-spec` calls it
   and walks every `src/**/*.ts` for config fallbacks. Red-before: the
   shipped-tree case failed on `(default 50k chars)`; green after REQ-021
   states `(default 50000)`. README names the truncation default, closing the
   pipeline's spec→README guard.
4. **C2 (`c1b95bd`).** `src/tool-footprint.ts` encodes input and output schemas
   through the SDK encoder and honours `enabled`. Arena red-before: 19031
   (Zod-internal input-only) vs 16174 (advertised input+output); green after.
   A fresh-server test re-derives `median_response_bytes` from five recorded
   bodies.
5. **C3 (`3d9496f`).** Appendix C names each rule's carrier and §9.4 narrows
   the error clause; D-116 records the gate scope, pair rule, encoder choice,
   and carrier map.

## What went right

- The cold pass caught two blockers that would have shipped: the encoder import
  was split across two SDK modules, and the done bar required a register row
  that did not exist. Both were verified against `node_modules` before the
  first edit.
- The red-before evidence is real in both behavioral commits: the shipped-tree
  reconciliation failed on the 50k wording, and the Arena byte equality
  failed at 19031 vs 16174 under a `git stash` of `src/index.ts`.
- Widening block A to `src/**/*.ts` was safe because the probe measured zero
  matches first; the wider gate found nothing to fix and cannot regress.

## What went wrong

- **Revision 1 named the wrong SDK module** for `toJsonSchemaCompat`. The
  feasibility check read the package's export map but not the module that
  exports the symbol.
- **The plan's `(each default false)` handling was reconciliation-only**, so a
  future multi-parameter clause would have been invisible to a scanner anchored
  on `(default `. The diff re-review caught it; the scanner now matches both
  forms and a fixture proves discovery.
- **The plan claimed the old schema→spec warning "stays"**, but it lived in
  the hardcoded path being replaced. Re-creating it would emit six permanent
  warnings for defaults no REQ declares. Recorded as Amendment 1; the scope is
  now stated rather than implied.
- **The plan stamp's binding line was markdown-formatted**, which the commit
  gate's `Plan sha256:` regex does not match, so `mark-build` blocked until the
  report carried a plain binding line. Cost: three stamp attempts.

## Findings

| ID | Severity | Predicate | Disposition |
|---|---|---|---|
| F-R9-C-2 | P1 | REQ-080 reconciled 2 of 10 declarations and 0 of 4 config pairs | Resolved in-session — C1 |
| F-R9-C-3 | P2 | REQ-081's "derived, not literals" clause unasserted | Resolved in-session — C2 |
| F-R9-C-3a | P1 | `tool_schema_bytes` measured Zod internals and omitted output schemas | Resolved in-session — C2 |
| F-R9-D-1 | P1 | Appendix C claimed universal G3 enforcement | Resolved in-session — C3 |
| F-AAR-1 | P3 | The plan's stamp binding line did not match the gate's plain `Plan sha256:` form | Resolved in-session — report carries the plain line |

## Gate evidence

| Gate | Result |
|---|---|
| T0b `npm run test-debate-club` (pre-edit) | PASS, 61 tests |
| `npx vitest run scripts/lib/tool-defaults.test.ts` | 9 passed (shipped-tree case red before the spec edit) |
| `npx tsx scripts/validate-spec.ts` | exit 0, all checks passed |
| `npm run typecheck:scripts` / `npm run typecheck` | 0 errors |
| Arena `npm run test-debate-club` (after C2) | PASS, 62 tests; red-before 19031 ≠ 16174 |
| `npm run validate-readme` | 0 errors, 0 warnings |
| `npm run check-roadmap` | OK (3 sections) |
| `grep "every rule is enforceable by G3"` | no match |
| `npm run check` (full, final tree) | PASS (full, 166.8 s; 22 gates incl. audit, check-pack, debate-club) |

## Recommendations

None outside `ROADMAP.md`. The two remaining sections (review-loop
convergence, hermetic option forwarding) need their own triggers. The
186-commit backlog is still unpublished; publication is a separate,
user-authorized step.

LOOP PAUSED
