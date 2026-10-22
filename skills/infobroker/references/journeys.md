# User Journeys

Canonical routing of user intent to workflow shape, tool sequence, and
recovery procedure. Each journey composes the shared primitives from
`workflows.md`; the orchestrator's Phase 0 Classify gate maps intent to a
row below.

## Intent → Journey

| Intent marker | Journey | Shape | Escalation |
|---------------|---------|-------|------------|
| "research / write a report" | Research & Write | research-and-write | — |
| "fact-check / verify claims" | Fact-Check | fact-check | — |
| "deep dive / comprehensive" | Deep-Dive | deep-dive | — |
| "compare / evaluate / X vs Y" | Competitive Evaluation | evaluation | — |
| "literature review / state of the art" | Literature Review | lit-review | — |
| "what changed / monitor / track" | Monitoring / Delta | monitor | — |
| "red-team / stress-test" | Adversarial / Red-Team | red-team | — |
| "vet / background check / due diligence" | Vetting / Due-Diligence | vetting | — |
| high-stakes, decision-driving | Gated Analysis | — | `analysis-loop` |

## Tool Journeys

| Intent | Tools | Steps |
|--------|-------|-------|
| Search broadly | `search_web` | KB-first recall → classify task → dispatch chain → fallback on failure; batch several queries by passing an array |
| Force a fresh search | `search_web (fresh)` | skip the KB-first shortcut and query external providers, then fall back per the chain |
| Autocomplete a query | `search_web (suggest)` | suggestion provider → next suggestion-capable provider → error if none |
| Expand a query | `search_web (expand)` | derive query variants from a suggestion-capable provider and the query, deduplicated and ranked |
| Deep-read the top results | `search_web (deep)` | fetch the top-ranked pages and return each page's passages ranked against the query |
| Research compile | `search_web (research)` | fan out to derived variants, deep-read each, group passages by variant |
| Read a URL | `fetch_page` | SSRF guard → renderer chain (Jina → native) → anti-bot challenge falls through to the next renderer → truncate → auto-index; use `fetch_page (question)` for ranked passages; for JS-rendered pages with no readable content, use `playwright-cli` (headless) and archive the extracted text via `manage_kb (action: ingest)` |
| Crawl a same-origin site | `fetch_page (crawl)` | bounded recursive fetch with the SSRF guard applied at every hop |
| Detect a page's last-updated date | `fetch_page (detect_date)` | report the date, evidence source, and confidence; omit the field when undetermined |
| Extract structured metadata | `fetch_page (extract)` | return JSON-LD, OpenGraph, and microdata alongside the content |
| Multi-source truth-finding | `verify_claims` | search → iterate → cross-source verify → confidence-scored findings |
| Academic references | `get_citations` | search scholarly sources → BibTeX citation per reference |
| Check provider status | `inspect_providers (action: list)` / `inspect_providers (action: health)` | list state (incl. inactivity reason) → live health per slug |
| Report build and spec identity | `inspect_providers (action: spec)` | build version, provider counts, token footprint, state paths |
| Knowledge base search | `manage_kb (action: search)` | vector + keyword hybrid → freshness-adjusted score; pass `collection: "reports"` to recall stored reports (search/list default to the `default` collection) |
| Store a report | `manage_kb (action: ingest, source_type: report)` | index → `reports` collection → revisit via list/get with `collection: "reports"` |
| List stored entries | `manage_kb (action: list)` | enumerate entries, optionally scoped to a collection |
| Retrieve a stored entry | `manage_kb (action: get)` | fetch one entry by its source URL |
| Knowledge base stats | `manage_kb (action: stats)` | chunk counts, collections, freshness tiers, last ingestion |
| Delete stored content | `manage_kb (action: delete)` | destructive; report the chunks removed |
| Hot-reload config | `reload_config` | re-read config → reconfigure providers → re-init KB |
| Migrate a user config layer | `reload_config (migrate)` | back up and apply registered user-layer migrations before reloading |

## Encryption Lifecycle Journey

1. **Enable.** `manage_kb (action: encryption, operation: generate_key)`
   (writes a key file; returns the path) →
   `manage_kb (action: encryption, operation: backup)` the key → add
   `kb.encryption` to `config.local.json` → `reload_config`; the store is
   encrypted in place immediately.
2. **Disable.** Remove the encryption block → `reload_config`; the store
   is decrypted in place — keep the key available during the transition.
3. **Recover.** `manage_kb (action: encryption, operation: status)` →
   `manage_kb (action: encryption, operation: verify)` a candidate key →
   `manage_kb (action: encryption, operation: backup)`/restore the key file →
   `manage_kb (action: encryption, operation: rekey)` to a new key file →
   point `kb.encryption.key_file` at the new key → `reload_config` →
   `manage_kb (action: encryption, operation: verify)` to confirm the new
   key opens the store.

The `manage_kb (action: encryption)` action remains reachable while the
store is locked; a lost key is unrecoverable by design (back up the key on
enable).
