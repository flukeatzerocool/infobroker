# Tasks — Hermetic config option forwarding

Roadmap item: `ROADMAP.md` § Hermetic test option forwarding.
Plan: `plan.md` · Depth: light · Cap: 1 self pass.

## Step 0 — red-before baseline

- [x] `npx vitest run src/lib/stub-provider.test.ts` → cases (a) and (b) fail
      (block dropped, no throw)
- [x] `npm run check-loop-artifacts` → `0 error(s), 1 warning(s)` before the
      increment directory was created (recorded in the AAR baseline)

## Step 1 — C-1..C-4, commit `fix(hermetic): forward config options and reject unknown ones`

- [x] C-1 `src/lib/stub-provider.ts`: `preservation`/`source_quality` merge hooks
      and the `HERMETIC_OPTION_KEYS` guard
- [x] C-2 `src/dispatch-orchestration.test.ts`: `setup()` forwards every declared
      option; the three `config.local.json` workarounds replaced
- [x] C-3 `src/lib/stub-provider.test.ts`: cases (a), (b), (c) green
- [x] C-4 `CHANGELOG.md`: `## 2026.11.11 — Hermetic option forwarding`
- [x] Gates: `npm run typecheck`, the two vitest files, `npm run version-sync`,
      `npm run check-script-discipline`
- [x] `grep -c "config.local.json" src/dispatch-orchestration.test.ts` → 0 (DB-3)

## Step 2 — C-5, commit `docs(roadmap): retire the hermetic option forwarding item`

- [x] `ROADMAP.md` section removed (DB-4)
- [x] Gates: `npm run check-roadmap`, `npm run check-non-goals`

## Step 3 — C-6, commit `docs(plans): record the hermetic option forwarding increment`

- [x] `aar.md` written with cap record, findings, evidence, terminal token (DB-5)
- [x] Gates: `npm run check-loop-artifacts` (`0 error(s), 1 warning(s)`),
      `npm run session:close -- --dry-run`

## Step 4 — full gate

- [x] `npm run check` (full) exit 0 (DB-5)
