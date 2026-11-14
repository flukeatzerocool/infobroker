# Tasks — Review cap contract and the narrowing rule

Execution order. One checkbox per commit-order step; the done-bar rows sit under the step that verifies them. A step is ticked only when it is verified.

## Step 0 — pre-edit baseline

- [ ] `git log -1` is `a694430`; tracked tree clean.
- [ ] `npm run check-loop-artifacts` → `1 error(s), 1 warning(s)` (DB-2 baseline).
- [ ] `ls -d docs/plans/*/ | sort | tail -1` → `2026-11-13-r9-tool-quality-evidence/` (no increment at or after the cutoff).

## Step 1 — commit 1: `fix(loop-artifacts): require a declared review cap and its AAR record`

- [ ] C-2 cases (b)–(e) written first and observed red; (a) and (g) built with an `aar.md` carrying `**Review cap:** 1 cold pass; used 2 passes` and `LOOP PAUSED`.
- [ ] C-1 implemented: `CAP_CONTRACT_FROM`, `planReviewCap` / `aarReviewCap` on `Increment`, line-initial `**Review cap:**` parse, four error findings, `nameProblem` guard, `hasPlan` guard.
- [ ] `scripts/check-loop-artifacts.ts` header sentence updated.
- [ ] C-6 changelog entry `## 2026.11.11 — Review cap contract` added to `CHANGELOG.md`.
- [ ] Gates: `npm run typecheck:scripts`, `npx vitest run scripts/lib/loop-artifacts.test.ts`, `npm run check-loop-artifacts` (`1 error(s), 1 warning(s)`), `npm run check-script-discipline`, `npm run version-sync`.
- [ ] **DB-1** — all eight cases green; (b)–(e) red before C-1.

## Step 2 — commit 2: `docs(plans): state the review cap and the narrowing rule`

- [ ] C-3: `docs/plans/README.md` table rows and three Rules bullets.
- [ ] C-4: `AGENTS.md` `**Review cap.**`, `**Narrowing rule.**`, and `**Increment record.**` amended.
- [ ] C-5: `DECISIONS.md` D-117 with three stated limits.
- [ ] Gates: `npm run check-script-discipline`, `npm run version-sync`.
- [ ] **DB-3** — read-back of C-3..C-6 agrees.

## Step 3 — commit 3: `docs(roadmap): retire the review-loop convergence item`

- [ ] C-7: `## Review-loop convergence` removed from `ROADMAP.md`.
- [ ] Gates: `npm run check-roadmap`, `npm run check-non-goals`.
- [ ] **DB-4** — `grep -c "Review-loop convergence" ROADMAP.md` → 0.

## Step 4 — commit 4: `docs(plans): record the review-loop cap increment`

- [ ] C-8: `aar.md` carries `**Review cap:** 1 cold pass, at most 12 reviewer dispatches; used <n> passes`, the findings with dispositions, gates, and the terminal token.
- [ ] `plan.cold/` carries `00-scope.md`, the stage files, and `report.md`.
- [ ] `npm run check-loop-artifacts` → `0 error(s), 1 warning(s)`.
- [ ] **DB-5** — `TMP=$(mktemp -d) && mkdir -p "$TMP/docs/plans" && cp -r docs/plans/2026-11-13-review-loop-cap-contract "$TMP/docs/plans/2026-11-20-review-loop-cap-contract" && rm -rf "$TMP/docs/plans/2026-11-20-review-loop-cap-contract/plan.cold" && REVIEW_CAP_ROOT="$TMP" npx tsx -e 'import { validateIncrements } from "./scripts/lib/loop-artifacts.ts"; const f = validateIncrements(process.env.REVIEW_CAP_ROOT!); console.log(JSON.stringify(f)); if (f.length) process.exit(1);'` → `[]`, exit 0.
- [ ] **DB-6** — `npm run session:close -- --dry-run` exits 0 and prints `session-close: dry run — no gate run, no record, no commit.`

## Step 5 — final suite

- [ ] **DB-7** — `npm run check` (full) exit 0.
