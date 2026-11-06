# Configuration Tuning — Time, Tokens, and Recall

Each key's effect on cost (HTTP calls, latency, tokens) and recall. Edit
`config.json` (shipped defaults) or override in `config.local.json`, then
`reload_config`. Defaults are the shipped values; "tighter" trades recall for
fewer tokens/shorter runs, "looser" trades the reverse.

## Corroboration (`corroboration`)

| Key | Default | Effect |
|-----|---------|--------|
| `first_pass_max_providers` | 5 | How many providers the Phase-1 broad pass queries (highest priority first). Tighter = fewer calls and less latency; looser = broader first pass before refinement. The remaining pool still serves gap refinement. |
| `first_pass_max_results` | 5 | Results fetched per provider in Phase 1. Halving it roughly halves Phase-1 token volume. |
| `max_http_calls` | 30 | Ceiling on total HTTP calls per `verify_claims` run. Lower it to hard-cap cost; too low forces `corroboration: "partial"`. |
| `max_iterations` | 5 | Refinement rounds (capped at 10). Lower = cheaper, more gaps left open. |
| `max_batch_claims` | 10 | Claims accepted in one `verify_claims` batch call (integer 1–25; the tool rejects a larger request). Lower = smaller batches, more calls. |
| `modality_markers` | see `config.json` | Marker lexicon for `reported`/`speculative` attribution. Override either list; supplying an empty list disables that category (every source reads asserted). |
| `similarity_threshold` | 0.3 | Claim-clustering threshold. Higher = stricter agreement (more contested findings); lower = looser grouping. |
| `confidence_threshold` | 0.8 | Bar for `green`/confirmed. Lower = more findings confirmed earlier (earlier exit, fewer calls). |
| `authority_weights` | — | Per-source-type weight (0.7–1.0). Affects confidence, not call count. |
| `kb_recall` | true | Whether prior KB findings reconcile first. Keep on — it is the cheapest corroboration source. |

## Deep read (`deep`)

| Key | Default | Effect |
|-----|---------|--------|
| `max_pages` / `max_total_pages` | 3 / 8 | Pages fetched when `search_web` runs with `deep: true`. Lower both to cut the most token-heavy mode. |
| `concurrency` | 4 | Parallel page fetches. |
| `max_ms` | 8000 | Wall-time budget for the deep pass. |
| `early_exit_score` | 0.3 | Stop fetching when a passage already scores this well. Raise to exit sooner. |

## Research compile (`research`)

| Key | Default | Effect |
|-----|---------|--------|
| `max_variants` | 3 | Query variants fanned out. |
| `max_pages_per_variant` | 2 | Pages deep-read per variant. `max_variants × max_pages_per_variant` is the compile's page cost. |

## Fetch (`fetch`)

| Key | Default | Effect |
|-----|---------|--------|
| `passage_size` | 250 | Words per ranked passage (question mode). Smaller = fewer tokens per read. |
| `max_passages` | 6 | Passages returned per page in question mode. |
| `crawl_max_pages` / `crawl_max_depth` | 10 / 2 | Bounds for same-origin `crawl`. Lower to cap crawl cost. |
| `detect_date` | true | Extra date lookup per fetch. Disable for the cheapest path. |
| `cache.kb_read` | true | Read a fresh knowledge-base copy before an outbound fetch. |
| `cache.kb_max_age_hours` | 24 | Maximum KB age for a cache hit; older entries fall through to the network. |

## Expansion (`expand`)

| Key | Default | Effect |
|-----|---------|--------|
| `max_expansions` | 5 | Query variants returned by `expand: true`. |

## Hedged fallback (`output`)

| Key | Default | Effect |
|-----|---------|--------|
| `hedge_enabled` | true | Hedge races fallback providers only when the primary is slow. Keep on — it shortens the common path. |
| `hedge_min_delay_ms` / `hedge_max_delay_ms` | 200 / 1500 | Hedge window bounds. |
| `fallback_depth` | 5 | Providers tried per dispatch chain. |
| `rate_limit_cooldown_ms` | 30000 | Hold-off after a 429/anti-bot. |
| `call_log` | stderr | Operational call records: `stderr`, `file`, or `off`. No query or content is recorded; one line is written per tool call and per outbound provider request, so a batch or multi-query search multiplies the volume. |
| `call_log_path` / `call_log_max_bytes` | `~/.local/share/infobroker/call-log.jsonl` / 2000000 | File sink target and rotation bound. |
| `provider.rate_limit.jitter_ms` | 0 (DDG: 800) | Added to the minimum interval so a burst is not fixed-cadence. |

## Source quality (`source_quality`)

| Key | Default | Effect |
|-----|---------|--------|
| `enabled` | true | Apply quality ordering and the blocklist. |
| `weight` | 0.15 | Relevance weight of a quality score. `0` preserves pure semantic order. |
| `primary_source_suffixes` | `.gov`, `.mil`, `.edu`, `.int` | Hosts ending in one of these score as primary sources. |
| `trusted_domains` / `low_quality_domains` | empty | Raise or lower matching hosts (subdomains included). |
| `blocklist` | empty | Remove matching hosts; `*.domain` matches subdomains only. |

## Knowledge base (`kb`)

| Key | Default | Effect |
|-----|---------|--------|
| `freshness.tiers` | see config | Decay/expiry per tier; a cached hit avoids network calls entirely. Shorter expiries = fresher but more re-fetching. |
| `kb_first_relevance_threshold` | 0.3 | Minimum relevance for a KB answer to suppress external search. Raise to trust only close matches. |
| `kb_first_confidence_threshold` | 0.5 | Minimum confidence to answer from the KB alone. |
| `chunk_size` / `chunk_overlap` | 1024 / 64 | Retrieval granularity. |

## Dispatch chain ordering

The shipped `academic`, `news`, and `privacy_critical` chains are ordered by
source quality, not by cost. A `config.local.json` array replaces a chain
wholesale; `dispatch_append` adds slugs to the end of one.

| Chain | Shipped order | Why |
|-------|---------------|-----|
| `academic` | semantic_scholar, arxiv, openalex, europe_pmc, crossref | Semantic Scholar carries cross-publisher coverage and a citation graph; arXiv serves preprints; OpenAlex, Europe PMC, and Crossref are keyless metadata indexes ordered from broadest to most specialised (open metadata, biomedical, DOI registrations). |
| `news` | duckduckgo, gdelt, hacker_news | DuckDuckGo has the freshest index with snippets and time filters; GDELT adds global event coverage on a lag and headline-only records; Hacker News is tech-scoped discussion. |
| `privacy_critical` | searxng, mojeek, duckduckgo | A self-hosted SearXNG means only your instance sees the query; Mojeek runs an independent index; DuckDuckGo resells and forwards upstream. SearXNG is disabled by default and dropped from the chain until `INFOBROKER_SEARXNG_URL` is set, so an unconfigured install starts at Mojeek. |

## Cheat sheet

- Fewer tokens now: lower `first_pass_max_results`, `first_pass_max_providers`,
  `deep.max_total_pages`, `research.max_pages_per_variant`, `fetch.passage_size`.
- Faster now: lower `first_pass_max_providers`, `max_http_calls`,
  `max_iterations`; keep `hedge_enabled` on.
- More recall: raise `first_pass_max_providers`, `first_pass_max_results`,
  `max_http_calls`; lower `confidence_threshold`.
