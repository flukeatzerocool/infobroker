# Provider Dispatch Map

Quick reference for `web_search` auto-selection. The server classifies the
query into a task type and routes to the primary provider of that type's
dispatch chain, falling back in order.

## Task → Provider Table

| Task type | Primary | Fallback 1 | Fallback 2 |
|-----------|---------|-----------|-----------|
| General web search | Brave (if keyed) | DuckDuckGo | Marginalia, Mojeek |
| Small web / blogs / non-commercial | Marginalia | Mojeek | DuckDuckGo |
| Encyclopedia article | Wikipedia | DuckDuckGo | — |
| Word definition / etymology | Wiktionary | DuckDuckGo | — |
| Structured fact (dates, stats) | Wikidata | Wikipedia | DuckDuckGo |
| Location / place lookup | OpenStreetMap Nominatim | Wikipedia | DuckDuckGo |
| Academic paper search | Semantic Scholar | arXiv | — |
| Code / technical Q&A | Stack Exchange | GitHub | DuckDuckGo |
| Recent news | Brave (if keyed) | DuckDuckGo | — |
| Historical web page | Internet Archive | DuckDuckGo | — |
| Semantic / "find things like X" | Exa (if keyed) | Brave (if keyed) | DuckDuckGo |
| Synthesized answer with citations | Tavily (if keyed) | Exa (if keyed) | DuckDuckGo |
| Privacy-critical search | DuckDuckGo | SearXNG (if configured) | Mojeek |
| URL content → Markdown | Jina Reader | Native HTTP fetch | — |

## Provider Capabilities

| Provider | Web | Academic | Code | Encyclopedia | News | Archive | Fetch | Key required |
|----------|-----|----------|------|-------------|------|---------|-------|-------------|
| DuckDuckGo | Yes | — | Yes | — | Yes | — | — | No |
| Marginalia | Yes | — | — | — | — | — | — | No |
| Mojeek | Yes | — | — | — | — | — | — | No |
| Wikipedia | — | — | — | Yes | — | — | — | No |
| Wiktionary | — | — | — | Defs | — | — | — | No |
| Wikidata | — | — | — | Facts | — | — | — | No |
| OpenStreetMap | — | — | — | Geo | — | — | — | No |
| Semantic Scholar | — | Yes | — | — | — | — | — | No* |
| arXiv | — | Yes | — | — | — | — | — | No |
| Stack Exchange | — | — | Yes | — | — | — | — | No* |
| GitHub | — | — | Yes | — | — | — | — | No* |
| Internet Archive | — | — | — | — | — | Yes | — | No |
| Jina Reader | — | — | — | — | — | — | Yes | No |
| Brave | Yes | — | — | — | Yes | — | — | Yes |
| Exa | Yes | — | — | — | — | — | — | Yes |
| Tavily | Yes | — | — | — | — | — | — | Yes |
| CORE | — | Yes | — | — | — | — | — | No* |
| SearXNG | Yes | Yes | Yes | Yes | Yes | — | — | No* |

\* No key required for baseline access (rate-limited); key increases quota.
