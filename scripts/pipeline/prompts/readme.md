Load and apply the proofreading skill. Read README.md and infobroker.md.
The specification may have changed. Update README.md and skill reference
files to reflect the current state of the project.

First, capture the current state: spec section count, REQ count, gate count,
tool count, provider count, and key features.

1. Check the install/setup instructions in README — still correct?
2. Check feature descriptions — cross-reference against any new or modified
   REQs from infobroker.md. Draft feature blurbs following existing cadence.
3. Check the provider comparison table — update counts, tiers, and new
   competitive advantages from recent REQ changes.
4. Verify tool names in README match the tool surface (web_search,
   fetch_page, search_suggestions, choose_provider, list_providers,
   provider_health, converge, reload_config, spec_health, kb_search,
   kb_ingest, kb_stats, kb_delete). Update stale names.
5. Update skills/infobroker/references/provider-auth.md if config.json has
   changed (regenerated separately — leave as-is if identical).
6. Update skills/infobroker/references/provider-map.md — verify provider
   slugs, tiers, capabilities, and enabled status match config.json.
7. Update skills/infobroker/references/pipeline-map.md — verify tool-to-
   provider mappings are still accurate.
8. Update the 'Last updated' line with 'Last updated: YYYY-MM-DD.' (with
   period). Match existing format if present.

Run `npm run validate-readme` after changes and fix any failures.

Do NOT commit. End with 'README UPDATE COMPLETE.'
