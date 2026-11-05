# Provider Privacy Reference

Generated from `config.json`. Do not edit manually.

Posture is derived from each provider's tier and resale flag, with explicit per-provider overrides taking precedence. `unknown` means configuration does not establish the answer; it is not a privacy claim.

| Provider | Tier | Query forwarding | Retains query | Account/key | Resells | Notes |
|----------|------|------------------|---------------|-------------|---------|-------|
| arxiv | free_http | origin provider | unknown | none | no |  |
| brave | keyed_http | third party | unknown | required | yes |  |
| core | free_http | origin provider | unknown | none | no |  |
| crossref | free_http | origin provider | unknown | none | no |  |
| duckduckgo | builtin | origin provider | unknown | none | yes |  |
| europe_pmc | free_http | origin provider | unknown | none | no |  |
| exa | keyed_http | third party | unknown | required | yes |  |
| gdelt | free_http | origin provider | unknown | none | no |  |
| github | free_http | origin provider | unknown | none | no |  |
| hacker_news | free_http | origin provider | unknown | none | no |  |
| internet_archive | free_http | origin provider | unknown | none | no |  |
| jina | free_http | origin provider | unknown | none | no |  |
| marginalia | builtin | origin provider | unknown | none | yes |  |
| mojeek | builtin | origin provider | unknown | none | yes |  |
| native_fetch | builtin | origin provider | unknown | none | no |  |
| openalex | free_http | origin provider | unknown | none | no |  |
| openstreetmap | free_http | origin provider | unknown | none | no |  |
| searxng | self_hosted_http | third party | unknown | none | yes | self-hosted instance; upstream engines receive queries unless configured otherwise |
| sec_edgar | free_http | origin provider | unknown | none | no |  |
| semantic_scholar | free_http | origin provider | unknown | none | no |  |
| stack_exchange | free_http | origin provider | unknown | none | no |  |
| tavily | keyed_http | third party | unknown | required | yes |  |
| wiby | builtin | origin provider | unknown | none | yes |  |
| wikidata | free_http | origin provider | unknown | none | no |  |
| wikipedia | free_http | origin provider | unknown | none | no |  |
| wiktionary | free_http | origin provider | unknown | none | no |  |
| world_bank | free_http | origin provider | unknown | none | no |  |
| yep | keyed_http | third party | unknown | required | yes |  |
