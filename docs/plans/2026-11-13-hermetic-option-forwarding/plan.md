# Plan — Hermetic config option forwarding

**Status:** draft 2026-11-13 (revision 1) · **Depth:** light
**Rollback:** revert two commits — (1) the harness forwarding plus its tests and changelog line, (2) the roadmap retirement and the increment record. No runtime code, no runtime state, no response shape. Rollback cost 1 (0 add, 1 reversible edit, 2 destructive).
**Roadmap item:** `ROADMAP.md` § Hermetic test option forwarding (retired by this increment)
**Predecessor:** `19b4205` (`docs(plans): record the review-loop cap increment`)

## Review depth

**Light** — one surface (the test harness: `src/lib/stub-provider.ts` and its one
consumer `src/dispatch-orchestration.test.ts`), no external state, no destructive
operation, rollback cost 1. Self-review only; no cold pass is required at light.

## Baseline (verified this session)

- `git log -1` → `19b4205`; tracked tree clean.
- `npm run status` → version 2026.11.11 (latest tag v2026.11.07), 195 unpushed commits (oldest 4.1 d), 1 open roadmap item, last pipeline run 2026-11-07.
- `npm run check` → **PASS** (full, 22 gates, 169.6 s), run at `19b4205` before any edit. Only finding: the pre-existing `check-loop-artifacts` warning for `2026-11-10-r6-encryption-capacity-remediation` (no `**Done bar:**` line).
- Defect evidence, read this session:
  - `src/dispatch-orchestration.test.ts:108-118` — `setup()` accepts an inline type of `{ chains?, output? }` and forwards only those two keys to `writeHermeticConfig`; every other option is dropped without an error.
  - Three call sites work around it by writing a `config.local.json` into the temp root instead: `:483-486` (`source_quality`), `:507-510` (`fetch`), `:621-624` (`fetch` + `preservation`).
  - `src/lib/stub-provider.ts:158-171` — `HermeticConfigOptions` declares `providers`, `chains`, `output`, `fetch`, `kb`, `fileLogs` only; `:234-236` merges `output`/`fetch`/`kb` and has no merge hook for `preservation` or `source_quality`; an unrecognized key is ignored silently.
  - Prior failure: `docs/plans/2026-11-12-r5-snapshot-family-remediation/aar.md:56` records a `preservation: { enabled: false }` assertion that failed because `setup()` dropped the option, and schedules this roadmap item.
- Option keys in use across callers today (`grep -rn "writeHermeticConfig\\|fileLogs" src`): `providers` (`key-safety-action.test.ts`, `provider-health-action.test.ts`), `fetch`/`kb` (`fetch-page-extraction.test.ts`), `fileLogs` (`key-safety-action.test.ts:228,256`), `chains`/`output` (`dispatch-orchestration.test.ts`); `quota.test.ts:249` and `provider-health-action.test.ts:131,201,210` pass no options.

## Problem

The hermetic harness has two silent-drop points: `writeHermeticConfig` only merges
the three blocks it knows, and the dispatch suite's `setup()` re-narrows the option
type to the two keys its tests happened to need. An unknown or newly needed option
is discarded, so a fixture keeps running against the shipped default while the
test author believes it set an override — the failure mode that already cost one
increment one failing assertion (R5 AAR), and that would silently weaken a future
fixture instead of failing loudly. The roadmap's two deliverables are the fix:
forward every option a caller passes, and reject an unknown one instead of
dropping it.

## Change entries

**C-1 (S) — `src/lib/stub-provider.ts`.** Widen `HermeticConfigOptions` with
`preservation?: Record<string, unknown>` and `source_quality?: Record<string, unknown>`,
merged into the cloned config beside the existing `fetch`/`kb` hooks
(`config.preservation = { ...(config.preservation ?? {}), ...options.preservation }`,
same shape for `source_quality`), so a caller override wins over the shipped block.
Add a module-level `HERMETIC_OPTION_KEYS` set (`providers`, `chains`, `output`,
`fetch`, `kb`, `preservation`, `source_quality`, `fileLogs`) and a guard at the top
of `writeHermeticConfig` that throws `writeHermeticConfig: unknown option "<key>"`
for any key outside the set. Rationale: explicit typed hooks follow the `fetch`/`kb`
precedent from `docs/plans/2026-11-11-r4-fetch-extraction-remediation/plan.md:69`
(D5). **Alternative rejected:** a free-form `blocks: Record<string, Record<string, unknown>>`
map — it removes the typo detection the roadmap's "reject an unknown option"
clause asks for and hides the option surface from TypeScript.

**C-2 (S) — `src/dispatch-orchestration.test.ts`.** `setup()` takes
`options: Omit<HermeticConfigOptions, "providers"> = {}` (importing the type from
`./lib/stub-provider.js`) and spreads it into `writeHermeticConfig(url, { providers, ...options })`,
so every declared option forwards and the runtime guard rejects a stray key. Replace
the three `config.local.json` workarounds with options: `source_quality` at `:483-486`,
`fetch` at `:507-510`, and `fetch` + `preservation` at `:621-624`; the `preservation:
{ enabled: false }` case is the red-before probe for the dispatch suite (it fails
today because the option is dropped and preservation stays on). Remove the now-unused
`writeFileSync`/`join` imports only if no other use remains (the file also seeds
quota and reads pages).

**C-3 (S) — `src/lib/stub-provider.test.ts` (new, ~40 lines).** Hermetic unit test
with no server: (a) `preservation` and `source_quality` overrides appear in the
generated `<root>/config.json` with the shipped block's other keys preserved;
(b) an unknown option key throws an `Error` whose message names the key; (c) the
`kb.storage_path` still points under the temp root and `auto_index` defaults to
`false` unless overridden. Cases (a) and (b) are red today — (a) because the block
is dropped, (b) because nothing throws — and are observed red before C-1. `@implements`
annotations follow the file's existing header style (`@implements REQ-024b`), since
the guard is harness-only and no REQ body changes.

**C-4 (S) — `CHANGELOG.md`.** New top entry `## 2026.11.11 — Hermetic option forwarding`
(heading date must equal the package version, `version-sync`) with two bullets:
the harness forwards `preservation` and `source_quality` like the existing `fetch`/`kb`
hooks, and an unknown option now throws instead of being dropped; and the dispatch
suite's `setup()` forwards every declared option, with its three `config.local.json`
workarounds replaced by options.

**C-5 (S) — `ROADMAP.md`.** Remove `## Hermetic test option forwarding`; its trigger
closes with this increment's own test.

**C-6 (M) — `docs/plans/2026-11-13-hermetic-option-forwarding/`.** `plan.md` (this
text, with a line-initial `**Review cap:**` and `**Done bar:**` line) and `tasks.md`
are written at execution start; `aar.md` is written at close with the cap record,
dispatches used, findings and dispositions, gate results, and `LOOP PAUSED` or
`LOOP OPEN`.

## Blast radius

| File | Change | Size | Gate |
|---|---|---|---|
| `src/lib/stub-provider.ts` | 2 block hooks + unknown-option guard | S | `typecheck`, `test` |
| `src/dispatch-orchestration.test.ts` | `setup()` type + 3 workarounds removed | S | `typecheck`, `test` |
| `src/lib/stub-provider.test.ts` | new 3-case unit test | S | `typecheck`, `test` |
| `CHANGELOG.md` | entry | S | `version-sync` |
| `ROADMAP.md` | retire section | S | `check-roadmap`, `check-non-goals` |
| `docs/plans/2026-11-13-hermetic-option-forwarding/{plan,tasks,aar}.md` | increment record | M | `check-loop-artifacts` |

No file outside this table is modified. No spec (`infobroker.md`) change: the
harness carries `@implements REQ-024b REQ-011` but no REQ body governs its option
surface, so no traceability edit is required.

## Amendment 1 (execution, 2026-11-13)

C-2 and the Baseline undercounted the `config.local.json` workarounds: there are
four, not three. The first deep-reading case (`src/dispatch-orchestration.test.ts:595-598`
at plan time) also writes `fetch: { allow_private_urls: true }` instead of passing
the option, and was folded into the same DB-3 condition without being named. C-2
converts all four; DB-3's `grep -c "config.local.json" ... → 0` already stated the
complete condition, so no done bar, acceptance criterion, or blast-radius file
changes. This is an amendment to an open increment, not a new scope.

## Verification

| Done bar | Step |
|---|---|
| **DB-1** — the red-before probe fails on today's harness | step 0: `npx vitest run src/lib/stub-provider.test.ts` → cases (a) and (b) fail (block absent / no throw). The dispatch `preservation: { enabled: false }` case cannot compile against today's `setup()` type, so the red is demonstrated at the unit level. |
| **DB-2** — every option forwards | after C-1..C-3: `npx vitest run src/lib/stub-provider.test.ts src/dispatch-orchestration.test.ts` → all pass, including the converted `preservation`, `source_quality`, and `fetch` cases |
| **DB-3** — no silent workaround remains | `grep -c "config.local.json" src/dispatch-orchestration.test.ts` → 0; `grep -rn "setup(\[" src/dispatch-orchestration.test.ts` still shows the suite's call sites with option objects |
| **DB-4** — the roadmap section is retired | `grep -c "Hermetic test option forwarding" ROADMAP.md` → 0; `npm run check-roadmap`; `npm run check-non-goals` |
| **DB-5** — the tree is green | `npm run check` (full) exit 0 on the final tree; `check-loop-artifacts` shows `0 error(s), 1 warning(s)` (the pre-existing warning) |

Not verified by a test: the guard's key list can drift from the interface if a future
option is added to one and not the other; the error message names the offending key,
so the drift fails loudly on the first call that uses it.

## Commit order

0. Pre-edit: run `npx vitest run src/lib/stub-provider.test.ts` (file absent today — write the test first, run it, record the two failures) and `npm run check-loop-artifacts` → `0 error(s), 1 warning(s)`.
1. `fix(hermetic): forward config options and reject unknown ones` — C-1, C-2, C-3, C-4. Gates: `npm run typecheck`, `npx vitest run src/lib/stub-provider.test.ts src/dispatch-orchestration.test.ts`, `npm run version-sync`, `npm run check-script-discipline` (no script files touched; confirms the tree is unaffected).
2. `docs(roadmap): retire the hermetic option forwarding item` — C-5. Gates: `npm run check-roadmap`, `npm run check-non-goals`.
3. `docs(plans): record the hermetic option forwarding increment` — C-6. Gates: `npm run check-loop-artifacts` (`0 error(s), 1 warning(s)`), `npm run session:close -- --dry-run`.
4. `npm run check` (full) once on the final tree — DB-5.

A failure at step 4 reopens step 1's files as an amendment to the open increment.
Before step 3 the increment directory is untracked, so abandoning it is a manual `rm`.

## Risks and mitigations

- **The guard rejects a legitimate future option.** The key set sits beside the
  interface it mirrors; adding an option is one edit in one file, and the error names
  the key, so the failure is immediate rather than silent. Recorded as a limit rather
  than a gate.
- **Converting `source_quality` changes what the analysis-omission test exercises.**
  It currently exercises the user-config merge path; after conversion it exercises the
  shipped-config merge path. The assertion (`blocked_count: 1`, no analysis) is
  unchanged, and the user-layer merge path keeps its own coverage in `src/config.test.ts`
  and `src/state-health.test.ts`.
- **Spawned-server flakiness.** No new server lifecycle is introduced; the existing
  suite pattern (stub provider + `withServer`) is reused, and the unit test needs no
  process at all.
- **TypeScript excess-property checks only bind object literals.** A dynamic caller
  could bypass the compile-time check; that is exactly what the runtime guard in C-1
  covers.

## User impact

No runtime, tool, spec, or response-shape change. Test authors get their options
honored and an error for a typo. Rollback cost: 1.

**Review cap:** light self-review only — 1 pass, no cold pass required at this depth.

**Done bar:** DB-1 through DB-5 pass, all three `config.local.json` workarounds in
`src/dispatch-orchestration.test.ts` are replaced by harness options, and
`ROADMAP.md` § Hermetic test option forwarding is retired.
