# AAR — R6 `manage_kb` action-contract remediation

**Status:** complete · **Date:** 2026-11-10 · **Loop:** `LOOP PAUSED`
**Plan:** `plan.md` (standard; cold pass 1 FAILED with 2 Blockers + 3 Majors, diff re-review passed; stamp `d739c6f2…5262a`, cold report `4b5eceb4…2727`)
**Predecessor:** M1 close, `ad56707`. R7 was the last chunk before remediation began.
**Roadmap:** `ROADMAP.md` § R6 `manage_kb` action-contract remediation — retired on close.

## What happened

1. **Baseline.** `npm run check` PASS (full, 22 gates, 52.1 s) at `ad56707`, tree
   clean; 27 roadmap items, version 2026.11.7.
2. **Probes.** `check-intent-citations` clean (141 citations, 0 findings), the
   sibling REQs reviewed, and the serialized schema probed: `max_results` carries
   `default 8 / minimum 1 / maximum 50`, so the schema test asserts bounds.
3. **Tests and harness first.** `startServer` gained a `configLayer(tmpDir)`
   hook (shallow merge over the harness default); `src/tool-surface.test.ts`
   gained the `manage_kb` max-results contract; `src/kb.test.ts` gained
   `resolveTextIdentity` unit tests; new Arena file
   `debate-club/src/kb-contract.test.ts` carries seven handler-level tests.
4. **Fail-first.** With the harness in place and the source untouched, the three
   A-2 identity legs failed and the four A-1/A-3 legs passed — exactly the
   regression the finding describes. `src/kb.test.ts` failed with
   `TypeError: resolveTextIdentity is not a function`.
5. **Fix.** `slugify` now takes a fallback; `resolveTextIdentity(title,
   providedUrl?)` emits `text://<slug>` with a `note` fallback; ingest resolves
   one identity (`url` → `source_url` → synthesized) instead of overwriting it.
6. **Close.** CHANGELOG entry, roadmap section retired (27 → 26 work items),
   F-R6-A-1/2/3 marked `Resolved`, this increment record written.

## What went right

- The cold pass caught two real execution blockers before any edit: an
  unachievable remediation assertion and a fail-first run that would have proved
  the harness, not the behavior. Both were fixed in the plan, and the fail-first
  evidence is now meaningful.
- The schema probe replaced an assumption (bounds survive zod→JSON Schema) with
  evidence before the test was written.
- The new Arena file isolates the KB contract tests from the 600-line
  `mcp-contract.test.ts` and its shared server.

## What went wrong

- **Plan predicted the wrong failure mode.** Step 1.5 expected `src/kb.test.ts`
  to fail at module load; ESM live bindings let the import resolve and the call
  fail instead (`TypeError: resolveTextIdentity is not a function`). The
  regression evidence is unaffected; the prediction was imprecise.
- **First check:fast run failed on the missing AAR** — expected while the
  increment record was still being written, but it means the gate sequence is
  "write the AAR, then rerun" and the failure is noise in the log.

## Findings

| ID | Disposition | Evidence |
|---|---|---|
| F-R6-A-1 | `Resolved` | `src/tool-surface.test.ts` (schema), Arena `kb-contract.test.ts` (cap, unconfigured, unopenable) |
| F-R6-A-2 | `Resolved` | `src/index.ts` identity resolution; `src/kb.ts` `resolveTextIdentity`; 3 Arena identity legs fail pre-fix, pass after |
| F-R6-A-3 | `Resolved` | 3 Arena refusal legs, each asserting no write |

Conditions from plan review:

- **C-1 (shallow merge drops default `kb` sub-keys)** — verified harmless: the
  two non-default servers are `kb: null` and an unopenable path, neither of which
  auto-indexes; no action needed.
- **C-2 (minimal receipt shape)** — `normalizeReceiptInput` requires a non-empty
  `claims` array; the report leg uses one claim, and verification passes.

## Verification

- `npm run typecheck` → 0.
- `npx tsc -p debate-club/tsconfig.json` → 0.
- `src/kb.test.ts` + `src/tool-surface.test.ts` → 31 passed.
- New Arena file → 7 passed; full Arena → 4 files / 44 tests passed.
- `npm run check:fast` → PASS (fast, 23.2 s).
- `npm run check` (full) → PASS (full, 22 gates, 58.8 s) on the final tree.

## Next

Remaining R6 remediation sections (action-evidence, auto-index/scoping/expiry,
config/dedup/report, retrieval, encryption/capacity, ledger/receipt) stay
scheduled. No new action item is opened by this increment.

LOOP PAUSED
