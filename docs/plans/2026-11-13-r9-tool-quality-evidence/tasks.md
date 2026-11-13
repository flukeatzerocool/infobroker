# Tasks — R9 tool-quality reporting and evidence

Terminal state is recorded in `aar.md`; this file carries the per-step
transcript. Each step records its evidence as `<command> → <result>`.

- [x] T0 — scaffold `plan.md`, `tasks.md`, `aar.md` (LOOP OPEN), `evidence/`.
- [x] T1 — baseline recorded.
- [x] T2 — plan gate: stamp, preflight, self pass, cold pass 1, diff re-review, revision 3.
- [x] T3 — REQ-106 report sentence narrowed; `buildQualityReport` + `conformanceViolations` added; `check-tdqs` consumes them.
- [x] T4 — `tdqs` tests added; red-before 2 failed, green after 14 passed.
- [x] T5 — `validate-spec`, `typecheck`, `typecheck:scripts`, `check-script-discipline`, `check-tdqs` green; commit 1.
- [x] T6 — disclosure matrix added to `tool-surface.test.ts`; red-before 1 failed.
- [x] T7 — `verify_claims` and `manage_kb` description sentences added; test green; probe gaps 0; commit 2.
- [x] T8 — `worklist.md` rows resolved; `ROADMAP.md` section removed; `DECISIONS.md` D-115; `CHANGELOG.md`; commit 3.
- [x] T9 — `aar.md` dispositions + terminal token; `tasks.md` transcript; `check-loop-artifacts`.
- [x] T10 — `npm run check:fast` on the tree.
- [x] T11 — full `npm run check`.

## Disclosure matrix (7 × 5)

Class applicability is decided from tool behavior, never from the description
under test (D-115). `n/a` cells carry the justification recorded here and in
`src/tool-surface.test.ts`.

| tool | stored | external | rate-limit | auth | destructive |
|---|---|---|---|---|---|
| search_web | caches results in the KB | dispatches every provider | per-provider throttle | keyed providers need configured keys | n/a — no irreversible action |
| fetch_page | fetched pages auto-index into the KB | renderer chain makes outbound calls | renderer/provider throttle | Jina key optional, configured keys change coverage | n/a — no irreversible action |
| inspect_providers | n/a — read-only, no persisted write | health action probes a provider | health is subject to provider limits; quota is reported | n/a — takes no credential, reports provider credential state | n/a — no irreversible action |
| verify_claims | findings are written back to the KB | dispatches every provider | per-provider limits apply | keyed providers need configured keys (gap, now closed) | n/a — no irreversible action |
| manage_kb | ingest, delete, and stats touch the store | URL ingest dispatches the fetch chain | URL ingest consumes chain quota (gap, now closed) | URL ingest uses the chain's configured keys (gap, now closed) | delete is irreversible and cannot be undone |
| reload_config | writes config.local.json | n/a — local file I/O only | n/a — no provider dispatch | n/a — no provider dispatch | rewrites the user config layer |
| get_citations | n/a — writes nothing | queries academic providers | provider throttle applies | keyed providers need configured keys | n/a — no irreversible action |

## Transcript

- **T1 baseline** — `npm run status` → 2026.11.11 (tag v2026.11.07), 182
  unpushed, oldest 4.0 d, 4 roadmap items. `npm run check:fast` → PASS (19/19
  gates, 28.2 s). Pre-change targeted baseline: `typecheck` → 0; `vitest
  src/tdqs.test.ts` → 12 passed; `check-tdqs --report` → 0 violations; tree
  clean except this increment's directory.
- **T2 plan gate** — artifact sha `b5bc9fde…` (revision 3); preflight → 10
  targets, 0 missing, 0 untracked, 3 REQ ids resolved, HEAD `27abc6c`. Cold
  pass 1 → `independent-review FAILED.` (2 blockers, 8 majors, 5 nits): the
  contradiction detector was vacuous because the mandatory "Do NOT use" phrase
  satisfies `NEGATIONS`, and the done bar cited a nonexistent fixture suite.
  Diff re-review → `independent-review FAILED.` on one new clarity major (a
  DECISIONS fragment swap); all prior blockers and majors resolved. Revision 3
  applies the last fix; the re-review cap forbade a third pass, and the user
  recorded `risk accepted: no cold pass — authorized by fluke`.
- **T3/T4 report + gate** — `infobroker.md:382`: "The server SHALL report" →
  "The conformance gate SHALL report" (671 → 681 chars, 4 sentences, 5 SHALLs,
  0 backticks). `buildQualityReport` emits `paramCount`/`requiredParamCount`;
  `annotationContradictionCandidates` is sentence-scoped and skips the
  guidance sentence; `conformanceViolations` folds it into `violations`.
  Red-before: `git stash push src/tdqs.ts scripts/check-tdqs.ts` → `vitest
  src/tdqs.test.ts` → **2 failed | 12 passed** (report metrics and
  contradiction tests). Green after: **14 passed**.
- **T5 gates** — `validate-spec` → All checks passed; `typecheck` → 0;
  `typecheck:scripts` → 0; `check-script-discipline` → 76 TS + 9 shell
  conform; `check-tdqs` → exit 0, `7 tool(s); 0 shadow candidate(s); 0
  contradiction(s); 0 violation(s)`, report states `paramCount: 18` /
  `requiredParamCount: 1` for `search_web`. Commit 1 `374f16e`.
- **T6/T7 disclosure** — matrix added to `src/tool-surface.test.ts`; red-before
  → `vitest src/tool-surface.test.ts` → **1 failed | 4 passed**
  (`infobroker_verify_claims must disclose auth`), with the evidence probe
  enumerating all three gaps. Two description sentences added (`verify_claims`
  auth; `manage_kb` URL-ingest chain quota/limits/keys), README gains one
  sentence, CHANGELOG gains the bullet. Green after: **5 passed**; probe
  `gaps: 0`. Gates: `validate-spec` pass, `validate-readme` 0/0,
  `check-intent-citations` 172 citations 0 findings, `check-tdqs` exit 0,
  `typecheck` 0. Commit 2 `ab26caa`.
- **T8 records** — `ROADMAP.md` section removed (3 items remain);
  `worklist.md` rows 532/534/535/536 and 883-885 resolved;
  `DECISIONS.md` D-115 added and the D-106-era gate sentence corrected.
  Gates: `check-roadmap` OK (4 sections), `check-non-goals` OK, `validate-spec`
  pass, `check-gate-coverage` 118 G1 REQs / 117 cited / 1 exempt / 0 waived.
  Commit 3 `0c9552c`.
- **T9/T10** — `check-loop-artifacts` PASS; `npm run check:fast` PASS.
- **T11** — full `npm run check` on the committed tree.
