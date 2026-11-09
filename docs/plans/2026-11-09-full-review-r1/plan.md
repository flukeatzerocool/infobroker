# Plan — Full-review sweep, chunk R1 (contracts and envelope)

**Status:** conditions applied after cold pass 2 (0 blockers, 2 majors, 6 minors) · **Date:** 2026-11-09 · **Depth:** standard
**Review independence:** fresh cold pass at `/tmp/opencode/r1-independent-review-2.md`, sha256 `ad2f9e58…`, stages 4/5; its two majors are applied and `build-review` verifies each condition before execution.
**Rollback cost:** 1 — review-only unless a P0 is fixed; the close also writes docs and commits.
**Roadmap item:** `ROADMAP.md` § Full-repository review sweep
**Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md`
**Predecessor:** program scaffold, commit `64ea04b`, `LOOP OPEN`.

## Done bar

**Done bar:** chunk R1 is closed when all six §4.1 REQs and the R1-owned prose (§3 SR-009, §6.1–6.2) carry a verdict; every finding has a `file:line` or `spec:line` predicate, a P-severity, and a terminal disposition; zero P0 is open; the finding table is written to `worklist.md` and the AAR; the worklist R1 surface matches the reviewed files; if any P1 is scheduled, `ROADMAP.md` carries a remediation section for it; its sweep trigger names R2; and `npm run check` exits 0 on the final tree after a final `npm run check:fast`.

## Scope

**In scope.** The shared response and error contract: the `[OK]`/`[ERROR]` text envelope, `structuredContent` attachment, the error taxonomy and remediation, result normalization, truncation and its `output_path`, minimum-viable-result discard, compact verbosity, and the §6.1/§6.2 naming and envelope conventions.

**Out of scope.** Per-tool behavior reviewed in R2–R9 except where it is the evidence for an R1 contract; publication; any redesign. A P0 fix is in scope; a P1 is scheduled.

## Decisions

- **D6 — Fix policy.** P0 fixed in-session with a hard bound: at most 2 source files (the regression test file counts as one) and 100 changed lines, one attempt; if the fix exceeds that or the regression test cannot be made green, stop and land `LOOP OPEN`. P1 scheduled on `ROADMAP.md`; P2 fixed only on a demonstrated failure; P3 record-and-close.
- **D7 — Increment record.** `docs/plans/2026-11-09-full-review-r1/` carries this plan, `tasks.md`, and `aar.md`; the worklist carries the R1 verdict table.
- **D8 — Boundary.** R1 owns the shared contract helpers and the envelope assembly. Per-tool response shaping is recorded here only when it violates an R1 REQ; otherwise it is `deferred:<chunk>`. The §1 goals and the §3 invariants outside SR-009 are owned per the prose-ownership table in `worklist.md` (D11), so a prose defect is filed once.
- **D9 — Citation resolution.** Classify `_Check:_` kind first. `REQ-001`/`REQ-002` are G0; `REQ-003`/`REQ-004`/`REQ-073`/`REQ-079` are G1. For G0, verify the conformance surface itself — `tools/list`, the registered `outputSchema`, and a live stdio envelope — not merely a test file that names the REQ. For G1, the cited test must exercise the stated behavior, not just name the REQ.
- **D10 — No push.** Publication stays user-authorized.

## Evidence base (this session)

| # | Evidence | Source | Trust |
|---|---|---|---|
| EV1 | Baseline green at `64ea04b`: `npm run check` PASS, 22 gates, 105 test files / 1087 tests; tree clean | tool output, 2026-11-09 | tool-output |
| EV2 | Six REQs in §4.1: REQ-001, 002, 003, 004, 073, 079; §1 and §3 invariants and §6.1–6.2 are the prose side | `infobroker.md` | repo |
| EV3 | Citation coverage: `REQ-001` `structured-output.test.ts`, `REQ-002` `error-envelope.test.ts` (`rate-limited-precedence`), `REQ-003`/`REQ-073` `normalizer.test.ts`, `REQ-004` `truncate.test.ts`, `REQ-079` `verbosity.test.ts` | `src/**/*.test.ts` | repo |
| EV4 | Surface: `src/index.ts` envelope assembly and 7 tool registrations, `src/error-envelope.ts`, `src/output-schema.ts`, `src/structured-output.ts`, `src/truncate.ts`, `src/verbosity.ts`, `src/normalizer.ts`, `src/types.ts` | `wc -l`, `grep -n` | repo |
| EV5 | All seven tools register `outputSchema: envelopeOutputSchema`; `instrumentTool` finalizes every handler result with `structuredContent` | `src/index.ts:1672`, `:1721`–`:2485` | repo |

## Review surface

| Cluster | Files | REQs | Carrying gates/tests |
|---|---|---|---|
| A — Envelope and structured output | `index.ts` `ok()`, `instrumentTool`, `finalizeToolResult`; `output-schema.ts`; `structured-output.ts` | REQ-001 | `structured-output.test.ts`, `check-pack`, debate-club |
| B — Error taxonomy | `error-envelope.ts`, `types.ts`, error call sites | REQ-002 | `error-envelope.test.ts`; branches: nine-code taxonomy, `access_blocked` with cause, `network_error`, `internal_error`, `rate_limited` precedence, remediation text |
| C — Normalization and minimum result | `normalizer.ts`; the `search_web` suggest/expand return paths in `index.ts` | REQ-003, REQ-073 | `normalizer.test.ts`, live suggest/expand paths |
| D — Truncation | `truncate.ts` and every `truncated`/`output_path` call site | REQ-004 | `truncate.test.ts` |
| E — Verbosity | `verbosity.ts`, `ok()`, compact call sites across all seven tools | REQ-079 | `verbosity.test.ts` |
| F — Naming and envelope prose | tool registrations, §6.1/§6.2 | §3 SR-009, §6.1–6.2 | `check-tdqs`, `check-intent-citations` |

## Steps

### Phase 0 — Baseline

1. Re-run `npm run check:fast` un-piped and record the exit status; run the named contract tests.
2. Record `git status --porcelain` and `git rev-parse --short HEAD`.

### Phase 1 — Enumerate

1. Record `file:line` anchors for each cluster in A–F.
2. Confirm the six REQ rows and the R1 code surface. The worklist already lists `src/normalizer.ts` and the `search_web` suggest/expand return paths; confirm they are present and record any drift.

### Phase 2 — Review (read-only)

1. Run `code-review` cluster by cluster and `drift-report` over the §6.1–§6.2 prose.
2. Open every cited test and check its assertion against the REQ text.
3. For each REQ, record `holds` or `finding:<ID>` with a predicate. For REQ-003, record the provider-mapping sampling basis: one provider per normalization override (`wikipedia`, `wikidata`, `internet_archive`), one generic-HTTP mapping, and one scholarly provider; an unexercised provider is recorded as a finding or `deferred:<chunk>`. For REQ-079, check the action-required-notice retention branch. For REQ-073, the title-only exemption is evidenced by the live suggest/expand paths, not a unit test.
4. Check the gate assertion against the REQ it claims to carry; a green gate asserting a narrower claim is a finding.
5. **Cross-tool envelope check.** Two passes, both read-only:
   - **Static.** Enumerate every handler return path under the seven `instrumentTool` registrations. Each must return `[OK] ` or `[ERROR] ` text, or provide `structuredContent`; a bare-text path is a REQ-001 finding.
   - **Live.** Call each tool through the stdio harness with a non-mutating argument set, and assert `structuredContent` deep-equals `parseEnvelopeObject(content[0].text)`. Restrict `provider !== "none"` to `status === "ok"` non-raw envelopes; an `[ERROR]` envelope legitimately uses `none`.

| Tool | Invocation | State/network |
|---|---|---|
| `inspect_providers` | `{ action: "list" }` | local |
| `manage_kb` | `{ action: "stats" }` | local, non-mutating |
| `reload_config` | `{}` | local, re-reads config |
| `search_web` | `{ query: "test", max_results: 1 }` | may return `[ERROR]`; envelope still checked |
| `fetch_page` | `{ url: "https://example.com" }` | may return `[ERROR]`; envelope still checked |
| `verify_claims` | `{ query: "test", max_iterations: 1 }` | may return `[ERROR]`; envelope still checked |
| `get_citations` | `{ query: "test", max_results: 1 }` | may return `[ERROR]`; envelope still checked |

6. Cross-check §3 SR-009 and the §6.1–§6.2 prose; record a prose verdict row (surface, verdict, predicate) alongside the REQ rows.

### Phase 3 — Disposition and close

1. P0 fix with a regression test; otherwise record the P1/P2/P3 disposition.
2. Write the verdict table to `worklist.md`; write the AAR and advance the roadmap trigger to R2.
3. Run `npm run check:fast` as the session gate, then `npm run check` as the recorded exit evidence. Then `npm run session:close` (which re-runs `check:fast`); split commits after the final tree is green. Record the full `npm run check` exit status, not the duplicate fast run.

## Risks

- The `_Check:_` G0/G1 split means a missing test is not automatically a finding for a G0 REQ; check `tools/list`, the output schema, and a live stdio envelope first.
- `finalizeToolResult` can synthesize an `ok` envelope for non-envelope text. Treat that as a fallback, not proof that every handler returns an envelope; the cross-tool check is the guard.
- A per-tool defect found here belongs to that tool's chunk unless it violates an R1 REQ.
- `src/truncate.ts` is shared with R4 and `src/structured-fact.ts` with R4/R5. In R1, review only the truncation contract; call-site behavior belongs to the owning chunk.
