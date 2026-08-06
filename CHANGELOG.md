# Changelog

## 2026.08.06 — Initial Build

- MCP skeleton with stdio transport
- Zero-config providers: DuckDuckGo (HTML scraping), Jina Reader, Wikipedia, Wiktionary, Wikidata, OpenStreetMap, Internet Archive
- Keyed provider configuration: Brave, Exa, Tavily, SearXNG, Semantic Scholar, Stack Exchange, GitHub, CORE
- 9 tools: `web_search`, `fetch_page`, `search_suggestions`, `choose_provider`, `list_providers`, `provider_health`, `converge`, `reload_config`, `spec_health`
- Per-provider rate limiting and persistent quota tracking
- Fallback chain with configurable depth
- Convergence engine: multi-pass truth-finding with cross-source verification
- Client artifacts: `search-preferences.md`, skill pipeline, bundled skills
- Result normalization across all provider formats
- Hot-reloadable configuration
