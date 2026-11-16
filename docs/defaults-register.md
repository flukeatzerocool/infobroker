# Defaults register

Every user-facing configuration path in `config.json` has one row here. The
register answers four questions a new operator asks: what is the shipped
value, who is it for, when should I change it, and which evidence shows the
change took effect. `npm run check-user-surface` fails when a path appears in
one place and not the other, so a new knob cannot ship undocumented.

**Rule of thumb.** The shipped value is the no-think default. Change a value
only when a run shows a concrete need; record the reason in the commit body.

Audience key: **Reader** (uses the server through a client), **Researcher**
(runs research shapes), **Fact-checker** (runs verification), **Operator**
(deploys and tunes), **Developer** (integrates or extends).


## Fetch and extraction

| Path | Default | Audience | Change when / evidence |
|---|---|---|---|
| `fetch.allow_private_urls` | `false` | Operator | Keep `false`; set `true` only for an intentional local crawl. |
| `fetch.max_response_bytes` | `20971520` | Operator | The per-response byte ceiling; lower it on a constrained host. |
| `fetch.passage_size` | `250` | Reader | Raise for long documents; it grows the response payload. |
| `fetch.max_passages` | `6` | Reader | Raise to return more excerpts; bounded by the response cap. |
| `fetch.detect_date` | `true` | Reader | Set `false` when date metadata is not needed and latency matters. |
| `fetch.crawl_max_pages` | `10` | Reader | Raise for site surveys; each page costs a fetch. |
| `fetch.crawl_max_depth` | `2` | Reader | Raise only with a page budget; depth multiplies requests. |
| `fetch.cache` | object | Reader | `kb_read` reuses a fresh cached page; disable for privacy-sensitive runs. |

## Query expansion

| Path | Default | Audience | Change when / evidence |
|---|---|---|---|
| `expand.max_expansions` | `5` | Researcher | Raise for broader recall; each expansion is a query. |

## Research route

| Path | Default | Audience | Change when / evidence |
|---|---|---|---|
| `research.max_variants` | `3` | Researcher | Raise for broader coverage; each variant is a search. |
| `research.max_pages_per_variant` | `2` | Researcher | Raise to read more per angle; watch latency. |

## Deep route

| Path | Default | Audience | Change when / evidence |
|---|---|---|---|
| `deep.max_pages` | `3` | Researcher | Raise for depth; bounded by `max_total_pages`. |
| `deep.max_total_pages` | `8` | Researcher | The hard ceiling for a deep route; raise with a latency budget. |
| `deep.concurrency` | `4` | Operator | Raise on a fast link; lower on a metered or rate-limited link. |
| `deep.early_exit_score` | `0.3` | Researcher | Lower to stop earlier; raise to keep collecting. |
| `deep.max_ms` | `8000` | Operator | The wall-clock budget; raise for thorough runs. |
| `deep.detect_date` | `false` | Researcher | Enable when dates matter more than latency. |

## In-process analysis

| Path | Default | Audience | Change when / evidence |
|---|---|---|---|
| `analysis.enabled` | `true` | Reader | Disable when the client does its own clustering. |
| `analysis.max_topics` | `10` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `analysis.max_entities` | `10` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `analysis.cluster_threshold` | `0.55` | Researcher | Lower to merge more topics; raise for tighter clusters. |
| `analysis.min_cluster_size` | `2` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `analysis.timeline` | `true` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |

## Corroboration

| Path | Default | Audience | Change when / evidence |
|---|---|---|---|
| `corroboration.max_iterations` | `5` | Fact-checker | Lower to bound cost; raise for contested claims. |
| `corroboration.max_http_calls` | `30` | Operator | The hard spend cap for one verification. |
| `corroboration.max_batch_claims` | `10` | Fact-checker | Raise for large batches; split above the cap. |
| `corroboration.modality_markers` | object | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `corroboration.confidence_threshold` | `0.8` | Fact-checker | Raise to demand stronger agreement before a verdict. |
| `corroboration.first_pass_max_results` | `5` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `corroboration.first_pass_max_providers` | `5` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `corroboration.similarity_threshold` | `0.3` | Fact-checker | Raise to require closer wording before sources agree. |
| `corroboration.kb_recall` | `true` | Fact-checker | Set `false` when cached material must not influence a verdict. |
| `corroboration.family_similarity_threshold` | `0.9` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `corroboration.calibration` | object | Fact-checker | Leave enabled; it caps secondary-only confidence. |
| `corroboration.authority_weights` | object | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |

## Output and dispatch

| Path | Default | Audience | Change when / evidence |
|---|---|---|---|
| `output.max_chars` | `50000` | Reader | The response truncation cap; raise only with a client that can use it. |
| `output.request_budget_ms` | `300000` | Operator | Wall-clock ceiling for search, fetch, and verification; lower it to bound spend. |
| `output.response_max_chars` | `50000` | Reader | The shared finalizer cap; keep aligned with `max_chars`. |
| `output.latency_window_size` | `100` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `output.latency_window_strategy` | `both` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `output.latency_window_ms` | `900000` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `output.verbose` | `true` | Reader | Set `false` for machine consumers that do not want prose. |
| `output.fallback_depth` | `5` | Operator | Lower to bound provider spend; raise for resilience. |
| `output.max_redirect_hops` | `5` | Operator | Lower for strict fetch hygiene; raise for redirect-heavy sites. |
| `output.degraded_latency_ms` | `2000` | Operator | Raise on a slow link to avoid false degraded status. |
| `output.hedge_enabled` | `true` | Operator | Disable on metered providers; hedging spends a second call. |
| `output.hedge_min_delay_ms` | `200` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `output.hedge_max_delay_ms` | `1500` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `output.hedge_grace_ms` | `300` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `output.rate_limit_cooldown_ms` | `30000` | Operator | Raise to protect quota; lower for faster retries. |
| `output.audit_log_path` | `~/.local/share/infobroker/audit.log` | Operator | Point at a private path; the audit trail is operator-owned. |
| `output.call_log` | `stderr` | Developer | `stderr` keeps the call log off disk; switch to `file` to retain it. |
| `output.call_log_path` | `~/.local/share/infobroker/call-log.jsonl` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `output.call_log_max_bytes` | `2000000` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |

## Source quality

| Path | Default | Audience | Change when / evidence |
|---|---|---|---|
| `source_quality.enabled` | `true` | Researcher | Disable only when every source is already vetted. |
| `source_quality.weight` | `0.15` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `source_quality.primary_source_suffixes` | `[4 entries]` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `source_quality.trusted_domains` | `[]` | Researcher | Add a domain to raise its authority; keep the list short. |
| `source_quality.low_quality_domains` | `[]` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `source_quality.blocklist` | `[]` | Researcher | Add a domain to refuse it from results. |

## Content policy

| Path | Default | Audience | Change when / evidence |
|---|---|---|---|
| `content_policy.mode` | `flag` | Operator | `flag` is non-blocking; `block` refuses storage of flagged content. |
| `content_policy.threshold` | `0.2` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `content_policy.patterns` | object | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |

## State

| Path | Default | Audience | Change when / evidence |
|---|---|---|---|
| `state.auto_migrate_config` | `false` | Operator | `true` accepts automatic config rewrites; keep `false` to review first. |
| `state.update_check` | `false` | Operator | `true` opts into the cached npm version check. |

## Knowledge base

| Path | Default | Audience | Change when / evidence |
|---|---|---|---|
| `kb.storage_path` | `~/.local/share/infobroker/knowledge-base` | Operator | Must resolve outside the repository tree. |
| `kb.embedding_model` | `signed-hash-tfidf` | Operator | `signed-hash-tfidf` is local and needs no model download. |
| `kb.chunk_size` | `1024` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `kb.chunk_overlap` | `64` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `kb.auto_index` | `true` | Reader | Set `false` when only explicit ingests should populate the KB. |
| `kb.default_collection` | `default` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `kb.max_results` | `50` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `kb.reports_dir` | `~/.local/share/infobroker/reports` | Operator | Advanced tuning; leave at the shipped value unless a run shows a need. |
| `kb.default_save_destination` | `kb` | Reader | `kb`, `file`, or both where the handler supports it. |
| `kb.freshness` | object | Operator | Per-tier decay and expiry; reports ignore expiry and decay in confidence. |
| `kb.kb_first_relevance_threshold` | `0.3` | Reader | Raise to demand a closer cached match before skipping search. |
| `kb.kb_first_confidence_threshold` | `0.5` | Reader | Raise to demand a more confident cached answer. |
| `kb.maintenance_interval_minutes` | `60` | Operator | Lower for aggressive expiry; raise to reduce background work. |
| `kb.keys_dir` | `~/.local/share/infobroker/keys` | Operator | Owner-only directory for KB encryption keys. |

## Preservation

| Path | Default | Audience | Change when / evidence |
|---|---|---|---|
| `preservation.enabled` | `true` | Fact-checker | Disable to skip archived-source preservation entirely. |
| `preservation.archive` | `true` | Fact-checker | `true` fetches an archive snapshot; disable on metered networks. |
| `preservation.max_sources_per_finding` | `3` | Fact-checker | Raise to preserve more evidence per finding. |
| `preservation.max_bytes` | `2000000` | Operator | The preserved-payload cap; raise only with storage headroom. |
