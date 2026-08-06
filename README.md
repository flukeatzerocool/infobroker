# Infobroker — Research & Writing Professional MCP Server

Multi-provider MCP server wrapping public web search, structured knowledge, scholarly, and content-extraction APIs behind a unified tool surface.

## Design Goals

1. **Free first, privacy always.** Zero-config default uses only free, no-auth-required providers.
2. **Upgrade path.** Optional API-keyed providers for higher throughput and specialized queries.
3. **Provider intelligence.** Auto-selects the best provider for a task.
4. **Truth by iteration.** `converge` tool runs multi-pass cross-source verification.
5. **Writing pipeline.** Raw research materials feed bundled client skills.

## Quick Start

```bash
cd Infobroker && npm install && npm run start
```

## Configuration

Edit `config.json` to enable/disable providers. API keys go in environment variables:

```bash
export INFOBROKER_BRAVE_API_KEY="your-key"
export INFOBROKER_EXA_API_KEY="your-key"
```

## OpenCode Integration

Add to `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "infobroker": {
      "type": "local",
      "command": ["<path-to-Infobroker>/node_modules/.bin/tsx", "<path-to-Infobroker>/src/index.ts"],
      "environment": {
        "INFOBROKER_CONFIG": "<path-to-Infobroker>/config.json"
      }
    }
  }
}
```

## Providers

| Provider | Type | Key Required |
|----------|------|-------------|
| DuckDuckGo | Built-in | No |
| Jina Reader | Free HTTP | No |
| Wikipedia | Free HTTP | No |
| Wiktionary | Free HTTP | No |
| Wikidata | Free HTTP | No |
| OpenStreetMap | Free HTTP | No |
| Internet Archive | Free HTTP | No |
| Brave Search | Keyed HTTP | Yes |
| Exa | Keyed HTTP | Yes |
| Tavily | Keyed HTTP | Yes |

## Tools

| Tool | Purpose |
|------|---------|
| `infobroker_web_search` | Search across providers with fallback |
| `infobroker_fetch_page` | Fetch URL content (Jina Reader default) |
| `infobroker_search_suggestions` | Query autocomplete |
| `infobroker_choose_provider` | Recommend best provider |
| `infobroker_list_providers` | List providers + quota status |
| `infobroker_provider_health` | Provider health report |
| `infobroker_converge` | Multi-source truth-finding |
| `infobroker_reload_config` | Hot-reload config |
| `infobroker_spec_health` | Build health report |

## Requirements

- Node.js 20+

## License

MIT

## Spec

Built from `infobroker.md` v2026.08.06
