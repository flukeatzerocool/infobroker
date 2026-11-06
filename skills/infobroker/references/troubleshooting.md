# Troubleshooting

Symptom → cause → fix, for the most common Infobroker operational states.
The server itself reports operational detail through `inspect_providers`
(actions list / health / spec).

## Search returns empty or slow

1. Check provider health: `inspect_providers` (action health) per slug.
2. A provider may be **exhausted** (quota 100%) — the fallback chain skips it
   until the daily/monthly reset. Wait, or `reload_config` after raising its
   `rate_limit.per_day` / `per_month` cap.
3. A provider may be in **cooldown** after a 429/anti-bot response
   (`output.rate_limit_cooldown_ms`, default 30 s). Retry later.
4. Rephrase the query — a too-specific query can empty every provider. Use
   `search_web` with `expand: true` to generate variants.

## A provider keeps returning 429 / rate-limit errors

The server holds a 429ing provider in per-provider cooldown so a burst stops
re-hammering it. If it persists, the provider's own quota is exhausted:
raise its cap in config or add an API key (for keyed providers) to raise the
provider-tier limit.

## Server won't start

`config.json` (and `config.local.json`) is validated at load. The error lists
every offending key, e.g. a non-positive `corroboration.first_pass_max_providers`,
a bad `tier`, a dispatch chain referencing an undeclared provider, or a
generic-HTTP provider missing `endpoint`/`query_param`. Fix the listed keys and
retry. The most common mistake is editing `config.json` directly instead of
`config.local.json`, then losing overrides on update — put your changes in the
local layer.

## A config change had no effect

Provider entries are strict: an unknown key (for example `result_path` instead
of `results_path`) invalidates the whole user layer, so a single typo suppresses
every override and the server runs on shipped defaults with an error notice.
Check the reported key (the notice or `inspect_providers` action `spec`), fix it
in `config.local.json`, then `reload_config`. `dispatch` must be an object of
task-type arrays; `null`, an array, or a non-array chain is rejected the same
way.

## A generic HTTP provider returns empty or unauthorized results

The shared backend sends the key named by `auth_env` as
`Authorization: Bearer …`. If the API expects another header or no scheme, set
`auth_header` (default `Authorization`) and `auth_scheme` (default `Bearer`;
`""` sends the raw key). A rejected request is usually the header pair or a
missing key, not the field mapping. `inspect_providers` (action health) with no
`health_endpoint` runs a real search and can consume quota.

## Knowledge base is locked (encryption)

The store locks rather than touching data when the key is missing or wrong.
Use `manage_kb` (action encryption): `status` to see the state, `verify` to
test a candidate key before committing it, `backup` to restore a key-file
copy, `rekey` to move to a new key. A lost key makes the store unrecoverable
by design — back up the key when you enable encryption. Full journey in
`journeys.md`.

## Facts come back stale

Each report records its source's `source_updated_at` at ingest. `fetch_page`
reports a page's `last_updated` date. When a stored report looks outdated,
retrieve it (`manage_kb` get), fetch the live source, and compare dates:
unchanged → still current; changed or absent → re-research and re-ingest under
the same title.

## `fetch_page` returns an anti-bot page or an empty page

1. **Anti-bot challenge** — the renderer returned a CAPTCHA or verification
   interstitial instead of the page. `fetch_page` now treats this as a failed
   render and falls through to the next renderer in the chain (REQ-021f), so a
   challenge page should surface as real content or a clean exhaustion error,
   not as the fetched text. If every renderer is blocked, the page's edge
   protection is rejecting the server's fetchers.
2. **JS-rendered page with no content** — the fetched text is an empty shell
   (`<div id="root"></div>` or similar). A plain HTTP renderer cannot execute
   JavaScript. Use the `playwright-cli` skill instead: headless
   `playwright-cli open --browser=firefox <url>`, extract the rendered text
   (`find` or `eval`), then archive it with `manage_kb` (action ingest) so it
   is searchable from the knowledge base.

## A `verify_claims` run returns `corroboration: "partial"`

The run hit `max_http_calls` or `max_iterations` before every finding cleared
`confidence_threshold`. Either the topic is genuinely under-sourced (treat the
unconfirmed findings as gaps), or the budget is too tight — raise
`corroboration.max_http_calls` / `first_pass_max_providers` or lower
`confidence_threshold` (see `config-tune.md`).
