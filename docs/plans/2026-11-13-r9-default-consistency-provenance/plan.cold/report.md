# Cold pass 1 — independent review of plan revision 1

**Reviewer:** review subagent (`ses_e28cace5fffeErqdmAXFSaZjQL`), cold: no authoring
history, no transcript, no prior findings.
**Plan sha256:** `d6df75b0913563f651777e4b31c9c2c68a60a6195b1f057215f8bc768dbf4de2`
(revision 1)
**Depth:** standard · **Reads:** 40/40

**Stage-isolation disclosure:** dispatched as a child session; stages 1, 2, 3
and 5 ran sequentially in one cold context rather than five fresh contexts.
Independence from the author is intact; per-stage context isolation did not
occur. Stage 4 was not needed (no edits).

## Verdict

`independent-review FAILED.` — 2 blockers, 6 majors, 4 nits.
Comprehension: faithful-with-gaps.

## Blockers

1. **[design] The encoder import names the wrong SDK module.**
   `zod-compat.d.ts:59` exports `normalizeObjectSchema` only;
   `toJsonSchemaCompat` lives in `zod-json-schema-compat.d.ts:8` and is imported
   there by `mcp.js:3`. Both subpaths are reachable under the `"./*"` export.
   The options block `{strictUnions: true, pipeStrategy: "input"}` matches
   `mcp.js:118-121`.
2. **[clarity] The done bar requires F-R9-C-3a "Resolved … in the sweep
   register", but no such row exists** and C4 said "four finding rows" against
   three (`worklist.md:887-889`). Resolve by adding a row or dropping the clause.

## Majors

3. **[design] C1 edits a REQ body but never names the README**, which
   `scripts/push-pipeline.sh:1066-1073` gates on the same diff; `README.md` has
   no `50k`/`50000` text today.
4. **[clarity] The done bar overstates the footprint assertion** — every tool
   advertises an `outputSchema` (`mcp-contract.test.ts:105-112`), so
   "byte-equals the `tools/list` schemas" cannot hold for an input-only sum.
5. **[design] `advertisedSchemaBytes` over `_registeredTools` skips the list
   handler's `.filter(([, tool]) => tool.enabled)`** (`mcp.js:108-110`).
6. **[design] The REQ-080 fix leaves REQ-080 overclaiming** — the static gate
   would still not fail on a literal/enum divergence while the REQ says
   "Every … SHALL" with `_Check:_ G3`.
7. **[design] The median assertion assumes a set equality the plan does not
   establish**: `json()` pushes every body into one global 100-entry window,
   while the expected value came from Arena records; the correspondence is
   unproven.
8. **[design] Baseline is weaker than the done bar**: only `check:fast` was
   recorded, and `test-debate-club` — the suite C2 rewrites — was never run.

## Nits

9. Dangling `§12`/`§13` references.
10. Drifted anchors: C.4 is `:1746`; the tool-block split is
    `validate-spec.ts:1078`; the footprint loop is `index.ts:1733-1740`.
11. New `scripts/lib/` module obligations (script-discipline header,
    `tsconfig.scripts.json`) unstated.
12. Findings-register counts lack their enumeration basis.

## Unknowns

- The 261-byte probe was not reproducible without running Node; the
  substantive claim stands on `index.ts:1734-1738`.
- `worklist.md:604` M1-closed anchor and the 186-unpushed / `v2026.11.07`
  figures were not re-verified.
- Whether §4 contains exactly seven numeric declarations was not enumerated.
- Whether any Arena response in the window is truncated or bypasses `json()`.
- Whether a fourth config↔tool pair exists beyond the four enumerated.
