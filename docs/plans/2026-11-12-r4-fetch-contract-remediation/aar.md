# AAR — R4 `fetch_page` contract remediation

**Status:** complete · **Date:** 2026-11-12 · **Plan:** `plan.md` ·
**Done bar:** met (see below).

## What happened

The increment closed the three findings in `ROADMAP.md` § R4 fetch-page
contract remediation. The defect was prose, not code: six surfaces advertised
a `renderer` default that the schema never declared, while the handler runs the
configured `content_fetch` chain (`jina` primary, `native_fetch` next) when the
parameter is omitted. The fix states that contract once across the schema
description, tool description, REQ-021, §6.4, the `AGENTS.md` tool table, the
spec's migration table, and the README; REQ-021's enumeration gained `raw`; and
§6.4 now names the hedge and the throttle/error and anti-bot fall-through.

A planned change of direction was recorded in the plan before execution: the
roadmap's suggested remedy ("declare the schema default") would have made
`renderer` always defined, pinning one renderer and disabling REQ-021's hedge,
so the plan removed the false default claim instead and recorded the rejected
alternative (D1).

## Findings and dispositions

| Finding | Disposition | Evidence |
|---|---|---|
| F-R4-F-1 (P1) | Resolved in-session | Renderer contract stated on all six surfaces; `renderer` stays `.optional()` with no default; handler untouched (`src/index.ts`, `infobroker.md`, `README.md`, `AGENTS.md`; `src/tool-surface.test.ts`) |
| F-R4-F-3 (P2) | Resolved in-session | `raw` added to REQ-021's enumeration; body 789 chars / 5 sentences / 4 SHALL / 16 backticks (`infobroker.md`; `src/tool-surface.test.ts` pins the advertised `raw` default) |
| F-R4-F-4 (P1) | Resolved in-session | §6.4 names the hedge after the grace window plus throttle/error and anti-bot challenge fall-through, citing REQ-021/REQ-021f; README fetch paragraph aligned without duplicating *Hedged fallback* (`infobroker.md`, `README.md`) |
| Skill references name Jina | Closed as informational (P3) | `skills/infobroker/SKILL.md`, `skills/technical-writing/SKILL.md` name Jina as the common path, not a parameter default; `journeys.md` already says "renderer chain (Jina → native)" |
| F-R4-F-2 (P2) | Deferred to the user | Already `Scheduled-roadmap` before this increment; the new test asserts the renderer/raw surface only, not the full REQ-021 parameter contract |
| Post-pass plan clarifications | Recorded | The re-review's remaining Major (done-bar wording vs named edits) and two Nits were applied after the passing pass; C-13 distinguishes them from the reviewed artifact |

## Verification

- Red first: the new test failed on `renderer description must state the
  omission-to-chain behaviour` against `"Renderer: jina (default), ..."`.
- Targeted suites after the fix: 49/49 pass (`tool-surface`,
  `fetch-page-extraction`, `fetch-fallback`, `fetch-cache`,
  `structured-output`).
- `npm run typecheck` exit 0; `validate-spec` PASS (142 REQs, 127 cited, 0
  uncited files); `validate-readme` 0 error(s), 0 warning(s).
- `npm run check` full: **PASS**, 22 gates, 155.2 s.
- `check-loop-artifacts`: 0 errors; the one pre-existing
  `2026-11-10-r6-encryption-capacity-remediation` warning remains (C-8).
- REQ-021 post-edit body measured: 789 characters, 5 sentences, 4 SHALL, 16
  backtick tokens (C-2). README *Content Extraction*: 219 words (was 208)
  against a 350-word budget (C-5).
- §6.4 and the README paragraph are inspection-verified against REQ-021 and
  REQ-021f; no gate asserts spec prose, and the AAR does not claim otherwise
  (C-6).

## Deviations

- **AGENTS.md predicate (binding-check Nit).** The binding check read
  `AGENTS.md:16` after this increment had already reworded it, so it saw the
  target text and counted five default-claim surfaces where the plan's
  predicate row counted six. The edit was performed as planned (slice B); the
  row's "six" describes the pre-edit tree. No execution difference.
- **C-13 scope (binding-check Nit).** C-13 says the three clarifications are
  "exactly" the post-pass changes; the independence header and C-7 were also
  updated when the binding review was recorded. They are review-record edits,
  not plan-scope edits, and are listed here for the build diff confirmation.

## Cross-chunk notes

- **Roadmap coverage gap.** F-R4-F-2 remains `Scheduled-roadmap` with no owning
  section, as do the other unowned R4 P2 rows. No P0/P1 is open.
- **Cold pass cost.** Two reviewer dispatches (one full pass, one targeted
  diff re-review), both `independent-review passed.`; the re-review's
  prescribed clarifications were applied after the pass and are named in C-13.
- **Backlog.** 99 unpushed commits before the increment, oldest 2.3 d.
  Publication stays user-authorized (D6); this increment did not push.

LOOP PAUSED
