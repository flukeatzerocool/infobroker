# Plan — R8 notice and gate-traceability evidence

**Status:** approved by the user as revision 6 (cold pass capped at stage 5 — see `plan.cold/`) · **Date:** 2026-11-13 · **Depth:** standard
**Review independence:** fresh — one cold pass, five stages, five fresh reviewer dispatches with no authoring context (`plan.cold/`). Stage 5 returned NO-GO twice (the second time on consistency defects); the cap was reached and the user approved revision 6 as-is, accepting that the revision-6 fixes were not independently re-audited.
**Rollback cost:** 1 of 2 — fully reversible. The real rollback unit is the six product commits as a set (a partial revert would leave documentation asserting a capability that had been removed).
**Roadmap item:** `ROADMAP.md` § R8 notice and gate-traceability evidence (`ROADMAP.md:17-22`); removed from `ROADMAP.md` and folded into `CHANGELOG.md` when this increment closes.
**Predecessor:** version 2026.11.11 (latest tag `v2026.11.07`); 159 unpushed commits, oldest 3.8 d; 7 open roadmap items; `HEAD` `e0753bf`; clean tree before this plan directory was created.

## Why this item

`ROADMAP.md` § R8 notice and gate-traceability evidence is the first open
section in file order, and file order selects it. Its trigger — "start after
the sweep reaches R9" (`ROADMAP.md:22`) — is satisfied: the sweep status board
records the **R9 review chunk** closed 2026-11-10 and **M1** (the sweep's final
cross-cutting chunk) closing the program
(`docs/plans/2026-11-09-full-review-sweep/worklist.md:603-604`). The roadmap's
own "R9 …" sections are a different, still-open work item (§ "R9 traceability
and taxonomy gate strength", `ROADMAP.md:24-28`); "R9" below always names the
sweep chunk unless it says "roadmap §R9".

The section closes two R8 findings that share one shape: a REQ clause is
implemented but only *partially* observed by a gate.

- **F-R8-C-1 — the response-level cooldown notice is unobserved.** The
  cooldown clause lives in REQ-111a: "WHEN a provider is cooling down, every
  successful tool response SHALL include a bounded notice naming the provider
  and the remaining cooldown" (`infobroker.md:653-654`; REQ-111 at `:650-651`
  owns the general `notices` channel, REQ-111a owns this clause). The
  implementation exists: `collectNotices()` builds the `provider_cooldown`
  notice (`src/state-health.ts:119-131`), and `instrumentTool` injects the
  notice list into every successful tool response (`src/index.ts:1837-1842`).
  What is missing is a test that drives a real cooldown through a tool call:
  `src/state-health.test.ts:165-205` calls `collectNotices()` directly, and the
  existing cooldown test in the spawned server harness stops at the skip
  behaviour (`src/dispatch-orchestration.test.ts:285-303`).
- **F-R8-D-1 — REQ-096's gate-traceability clause is asserted as reference
  presence.** REQ-096 says "The validation gate SHALL fail when a category is
  unmapped or a security requirement is not traceable to a gate"
  (`infobroker.md:667-670`). `checkSecurityModel()` currently asserts that §E
  exists, that both OWASP headings appear, and that each security REQ is
  *mentioned* anywhere in §E (`scripts/validate-spec.ts:1206-1225`). Mention is
  not traceability: a security REQ can lose its gate and the check still
  passes.

Both findings are treated as **evidence gaps, not behaviour gaps** — the
notice is emitted and injected today, and the §9.5 manifest already declares a
gate for every security REQ. That premise is testable: T3 is the test that
confirms it, and **C-1 makes an absent notice a production defect that stops
the increment**. The security-model work is assertion work on data that
already exists, but it adds three new checks to an existing gate step rather
than only evidence: the category-mapping and manifest-trace assertions below
are new gate behaviour.

**A citation is not an assertion.** REQ-111a is already carried by
`src/call-log.test.ts:1` and `src/session-stats.test.ts:1`, so
`validate-spec` and `check-gate-coverage` pass today; REQ-096 is in the
`metaReqs` exemption set (`scripts/validate-spec.ts:73`). Neither gate is red.

**Category completeness is in scope, deliberately.** REQ-096's clause has two
branches: an unmapped category and an untraceable requirement. F-R8-D-1 names
the second; the first is equally unasserted today — only the two OWASP
*headings* are checked, not the twenty category rows. "Mapped" is defined as
"the row exists and its controlling cell is non-empty"; controller
correctness belongs to the open roadmap §R9 taxonomy item and is out of scope
(C-3).

## Baseline (this session)

- `npm run status` → version 2026.11.11 (latest tag `v2026.11.07`), **159
  unpushed commits, oldest 3.8 d**, 7 open roadmap items.
- `npm run check` → **exit 0**, `gates: PASS (full, 163.1 s)`, 22 gates
  (`/tmp/opencode/pre-plan-check.log`; the count is `GATES.length` in
  `scripts/lib/gate-manifest.ts`). The run was made on a clean tree **before**
  this plan directory existed; the tree became dirty only when the increment
  directory was created afterwards. The run is not in the tree-keyed run
  journal because that journal is written only for the tree a release ships.
- Predicate re-verification (reads, this session):
  - `src/state-health.ts:18` `MAX_NOTICES = 5`; `:119-131` emits
    `provider_cooldown` with `severity: "info"`, `message` naming the provider,
    and `details: { provider, remaining_ms }` at `:129`, capping
    `activeCooldowns()` at 2; `:137-140` `collectNotices`; `:172-200`
    `injectNotices` — which returns the result unchanged when the payload
    already has a non-empty `notices` array (`:191`) and otherwise merges at
    `:193-195`.
  - `src/index.ts:1837-1842` `instrumentTool` calls `collectNotices()` on every
    successful handler result and passes it to `injectNotices`.
  - `src/index.ts:1601-1630` `doListProviders` (the `inspect_providers`
    `list` path) returns a payload with **no `notices` key**, so it satisfies
    `injectNotices`' precondition.
  - `src/index.ts:106` calls `startupHealthCheck()` once at module load;
    `:172-204` it only calls each provider's `health()` and logs the result —
    it never calls `markCooldown`, so it cannot create the cooldown under test.
  - `src/cooldown.ts:14-19` `markCooldown`, `:21-30` `inCooldown`, `:38-50`
    `activeCooldowns` (sorted, expired entries dropped); `src/index.ts:612-618`
    marks a provider on `shouldCooldown` (429 or bot challenge) with
    `cooldownDurationMs(config.output.rate_limit_cooldown_ms)` — the duration is
    config-derived, not the response's `retry-after`.
  - `src/dispatch-orchestration.test.ts:23-27` `cleanups`; `:44-93`
    `withServer`; `:95-99` `parse`; `:101-105` `search`; `:107-117` `setup`
    (forwards only `chains` and `output`); `:119-125` `stub` (pushes the stub
    close onto `cleanups`); `:143-149` `provider`; `:285-303` the existing
    cooldown test, including its `a.requests` delta guard.
  - `src/lib/stub-provider.ts:15` `StubMode` includes `rate_limited`;
    `:89-91` serves HTTP 429 with `retry-after: 30`; `:188-203` the hermetic
    config is a clone of the shipped `config.json`, so `output` keeps shipped
    values except the keys `setup` overrides; `:228-233` the dispatch chain is
    built from the provider array **in argument order**.
  - `config.json:363` `output.hedge_enabled = true`; `:367`
    `output.rate_limit_cooldown_ms = 30000`.
  - `CHANGELOG.md:1-3` the current top section is
    `## 2026.11.11 — R8 update preservation: simulated-update G1 evidence`; a
    second same-version section above it is the established pattern (the prior
    increment did the same), and `version-sync` pins the top date to
    `package.json`, so the new section's date stays `2026.11.11`.
  - `scripts/validate-spec.ts:1206-1225` the current §E check, and
    `:430-454` the manifest reconciliation (presence bidirectionally against
    the §4 body — it does **not** cross-check each REQ's `_Check:_` field, so
    §9.5 is the only gate-read declaration of a REQ's gate). `scanDir` is
    called on `SRC` only (`:102`), so `scripts/**` files need a role header but
    no `@implements` citation;
    `infobroker.md:1837-1901` §E with E.1–E.4, all twenty category rows
    present, and the seven security REQs each appearing in an E.2 or E.3
    category row (096→A06; 097→LLM01/04/08; 098→A09; 099→A01/LLM06;
    100→A01/A04/A08; 101→A03/LLM03; 102→A05/A10); `infobroker.md:1180-1336`
    §9.5 manifest (4 columns, gate in the fourth), every `REQ` row carrying a
    gate token (no irregular or empty row).
  - `infobroker.md:1319-1325` the seven security REQs and their declared gates
    (096 G3; 097 G0, G1; 098 G1; 099 G1; 100 G1; 101 G3; 102 G1).
  - `src/clause-coverage.ts:89-101` run against REQ-111a returns
    `{ orBranches: 0, conditionals: 0 }`, so no clause tag is required for a
    bare `@implements REQ-111a`.
  - `vitest.config.ts:4-5` includes `src/**/*.test.ts` and
    `scripts/**/*.test.ts`; `scripts/lib/gate-manifest.test.ts:1-13` is the
    header/path convention for a `scripts/lib` test.
  - `grep -rn "F-R8-C-1\|F-R8-D-1"` → four live rows (`worklist.md:475`,
    `:479`, `:876`, `:877`) plus two historical AAR rows
    (`docs/plans/2026-11-10-full-review-r8/aar.md:33-34`).
  - `grep -rln "fingerprint" scripts src` → none; `grep -n "§E\|Security
    Model" scripts/*.ts scripts/lib/*.ts` outside `validate-spec.ts` → none;
    `grep -o "D-[0-9]\{3\}" DECISIONS.md | sort -u | tail -3` → D-109, D-110,
    D-111.

## Alternatives considered

- **A — assert the cooldown notice in `src/state-health.test.ts` (unit
  level).** Rejected: that file already calls `collectNotices()` directly. It
  proves the notice object, not the REQ's "every successful tool response"
  clause. Only the tool boundary proves injection.
- **B — assert the notice in the Debate Club Arena.** Rejected: the Arena
  replays committed fixtures and `debate-club/fixtures/index.json` has no
  `rate_limited` entry for a listed host, so it would need a new fixture host
  plus a two-call scenario. The dispatch harness already starts loopback stubs
  and speaks the real MCP protocol; the new test is roughly forty lines of
  assertions and types on an existing fixture mode.
- **C — add the test to a new file `src/cooldown-notice.test.ts`.** Rejected:
  it would duplicate `withServer`, `setup`, `stub`, `search`, and `parse` (about
  110 lines) or force an extraction that touches an unrelated harness. The
  existing cooldown area of `dispatch-orchestration.test.ts` is the natural
  home.
- **D — annotate every REQ mention inside E.2 and E.3 with its gate.**
  Rejected: several REQs appear in more than one row (REQ-100 in A01/A04/A08,
  REQ-101 in A03/LLM03, REQ-097 in LLM01/LLM04/LLM08), so the check would have
  to accept "at least one annotated occurrence" — a weaker and harder-to-read
  rule than reading the manifest.
- **E — narrow REQ-096's sentence to reference presence.** Rejected: the
  roadmap offers it as the alternative, but narrowing a REQ body to match a
  weak check removes the obligation instead of meeting it, and §9.5 already
  carries the declared-gate data the assertion needs.
- **F — make `check-gate-coverage` the traceability carrier.** Rejected:
  `check-gate-coverage` asserts G1 REQs have *test citations*; REQ-096 is G3 and
  in `metaReqs`. Gate traceability is a §E-model property and belongs in the §E
  check.
- **G — parse the gate column out of §9.5 inside `validate-spec.ts` without a
  lib module.** Rejected: the check needs negative fixtures, and `validate-spec`
  is a script entry point with no unit-test seam. `scripts/lib/` is the
  established pure-module seam (`gate-manifest.ts`, `release-policy.ts`, …).
- **H — add a §E.5 "Gate Traceability" table restating each security REQ's
  gate, and assert it equals §9.5.** Rejected (cold Stage 3, design and
  structural lenses): the table duplicates the §9.5 gate column, so every
  future gate edit becomes a two-place spec edit or `validate-spec` goes red,
  and the check degenerates into comparing a copy with its source. The
  non-duplicating reading of REQ-096 is a chain: each §4.11 REQ appears in
  an E.2/E.3 category row (the model) **and** has a §9.5 row carrying a gate
  (the trace). That is what checks 4–6 assert, with one copy of the gate data
  and a scope derived from the same table rather than a second hand-kept list.
- **I — keep the §E-wide "referenced" check and only add new checks.** Rejected
  (cold Stage 1, finding 4): a §E-wide mention test cannot distinguish a REQ
  that appears only in the residual-risk prose from one mapped to a category.

## Blast radius

Sizes: **S** ≤ ~60 changed lines, **M** ≤ ~260.

| File | Change | Size |
|---|---|---|
| `src/dispatch-orchestration.test.ts` | header gains `REQ-111a`; `ToolPayload` gains optional `notices`; new `describe` with one test: a control call carries no cooldown notice, stub A 429 → stub B serves (hedge off), the first successful response carries one bounded `provider_cooldown` notice naming `stub_a`, and a second call to a tool other than the search carries it too | S |
| `scripts/lib/security-model.ts` (new) | pure REQ-096 checker: §E presence, both OWASP headings, twenty category rows mapped, each security REQ in an E.2/E.3 row, each security REQ's §9.5 gate non-empty | M |
| `scripts/lib/security-model.test.ts` (new) | live-spec pass plus eleven negative fixtures derived from the live spec text by verified deletion/mutation | M |
| `scripts/validate-spec.ts` | delete the inline `checkSecurityModel` (`:1206-1225`), import the lib checker, call it at the existing site with `for (const message of …) error(message)` | S |
| `infobroker.md` | extend the §9.2 rate-limit cooldown bullet with the notice assertion (no REQ body edit) | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | surface rows `:475` and `:479` → `**Resolved 2026-11-13**`; register rows `:876` and `:877` → `**Resolved 2026-11-13**`; cross-note at `:474` (REQ-111) and `:547` (§9.2 bullet carrier); correct the stale `scripts/validate-spec.ts:923-945` anchor at both `:479` and `:500` | S |
| `ROADMAP.md` | remove § R8 notice and gate-traceability evidence (`:17-22`); record the disposition of § Review-loop convergence and § Hermetic test option forwarding in the AAR | S |
| `CHANGELOG.md` | one `## 2026.11.11 — …` section as the new top section, above `## 2026.11.11 — R8 update preservation…` (`:3`) | S |
| `DECISIONS.md` | one entry (`D-112`) recording both evidence shapes | S |
| `docs/plans/2026-11-13-r8-notice-gate-traceability/` | `plan.md`, `tasks.md`, `aar.md`, `plan.cold/` (increment record) | S |

No production handler change, no REQ body edit, no config, schema,
dependency, provider-registry, tool-schema, or gate-manifest change. The gate
behaviour change is inside `validate-spec`'s existing `checkSecurityModel`
step: all four existing messages stay verbatim; three checks are new.

## Design — the cooldown notice test (F-R8-C-1)

Add one test to `src/dispatch-orchestration.test.ts` in a **new**
`describe("cooldown notice on tool responses (REQ-111a)")`. Reuse the existing
helpers unchanged: `withServer` (`:44-93`), `search` (`:101-105`), `parse`
(`:95-99`), `setup` (`:107-117`), `stub` (`:119-125`), `provider` (`:143-149`),
and the module-level `cleanups` (`:23-27`) that `stub()` populates.

1. **Fixture.** `const a = await stub("rate_limited")` and
   `const b = await stub("ok")`; providers
   `provider("stub_a", a.url)` and `provider("stub_b", b.url)`; no chain
   override. `writeHermeticConfig` builds each dispatch chain from the provider
   array in argument order (`src/lib/stub-provider.ts:228-233`), so the order
   is `stub_a` then `stub_b`. Pass `output: { hedge_enabled: false }` to
   `setup` — the shipped value is `true` (`config.json:363`), and a hedge race
   would make "the fallback served" and the cooldown timing order-dependent
   (the neighbouring single-outcome tests do the same,
   `src/dispatch-orchestration.test.ts:240,335`).
2. **Control call (no cooldown yet).** Add one local helper to the test file:
   `async function toolPayload(call, name, args)` that sends `tools/call`,
   reads `result.content[0].text`, and returns `parse(text)` — the existing
   `search()` hardcodes `infobroker_search_web` (`:101-105`), so it cannot be
   reused for this tool. Then call
   `infobroker_inspect_providers` with `{ action: "list" }` and assert it
   carries **no** `provider_cooldown` notice (`payload.notices` absent or no
   matching code). This proves the later notice is caused by the cooldown, and
   that this tool's payload has no `notices` of its own — the precondition
   `injectNotices` requires (`src/state-health.ts:172-192`).
3. **First search.** `const before = a.requests;` then
   `search(call, { query: "cooldown notice first" })`:
   - `a.requests - before === 1` and `status === "ok"` with
     `provider === "stub_b"` — the search itself hit stub A and the fallback
     served, so the response is a *successful* tool response (the same guard
     the existing cooldown test uses, `:290-294`). Without the delta, a cooldown
     created by anything else would satisfy the notice assertions;
   - exactly one notice with `code === "provider_cooldown"`;
   - `severity === "info"`, `details.provider === "stub_a"`, and `message`
     contains `"stub_a"` (the "naming the provider" limb);
   - `details.remaining_ms` is a finite number with
     `0 < remaining_ms <= window`, where `window` is read from the written
     hermetic config (`<cfg.root>/config.json` →
     `output.rate_limit_cooldown_ms`; the hermetic config clones the shipped
     file, `src/lib/stub-provider.ts:188-203`). The test asserts `window > 0`
     first, so a future config of 0 fails loudly. Whether the duration is
     config-derived or header-derived is established by the read at
     `src/index.ts:614`, not by this bound — the stub's `retry-after` and the
     window are both 30 s, so the bound cannot distinguish them;
   - the whole `notices` array has `length <= 5` (a ceiling consistent with
     `MAX_NOTICES`, `src/state-health.ts:18`), and the cooldown notice appears
     exactly once.
4. **Second call, a different tool from the search.** `toolPayload(call,
   "infobroker_inspect_providers", { action: "list" })` again. Assert it now
   carries one `provider_cooldown` notice for `stub_a`. This is the "every
   successful tool response" limb — the notice follows the cooldown onto a
   tool that neither searched nor caused the 429.
5. **Header and types.** The file header becomes
   `// @implements REQ-031 REQ-031a REQ-034 REQ-038 REQ-015 REQ-027a REQ-111a`
   (no clause tag: the detector returns 0/0 for REQ-111a), and `ToolPayload`
   gains
   `notices?: Array<{ code: string; severity?: string; message: string; details?: Record<string, unknown> }>`.
6. **Teardown.** None beyond the file's existing `afterAll`; `stub()` pushes
   both stub closes onto `cleanups`.

**Mutation check (evidence, not a committed test).** Temporarily change
`src/state-health.ts`'s cooldown loop to `continue` (or make `collectNotices`
return `[]`); the new test must fail on the notice assertions; restore the
file byte-identically (`sha256` before/after) and re-run green. Record both
transcripts in `tasks.md`, and confirm `git status --porcelain` shows no
source change before the Phase-1 commit.

## Design — the security-model gate (F-R8-D-1)

### New module: `scripts/lib/security-model.ts`

Header comment naming role (`gate helper — pure; called by
scripts/validate-spec.ts; mutates nothing`), purpose, and exit contract ("returns
the finding list; the caller decides the exit code"), per the script
discipline. No shebang (lib modules are exempt).

Exports:

```ts
export const OWASP_CATEGORIES: readonly string[];   // "A01"…"A10", "LLM01"…"LLM10"
export interface ManifestRow { req: string; gates: string[]; }
export function readManifest(specText: string): ManifestRow[];
export function securityReqsFromBody(specText: string): string[]; // §4.11 REQ headings
export function checkSecurityModel(specText: string): string[];
```

**The scope is derived from the §4.11 body, not listed.** A security REQ is any
`**REQ-NNN — …**` heading between `### 4.11 Security and Content Safety`
(`infobroker.md:665`) and the next `### ` heading; today that is exactly
REQ-096…REQ-102. The body is the authoritative set of security requirements,
and §9.5 is the manifest that must trace each one to a gate — so deleting a
security REQ's §9.5 row *does* produce a finding (check 6) instead of silently
shrinking the scope. There is no hand-maintained id list. The REQ body's
`_Check:_` field is unchecked prose and is **not** a second source the checker
reads; §9.5 is the only gate-read declaration.
`OWASP_CATEGORIES` stays a constant because the OWASP Top 10 is an external
standard, and check 6 closes the other direction (a spec row naming a code
outside the standard).

**Section slices.** `§E` body: from `## §E Appendix: Security Model` to EOF
(it is the last appendix). `E.2` and `E.3` bodies: from the heading whose text
**starts with** `### E.2` / `### E.3` to the next `### ` or `## ` heading — the
match is on the section number, not the title, so a fixture that removes the
OWASP title token does not destroy the slice it is testing. `§9.5` body: from
`### 9.5 REQ Manifest` to the next `### ` or `## ` heading.

**Table shapes.** §9.5 rows have four columns `| REQ | Title | Section |
Gate |`; the gate is the fourth cell, tokens matched with `/\bG[0-3]\b/g`.
E.2 rows read `| Category | Controlling REQ / disposition |` and E.3 rows
`| Risk | Controlling REQ / disposition |`; the controlling cell is the second
cell in both. The E.2/E.3 parser accepts **any** row whose first cell is a
non-empty category code (it does not filter on a known prefix, so check 6 can
see an out-of-standard code); header and separator rows are ignored.
"Mapped" means the row exists and its controlling cell is non-empty.

**Checks, in emission order** (the returned array order is the evaluation
order):

1. `## §E Appendix: Security Model` present — existing message, verbatim; when
   absent, return immediately (as today, `scripts/validate-spec.ts:1207-1211`).
2. `OWASP Top 10:2025` present in §E — existing message, verbatim.
3. `OWASP LLM Top 10:2025` present in §E — existing message, verbatim.
4. each security REQ (derived from §4.11) is referenced in §E — **unchanged**
   from today's check, existing message verbatim. This is a *reference*
   assertion, not a mapping assertion, so a REQ disposed as a residual risk is
   not failed; the model-mapping requirement is carried by checks 5–6.
5. **new** every `OWASP_CATEGORIES` code has a row in E.2/E.3 — a row absent →
   `Security model (§E) category '<code>' is missing — REQ-096`; a row present
   with an empty controlling cell → `… is unmapped — REQ-096`.
6. **new** an E.2/E.3 row whose first cell names a category code outside
   `OWASP_CATEGORIES` → `Security model (§E) category '<code>' is not a known
   OWASP category — REQ-096`.
7. **new** for each §4.11 REQ, in body order: a §9.5 row exists → otherwise
   `Security model: §9.5 has no row for <REQ> — REQ-096`; its gate cell yields
   at least one gate token (`/\bG[0-3]\b/g`) → otherwise
   `Security model: §9.5 declares no gate for <REQ> — REQ-096`.

No gate value and no security-REQ id is hardcoded in the module; the scope
comes from the §4.11 body and the gates from §9.5.

### Spec edit

The §9.2 rate-limit cooldown bullet (`infobroker.md:1088`, currently ending
`…and its quota counters are unchanged (REQ-038)`) gains one trailing clause:

> … and its quota counters are unchanged (REQ-038); the following successful
> response carries a bounded cooldown notice naming the provider (REQ-111a).

This aligns the spec's verification list with the new test and changes no REQ
body.

### `scripts/validate-spec.ts` refactor

Delete the local `checkSecurityModel` function (`:1206-1225`), import
`checkSecurityModel` from `./lib/security-model.js`, and at the existing call
site (where `specText` and `error` are in scope):

```ts
for (const message of checkSecurityModel(specText)) error(message);
```

Checks 1–3's messages stay byte-identical to today's strings (`§E` missing,
each OWASP heading missing). Check 4's message also stays verbatim — the check
is unchanged; only checks 5–7 are new behaviour.

### Headers on the new files

`scanDir` in `scripts/validate-spec.ts` is called on `src/` only (`:102`), so
neither new `scripts/lib/` file needs an `@implements` citation. Both carry the
lib-module header required by the script discipline: one comment line naming
the role (`gate helper — pure; called by scripts/validate-spec.ts; mutates
nothing`), one naming the purpose, and the exit contract (the `check*` function
returns findings; the caller sets the exit code).

### Negative fixtures (`scripts/lib/security-model.test.ts`)

Each fixture starts from the live spec text, **asserts the token it will remove
or change is present** (so an upstream reformat turns the fixture red instead
of silently making it a no-op), then mutates and asserts the exact finding.

| # | Mutation on the live spec text | Expected finding(s) |
|---|---|---|
| 1 | none | `[]` (the pass case, not a negative fixture) |
| 2 | delete the `## §E Appendix: Security Model` heading | check 1's message, and nothing else |
| 3 | replace every `OWASP Top 10:2025` token | check 2's message |
| 4 | replace every `OWASP LLM Top 10:2025` token | check 3's message |
| 5 | delete every E.2/E.3 mention of REQ-099 | check 4 for REQ-099 |
| 6 | delete the E.2 row beginning `\| A07 ` | check 5 `is missing` for A07 |
| 7 | empty A07's controlling cell | check 5 `is unmapped` for A07 |
| 8 | append an E.2 row `\| X01 Made Up \| REQ-096 \|` | check 6 `is not a known OWASP category` for X01 |
| 9 | delete the `\| REQ-101 \|` row from §9.5 | check 7 `has no row for REQ-101` |
| 10 | empty REQ-101's §9.5 gate cell | check 7 `declares no gate for REQ-101` |
| 11 | append a `**REQ-999 — Test obligation**` heading inside §4.11 (after REQ-102) and its §9.5 row with gate `G1` | check 4 for REQ-999 — proves the scope comes from the body, not a constant |
| 12 | empty the §9.5 gate cells for REQ-098 and REQ-102 | two check-7 findings, in §4.11 body order |

Eleven negative fixtures (rows 2–12) plus the pass case.

## Done bar

**Done bar:** F-R8-C-1 and F-R8-D-1 each read `**Resolved 2026-11-13**` with
file:line evidence. Concretely: (1) the new cooldown test passes — asserting
the notice on the **first** successful response (with the `a.requests` delta)
and on a following call to a tool other than the search — and fails when the
`collectNotices` cooldown loop is removed, with both transcripts in
`tasks.md`; if a successful response lacks the notice, C-1 stops the increment;
(2) `scripts/lib/security-model.test.ts` passes: the live-spec case returns no
findings, and each of the eleven negative fixtures (table rows 2–12) produces
exactly the specified finding, with the transcripts in `tasks.md`; the
end-to-end "gate goes red" evidence is T8's `validate-spec` run on a spec with
one §9.5 gate cell emptied; (3) `npm run
typecheck`, `npm run typecheck:scripts`, `npx vitest run
src/dispatch-orchestration.test.ts scripts/lib/security-model.test.ts`,
`npm run validate-spec`, and `npm run check-gate-coverage` are green; (4)
`ROADMAP.md` no longer carries § R8 notice and gate-traceability evidence after
that run, with `check-roadmap` green; (5) `worklist.md:475`, `:479`, `:876`, and
`:877` carry the resolution, `:474` and `:547` carry their cross-notes, and the
stale anchor at `:479` and `:500` is corrected; (6) `CHANGELOG.md` has one new
`## 2026.11.11 —` heading above the pre-existing top heading,
`DECISIONS.md` carries `D-112`, and the §9.2 bullet at `infobroker.md:1088`
carries the REQ-111a clause; (7) `npm run check` is green on the tree that
carries the AAR's terminal token; T17 then writes only the recorded exit-status
line into `tasks.md`/`aar.md` and re-runs `check-loop-artifacts` and
`check-roadmap`, and T18's `check:fast` covers that final tree; (8) the AAR ends
`LOOP PAUSED` with the review cap recorded.

## Review-loop cap (recorded, not judged at run time)

One cold pass at standard depth plus at most one targeted diff re-review of
the lines that changed. If the cold pass returns a blocker inside one
assertion's evidence, the revision narrows to that assertion instead of
re-scoping the increment. At the cap an unresolved item is escalated to the
user. **Recorded outcome for this plan:** stages 1–4 ran (no Blockers after
revision 4); stage 5 returned NO-GO twice, so the run stopped at the cap and
the second report's findings (all consistency defects, listed in
`plan.cold/05-readiness.md`) were applied as revision 6 **without a third
audit**. Approval of revision 6 therefore carries the residual risk that the
editorial fixes were not independently re-checked. As with the previous
increment, recording the cap does **not** retire
`ROADMAP.md` § Review-loop convergence — that section's close is a user
decision after the AAR (`docs/plans/2026-11-12-r8-update-preservation-evidence/aar.md:55-61`).

## Phases and steps

### Phase 0 — Scaffold and baseline

- **T0.** Create `tasks.md` (this step list) and `aar.md` seeded with
  `LOOP OPEN`, so `check-loop-artifacts` sees a complete increment directory
  from the first gate run.
- **T1.** Record the baseline in `tasks.md`: `npm run status`, the full `npm
  run check` run (163.1 s, before this directory existed), and the predicate
  reads above.

### Phase 1 — Cooldown notice evidence (F-R8-C-1)

- **T2.** Add the test, type, and header edit to
  `src/dispatch-orchestration.test.ts` per §Design. No production change.
- **T3.** Run `npx vitest run src/dispatch-orchestration.test.ts`. **If any
  successful response lacks the notice, stop the increment**: that is a
  production defect against REQ-111a, not an evidence gap. Record the failing
  response in `tasks.md`, report it to the user, and re-scope to a behaviour
  fix before any bookkeeping. Do not weaken the assertion to a direct
  `collectNotices()` call.
- **T4 — mutation check.** Break the `collectNotices` cooldown loop, record the
  failing assertion, restore the file byte-identically (sha256), and re-run
  green. Confirm `git status --porcelain` shows only the test file and this
  directory. Transcript in `tasks.md`.
- **T5.** `npm run typecheck` and `npx vitest run src/dispatch-orchestration.test.ts`
  → green; **commit 1** (`test(dispatch)`).

### Phase 2 — Security-model gate (F-R8-D-1)

- **T6 — dry run.** Write `scripts/lib/security-model.ts` and
  `scripts/lib/security-model.test.ts`. Run the live-spec case: it must pass
  after the code exists (the checks read the existing spec, which needs no
  edit). Record the fixture results for rows 2–12. This is the error-gate dry
  run: no finding against the current tree, and every negative fixture red in
  exactly the specified way.
- **T7.** Add the §9.2 bullet to `infobroker.md`; re-run the live-spec case →
  zero findings (the bullet is not parsed by the checker).
- **T8.** Refactor `scripts/validate-spec.ts` to the lib call. First capture
  `sha256sum infobroker.md` **after** T7 (the §9.2 edit), then run
  `npm run validate-spec` → exit 0, then mutate one §9.5 gate cell in the spec
  (clear REQ-101's gate), run it again → exit 1 with the
  `declares no gate for REQ-101` message, and restore the spec to the captured
  sha256; confirm `git status --porcelain` shows only the intended spec edit.
  (`scanDir` is scoped to `src/`, so the new `scripts/lib/` files cannot trip
  the undocumented-source check; if any gate does report them, record the exact
  finding and stop.)
- **T9.** `npm run typecheck:scripts`,
  `npx vitest run scripts/lib/security-model.test.ts`, and
  `npm run check-script-discipline` → green; **commit 2** (`fix(validate-spec)`).

### Phase 3 — Bookkeeping

- **T10.** Add `D-112` to `DECISIONS.md` (highest existing id is `D-111`):
  the cooldown notice is asserted through the spawned-server harness against
  loopback stubs; §9.5 is the single source of truth for a security REQ's gate
  and the checker's scope is derived from the §4.11 body headings; category-row
  completeness is asserted as presence, not as controller correctness.
  **commit 3** (`docs(decisions)`).
- **T11.** `worklist.md`: surface rows `:475` (REQ-111a) and `:479` (REQ-096)
  keep their `Surface | Verdict | Predicate` shape; the Verdict cell becomes
  `**Resolved 2026-11-13** (F-R8-C-1)` / `(F-R8-D-1)`, and the Predicate cell
  gains the new test path and module path. Register rows `F-R8-C-1` (`:876`)
  and `F-R8-D-1` (`:877`) → `**Resolved 2026-11-13**` with the same evidence.
  Correct the stale `scripts/validate-spec.ts:923-945` anchor at `:479` **and**
  `:500` (Appendix E row). Add a cross-note at `:474` (REQ-111 keeps `holds`;
  the cooldown-clause evidence sits under REQ-111a) and at `:547` (the new
  §9.2 bullet's carrier). Leave the M1 disposition census (`:583-585`) and the
  R8 chunk AAR (`docs/plans/2026-11-10-full-review-r8/aar.md`) as dated closure
  snapshots — the rule is: live verdict/register rows are updated; dated
  program-closure snapshots are historical. **commit 4** (`docs(plans)`).
- **T12.** Add the new `## 2026.11.11 — <title>` section as the **top**
  section, immediately after `# Changelog` and above
  `## 2026.11.11 — R8 update preservation…` (`:3`), with the same
  `(REQ-…; F-…; D-…)` reference tail (`version-sync` pins the top date to
  `package.json`; the date stays `2026.11.11`). **commit 5** (`docs(changelog)`).
- **T13.** `npm run validate-spec` and `npm run check-gate-coverage` → green;
  **then** remove § R8 notice and gate-traceability evidence from `ROADMAP.md`;
  `npm run check-roadmap`; **commit 6** (`docs(roadmap)`). § Review-loop
  convergence and § Hermetic test option forwarding stay: the first is a user
  decision (precedent above), and the second's trigger — "the next increment
  that touches the hermetic harness" — does not fire because this increment
  edits `src/dispatch-orchestration.test.ts` and `setup()` is unchanged.

### Phase 4 — Gates and close

- **T14.** `npm run check-roadmap`, `npm run version-sync`, `npm run test`,
  `npm run check-loop-artifacts`, `npm run check-script-discipline`.
- **T15.** Rewrite `aar.md` with dispositions, the review cap, every gate
  result so far, and the terminal token. `npm run session:close`.
- **T16.** `npm run check` on the complete tree (full suite, un-piped, exit
  status recorded) — after T15 so `check-loop-artifacts` is satisfiable.
- **T17.** Write the T16 exit status into `tasks.md`/`aar.md`; re-run
  `check-loop-artifacts` and `check-roadmap`; **commit 7** (`docs(plans)`).
- **T18.** `npm run check:fast` on the committed tree as the closing
  session-loop gate.

## Commit series

Seven commits, each `typecheck`-clean and green for the gate it feeds. The
order follows the AGENTS convention buckets (source and tests before docs);
the CHANGELOG entry for the gate change lands in commit 5 rather than beside
commit 2, which is the documented bucket order, and the release is judged on
the complete series. The spec bullet is one line in commit 2 so the gate's
behaviour and the verification list it feeds move together.

1. `test(dispatch)`: the cooldown-notice test, type, and header (T2–T5). Gate:
   `npx vitest run src/dispatch-orchestration.test.ts`, `npm run typecheck`.
2. `fix(validate-spec)`: `scripts/lib/security-model.ts`,
   `scripts/lib/security-model.test.ts`, the `validate-spec.ts` call site, and
   the §9.2 bullet (T6–T9). Gate: `npm run validate-spec`,
   `npm run typecheck:scripts`,
   `npx vitest run scripts/lib/security-model.test.ts`,
   `npm run check-script-discipline`.
3. `docs(decisions)`: `D-112` (T10).
4. `docs(plans)`: the two surface rows, the two register rows, and the two cross-notes (T11).
5. `docs(changelog)`: the CHANGELOG section (T12); `npm run version-sync`.
6. `docs(roadmap)`: removal (T13); `check-roadmap`, `validate-spec`,
   `check-gate-coverage`.
7. `docs(plans)`: this increment's `plan.md`, `tasks.md`, `aar.md`,
   `plan.cold/` (T15–T17); `check-loop-artifacts`.

Commits 1–6 are made at their phase boundaries before T16; commit 7 is made by
T17 after the AAR is final and carries the T16 transcript. T18 then verifies
the committed tree.

## Verification plan

| Step | Gate | Satisfiability evidence |
|---|---|---|
| Control call carries no cooldown notice | `vitest run src/dispatch-orchestration.test.ts` | `doListProviders` payload has no `notices` (`src/index.ts:1601-1630`), and `injectNotices` merges only into a payload with none (`src/state-health.ts:172-192`) |
| Cooldown comes from the search | same suite | `a.requests` delta guard, as in `src/dispatch-orchestration.test.ts:290-294`; startup health never marks a cooldown (`src/index.ts:172-204`) |
| Cooldown notice on a success | same suite | `stub("rate_limited")` serves 429 (`src/lib/stub-provider.ts:89-91`), `markCooldown` fires (`src/index.ts:612-618`), `collectNotices` emits the row (`src/state-health.ts:119-131`), `instrumentTool` injects (`src/index.ts:1837-1842`) |
| Notice names provider and remaining window | same suite | `details: { provider, remaining_ms }` (`src/state-health.ts:129`); window from `config.json:367`, applied at `src/index.ts:614` |
| Notice is bounded | same suite | `MAX_NOTICES = 5` (`src/state-health.ts:18`); `activeCooldowns()` capped at 2 (`:121`) |
| Every successful tool response | same suite | the same `instrumentTool` wrapper wraps every `registerTool` call (`src/index.ts:1837`) |
| Manifest gate presence | `security-model.test.ts`, `validate-spec` | §9.5 rows are uniform, 4 columns, every gate cell non-empty today (`infobroker.md:1180-1336`; security rows at `:1319-1325`); the scope comes from the §4.11 body headings, so no list can go stale |
| Category rows complete | same suite | all twenty rows exist today (`infobroker.md:1862-1901`) |
| Model references each security REQ | same suite | check 4 is the existing §E-wide reference assertion, unchanged; each §4.11 REQ is named in §E today |
| Refactor keeps the gate's old findings | same suite | fixtures 2–5 assert the four preserved messages |
| Whole-tree health | `npm run check` after T15 | 22 gates sequential (`scripts/lib/gate-manifest.ts`); a T16 failure means fix, rewrite the AAR terminal token, re-run |

## Edge cases and rollback

- **A successful response carries no notice.** That is a REQ-111a defect, not
  an evidence gap. T3 stops the increment and reports; no bookkeeping commit
  is made (C-1).
- **Hedge or startup timing makes the outcome order-dependent.** `setup` gets
  `hedge_enabled: false`, and the `a.requests` delta is measured immediately
  around the search, matching the existing cooldown test.
- **`rate_limit_cooldown_ms` is 0 in a future config.** The test asserts
  `window > 0` before using it, so the failure is a clear message, not an
  assertion that silently passes.
- **`inspect_providers action=list` gains its own `notices` key.** The control
  call fails first and T3 stops with the tool's payload recorded. Do not
  substitute another probe tool without first proving in that same session that
  its control payload carries no `notices`; an unproven substitute turns the
  test into a coincidence.
- **The §9.5 table changes shape or gains a §4.11 REQ.** The scope and gates
  are derived from §9.5, so a new §4.11 REQ is covered automatically and must
  gain an E.2/E.3 category row; the failure message names the REQ. A §4.11 REQ
  whose §9.5 row is deleted leaves the scope, and the pre-existing manifest
  reconciliation (`scripts/validate-spec.ts:430-454`) reports it — recorded as
  fixture 10 so the boundary is tested rather than assumed.
- **`check-script-discipline` rejects the new lib module.** The module carries
  the required header comment and no shebang, like
  `scripts/lib/gate-manifest.ts`; T9 confirms before any bookkeeping commit.
- **Rollback.** The unit is commits 1–6 as a set (`git revert <1>..<6>` or one
  revert per commit in reverse order); a lone revert leaves documentation
  asserting capability that no longer exists. The mutation transcript in T4 is
  not a commit; the working tree is restored byte-identically before commit 1.

## Conditions to verify during execution

- **C-1** — after a cooldown has been established (i.e. every successful
  response in the new test **except** the pre-cooldown control call) the
  response must carry the notice. If it does not, stop and report a REQ-111a
  defect; do not weaken the assertion or mark the finding resolved. The control
  call is expected to carry none. The mutation check (T4) must also fail when
  the `collectNotices` cooldown loop is removed.
- **C-2** — `scripts/lib/security-model.ts` must not hardcode a gate value or
  a security-REQ id; the scope comes from the §4.11 body headings and only the
  gate tokens come from §9.5. If a REQ id or gate has to be written into the
  module to pass, the parse is wrong.
- **C-3** — the category check asserts *presence and a non-empty controlling
  cell*, not that each controller is the right REQ; controller correctness is
  the open roadmap §R9 taxonomy item and must not be smuggled in.
- **C-4** — no REQ body edit. `REQ-096` and `REQ-111a` are unchanged; if a cold
  pass wants them reworded, that is a separate increment.
- **C-5** — `npm run check` runs only after `aar.md` carries a terminal token.
- **C-6** — the review cap: one cold pass, at most one diff re-review; at the
  cap an unresolved item goes to the user.

## Unknowns

- Whether the first successful fallback response already carries the notice —
  T3 settles it; C-1 defines the outcome if it does not.
- Whether adding `REQ-111a` to the `dispatch-orchestration` header changes any
  coverage report — `check-gate-coverage` treats an added citation additively;
  T13 confirms.
- Whether `validate-spec` reports the new `scripts/lib/*.test.ts` as an
  undocumented source file — resolved by reading: `scanDir` is called on `src/`
  only (`scripts/validate-spec.ts:102`), so it cannot. `check-gate-coverage`
  treats an added citation additively; T13 confirms the gate, and if any other
  gate reports the new files, record its exact finding and stop rather than
  guessing at a registration.

## Evidence

- Plan artifact: stamped copy under
  `~/.local/state/opencode/plans/<repo-key>/` (sha256 recorded on the stamp).
- Cold pass: `plan.cold/` in this directory — stage reports plus `report.md`;
  the stamp records the `report.md` hash.
- Declared targets are the nine file paths in the Blast radius table plus this
  increment's own directory.
- `scripts/lib/security-model.ts` and `scripts/lib/security-model.test.ts` are
  the two declared targets that do not exist yet; both are additive
  deliverables.
- `REQ-096` and `REQ-111a` resolve to `infobroker.md:667` and `:653`; the
  backticked path literals in this plan are not declared targets.
