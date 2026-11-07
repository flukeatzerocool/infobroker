# Roadmap

<!--
  Admission rule: a `## <title>` section is a scheduled work item. It needs an
  action a maintainer can take, 1–3 bullet lines, and a `**Trigger:**` line
  naming what starts the work or what closes it. Priority order, P0 first;
  remove a section when the work ships (it moves to CHANGELOG.md).

  Standing facts are not roadmap items: accepted dependency advisories and
  by-design limitations are recorded in DECISIONS.md, and a review cites the
  decision rather than filing a roadmap entry. `npm run check-roadmap`
  enforces this rule; `## Non-goals` is exempt.
-->

## Normalize CalVer to valid SemVer

- `today()` and the version-bump path emit `YYYY.M.D` with no leading zeros, so
  `package.json`, the tag, and the npm-published version are the same string;
  CHANGELOG headers follow the same spelling while history stays as written.
- `version-sync` then compares like for like, and the `server.json`
  normalization becomes redundant rather than corrective (D-086).

**Trigger:** the first version bump after the release-routine plan; closes when
`npm view infobroker version` equals the `package.json` version for a release.

## Non-goals

Open-web scope boundary: no SOCMINT platform collection, WHOIS/DNS/CT or
attack-surface data, corporate registries, sanctions/PEP screening, breach
indexes, media forensics, STIX/MISP link analysis, chain-of-custody, multi-user
case management, or enterprise scheduling. Authoritative list and rationale:
`DECISIONS.md` D-061.
