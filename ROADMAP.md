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

## Align REQ-115 and REQ-118 with ICD 203/206

- Read ICD 203 (Analytic Standards) and ICD 206 (Sourcing Requirements) from
  primary text and align the confidence, likelihood and source-grading
  vocabulary only where the text supports it. The 2026-11-15 attempt could not
  read the DNI-hosted PDF (`422` from the reader, binary payload), so no
  provision is cited and nothing was paraphrased.

**Trigger:** start when a readable copy of both directives is available; close
when REQ-115/REQ-118 cite them or record a deliberate divergence.

## Research-suite matrix in repo mode

- Run the remaining research-suite scenarios with `--mcp=repo` and record
  per-persona results; current evidence is the A1a/A1b audience pair plus S3
  and N1.

**Trigger:** start after the audience/defaults increment closes; close when
every §1 goal row names a recorded repo-mode run.

## Non-goals

Open-web scope boundary; the authoritative list lives in `DECISIONS.md`
under `## Scope Non-goals`.
