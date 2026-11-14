# Cold pass 2 — capped diff re-review of plan revision 2

**Reviewer:** the same cold-review session (`ses_e28cace5fffeErqdmAXFSaZjQL`),
reviewing only added or changed lines. Prior findings from `report.md` are
settled; unchanged-text issues would be `Deferred`.
Plan sha256: 86b0401ce7e9dca4355e2691e1be3b6f993fa95e9954964fc114f096a64dc199
**Reviewed revision:** 2 (`a65f9759…`). Revision 3 applies this report's 1 new
major and 3 nits and adds a documentation-only scope amendment (plan
§Amendments); no new file, gate, or destructive step. Under the standard
re-review cap those edits are verified by build-review, and this bind line
names the amended plan. **Reads:** 5/10 · **Stage:** diff re-review

## Verdict

```
independent-review passed. plan.md — diff re-review, 0 new blockers
Blockers: 0 (revision-1 blockers 1 and 2 verified resolved) · New Majors: 1 · Nits: 3
```

## Changed-claim verification

| Changed claim | Verdict | Evidence |
|---|---|---|
| `normalizeObjectSchema` in `server/zod-compat.js`; `toJsonSchemaCompat` in `server/zod-json-schema-compat.js` | Confirmed | `zod-compat.d.ts:59`; `zod-json-schema-compat.d.ts:8`; `mcp.js:3` |
| input `pipeStrategy:"input"`, output `"output"` | Confirmed | `mcp.js:118-121`, `:130-135` |
| Output schemas are advertised for all seven tools | Confirmed | `mcp-contract.test.ts:105-112` |
| List handler filters `.filter(([, tool]) => tool.enabled)` | Confirmed | `mcp.js:108-110` |
| README fetch section can truthfully name the truncation default | Confirmed | `README.md:255-270` describes the fetch surface and never states `max_length`; `index.ts:1920` |
| Fresh server: five recorded bodies + spec as sixth ⇒ exact window membership | Confirmed | `json()` is first called from a handler (`index.ts:269`); startup uses `console.error` only; `responseBytes` starts empty (`:88,158-163`), window 100, odd count ⇒ integer median, computed before the sixth push |
| `(each default false)` representable as one entry | Confirmed | `infobroker.md:238` names six flags; schema defaults all `false` (`index.ts:1864-1869`) |
| `tsconfig.scripts.json` includes `scripts/**/*.ts` | Confirmed | `tsconfig.scripts.json:17` |
| Revision-1 fixes internally consistent | Confirmed | done bar ↔ C4 ↔ blast radius; input+output, `enabled`, README, T0b |

## New findings (changed lines only)

1. **[Major|design] The completeness scanner cannot see `(each default …)`
   clauses.** A scanner anchored on `(default ` would not discover the tenth
   declaration, leaving a future `(each default true)` invisible while REQ-080
   says "Every … SHALL". Applied in revision 3: the scanner matches both forms
   and C1.5 adds an unclaimed-`(each default true)` fixture.
2. **[Nit] `plan:17-18` called full `npm run check` a T0b pre-edit probe**,
   which cannot run there (network gates). Applied.
3. **[Nit] The README risk fallback implied an AAR note satisfies the pipeline
   guard.** Applied: the fallback is to surface the blocker.
4. **[Nit] The lib-module header was asked to name exit codes**, which
   `scripts/lib/` modules do not have. Applied: role and purpose.

## Done-bar achievability

Yes, as revised. The revision-1 contradictions are gone; the one new major
concerned future multi-parameter detection, not the current tree's
zero-findings bar, and is resolved in revision 3.

## Unknowns

- T0b's `test-debate-club` result is a probe, not yet observed.
- `plan.cold/report.md` existence and hash are the parent's to confirm.
