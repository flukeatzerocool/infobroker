# Plan — R2b-i provider auth-field validation

**Status:** executed 2026-11-11 (revision 7, F-R2-3 only) · **Depth:** standard
**Review independence:** cold pass on revision 6 **FAILED** (4 blockers; all corrected in this revision) — report `/tmp/opencode/r2b-cold/report-final2.md`. The corrected revision has not itself been cold-reviewed: the review loop stopped at seven passes by user decision. Execution proceeds under the recorded risk acceptance in § Risk acceptance.
**Rollback:** revert two commits. One production function (`validateConfig` in `src/config.ts`) and one REQ body change; no persisted state, schema, config value, credential format, tool contract, or response shape changes.
**Roadmap item:** the retired `ROADMAP.md` § R2b configuration reload and validation — this plan is the R2b-i increment that closes part of it and replaces its section with two successors (D5)
**Predecessor:** `289c909` (`docs(roadmap): split R2 and record the R2a close`)

## Re-scope and review history

Revision 2 carried all three R2b findings. Revisions 3–5 tried to close F-R2-3
and F-R2-7 together and were rejected by cold passes 2–5. Every rejection's
blockers sat in the F-R2-7 half: a spawned-server evidence set whose assertions
could not be made non-vacuous, a `key_pool` row shape owned by § R8, and an
`inspect_providers` status row that § R2c's F-R2-9 already has in flight.

Pass 5 also produced the finding that changes the spec side: **REQ-037's body
does not authorize the validation this increment adds** (`infobroker.md:420-427`
enumerates provider fields, keys, chains, appends, capabilities, and rate
limits — not the shape of `auth_env`/`url_env`/`auth_optional`), and REQ-037 is
scoped to load and reload, so a *patch* is authorized by REQ-040's
"validate the merged configuration before committing" (`infobroker.md:435`).

Revision 6 does one thing: it makes the three field rules real, puts them in
REQ-037, and leaves F-R2-7 to a successor section whose blockers it names
(D5). The `/tmp/opencode/r2b-cold/` directory holds the pass-2 report and the
pass-5 stage reports; the earlier passes' files were removed when that
temporary directory was recreated, so their findings are carried forward here
rather than re-cited.

## Why this finding alone

F-R2-3 is a reproduced, self-contained defect: an unvalidated field type loads
cleanly and then throws inside dispatch. Its fix is one additive branch set in
the function that already validates every config path, plus the REQ sentence
that authorizes it. It needs no harness, no status row, and no key-pool
observation — all of which belong to the finding about *reporting* a
credential's absence (F-R2-7).

## Baseline (verified this session)

- `git log -1` → `289c909`; working tree clean except this plan directory.
- `npm run status` → version 2026.11.7, 23 roadmap items, 63 unpushed commits.
- `npm run check` → **PASS** (full, 22 gates, 112.7 s). The
  `check-loop-artifacts` warning for
  `2026-11-10-r6-encryption-capacity-remediation` does not fail the suite: only
  `check-non-goals` is recorded advisory in `scripts/gate-ledger.json`, and the
  loop-artifact gate reports warnings while exiting 0.
- Register rows: `worklist.md:619` (F-R2-3, P1) and `:623` (F-R2-7, P2), both
  `Scheduled-roadmap`; F-R2-2 at `:618` (P1).
- `providerUsable` (`src/config.ts:1033-1044`) returns false for a disabled
  provider (`:1036`) and reads `url_env`/`auth_env` by truthiness (`:1037-1038`),
  which is why a falsy declared value is a bypass rather than a neutral unset.
- `getStartupConfigIssue()` is exported at `src/config.ts:84`; the recovery path
  sets `code: "invalid_merged_user_layer"` at `:988` and derives the message from
  the thrown error at `:989` and `:993-995`.
- `applyDefaults` (`src/config.ts:320-338`) fills only `timeout` and
  `retry_*` from `defaults`; it never coerces a provider auth field, so a `null`
  reaches `validateConfig` on every path.
- Shipped providers, read from `config.json`: `core` declares
  `auth_env: "INFOBROKER_CORE_API_KEY"` with no `auth_optional`; `github` adds
  `auth_optional: true`; `exa` is `enabled: false` with one `auth_env`; the only
  `url_env` is `config.json:220` (`INFOBROKER_SEARXNG_URL`, non-empty).
- `src/config.test.ts:1` reads
  `// @implements REQ-010 REQ-042 REQ-043 REQ-037 REQ-015 REQ-040 REQ-067 REQ-105 REQ-113`,
  and the rate-limit rejection tests at `:460-476` establish the
  `rejects … (REQ-037)` naming convention.

## Predicate re-verified this session

A config with `providers.exa.auth_env = 42`, `enabled: true`, and `exa`
prepended to `general_web` passes `loadConfig()` with no error, then
`getDispatchChain("general_web")` throws `envName.endsWith is not a function`
from `poolEnvName` (`src/key-pool.ts:157`), reached through `poolKeysForEnv`
inside `providerUsable` (`src/config.ts:1038-1040`). `validateConfig`
(`src/config.ts:359-969`) has no branch for any of the three fields, and
`src/types.ts:55` declares `auth_optional?: boolean` with nothing checking it.

## Finding in scope

| Finding | Severity | Disposition target |
|---|---|---|
| F-R2-3 | P1 | `Resolved` |

F-R2-2 (P1, `worklist.md:618`) and F-R2-7 (P2, `:623`) stay
`Scheduled-roadmap` and move to § R2b-ii and § R2b-iii respectively (D5).

## Done bar

**Done bar:** the clauses below, each with the verification named in the summary
table at the end of this plan.

The bar is met when every clause holds on the final tree.

- **DB-1** `validateConfig` rejects a declared provider field whose type is
  wrong: `auth_env` and `url_env` when `typeof value !== "string" || value === ""`,
  `auth_optional` when `typeof value !== "boolean"`. `null` falls out of the
  type test. `auth_optional: false` remains valid and is asserted accepted (D1).
- **DB-2** Twelve rejection cases pass at the `validateConfig` level — `auth_env`
  as a number, empty string, `null`, an array carrying a sentinel, and a boolean
  (all on an `enabled: true` provider); `url_env` as an array, empty string,
  `null`, and an object; `auth_optional` as a string and as `null`; and one case
  on a provider with `enabled: false` — plus one acceptance case for
  `auth_optional: false`. The disabled-provider case carries the User impact
  claim that the rules apply regardless of `enabled`. Each rejection asserts a
  message naming the provider slug and the offending field (D3).
- **DB-3** Each of the twelve was observed before the fix and the observation is
  recorded per case in `tasks.md` (C-1). The original reproduction — `exa` with
  `auth_env: 42`, `enabled: true`, prepended to `general_web` — is recorded too:
  before the fix `loadConfig()` accepts it; after the fix `loadConfig()` rejects
  it and `getDispatchChain("general_web")` no longer reaches the throw.
- **DB-4** Two layers are exercised through the recovery path: one declaring
  `providers.exa.auth_env = 42` and one declaring `auth_env: null`. Each starts
  on the shipped configuration, leaves the layer file byte-identical, and
  records `getStartupConfigIssue()?.code === "invalid_merged_user_layer"`
  (`src/config.ts:84`, set at `:988`) whose message names `exa` and `auth_env`.
- **DB-5** A patch declaring `providers.exa.auth_env = 42` throws before the
  file is written, and the layer file is unchanged afterwards. The patch's
  authority is REQ-040; the pre-existing tool handler already maps the throw to
  a `config_error` envelope (`src/index.ts:2478-2489`), which this increment
  does not change or assert.
- **DB-6** `reloadConfig()` against a layer declaring that value, and against one
  declaring `auth_env: null`, each throws, leaves the previously active
  configuration active, and leaves the layer file unchanged.
- **DB-7** The sentinel case is asserted on two paths. *(load)* With `exa`
  declaring `auth_env: ["sk-sentinel-a"]`, `loadConfig()` records a
  `getStartupConfigIssue()` whose message is non-empty, names `exa` and
  `auth_env`, and contains neither `sk-sentinel-a` nor `sk-sentin`; the
  `vi.spyOn(console, "warn")` capture is non-empty with the same three
  properties. *(throw)* `reloadConfig()` against that layer throws a message
  that is non-empty, names `exa` and `auth_env`, and contains neither needle.
- **DB-8** REQ-037 carries the sentence in D2 verbatim and
  `npm run validate-spec` passes. `src/config.test.ts` carries three named
  clause tags — `@implements REQ-037 auth-env`, `REQ-037 url-env`,
  `REQ-037 auth-optional` — because the sentence has three independently
  implementable branches (C-4). The G3 detector does not see this construct
  (it only counts parenthesized "or" enumerations without backticks), so the
  tags carry the traceability rather than the detector.
- **DB-9** `CHANGELOG.md` gains one entry under `## 2026.11.7`, and
  `DECISIONS.md` gains one entry recording that a declared provider auth field
  with an invalid shape is rejected rather than read as "unset".
- **DB-10** `ROADMAP.md` replaces § R2b with the two sections in D5, each with at
  most three bullets and a `**Trigger:**` line; the old section's close
  condition is recorded as superseded by this split. `worklist.md` marks F-R2-3
  `Resolved` with a one-line summary in the file's existing
  `**Resolved <date>** — ` format, and points F-R2-2 and F-R2-7 at their
  sections; the `aar.md` carries a DB-clause-to-evidence table and ends in
  `LOOP PAUSED`; `npm run check` exits 0. A `LOOP OPEN` end is the non-closure
  path and means the bar is **not** met. The table is the AAR's own contract and
  is checked in Phase 3 step 8, not by `check-loop-artifacts`.
- **DB-11** `npm run typecheck`, `npm run validate-spec`,
  `npm run check-gate-coverage`, and `npm run check` exit 0 on the final tree.

**Non-closure rule.** A fix that needs a `config.json` value change, a new
config key, a change to `providerUsable`'s contract, a fixture edit, or any
production edit outside `validateConfig` in `src/config.ts` stops the
increment. The AAR ends `LOOP OPEN`, the surviving work moves to § R2b-ii or
§ R2b-iii, and both roadmap sections are rewritten rather than deleted (C-3).

## Decisions

- **D1 — three rules in `validateConfig`; a declared but unusable shape is
  invalid.** For the string fields, `null` and `""` are rejected along with
  non-strings: at dispatch `auth_env` is read as `if (p.auth_env)`
  (`src/config.ts:1038`) and `url_env` as `if (p.url_env && …)` (`:1037`), so a
  falsy value silently converts "requires a credential/endpoint" into "requires
  nothing" — a keyed provider with `auth_env: null` is admitted to every chain
  and fails at the provider with a 401 instead of being filtered as
  `no_api_key`. `auth_optional` must be a boolean; `null` is rejected there for
  consistency, while `false` and `true` remain valid because both are real
  policy. *Alternative rejected:* implementing "unset" semantics in
  `providerUsable` — a dispatch-contract change outside this increment.
  *Consequence:* there is currently no config-level way to clear a declared auth
  field; that capability is § R2b-ii's second bullet.
- **D2 — the obligation goes into REQ-037, and the patch's authority is
  REQ-040.** No new REQ: REQ-037 is the config-validation contract and already
  enumerates its rejection classes (SR-011). The amendment is this sentence,
  verbatim: *"Validation SHALL also reject a declared provider `auth_env` or
  `url_env` that is not a non-empty string, and a declared `auth_optional` that
  is not a boolean."* REQ-037 stays scoped to load and reload; DB-5's patch
  behaviour is required by REQ-040's "validate the merged configuration before
  committing" (`infobroker.md:435`), which the patch path already honours by
  calling `validateConfig` at `src/config.ts:313`.
- **D3 — the message names the field and never the value.** Existing validators
  interpolate enum-like values (`config_version …`) but never free text; a
  credential pasted into a provider field must not reach a message, the startup
  issue, or stderr. The new branches use the existing `Provider "<slug>": …`
  shape with the field name only, and DB-7 pins it with a sentinel value. The
  startup issue and the warning log both derive from the thrown message
  (`src/config.ts:989`, `:993-995`), so one redaction point covers all three
  sinks.
  The message shape is a test convention and an implementation constraint of this
  plan; it is not a spec-level contract, so no gate enforces it and DB-2/DB-7
  are its only evidence.
- **D4 — no spawned-server harness in this increment.** The rules are proven at
  the config layer, where `validateConfig` runs on load (`:976`), reload
  (`:1003`), and patch (`:313`). The reporting surfaces that need a spawned
  server belong to F-R2-7.
- **D5 — the roadmap section is replaced by two scheduled successors.**
  `## R2b-ii user-layer write ordering` carries F-R2-2 and three bullets: merge
  the patch over the current on-disk layer and apply the same fresh read to
  `migrateUserConfigLayer` and `loadConfigFromDisk`; narrow the read-modify-write
  window and back up the bytes that were read rather than the file at backup
  time; document and provide the config-level route to clear a declared provider
  auth field, which this increment leaves unavailable. Trigger: "start after
  R2b-i ships; close when F-R2-2 is `Resolved` and the unset path is tested."
  `## R2b-iii key-safety evidence` carries F-R2-7 and two bullets: assert
  REQ-011's missing-key, optional-key, and no-leak clauses through a spawned
  server; coordinate the `inspect_providers` status row with § R2c's F-R2-9 and
  the key-pool row shape settled by § R8. Trigger: "start after § R2c and § R8
  settle the rows it asserts; close when F-R2-7 is `Resolved`."
  Deferring is a schedule decision: both findings keep their severity and their
  `Scheduled-roadmap` state.

## Blast radius

**Production (1 file, one function).** `src/config.ts` — `validateConfig` only:
three field rules in the existing per-provider error loop.

**Spec (1 file, one REQ).** `infobroker.md` — REQ-037 gains the D2 sentence; no
new REQ, no appendix change.

**Tests (2 files).** `src/config.test.ts` (twelve rejection cases with message
assertions; the `auth_optional: false` acceptance case; the original
`loadConfig` reproduction; the two-layer REQ-113 recovery case; the two-value
reload case; the DB-7 load and throw sentinel cases with the `console.warn`
spy). `src/config-patch.test.ts` (one added case: a malformed field is rejected
before the file is written). `src/key-pool.test.ts` is run as a regression
suite and is not edited.

**Documentation and bookkeeping (5 paths).** `CHANGELOG.md`, `DECISIONS.md`,
`ROADMAP.md`, `docs/plans/2026-11-09-full-review-sweep/worklist.md`, and this
increment directory.

**Explicitly out of scope.** F-R2-2 and the write-path writers; F-R2-7 and every
reporting surface; `config.json` values; fixture edits; the R2c and R2d
findings; the key-pool state threat model (R8).

## Risk acceptance

**Risk accepted:** execute revision 7 of this plan without a cold review of the
corrected text. The seven-pass cold review found real defects on every pass; the
four blockers and six majors from the seventh pass are corrected here (case
count, load-vs-throw sinks, clause tags, `LOOP PAUSED`, roadmap retirement
wording, post-fix anchor), but the corrections themselves are unreviewed.
Authorized by the maintainer's instruction "run one final cold pass, then
execute the plan" on 2026-11-11, after being shown that pass's blockers. The
residual risk is limited to plan text, not to the code change: the code diff is
gated by `validate-spec`, `check-gate-coverage`, the targeted suites, and the
full `npm run check`, and every behaviour claim has a test that fails without
the fix.

## Phases and steps

### Phase 0 — Scaffold, baseline, and discovery

1. Confirm this directory carries `plan.md`, `tasks.md`, and an `aar.md` ending
   in `LOOP OPEN`.
2. Confirm the baseline above (`git log -1`, `npm run status`, `npm run check`).
3. Discovery: sweep `src/**`, `test-fixtures/`, `debate-club/`, and `config.json`
   for a provider declaring a non-string, empty, or `null` auth field. A hit
   stops the increment (C-2); no fixture is edited.
4. Discovery: confirm the five `validateConfig` call sites — load `:976`,
   loop-recovery `:985`, reload `:1003`, patch `:313`, and the auto-migration
   candidate at `:198` — and that the patch call precedes `atomicWriteFile` at
   `:315`. The migration site validates the same three fields; if it rejects a
   layer this increment would otherwise accept, that is a contradiction that
   stops the increment.
5. Discovery: read REQ-037 and REQ-040, draft the D2 sentence, and count the
   amended body against Appendix B's limits by hand (≤800 characters, ≤8
   sentences, ≤8 SHALL clauses, ≤5 backtick tokens); `validate-spec` itself runs
   after the amendment lands in Phase 3.
6. Discovery: confirm `loadConfigFromDisk`'s recovery derives the startup issue
   message from the thrown error (`src/config.ts:989`) and warns with the same
   string (`:993-995`), so DB-7's load path covers both sinks.
7. Discovery: confirm the test module's reset pattern (`vi.resetModules()` plus
   a fresh `import("./config.js")`, as `src/config.test.ts` already uses) so
   DB-4's two layers and DB-7's case each observe their own
   `startupConfigIssue` rather than the first one set.

### Phase 1 — Failing evidence first (red recorded before the fix)

1. `src/config.test.ts`: add the twelve rejection cases (the disabled-provider
   case uses `exa`, which ships `enabled: false`), each asserting the message
   names the slug and the field; run before the fix and record the observed
   result per case in `tasks.md` (C-1). Add the `auth_optional: false`
   acceptance case in the same run and record it green.
2. `src/config.test.ts`: add the REQ-113 cases for `auth_env: 42` and
   `auth_env: null` — shipped-config start, layer file bytes unchanged,
   `invalid_merged_user_layer` with `exa` and `auth_env` in the message — and
   record the observed pre-fix result.
3. `src/config.test.ts`: add the reload cases for both values —
   `reloadConfig()` throws, the previous `getConfig()` result is still returned,
   layer bytes unchanged — and record the observed pre-fix result.
4. `src/config-patch.test.ts`: add the malformed-field patch case; record that
   it is accepted and written today.
5. `src/config.test.ts`: add the DB-7 sentinel case with the
   `vi.spyOn(console, "warn")` capture; record that today it loads cleanly and
   produces no message.

### Phase 2 — Fix

1. `src/config.ts` `validateConfig`: add the three rules to the existing
   per-provider error loop, naming the slug and field, never the value (D1, D3).
2. `infobroker.md`: amend REQ-037 with the D2 sentence verbatim.
3. Re-run Phase 1's suites; every added case passes, and DB-7's three sinks hold.

### Phase 3 — Verification and documentation

1. Audit `git diff --stat` against the blast radius (C-3), before any
   bookkeeping edit.
2. Targeted suites: `src/config.test.ts`, `src/config-patch.test.ts`,
   `src/key-pool.test.ts` (regression).
3. `npm run typecheck`, `npm run validate-spec`, `npm run check-gate-coverage`,
   then `npm run check` (which runs the full gate suite, including `test` and
   `test-debate-club`).
4. `CHANGELOG.md`: one entry under `## 2026.11.7`.
5. `DECISIONS.md`: the declared-invalid entry.
6. `ROADMAP.md`: replace § R2b with the two D5 sections; `npm run check-roadmap`
   and `npm run check-non-goals` pass. Verify by diff, by `grep -n "^## R2b"
   ROADMAP.md` returning exactly those two headings, and by confirming each
   section carries the bullets and trigger D5 specifies.
7. `docs/plans/2026-11-09-full-review-sweep/worklist.md`: F-R2-3 → `Resolved`
   with a one-line summary in the file's existing `**Resolved <date>** — `
   format; refresh its anchor to `validateConfig`'s post-change range (read the
   final line numbers) or to the symbol name; F-R2-2 and F-R2-7 keep
   `Scheduled-roadmap` and name their sections.
8. `aar.md`: the DB-clause-to-evidence table, dispositions, and the LOOP token.
9. Final `npm run check` on the tree that ships.

### Phase 4 — Commit series

1. **One concern: the validation rule** — `infobroker.md`, `src/config.ts`,
   `src/config.test.ts`, `src/config-patch.test.ts`, `CHANGELOG.md`, staged by
   explicit path. Gate: `npm run typecheck`, `npm run validate-spec`, and the
   two targeted suites after the commit.
2. **Bookkeeping and record** — `ROADMAP.md`, `DECISIONS.md`, `worklist.md`,
   this plan directory, staged by explicit path. Gate: `npm run check` on the
   tree that ships.

## Conditions

- **C-1** Pre-fix results are recorded as observed, not assumed. A case that is
  already green is kept as regression evidence with its reason in `tasks.md`.
  Pass signal: `tasks.md` carries one observation line per added case.
- **C-2** No fixture is edited. A fixture or shipped config carrying a rejected
  value stops the increment and is reported.
- **C-3** The non-closure rule is audited by Phase 3 step 1, before any
  bookkeeping edit; an escaped fix stops the increment.
- **C-4** The three `REQ-037` clause tags are part of the deliverable, not a
  conditional: add them to `src/config.test.ts` in Phase 2 regardless of the
  detector's output. Pass signal: `grep -c "@implements REQ-037"` in that file is
  1 (the existing file-level line) plus the three named tags.

## User impact

No breaking change for a configuration whose declared values have the right
shape; a running server needs one restart to pick up the change. A user layer
that declares a non-string, empty, or `null` `auth_env`/`url_env`/
`auth_optional` no longer loads cleanly: the server starts on the shipped
configuration, leaves the layer untouched, and records the failure for the
REQ-113 startup report. A configuration that relies on a falsy value to disable
a credential requirement is exactly the silent bypass D1 removes. The
provider's validation applies whether or not the provider is enabled, so
disabling it does not exempt it; the supported fixes are to give the field a
valid value, delete the field, remove the provider entry, or set
`auth_optional: true` where the provider permits optional credentials. No config
key, environment-variable name, tool parameter, or response shape changes.

## Rollback

Revert the two commits. The production change is one function body in
`src/config.ts`, and the spec change is one sentence in REQ-037; no persisted
state, schema, config file, or wire format changes, so a revert restores the
exact prior behavior with no data migration. The worklist dispositions, the
`DECISIONS.md` entry, the roadmap rewrite, and the increment record are added by
the second commit and are removed with it.

## Verification summary

| Clause | How it is verified |
|---|---|
| DB-1 | `config.test.ts` — twelve rejection cases plus the `auth_optional: false` acceptance case |
| DB-2 | each rejection case asserts the slug and field in the message |
| DB-3 | `tasks.md` records each pre-fix observation |
| DB-4 | `config.test.ts` — two layers (`42`, `null`), issue code and message, layer bytes |
| DB-5 | `config-patch.test.ts` — throw before write, file unchanged |
| DB-6 | `config.test.ts` — reload throws for both values, previous config returned, bytes |
| DB-7 | `config.test.ts` — thrown message, startup issue message, `console.warn` capture: non-empty, names `exa`/`auth_env`, no sentinel |
| DB-8 | `infobroker.md` diff; `validate-spec`; detector classification recorded (C-4) |
| DB-9 | `CHANGELOG.md` and `DECISIONS.md` diffs |
| DB-10 | roadmap diff, heading grep, worklist diff, AAR table, `npm run check` |
| DB-11 | `typecheck`, `validate-spec`, `check-gate-coverage`, `npm run check` |
