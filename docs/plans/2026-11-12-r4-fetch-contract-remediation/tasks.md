# Tasks — R4 `fetch_page` contract remediation

Plan: `plan.md` · Findings: F-R4-F-1, F-R4-F-3, F-R4-F-4 ·
Roadmap: `ROADMAP.md` § R4 fetch-page contract remediation

A step is ticked only when it is verified. Tick order follows execution order.

## Phase 0 — Scaffold and baseline

- [x] 0. Increment directory carries `plan.md`, `tasks.md`, and `aar.md`
      ending `LOOP OPEN`.
- [x] 1. Baseline: `npm run check` → PASS (full, 22 gates, 154.5 s) at
      `d43192d`; one pre-existing `check-loop-artifacts` warning.
- [x] 2. Seam audit: `doFetchPage` selection is
      `renderer ? [renderer] : getDispatchChain("content_fetch")`
      (`src/index.ts:1131`); shipped chain `["jina","native_fetch"]`
      (`config.json:259`). Matches found and their disposition: `src/index.ts`
      (edit, slice A), `infobroker.md` REQ-021/§6.4/migration row (edit, slice
      B), `README.md` (edit, slice B), `AGENTS.md` (edit, slice B);
      `skills/infobroker/SKILL.md`, `skills/technical-writing/SKILL.md`
      (leave — name Jina as the common path, no default claim);
      `skills/infobroker/references/journeys.md` (already "renderer chain
      (Jina → native)"). No unanticipated surface.
- [x] 3. Authoring pre-check: REQ-021j and REQ-021f read; planned REQ-021 body
      measured: 782 → **789 characters, 5 sentences, 4 SHALL, 16 backtick
      tokens**, inside Appendix B (tool-signature exception for backticks).
      Recorded.

## Phase 1 — Failing evidence first

- [x] 4. New test block in `src/tool-surface.test.ts` (no default claim,
      omission-to-chain wording, `raw` default false, six-value enum).
- [x] 5. Red run before any edit: `npx vitest run src/tool-surface.test.ts -t
      "fetch_page advertises"` → FAIL at `renderer description must state the
      omission-to-chain behaviour`; received
      `"Renderer: jina (default), native_fetch, ..."`.

## Phase 2 — Edits

- [x] 6. Slice A — `src/index.ts` tool description and `renderer` schema
      description rewritten; no `.default(...)`, handler untouched. Evidence:
      the same targeted test → 1 passed.
- [x] 7. Slice B — REQ-021 body (`` `jina` primary ``, `raw` appended);
      post-edit counts 789 / 5 / 4 / 16; §6.4 rewritten (hedge, throttle/error,
      anti-bot); migration row reworded; README two sentence changes (section
      219 words, was 208); `AGENTS.md` row reworded.

## Phase 3 — Verification and closeout

- [x] 8. Targeted suites: `tool-surface`, `fetch-page-extraction`,
      `fetch-fallback`, `fetch-cache`, `structured-output` → 49/49 pass.
- [x] 9. `npm run typecheck` → exit 0; `validate-spec` → PASS (142 REQs, 127
      cited, 0 uncited files); `validate-readme` → 0 error(s), 0 warning(s);
      full `check` and `check-loop-artifacts` recorded in `aar.md`.
- [x] 10. `CHANGELOG.md` bullet under `## 2026.11.11`; `version-sync` green in
      the full gate.
- [x] 11. `ROADMAP.md` section removed; `check-roadmap` green in the full gate.
- [x] 12. `worklist.md` rows F-R4-F-1, F-R4-F-3, F-R4-F-4 `Resolved`;
      F-R4-F-2 left `Scheduled-roadmap`; coverage gap recorded in `aar.md`.
- [x] 13. `aar.md` finished with dispositions, verification, backlog note, and
      terminal token.
- [x] 14. `session:close` sealed the session; three commits landed
      (`fix(fetch): state the renderer chain…`, `docs(spec): align the
      renderer chain…`, `docs(roadmap): resolve the R4 contract findings…`);
      no push.
