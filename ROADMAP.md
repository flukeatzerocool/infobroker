# Roadmap

<!--
  Admission rule: a `## <title>` section is a scheduled work item. It needs an
  action a maintainer can take, 1–3 bullet lines, and a `**Trigger:**` line
  naming what starts the work or what closes it. Priority order, P0 first;
  remove a section when the work ships (it moves to CHANGELOG.md).

  Standing facts are not roadmap items: accepted dependency advisories and
  by-design limitations are recorded in DECISIONS.md, and a review cites the
  decision rather than filing a roadmap entry. `npm run check-roadmap`
  enforces this rule; `## Non-goals` is exempt from it because
  `npm run check-non-goals` verifies that section as a pointer to the
  `## Scope Non-goals` block in DECISIONS.md.
-->

## Workflow convergence with Holonovel

- Share one vocabulary and cadence across both repos: `status`, `check:fast`,
  `session:close`, durable AARs under `docs/plans/`, and the deterministic
  `prep` / `release` seam. Keep the split-commit series and AI prep that
  Holonovel does not need.
- Port Holonovel's gate runner, run manifest, loop audit, and hermetic pipeline
  harness; keep Infobroker's AI steps, Arena, and npm + registry publish path.
- Align the tag policy: never move a published tag; a correction is a new
  CalVer; push branch and tag atomically.

**Trigger:** the first session after the workflow-convergence plan is approved;
closes when both repos pass `check:fast` and `check` with the shared commands,
`docs/workflow-cadence.md` is current, and a real increment closes through
`session:close`.

## Normalize CalVer to valid SemVer

- `today()` and the version-bump path emit `YYYY.M.D` with no leading zeros, so
  `package.json`, the tag, and the npm-published version are the same string;
  CHANGELOG headers follow the same spelling while history stays as written.
- `version-sync` then compares like for like, and the `server.json`
  normalization becomes redundant rather than corrective (D-086).

**Trigger:** the first version bump after the release-routine plan; closes when
`npm view infobroker version` equals the `package.json` version for a release.

## Gate retirement and weekly cadence

- Add `scripts/gate-cost-report.ts` and `scripts/weekly.ts` over the timing
  record `run-gates --timing` already writes: a gate with no findings across 20
  consecutive runs becomes advisory, and one weekly run produces the gate-cost,
  loop, and delivery reports together.
- Keep the retirement decision in a JSON ledger; deleting a gate stays a manual
  decision.

**Trigger:** the timing record holds 20 consecutive runs for at least one gate;
closes when a gate is downgraded to advisory by that policy and the weekly run
writes its report.

## Non-goals

Open-web scope boundary; the authoritative list lives in `DECISIONS.md`
under `## Scope Non-goals`.
