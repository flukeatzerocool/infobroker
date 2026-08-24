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
| Search broadly | `web_search` | KB-first recall → classify task → dispatch chain → fallback on failure |
| Autocomplete a query | `web_search` (`suggest: true`) | suggestion provider → next suggestion-capable provider → error if none |
| Read a URL | `fetch_page` | SSRF guard → renderer chain (Jina → native) → truncate → auto-index |
| Multi-source truth-finding | `corroborate` | search → iterate → cross-source verify → confidence-scored findings |
| Check provider status | `providers` (list / health) | list state (incl. inactivity reason) → live health per slug |
| Knowledge base search | `kb` (search) | vector + keyword hybrid → freshness-adjusted score |
| Store a report | `kb` (ingest `source_type: report`) | index → `reports` collection → revisit via list/get |
| Hot-reload config | `reload_config` | re-read config → reconfigure providers → re-init KB |

## Encryption Lifecycle Journey

1. **Enable.** `generate_key` (writes a key file; returns the path) →
   `backup` the key → add `kb.encryption` to `config.local.json` →
   `reload_config`; the store is encrypted in place immediately.
2. **Disable.** Remove the encryption block → `reload_config`; the store
   is decrypted in place — keep the key available during the transition.
3. **Recover.** `encryption status` → `verify` a candidate key →
   `backup`/restore the key file → `rekey` to a new key file → point
   `kb.encryption.key_file` at the new key → `reload_config` → `verify`
   to confirm the new key opens the store.

The `encryption` action remains reachable while the store is locked; a
lost key is unrecoverable by design (back up the key on enable).
