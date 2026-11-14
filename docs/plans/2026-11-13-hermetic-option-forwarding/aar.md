# AAR — Hermetic config option forwarding

**Review cap:** light self-review only — 1 pass, no cold pass required at this depth; used 1 pass.
**Increment:** `docs/plans/2026-11-13-hermetic-option-forwarding/`
**Roadmap item closed:** `ROADMAP.md` § Hermetic test option forwarding.

## What happened

The hermetic harness had two silent-drop points: `writeHermeticConfig` merged only
`output`/`fetch`/`kb`, and `src/dispatch-orchestration.test.ts`'s `setup()` re-narrowed
the option type to `chains`/`output`. Both dropped an unrecognized option without an
error, so a fixture could keep running against a shipped default while the test author
believed an override was in force — the failure that cost the R5 increment one failing
assertion.

The change adds `preservation` and `source_quality` merge hooks, rejects any unknown
option with `writeHermeticConfig: unknown option "<key>"`, widens `setup()` to
`Omit<HermeticConfigOptions, "providers">` with a full spread, and replaces the four
`config.local.json` workarounds in the dispatch suite with ordinary options. A new
`src/lib/stub-provider.test.ts` pins the written config, the rejection, and the isolated
KB path.

## What went right

- The red-before probe was genuine: the new test failed twice before C-1 (dropped block,
  no throw) and passed after, with no test-specific plumbing in the harness.
- The guard runs before `mkdtempSync`, so a rejected option leaves no temp directory.
- The converted dispatch cases kept their assertions unchanged, so the option path is
  the only variable.

## What went wrong

- **The plan undercounted the workarounds (P3).** C-2 named three `config.local.json`
  sites; there were four — the first deep-reading case also wrote `fetch.allow_private_urls`.
  Caught by DB-3's grep before commit 1; recorded as Amendment 1 (no done-bar, criterion,
  or blast-radius change) and the plan was re-stamped before the remaining work. The
  re-stamp re-ran preflight; the diff re-review was self at light depth.
- **First draft of the new test compared `kb.storage_path` against `roots[0]`.** The
  module-level array accumulates across cases, so the third case referenced the first
  case's root; fixed to the value returned by its own call before any implementation
  work. Red-baseline noise from the author, not a harness defect.

## Findings and dispositions

- **F-1 (P3) — plan undercounted the workaround sites.** Resolved in-session: Amendment 1
  added to `plan.md`, plan re-stamped, all four sites converted. No new action.
- **F-2 (P3) — test-authoring bug in the fresh test.** Resolved in-session before the
  implementation edit; no harness change. No new action.
- **F-3 (P3) — the guard's key list can drift from the interface.** Documented as a plan
  limit; the error names the offending key, so drift fails loudly at the first caller
  that uses it. Closed as informational.

No P0 or P1 findings. No new action items.

## Verification

| Command | Result |
|---|---|
| `npx vitest run src/lib/stub-provider.test.ts` (before C-1) | 2 failed / 1 passed — block dropped, no throw |
| `npx vitest run src/lib/stub-provider.test.ts src/dispatch-orchestration.test.ts` | 26 passed |
| `npm run typecheck` | exit 0 |
| `npm run version-sync` | OK (2026.11.11) |
| `npm run check-script-discipline` | 78 TS + 9 shell scripts conform |
| `grep -c "config.local.json" src/dispatch-orchestration.test.ts` | 0 |
| `npm run check-roadmap` | OK (1 section) |
| `npm run check-non-goals` | OK |
| `npm run check-loop-artifacts` | 0 error(s), 1 warning(s) — the pre-existing 2026-11-10 Done-bar warning |
| `npm run session:close -- --dry-run` | exit 0 |
| `npm run check` (full) | PASS (full, 163.4 s) on this tree |

## Commits

1. `fix(hermetic): forward config options and reject unknown ones`
2. `docs(roadmap): retire the hermetic option forwarding item`
3. `docs(plans): record the hermetic option forwarding increment`

## Review record

Light depth: self-review only, 1 pass, no cold pass required. Conditions C-1 (no REQ body
governs the harness option surface — `grep -n "HermeticConfig\|stub-provider" infobroker.md`
→ 0 matches) and C-2 (the dropped-option red was demonstrated at unit level, not assumed)
were both satisfied before the first edit.

LOOP PAUSED
