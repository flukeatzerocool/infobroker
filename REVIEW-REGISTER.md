# Review Register

Findings and follow-through items from the after-action review loop. Each
entry carries a terminal disposition: `Resolved`, `Scheduled-roadmap`,
`Closed-P3`, or `Deferred-by-user`. The AAR references this file; it does not
restate it. `ROADMAP.md` is the tracking surface for scheduled work.

## Resolved

Findings fixed and verified in-session.

- **AGENTS.md provider-backend table stale** — missing the six zero-config
  providers added in the competitive batch, and a stale `v2026.08.10` header.
  Resolved: rows and version stamp updated; a `validate-spec` gate now
  reconciles the table against `config.json` and the stamp against
  package.json.
- **`provider-map.md` dispatch tables stale** — missing the `financial` row,
  stale `academic`/`news` chains, six providers absent. Resolved: the file is
  now generated from `config.json`; a `validate-spec` staleness gate fails on
  drift.
- **Spec §1.6 block-reservation paragraph stale** — sub-REQ ranges omitted
  `020f`, `021d`–`021e`, `031a`, `088`–`092`, `095`. Resolved: ranges
  corrected; a `validate-spec` gate reconciles the paragraph against the
  §9.5 manifest.

## Scheduled-roadmap

Findings scheduled on `ROADMAP.md` for a future increment.

## Closed-P3

Informational findings recorded with no action.

## Deferred-by-user

Findings the user explicitly declined to act on.
