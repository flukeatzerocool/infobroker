# Stage 5 — readiness (excerpt)

Reviewer: review subagent (fresh). Plan sha256: e837549e785b758c355baa3c8aa5f672ec850536b146384d0738857a2784668a. Reads: 7 files / 8 calls.

Verdict: **GO** — no Blockers.

Verified present and accurate: every cited register row and anchor; every API (`getQuotaStatePath`, `initKb` spread lever, maintenance clear, "Storage path changed" warning); `vitest.config.ts` contents; T7→T8 and T9→removal ordering; T11→T12 token ordering; done-bar marker and eight items; increment-record shape.

Majors (precision, no step change):
1. Done-bar item (6) used `:20` as a position criterion; restated as "one new heading above the pre-existing R7-export heading".
2. Assertions did not bind their module instance; now explicitly the stage-3 `postCfg`/`postKb`/`postQuota` objects.

Nits: explicit `vitest` imports (no `globals`); assertion 4 should compare `.text === BODY`; cross-note wording not dictated; M size optimistic.

Unknowns: `config.json` values (integer guard makes a wrong premise loud); roadmap anchors; whether `validate-spec` accepts the new test file (remedy step added).
