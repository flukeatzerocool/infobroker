Load and apply the proofreading skill. Read README.md and infobroker.md.

The README DESIGN comment at the top of README.md is the canonical style
guide. Apply it — including its binary style checklist — to every edit.
The specification may have changed. Update README.md and skill reference
files to reflect the current state of the project.

────────── PHASE 1 — GENERATE ──────────

Capture the current state first: spec section count, REQ count, gate count,
tool count, provider count, and key features — deriving tool names from
src/index.ts and provider slugs from config.json (never trusting a
hardcoded count in prose).

1. Check the install/setup instructions in README — still correct?
2. Check feature descriptions — cross-reference against any new or modified
   REQs from infobroker.md. Draft feature blurbs following the existing
   four-beat cadence (benefit hook, mechanics, competitive proof, closer).
3. Check the provider comparison table — update counts, tiers, and new
   competitive advantages from recent REQ changes. Every provider slug in
   config.json (except native_fetch) must have a row.
4. Verify tool names in README match the tool surface — every tool in
   src/index.ts must appear by full name or shorthand (sans `infobroker_`
   prefix). Update stale names. Shorthand in backticks only.
5. Update skills/infobroker/references/provider-auth.md if config.json has
   changed (regenerated separately — leave as-is if identical).
6. Update skills/infobroker/references/provider-map.md — verify provider
   slugs, tiers, capabilities, and enabled status match config.json.
7. Update skills/infobroker/references/pipeline-map.md — verify tool-to-
   provider mappings are still accurate.
8. Update the 'Last updated' line with 'Last updated: YYYY-MM-DD.' (with
   period). Match existing format if present.

Run `npm run validate-readme` after changes and fix any failures.

────────── PHASE 2 — VERIFY ──────────

Re-read the updated README.md against this checklist. Produce a
claim-to-truth table — one row per numeric or factual claim, with columns:
Claim | Truth source | Status. Verify at minimum:
- Tool count and every tool name reconcile to src/index.ts.
- Provider count and every provider row reconcile to config.json.
- The zero-config / keyed provider split matches config.json `tier` fields.
- Every feature blurb maps to a real REQ in infobroker.md (no invented
  capabilities).
- The refrain "Free first. Privacy always." appears exactly twice.
- No first-person voice, no naked tool names in prose.

Return exactly one line ending:
VERIFY ... <N> high-severity finding(s).
(<N> = 0 means every claim checked out against its source.)

Do NOT commit. End with 'README UPDATE COMPLETE.' only if Phase 2 reported
0 high-severity findings.
