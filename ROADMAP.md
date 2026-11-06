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

## Provider rate-limit and privacy defaults (P0)

- Replace Stack Exchange's `per_second: 0.003` (a 333-second inter-call stall)
  with `per_day: 300` plus normal spacing, and add a config test that bounds an
  implied interval (CF-1).
- Reorder `privacy_critical` to prefer the self-hosted instance and an
  independent index before DuckDuckGo; record the decision and document the
  academic-chain and news-ordering rationale (CF-2, CF-9, CF-10).

**Trigger:** Start on the next config change or when a `code` search stalls;
close when `npm run check` passes and the generated auth reference is refreshed.

## Structured-fact fidelity (P1)

- Emit the unit for area and elevation facts (CR-4), parse real header-plus-data
  wikitables instead of only per-row `<th>` tables (CR-5), and resolve
  birth/death dates (CR-12); strip leading prepositions from the entity query
  (CR-14, SR-9).
- Add a realistic table fixture, a unit-map fixture, and a birth-date fixture.

**Trigger:** Start when a structured-fact query returns a bare number or an
empty table; close when REQ-021i's "unit when applicable" is exercised by a test.

## Corroboration source reading (P1)

- Stop the modality lexicon from reading the month "May" as speculation (CR-6),
  keep decimals inside a support span (CR-7), and clear the per-provider timeout
  timer after a fast success (CR-13).
- Move REQ-026h's report-body attribution clause to the report contract or gate
  it G1+G3, and tag the modality and span branches (SR-5, SR-6).

**Trigger:** Start when a report shows a hedged date or a truncated span; close
when the span and modality regressions pass and the REQ gate matches its scope.

## Fetch fallback and raw mode (P1)

- Return the error text in raw mode instead of an empty string (CR-10), and split
  paywall from access-restricted so a 403/451 is not reported as a paywall
  (CR-11).
- Align REQ-021h's taxonomy with the observed error codes and causes (SR-3).

**Trigger:** Start on the next paywalled or blocked fetch, or with the next
fallback change; close when the taxonomy tests cover every branch.

## Config safety and discoverability (P1)

- Guard `validateConfig` against a null `dispatch` (CR-9); add default
  `corroboration.modality_markers`, document `max_batch_claims` and the call-log
  volume, and document the strict-provider-key and blocklist scopes (CR-19,
  CF-3, CF-4, CF-5, CF-7, SR-1).
- Add optional `generic_http` `auth_header`/`auth_scheme` so non-Bearer APIs can
  be configured without a module (CF-6).

**Trigger:** Start with the next config or provider-onboarding change; close when
README, `config.json`, and `validate-spec` agree.

## Batch metadata and gate hygiene (P2)

- Report a batch's aggregate time rather than the first item's (CR-16), make the
  per-input passage/truncation fields "when applicable" (SR-4), and chmod an
  existing call log to owner-only (CR-17).
- Scope the `validate-spec` modality check to the redraft step (CR-20, SR-10),
  report the blended count when the cache is empty (SR-8), and normalize the
  structured-fact hyphenation (SR-7).

**Trigger:** Start with the next batch or gate change; close when `npm run check`
passes and the REQ wording matches the response shape.

## Non-goals

Open-web scope boundary: no SOCMINT platform collection, WHOIS/DNS/CT or
attack-surface data, corporate registries, sanctions/PEP screening, breach
indexes, media forensics, STIX/MISP link analysis, chain-of-custody, multi-user
case management, or enterprise scheduling. Authoritative list and rationale:
`DECISIONS.md` D-061.
