# Plan — R9 default consistency and provenance enforcement

**Status:** revision 3 (cold pass 1 FAILED: 2 blockers, 6 majors, 4 nits; all
applied in revision 2; the capped diff re-review passed with 0 new blockers,
1 new major and 3 nits, all applied here) · **Date:** 2026-11-13 · **Depth:** standard
**Review independence:** self; cold pass 1 reviewed revision 1
(`independent-review FAILED.`, `plan.cold/report.md`), and the capped diff
re-review verified revision 2 (`independent-review passed.`,
`plan.cold/report-diff.md`). The standard re-review cap forbids a second full
cold pass, so revision 3's four changed paragraphs are verified by
build-review rather than a third independent read.
**Rollback cost:** 1 on the plan-review skill's 0–2 scale (reversible edits).
C1 and C3 revert independently as documentation/gate changes. C2 changes one
reported number's derivation, so it is the only commit with a behavior change;
it reverts alone.
**Roadmap item:** `ROADMAP.md:17-22` § R9 default-consistency and provenance
enforcement; removed when this increment closes.
**Predecessor:** version `2026.11.11` (latest tag `v2026.11.07`); `HEAD`
`03255db`; `npm run status` → 186 unpushed commits, 3 open roadmap items;
`npm run check:fast` PASS (19/19 gates, 32.5 s) with a clean tree before this
directory existed. `npm run test-debate-club` has not been run this session and
is the pre-edit probe in T0b; the network-dependent gates (`audit`,
`check-pack`) are recorded unrun rather than folded into that probe.
**Closes:** F-R9-C-2, F-R9-C-3, F-R9-D-1 (`worklist.md:887-889`), plus
F-R9-C-3a, discovered at plan time and added as a new sweep-register row.

**Done bar:** `npm run check` PASS on the final tree, including
`validate-spec`, `test`, `test-debate-club`, and `typecheck:scripts`; the new
REQ-080 gate reports zero findings on the shipped tree and its unit fixtures
prove it fails on each seeded divergence class (numeric, literal, config pair,
unclaimed declaration); the Arena asserts `tool_schema_bytes` byte-equals the
client-observed `tools/list` input **and** output schemas and
`median_response_bytes` equals the median of a fresh server's observed
response bodies; Appendix C names a carrier for every rule and no text still
claims universal G3 enforcement; F-R9-C-2, F-R9-C-3, and F-R9-D-1 are
`Resolved` in the sweep register, F-R9-C-3a is added there as `Resolved`, and
all four are `Resolved` in the AAR; the roadmap section is removed; each
behavioral commit carries a CHANGELOG entry and a non-whitespace README update
where the push pipeline's spec→README guard requires one.

## Why this item

`ROADMAP.md:17-22` is the first open section in file order, and file order
selects it. Its trigger — "start after chunk M1 closes" — is satisfied: the
sweep board records M1 closed 2026-11-10
(`docs/plans/2026-11-09-full-review-sweep/worklist.md:604`). The other two
open sections stay open: review-loop convergence needs a future multi-finding
increment, and hermetic option forwarding needs a future harness change.

- **F-R9-C-2 — REQ-080 reconciles two of its own defaults.** The G3 check in
  `scripts/validate-spec.ts:1030-1066` scans a numeric-fallback regex over four
  hardcoded files (block A) and reconciles exactly two defaults — `search_web`
  and `manage_kb` `max_results` (block B). Of the 10 default declarations §4
  makes, 2 are reconciled. `fetch_page.max_length` (`src/index.ts:1920`),
  `verify_claims.max_iterations` and `confidence_threshold`
  (`src/index.ts:2012-2013`), `get_citations.max_results`
  (`src/index.ts:2644`), `search_web.page` (`src/index.ts:1862`), and the
  literal/enum declarations (`safe_search`, `content_type`, and the six
  `false` flags, `infobroker.md:238`) are unchecked. No config-vs-tool limit
  pair is reconciled although REQ-080 (`infobroker.md:541`) requires both
  directions.
- **F-R9-C-3 — the "derived … rather than static literals" clause is
  unasserted.** `debate-club/src/mcp-contract.test.ts:414-420` checks presence,
  `> 0`, and `>= 0` only, so a hardcoded number would pass.
- **F-R9-C-3a — the report measures the wrong quantity.** `src/index.ts:1733-1740`
  sums `JSON.stringify(inputSchema.shape)`, which serializes Zod internals, not
  the JSON Schema the server advertises. A two-parameter probe shape serializes
  to 261 bytes of `{"def":…,"type":"string"}` structure, so `tool_schema_bytes`
  does not measure "the total size of the advertised tool schemas" as REQ-081
  requires (`infobroker.md:544`).
- **F-R9-D-1 — Appendix C's preamble overstates G3.** `infobroker.md:1726`
  claims "every rule is enforceable by G3 (§9.4)" and `infobroker.md:1170`
  says "Appendix C violations are errors", but `grep -n "Appendix C\|Out of
  scope" scripts/*.ts` returns nothing: C.4 (`:1746`), C.9 (`:1787`), and
  C.10 (`:1798`) have no G3 carrier, and C.7/C.8 have no mechanical carrier
  either. C.10 *is* enforced — by the push pipeline's changelog step
  (`scripts/push-pipeline.sh:921-936,948-976`) — and C.9 by
  `scripts/push-pipeline.sh` plus `npm run test-push-pipeline`. The defect is
  the claim, not the discipline.

## Measured state (this session, before any edit)

| Probe | Result |
|---|---|
| `npm run status` | 2026.11.11, tag `v2026.11.07`, 186 unpushed, 3 roadmap items |
| `npm run check:fast` | PASS 19/19, 32.5 s |
| `grep -rnE "config\.[A-Za-z0-9_.]+ *\?\? *[0-9]" src --include=*.ts` | 0 matches — block A has no violations to fix today, so widening its file set cannot turn the gate red |
| `grep -o "\.default(" src/index.ts` | 20 schema defaults; 15 of them correspond to a §4 declaration (7 numeric, 8 literal) |
| §4 default declarations (`infobroker.md:190-694`) | 10 declarations covering 15 parameters: `(default 8,` ×3, `(default 1)`, `(default 50k chars)`, `(default 5,`, `(default 0.8)`, `(default on)`, `(default all)`, `(each default false)` |
| Zod raw-shape probe (`JSON.stringify` of a 2-param shape) | 261 bytes of Zod internals — confirms F-R9-C-3a |
| SDK encoder split | `normalizeObjectSchema` in `server/zod-compat.d.ts:59`; `toJsonSchemaCompat` in `server/zod-json-schema-compat.d.ts:8`; `mcp.js:118-121` encodes input with `pipeStrategy: "input"`, `:130-135` encodes output with `pipeStrategy: "output"`; the list handler filters `.filter(([, tool]) => tool.enabled)` at `mcp.js:108-110` |
| Config-vs-tool pairs today | `output.max_chars` 50000 ↔ `fetch_page.max_length` 50000; `kb.max_results` 50 ↔ `manage_kb.max_results` max 50; `corroboration.max_iterations` 5 ↔ `verify_claims.max_iterations` 5; `corroboration.confidence_threshold` 0.8 ↔ `verify_claims.confidence_threshold` 0.8 — all equal today |
| `src/index.ts:1145` | `maxLength ?? config.output.max_chars` — the config path is live, but the schema default fills the parameter first, so the pair is a real drift hazard |
| `src/index.ts:158-168` | `json()` pushes `text.length` of the pretty-printed body into a 100-entry window (`:87-88`); the median is computed before the current body is pushed |
| Arena footprint test | `debate-club/src/mcp-contract.test.ts:414-420` — presence and sign only; every tool carries an `outputSchema` (`:105-112`) |
| `scripts/lib/loop-artifacts.ts:63-69` | a directory under `docs/plans/` without `aar.md` is a gate error (execution constraint, see "Execution constraints") |

## Decisions and alternatives

1. **Carrier for REQ-080: a static G3 gate over spec text, schema source, and
   the shipped config (chosen).** REQ-080 declares `_Check:_ G3`, and the
   existing check already reads both layers statically. A live-surface check
   would need a running server in a spec gate. Rejected: extending only the
   live test (`src/tool-surface.test.ts`) — it validates the advertisement
   against hardcoded expectations, not the spec text against the schema source.
2. **The gate covers every §4 declaration, numeric and literal (chosen;
   supersedes revision 1's numeric-only scope).** A declaration entry may claim
   several parameters (`(each default false)` claims six), so the house style's
   multi-parameter clause is representable without a heuristic. Rejected:
   numeric-only — it would leave REQ-080 claiming more than its carrier proves,
   the exact defect C3 exists to correct. Rejected: a general English parser —
   unnecessary once declarations are enumerated.
3. **Completeness direction: spec→schema only (chosen).** An unclaimed
   `(default …)` or `(each default …)` in §4 is an error. A schema default with
   no spec declaration is out of scope: REQ-080 governs declared defaults, and
   requiring a declaration for `crawl`/`extract`/`format` would be four
   speculative REQ edits (see Out of scope and Amendment 1).
4. **Config pairs are declared, not inferred (chosen).** Four pairs are
   enumerated with the config path and the schema field they must equal. An
   inferred pair (matching by parameter name) would mis-pair
   `corroboration.max_iterations` (a loop bound) with unrelated `max_*` keys.
5. **Footprint encoder: the SDK's own advertisement encoder (chosen).** Import
   `normalizeObjectSchema` from `@modelcontextprotocol/sdk/server/zod-compat.js`
   and `toJsonSchemaCompat` from
   `@modelcontextprotocol/sdk/server/zod-json-schema-compat.js` (both reachable
   through the package's `"./*"` export), encoding input with
   `pipeStrategy: "input"` and output with `"output"` — the same calls and
   options `mcp.js:118-135` uses. Rejected: `z.toJSONSchema` with hand-tuned
   options — a second encoder whose output can drift from the advertised one.
   Rejected: asserting the Zod-internal number — it would enshrine a quantity
   REQ-081 does not ask for.
6. **The footprint counts input and output schemas, and honours `enabled`
   (chosen).** REQ-081 says "the total size of the advertised tool schemas", and
   every tool advertises both; the derivation filters `tool.enabled` exactly as
   the list handler does, so the Arena's expected value is the same set.
7. **Appendix C: name the carriers, add no gate (chosen).** A mechanical C.10
   gate (every changed REQ named in the CHANGELOG diff) already exists in the
   push pipeline; duplicating it in `validate-spec` would read git state in a
   spec gate. C.4's carrier is the read-through and code review its own text
   names. C.7/C.8 are review lenses; the preamble will say so.

## Blast radius

| File | Change | Size |
|---|---|---|
| `scripts/lib/tool-defaults.ts` (new) | Declared defaults (10 declarations, 15 parameters), config pairs, reconciliation functions; script-discipline header naming its role and purpose | M |
| `scripts/lib/tool-defaults.test.ts` (new) | Fixture-driven red/green cases | S |
| `scripts/validate-spec.ts` | Replace REQ-080 blocks A/B (`:1030-1066`) with the module; widen block A to `src/**/*.ts` | M |
| `src/tool-footprint.ts` (new) | `advertisedSchemaBytes`, `medianOfWindow`; `@implements REQ-081` | S |
| `src/tool-footprint.test.ts` (new) | Median window/eviction, disabled-tool exclusion, byte derivation changes with input | S |
| `src/index.ts` | `doSpecHealth` (`:1722-1760`) uses the helpers | S |
| `debate-club/src/client.ts` | `listToolDefs` return type carries `inputSchema` and `outputSchema` | S |
| `debate-club/src/mcp-contract.test.ts` | Byte-equality and fresh-server median derivation assertions | M |
| `infobroker.md` | REQ-021 wording (`:268`); Appendix C preamble (`:1726`); carrier lines in C.4 (`:1746`)/C.9 (`:1787`)/C.10 (`:1798`); §9.4 (`:1170`) | M |
| `README.md` | Name the `fetch_page` truncation default in the fetch section (`:255-270`) | S |
| `DECISIONS.md` | D-116: gate scope, config-pair rule, encoder choice, carrier map | S |
| `CHANGELOG.md` | One entry per behavioral commit | S |
| `ROADMAP.md` | Remove `:17-22` | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | Rows 887-889 → `Resolved`; one row added for F-R9-C-3a | S |
| `docs/plans/2026-11-13-r9-default-consistency-provenance/{plan,tasks,aar}.md` | This increment | M |

`scripts/**/*.ts` is already inside `tsconfig.scripts.json`'s `include`, so the
new module is typechecked without a config edit.

## Work breakdown

### C1 — default consistency gate (F-R9-C-2)

**Files:** `scripts/lib/tool-defaults.ts`, `scripts/lib/tool-defaults.test.ts`,
`scripts/validate-spec.ts:1030-1066`, `infobroker.md:268`, `README.md:255-270`,
`CHANGELOG.md`.

1. `infobroker.md:268`: change `max_length` prose from `(default 50k chars)` to
   `(default 50000)`. REQ-021 prose is 774 characters today and the edit
   shortens it, so Appendix B's 800-character limit stays satisfied.
2. `README.md` fetch section: name the truncation default (`max_length`
   defaults to 50,000 characters) — a real content update, not a whitespace
   touch, because `scripts/push-pipeline.sh:1066-1073` fails the run when a REQ
   body changes and the README has no non-whitespace diff.
3. New module exports:
   - `DECLARED_DEFAULTS`: 10 entries `{ tool, params: string[], declaration:
     RegExp }`. The regex captures the declared value (and max, when present),
     in both the `(default <token>` and `(each default <token>` forms; the
     expected value comes from the spec match, never a third hardcoded copy.
     One entry claims several parameters.
   - `CONFIG_LIMIT_PAIRS`: 4 entries `{ configPath, tool, param, field:
     "default" | "maximum" }` per the measured-state table.
   - `reconcile({ spec, schemaSource, config }): string[]` — schema-vs-spec,
     max-vs-spec, and config-pair mismatches. A captured token coerces to
     boolean for `true`/`false`, to number for numeric text, else stays a
     string.
   - `unreconciledSpecDefaults(spec): string[]` — every `(default <token>` **and
     every `(each default <token>`** in §4 that no entry claims; both forms are
     discovered, so a future multi-parameter clause cannot slip past the gate.
   - `schemaParam(schemaSource, tool, param)` — isolates the
     `registerTool`/`instrumentTool` block (the same split the REQ-092 check
     uses at `validate-spec.ts:1078`) and reads `\.default\(`, `\.max\(`,
     `\.min\(`.
4. `validate-spec.ts`: call `reconcile` and `unreconciledSpecDefaults`; widen
   block A's numeric-fallback regex to a recursive `src/**/*.ts` walk excluding
   `*.test.ts` (0 current matches, so no new failures).
5. Tests (red first, via a `git stash` round trip): matching fixture → no
   findings; numeric spec 8 vs schema 10 → finding; literal `(each default
   false)` with one schema flag defaulting true → finding; an unclaimed
   `(default 3)` → finding; **an unclaimed `(each default true)` → finding**
   (discovery, not only reconciliation); a config pair mismatch → finding; a
   declaration claiming a parameter the schema does not default → finding.
6. Dry-run the gate on the shipped tree: expected 0 findings. Any finding is
   resolved in this commit, never deferred.

**Verify:** `npx tsx scripts/validate-spec.ts` exit 0; `npx vitest run
scripts/lib/tool-defaults.test.ts` red-before/green-after; `npm run
typecheck:scripts`.

### C2 — token footprint derivation (F-R9-C-3, F-R9-C-3a)

**Files:** `src/tool-footprint.ts`, `src/tool-footprint.test.ts`,
`src/index.ts:1722-1760`, `debate-club/src/client.ts:33,179`,
`debate-club/src/mcp-contract.test.ts:414-420`, `CHANGELOG.md`.

1. `src/tool-footprint.ts` (`@implements REQ-081`):
   `advertisedSchemaBytes(tools)` sums, for every `enabled` tool, the JSON
   Schema from `normalizeObjectSchema` + `toJsonSchemaCompat` for both input
   (`pipeStrategy: "input"`) and output (`"output"`); `medianOfWindow(values,
   window)` implements the even/odd median and eviction.
2. `src/index.ts`: `doSpecHealth` calls `advertisedSchemaBytes` over
   `_registeredTools`; `medianResponseBytes` delegates to `medianOfWindow` with
   `RESPONSE_WINDOW`.
3. **Byte-equality assertion** (in the existing footprint test, replacing the
   presence/sign checks): `expected = sum(JSON.stringify(t.inputSchema).length
   + JSON.stringify(t.outputSchema).length)` over `server.listToolDefs()`;
   assert `tool_schema_bytes === expected`.
4. **Median assertion in a fresh server** (a second `startServer()` inside a new
   test, stopped at the end): make five `tools/call` requests, record each
   response's body length as `text.length - prefix.length` (5 for `[OK] `, 8
   for `[ERROR] `, per `contracts.ts:40`), then call
   `inspect_providers action=spec` as the sixth request and assert
   `median_response_bytes === median(the five recorded bodies)`. A fresh
   server has no earlier `json()` pushes, so window membership is exact rather
   than assumed — this is the set-equality the first cold pass found missing.
   Assert `tool_schema_tokens` and `median_response_tokens` equal
   `Math.ceil(bytes / 4)` for the same readings.
5. `src/tool-footprint.test.ts`: median over odd/even/window-evicted sequences;
   a disabled tool excluded from the byte total; two different synthetic
   surfaces produce different totals, proving the value is not a literal.

**Red-before:** the byte-equality assertion fails on today's tree (Zod internals
≠ advertised JSON Schema, and output schemas are omitted). The median assertion
passes today; it guards the literal clause, and the unit test's
different-input/different-total case is its fail-before evidence.

**Verify:** `npx vitest run src/tool-footprint.test.ts`; `npm run
test-debate-club`; `npm run typecheck`.

### C3 — Appendix C carrier map (F-R9-D-1)

**Files:** `infobroker.md:1726,1746,1787-1802,1170`, `DECISIONS.md`,
`CHANGELOG.md`.

1. Replace the preamble (`:1726`) with the carrier map: G3 for C.1/C.2/C.3/C.5/
   C.6; read-through plus code review for C.4; the push pipeline and
   `test-push-pipeline` for C.9; the changelog step guard for C.10; C.7 and C.8
   are review lenses, not gate claims.
2. Add one carrier sentence inside C.9 (`:1787`) and C.10 (`:1798`) naming the
   script and guard they rely on, so the map is readable per rule.
3. §9.4 (`:1170`): "warnings; Appendix C violations are errors" becomes
   "warnings; a violated Appendix C rule that names G3 as its carrier is an
   error".
4. D-116 also records that the REQ-080 gate now covers every §4 declaration,
   so the REQ's "Every … SHALL" clause and its G3 carrier agree.

**Verify:** `npm run validate-spec`; `grep -n "every rule is enforceable by
G3" infobroker.md` returns nothing; read-through of the appendix.

### C4 — close the increment

**Files:** `ROADMAP.md`, `worklist.md:887-889` plus one new row, this
directory's `aar.md`, `CHANGELOG.md`.

1. Remove `ROADMAP.md:17-22`.
2. Mark the three existing finding rows `Resolved` with verified anchors, and
   add one row for F-R9-C-3a with its predicate and carrier.
3. Write `aar.md` with the terminal token and the gate-evidence table.
4. Wire the per-commit CHANGELOG entries into the release notes.

**Verify:** `npm run check` full PASS on the final tree.

## Verification plan

| Step | Command | Expected |
|---|---|---|
| T0 baseline (done) | `npm run status`, `npm run check:fast` | 186 unpushed; PASS 19/19, 32.5 s |
| T0b pre-edit probes | `npm run test-debate-club`; record `audit`/`check-pack` as unrun (registry/network) | green — establishes the red-before is attributable to C2 |
| T2 C1 red | `npx vitest run scripts/lib/tool-defaults.test.ts` | 5-6 failed before implementation |
| T3 C1 green | same + `npx tsx scripts/validate-spec.ts` | all passed, exit 0 |
| T4 C2 red | `npm run test-debate-club` | byte-equality assertion fails |
| T5 C2 green | `npm run test-debate-club`, `npx vitest run src/tool-footprint.test.ts` | pass |
| T6 C3 | `npm run validate-spec`, spec grep | exit 0, no universal-G3 claim |
| T7 final | `npm run check` | PASS (full gate suite) |
| T8 split | `npm run typecheck` after each commit | 0 errors |

## Risks and edge cases

- **SDK subpath import.** Two subpaths, both reached through the package's
  `"./*"` export but not documented API. The Arena byte-equality test is the
  tripwire: an SDK encoder or filter change fails the contract test rather than
  drifting silently. Fallback if a subpath disappears: keep `z.toJSONSchema`
  with options tuned until the Arena assertion passes, and pin the tuning in a
  comment.
- **Reported number changes.** `tool_schema_bytes` moves from the Zod-internal
  input-only total to the advertised input+output total. Nothing pins the old
  value (verified: only presence/positivity assertions plus the §9.2 bullet at
  `infobroker.md:1112`, which asks for consistency with live registration).
- **Median window membership.** Resolved by the fresh-server test; a server
  that pushes a body outside a `tools/call` response fails the test, which is
  the intended signal. The prefix offset is derived from `contracts.ts:40` and
  `index.ts:158-163`; if build-time measurement shows additional framing, the
  test pins the measured offset with a comment rather than loosening the
  assertion.
- **Gate false positives.** The declaration scanner is pattern-based.
  Mitigation: exactly one entry claims each discovered declaration, and the
  fixtures cover an unclaimed declaration, a multi-parameter literal clause, and
  a claimed-but-undeclared parameter. Dry-run on the shipped tree is a required
  step.
- **README-sync guard.** C1 changes a REQ body, so the prep run requires a
  non-whitespace README diff; C1 therefore owns the README edit. The README
  section is verified capable of carrying the sentence truthfully (it describes
  the fetch surface and never states a truncation default). If the edit cannot
  be made truthfully, surface the blocker to the user — the pipeline guard
  fails regardless and an AAR note does not satisfy it.
- **Loop-artifact gate.** A directory under `docs/plans/` without `aar.md` is
  an error (`scripts/lib/loop-artifacts.ts:63-69`); see "Execution constraints".
- **`config.local.json`.** The gate reads the shipped `config.json` only. A
  user override that diverges from a tool limit is a deployment choice, not a
  spec defect; D-116 records this boundary.

## Rollback

C1, C3, C4 are documentation and gate edits — `git revert` of any one restores
the previous gate behavior. C2 reverts independently to the Zod-internal
derivation; the previous assertions are restored with it. No data, schema, or
external state is touched.

## Out of scope

- Requiring a spec declaration for every schema default (decision 3).
- A mechanical C.4/C.7/C.8 carrier; C.4 is review-mediated by its own text.
- The other two roadmap sections (review-loop convergence, hermetic option
  forwarding).
- Publishing the 186-commit backlog; publication is a separate user-authorized
  step.

## Findings register (this increment)

| ID | Severity | Predicate | Disposition |
|---|---|---|---|
| F-R9-C-2 | P1 | REQ-080 reconciles 2 of 10 §4 default declarations and 0 of 4 config pairs | Resolved — C1 |
| F-R9-C-3 | P2 | REQ-081's "derived, not literals" clause unasserted | Resolved — C2 |
| F-R9-C-3a | P1 | `tool_schema_bytes` serializes Zod internals and omits output schemas | Resolved — C2 |
| F-R9-D-1 | P1 | Appendix C claims universal G3 enforcement; C.4/C.9/C.10 have no G3 carrier | Resolved — C3 |

## Execution constraints

1. This directory is untracked until C4. Before `aar.md` exists, verify with
   the named per-step commands (see "Verification plan"), not `npm run
   check:fast`; the full suite runs once `aar.md` is in place.
2. Each commit runs `npm run typecheck` (C1/C2 also `typecheck:scripts`) before
   it is made; `npm run check` runs on the final tree.
3. CHANGELOG entries use the release version in `package.json` (`2026.11.11`)
   and the date the version-sync gate expects.
4. No commit moves a tag or pushes; publication stays user-authorized.

## Amendments

1. **Decision 3: the schema→spec warning is dropped (2026-11-13, during C1).**
   The plan said a schema default with no spec declaration "stays the existing
   warning (`validate-spec.ts:1057`)". That warning lived inside the hardcoded
   `requireDefault` path the rewrite replaces, and it only ever covered two
   parameters. Re-creating it would emit six permanent warnings for
   `crawl`/`extract`/`raw`/`format`/probe defaults that no REQ declares —
   noise on every gate run, and a claim the REQ does not make. The scope is
   now stated: the gate reconciles declared defaults; an undeclared schema
   default is out of scope (already listed). No new file, gate, or destructive
   operation; verified by build-review.
