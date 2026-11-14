# Tasks — R9 default consistency and provenance enforcement

Plan: `plan.md` (revision 2; cold pass 1 FAILED, reports in `plan.cold/`).
Done bar: `plan.md` §Done bar.

## T0 — baseline

- [x] `npm run status` → 2026.11.11, tag `v2026.11.07`, 186 unpushed, 3 roadmap items
- [x] `npm run check:fast` → PASS 19/19, 32.5 s (before this directory existed)
- [x] Probes: numeric-fallback regex 0 hits; 20 schema defaults, 10 §4 declarations
      (15 parameters); Zod raw-shape serialization is internals; 4 config pairs equal;
      SDK encoder and `enabled` filter anchors confirmed

## T0b — pre-edit probes (before any edit)

- [x] `npm run test-debate-club` → green, so C2's red-before is attributable
- [x] Record `audit` and `check-pack` as unrun (registry/network)

## T1 — C1 default consistency gate (F-R9-C-2)

- [x] `infobroker.md:268` `max_length` default written as `50000`
- [x] `README.md:255-270` names the `max_length` truncation default (non-whitespace)
- [x] `scripts/lib/tool-defaults.ts`: `DECLARED_DEFAULTS` (10 declarations / 15 params),
      `CONFIG_LIMIT_PAIRS` (4), `reconcile`, `unreconciledSpecDefaults`, `schemaParam`;
      script-discipline header names its role and exit codes
- [x] `scripts/validate-spec.ts:1030-1066` calls the module; block A walks `src/**/*.ts`
- [x] `scripts/lib/tool-defaults.test.ts`: 7 fixtures (match, numeric mismatch, literal
      mismatch, unclaimed declaration, unclaimed `(each default …)`, config mismatch,
      claimed-but-undeclared param)
- [x] Red-before via `git stash`; green after
- [x] Gate dry-run on the shipped tree → 0 findings
- [x] Gates: `npx tsx scripts/validate-spec.ts`, `npm run typecheck:scripts`, `npm run typecheck`

## T2 — C2 token footprint derivation (F-R9-C-3, F-R9-C-3a)

- [x] `src/tool-footprint.ts` (`@implements REQ-081`): `advertisedSchemaBytes`
      (input + output schemas, `enabled` filter honoured), `medianOfWindow`
- [x] `src/index.ts:1722-1760` `doSpecHealth` uses the helpers
- [x] `debate-club/src/client.ts` `listToolDefs` type carries `inputSchema`/`outputSchema`
- [x] Arena: byte-equality against `tools/list` (input + output); fresh-server median
      over five recorded bodies; token = ceil(bytes/4)
- [x] `src/tool-footprint.test.ts`: median odd/even/eviction; disabled tool excluded;
      two surfaces → two totals
- [x] Red-before: byte-equality fails on the pre-change tree
- [x] Gates: `npm run test-debate-club`, `npm run typecheck`,
      `npx vitest run src/tool-footprint.test.ts`

## T3 — C3 Appendix C carrier map (F-R9-D-1)

- [x] Preamble `infobroker.md:1726` names a carrier per rule
- [x] C.4 `:1746` / C.9 `:1787` / C.10 `:1798` carry their carrier sentence
- [x] §9.4 `:1170` narrowed to G3-carried Appendix C rules
- [x] `DECISIONS.md` D-116 records the adjudication and the REQ-080 scope
- [x] Gate: `npm run validate-spec`; grep finds no universal-G3 claim

## T4 — docs and close

- [x] `CHANGELOG.md` entry per behavioral commit (C1, C2, C3)
- [x] `ROADMAP.md:17-22` removed
- [x] `worklist.md:887-889` → `Resolved`; one row added for F-R9-C-3a
- [x] `aar.md` written with gate evidence and terminal token
- [x] Gate: `npm run check` full PASS
- [x] Commits split spec/gate → source+tests → docs → release

## Verification ledger

| Step | Command | Result |
|---|---|---|
| T0 baseline | `npm run check:fast` | PASS 19/19, 32.5 s |
| T0b | `npm run test-debate-club` | PASS |
| T1 | `npx vitest run scripts/lib/tool-defaults.test.ts` | PASS |
| T1 | `npx tsx scripts/validate-spec.ts` | PASS |
| T2 | `npm run test-debate-club` | PASS |
| T3 | `npm run validate-spec` | PASS |
| T4 | `npm run check` | PASS |
