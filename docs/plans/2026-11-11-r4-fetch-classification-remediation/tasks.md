# Tasks — R4 `fetch_page` classification remediation

**Plan:** `plan.md` · **Status:** executed · **Final line:** see `aar.md`

## Phase 0 — Scaffold and baseline

- [x] 0. Increment directory carries `plan.md`, `tasks.md`, in-progress `aar.md`.
- [x] 1. Baseline re-confirmed on `cd447d6`: `npm run typecheck` exit 0; targeted suites 77/77 pass; full `npm run check` PASS (22 gates, 153.8 s).
- [x] 2. Seam audit: `isBotChallenge` caller `src/index.ts:941`; `TASK_TYPE_SIGNALS`/`TASK_TYPE_KEYWORDS` consumers (classifier, semantic prototypes, config dispatch); `detectClauseRequirements` caller `scripts/validate-spec.ts:355`. No other test or Arena fixture pins the CAPTCHA-title verdict.
- [x] 3. Detector baseline with the real function over 142 REQ bodies: `REQ-013: 4`, `REQ-020: 2`; nothing else had `orBranches > 0`.
- [x] 4. Sibling-REQ pre-check: REQ-020a, REQ-021a, REQ-021f, REQ-021i, REQ-055 — no conflict.
- [x] 5. Existing-check discovery: no other unparenthesized branch-list detector.

## Phase 1 — Failing evidence first

- [x] 6a–6d. `bot-challenge.test.ts`: long prose page titled "How CAPTCHA works"; short title-only CAPTCHA wall; accepted >400-char residual; remaining strong markers.
- [x] 6e. `task-type.test.ts`: eight area/elevation route cases, "Bay Area news" guard, four accepted misroutes, keyword-table assertion.
- [x] 6f. `structured-fact.test.ts`: classify→enrich end-to-end for `area of Testville`.
- [x] 6g. `clause-coverage.test.ts`: REQ-021a 4 legs, REQ-021f 3, five negative shapes, REQ-013 unchanged, summed body.
- [x] 7. Red run recorded below.

### Red-run log (unmodified source)

```
npx vitest run src/lib/bot-challenge.test.ts src/task-type.test.ts \
  src/clause-coverage.test.ts src/structured-fact.test.ts
Tests  7 failed | 79 passed (86)

FAIL clause-coverage: counts the four target classes in REQ-021a
FAIL clause-coverage: counts the three challenge kinds in REQ-021f
FAIL clause-coverage: sums a parenthesized group and a prose list
FAIL structured-fact: classifies an area query and resolves it end to end
FAIL task-type: routes area and elevation queries to structured_fact
FAIL bot-challenge: does not flag an article whose title mentions CAPTCHA
FAIL bot-challenge: records the accepted long-boilerplate residual
```

## Phase 2 — Fixes

- [x] 8. Slice A — `src/lib/bot-challenge.ts`: `/captcha/i` moved to `WEAK_TITLE_MARKERS`, weak families gated by `MIN_TEXT_FOR_SCRIPT_SIGNAL`; header comment updated.
- [x] 9. Slice B — `src/task-type.ts`: eight signals at weight 4; `src/index.ts` description and README enumeration updated.
- [x] 10. Slice C — `src/clause-coverage.ts`: narrow prose class-list scan (span, class-introducer predicate, terminator, legs, shape test, summed count); module/interface comments updated.
- [x] 10a. Real-detector gate: **adjustment 1 of 2** — the first run also detected REQ-020a (`a place, fact, filing, definition, or code chain`, 5 legs), a selectable-value union. Narrowed the rule with a class-introducer predicate (`is/are/resolves to/indicates/means` or an appositive dash/colon). Re-run: `REQ-013: 4`, `REQ-020: 2`, `REQ-021a: 4`, `REQ-021f: 3` — exact expected map. Tags appended to `src/lib/url-guard.test.ts` and `src/lib/bot-challenge.test.ts`.
- [x] 11. No remaining red expectations; no assertion weakened.

## Phase 3 — Verification and close

- [x] 12. Targeted suites: 111/111 pass across `bot-challenge`, `task-type`, `structured-fact`, `clause-coverage`, `url-guard`.
- [x] 13. `npm run typecheck` exit 0; `npm run check` full PASS (22 gates, 153.9 s).
- [x] 14. `npm run validate-spec` PASS (142 REQs, 127 cited, 0 uncited files); `npm run validate-readme` PASS.
- [x] 15. `CHANGELOG.md` bullet under the top `## 2026.11.11 — R4 fetch-page extraction…` heading.
- [x] 16. `ROADMAP.md` classification section removed; `npm run check-roadmap` PASS.
- [x] 17. `worklist.md`: F-R4-B-2, F-R4-E-1, F-R4-E-4, F-R4-A-1 `Resolved`.
- [x] 18. `aar.md` finished; `LOOP PAUSED`.
- [x] 18a. Final full `npm run check` after the doc edits: PASS (22 gates, 153.7 s).
- [x] 19. `npm run session:close`; four-commit series; typecheck after each.
