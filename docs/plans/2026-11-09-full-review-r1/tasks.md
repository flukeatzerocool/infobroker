# Tasks — chunk R1 (contracts and envelope)

## Phase 0 — Baseline

- [x] Record baseline: tree clean at `64ea04b`, `npm run check` PASS, 22 gates, 1087 tests.
- [x] Re-run the named contract tests: 33/33 PASS.
- [x] Record the cold plan review outcome and the applied conditions.

## Phase 1 — Enumerate

- [x] Envelope and structured-output anchors (`ok()`, `instrumentTool`, `finalizeToolResult`, `output-schema`, `structured-output`).
- [x] Error-taxonomy anchors (`err`, `chainExhaustion`, error call sites, `types.ts`).
- [x] Normalization and minimum-result anchors (`normalizer.ts`, suggest/expand paths).
- [x] Truncation anchors (`truncate.ts`, every `truncated`/`output_path` call site).
- [x] Verbosity anchors (`verbosity.ts`, compact call sites across all seven tools).
- [x] Naming/envelope prose anchors (§6.1 tool names, §6.2 example).

## Phase 2 — Review

- [x] REQ-001 verdict with the live cross-tool envelope check.
- [x] REQ-002 verdict with the error-code list and remediation check.
- [x] REQ-003 verdict with the provider-mapping sampling basis.
- [x] REQ-004 verdict with every truncation path.
- [x] REQ-073 verdict with the max-results budget check and the suggest/expand exemption.
- [x] REQ-079 verdict across all seven tools and the notices branch.
- [x] §3 SR-009, §6.1, §6.2 prose verdicts.

## Phase 3 — Disposition and close

- [x] Disposition every finding (three P1, `Scheduled-roadmap`).
- [x] Write the R1 verdict table and finding register to `worklist.md`.
- [x] Add the R1 remediation roadmap section; advance the sweep trigger to R2.
- [x] Write `aar.md` with the terminal token.
- [x] `npm run check:fast` and `npm run check` exit 0.
- [ ] Split commit; `npm run session:close`.
