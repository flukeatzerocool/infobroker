# Provider Dispatch Map

Quick reference for `web_search` auto-selection. The server classifies the
query into a task type and routes to the primary provider of that type's
dispatch chain, falling back in order.

## Task → Provider Table

| Task type | Primary | Fallback 1 | Fallback 2 |
|-----------|---------|-----------|-----------|
| General web search | Brave (if keyed) | DuckDuckGo | Marginalia, Mojeek, Wiby |
| Small web / blogs / non-commercial | Marginalia | Mojeek | Wiby, DuckDuckGo |
| Encyclopedia article | Wikipedia | DuckDuckGo | — |
| Word definition / etymology | Wiktionary | DuckDuckGo | — |
| Structured fact (dates, stats) | Wikidata | Wikipedia | DuckDuckGo |
| Location / place lookup | OpenStreetMap | Wikipedia | DuckDuckGo |
| Academic paper search | Semantic Scholar | arXiv | OpenAlex, Europe PMC |
| Code / technical Q&A | Stack Exchange | GitHub | DuckDuckGo |
| Recent news | Brave (if keyed) | DuckDuckGo | GDELT, Hacker News |
| Financial filings / economic data | SEC EDGAR | World Bank | DuckDuckGo |
| Historical web page | Internet Archive | DuckDuckGo | — |
| Semantic / "find things like X" | Exa (if keyed) | Brave (if keyed) | DuckDuckGo |
| Synthesized answer with citations | Tavily (if keyed) | Exa (if keyed) | DuckDuckGo |
| Privacy-critical search | DuckDuckGo | SearXNG (if configured) | Mojeek |
| URL content → Markdown | Jina Reader | Native HTTP fetch | — |

## Provider Capabilities

| Provider | Web | Academic | Code | Encyclopedia | News | Archive | Fetch | Key required |
|----------|-----|----------|------|-------------|------|---------|-------|-------------|
| DuckDuckGo | Yes | — | — | — | — | — | — | No |
| Jina Reader | — | — | — | — | — | — | Yes | No |
| Wikipedia | — | — | — | Yes | — | — | — | No |
| Wiktionary | — | — | — | Defs | — | — | — | No |
| Wikidata | — | — | — | Facts | — | — | — | No |
| OpenStreetMap | — | — | — | Geo | — | — | — | No |
| Internet Archive | — | — | — | — | — | Yes | — | No |
| arXiv | — | Yes | — | — | — | — | — | No |
| Semantic Scholar | — | Yes | — | — | — | — | — | No* |
| Stack Exchange | — | — | Yes | — | — | — | — | No* |
| GitHub | — | — | Yes | — | — | — | — | No* |
| CORE | — | Yes | — | — | — | — | — | No* |
| Marginalia | Yes | — | — | — | — | — | — | No |
| Mojeek | Yes | — | — | — | — | — | — | No |
| Wiby | Yes | — | — | — | — | — | — | No |
| OpenAlex | — | Yes | — | — | — | — | — | No |
| Europe PMC | — | Yes | — | — | — | — | — | No |
| Hacker News | — | — | — | — | Yes | — | — | No |
| GDELT | — | — | — | — | Yes | — | — | No |
| SEC EDGAR | — | — | — | — | — | — | — | No |
| World Bank | — | — | — | — | — | — | — | No |
| Brave | Yes | — | — | — | Yes | — | — | Yes |
| Exa | — | — | — | — | — | — | — | Yes |
| Tavily | — | — | — | — | — | — | — | Yes |
| SearXNG | Yes | — | — | — | — | — | — | No* |
| Yep | Yes | — | — | — | — | — | — | Yes |

\* No key required for baseline access (rate-limited); key increases quota.
