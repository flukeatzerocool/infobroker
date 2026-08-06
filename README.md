<!--
README DESIGN:
  Voice: Professional, confident, benefit-first. Direct address ("you").
  Demo: Natural-language prompts in blockquotes ("Search for..."),
    never tool names (`infobroker_web_search`). Show the reader how
    to express what they want — the AI maps intent to tools.
  Structure: Hero → Quick Start → MCP Server (§3 features) → Providers →
    Configuration → How It Compares → Contribute → License → Spec.
  Audience split: §2 is for developers who want to start the server.
    §3 describes what users can do with it. §4-5 are configuration.
    §6 is competitive context.
  No tables for feature descriptions. No repetition. One story vector
    per section.
  Feature blurbs: Each h3 under §3 follows a four-beat cadence —
    benefit hook, mechanics, competitive proof, closer. The
    competitive-proof sentence contrasts Infobroker against the
    current tool landscape without naming individual competitors; it
    answers "why this beats what you're used to."
  MCP server order: Features under §3 follow a research workflow —
    Search → Extract → Verify → Write → Manage. New features
    insert at the workflow point they serve; reorder the section
    to restore the workflow after every addition or removal.
  Comparison table: Three columns (Tool name | What you're used to |
    How Infobroker differs). One row per competitor category, never
    individual products. Prose paragraph below synthesizes the table;
    it never repeats a row's content verbatim.
  Hero: Exactly three elements — h1 heading, bold tagline, one prose
    paragraph. No sub-headings, bullet lists, or preamble paragraphs.
    The tagline uses short declarative fragments separated by periods
    — never a sentence or question. The closing refrain "Free first.
    Privacy always." is echoed in the comparison section; changing
    one requires updating the other. Enforced maximum 200 words
    (validate-readme).
-->

# Infobroker

**One server. Every source. Research that delivers.**

Infobroker is a multi-provider MCP server that unifies web search,
structured knowledge, academic, archive, and content-extraction APIs
behind a single tool surface. Seven zero-config providers ship in the
box — search the web, look up facts, fetch articles — with nothing to
configure. Eleven more providers unlock instantly with free API keys or
self-hosting. A built-in convergence engine cross-references independent
sources to separate established facts from contested claims. Bundled
client skills transform raw research into polished writing. Free first.
Privacy always.

## Quick Start

```sh
cd Infobroker && npm install && npm run start
```

Add this to your OpenCode config (`~/.config/opencode/opencode.json`):

```json
{
  "mcp": {
    "infobroker": {
      "type": "local",
      "command": ["node_modules/.bin/tsx", "src/index.ts"],
      "cwd": "<path-to-Infobroker>",
      "environment": {
        "INFOBROKER_CONFIG": "<path-to-Infobroker>/config.json"
      }
    }
  }
}
```

Free providers work immediately. API-keyed providers — Brave, Exa,
Tavily, SearXNG — unlock higher throughput and specialized search:

```bash
export INFOBROKER_BRAVE_API_KEY="your-key"
export INFOBROKER_EXA_API_KEY="your-key"
```

Requirements: Node.js 20+.

## MCP Server

Your research backend. Nine tools, eighteen providers, one
convergence engine.

### Unified Search

> "Search the web for quantum error correction advances in 2025."
> "Find scholarly papers on CRISPR delivery mechanisms."

One query, every provider that can answer it. Search across DuckDuckGo,
Wikipedia, academic databases, news, code repositories — or describe
your task and the server picks the best source. Failed providers fall
back silently through a configurable chain so you get results, not
error messages. Other search tools lock you to one engine; Infobroker
routes every query to the right provider and keeps going when one
fails.

### Content Extraction

> "Fetch this article and summarize it."
> "Get the text of that Wayback Machine snapshot."

Jina Reader renders any URL as clean Markdown optimized for LLM
consumption. Falls back to native HTTP when Jina is throttled.
Wikipedia and Internet Archive have dedicated renderers for
source-specific extraction. Built-in web fetchers return raw HTML;
Infobroker gives you clean, readable content from any source — ready
for summarization or analysis.

### Provider Intelligence

> "Which provider should I use for academic papers?"
> "Show me all available sources and their quota status."

The server knows its own capabilities. `choose_provider` recommends
the best backend for your task, weighing capability, quota, and
latency. `list_providers` surfaces every configured source with
status, rate limits, quota, and supported task types.
`provider_health` drills into a single provider's uptime and error
history. No other search MCP server gives you operational visibility
into every backend.

### Multi-Source Verification

> "Verify whether honey never spoils."
> "Find the consensus on recommended daily water intake."

The convergence engine runs a multi-pass truth-finding loop: broad
search across active providers, claim extraction, cross-source
reconciliation, and targeted follow-up for gaps. Claims corroborated
across independent sources score high confidence. Contradictions are
surfaced with all perspectives. Gaps trigger refined queries. You get a
structured report — confirmed, contested, and unverified findings —
with source provenance and confidence scores. Every other search tool
returns a list of links; Infobroker finds the truth and tells you how
sure it is.

### Research Pipeline

> "Research EU climate policy, then draft a summary."
> "Fact-check this article's nutrition claims."

Infobroker is a search backend — but it ships with bundled client
skills that chain its tools into writing pipelines. The orchestrator
skill routes through deep-research (multi-source investigation),
fact-checking (claim-to-verdict with confidence scoring), and
summarization before handing off to technical-writing or copywriting.
Every skill lives in the repository — no external paths needed. Other
search MCP servers produce search results; Infobroker produces finished
work.

### Operational Visibility

> "Show server health."
> "Hot-reload my config without restarting."

Quota counters persist to disk and survive restarts. Rate limits are
enforced per-provider, not globally. Configuration is hot-reloadable
via `reload_config` — change providers, adjust chains, or tweak
thresholds without dropping connections. Search suggestions via
DuckDuckGo autocomplete. You always know what your search server is
doing and how much capacity remains.

## Providers

Eighteen providers. Seven work with zero configuration.

| Provider | Tier | Type | Key Required |
|----------|------|------|-------------|
| DuckDuckGo | Built-in | Web search | No |
| Jina Reader | Free HTTP | Content extraction | No |
| Wikipedia | Free HTTP | Encyclopedia | No |
| Wiktionary | Free HTTP | Dictionary | No |
| Wikidata | Free HTTP | Structured facts | No |
| OpenStreetMap | Free HTTP | Geocoding | No |
| Internet Archive | Free HTTP | Historical | No |
| arXiv | Free HTTP | Academic | No |
| Semantic Scholar | Free HTTP | Academic | Optional |
| Stack Exchange | Free HTTP | Code Q&A | Optional |
| GitHub | Free HTTP | Code search | Optional |
| CORE | Free HTTP | Open access | Optional |
| Marginalia | Built-in | Small web | No |
| Mojeek | Built-in | Independent index | No |
| Brave Search | Keyed HTTP | Web, News | Yes |
| Exa | Keyed HTTP | Semantic | Yes |
| Tavily | Keyed HTTP | Synthesis | Yes |
| SearXNG | Self-hosted | Full privacy | Yes (self) |

Built-in and free-HTTP providers are active out of the box. Keyed
providers enable with an API key. Self-hosted providers point at your
own instance:

```bash
export INFOBROKER_BRAVE_API_KEY="BSA-..."
export INFOBROKER_SEARXNG_URL="http://localhost:8080"
```

Then set `"enabled": true` in `config.json` for the provider.

## Configuration

| Variable | Purpose |
|----------|---------|
| `INFOBROKER_CONFIG` | Path to config.json (default: `./config.json`) |
| `INFOBROKER_<NAME>_API_KEY` | API key for keyed providers |
| `INFOBROKER_<NAME>_URL` | URL for self-hosted providers |

`config.json` controls which providers are enabled, their priority in
fallback chains, rate limits, convergence parameters, and the
task-to-provider dispatch table. Hot-reloadable via `reload_config` —
edit the file, call the tool, and changes take effect without a
restart.

## How It Compares

| Tool name | What you're used to | How Infobroker differs |
|-----------|--------------------|-----------------------|
| Built-in `websearch` / `webfetch` | One search engine, one fetch mode, no configuration, no visibility into what backend is used | Seven zero-config providers with a unified tool surface. Choose the right source for each task. Fall back automatically on failure. See every provider's status and quota. |
| Raw API calls | Manual HTTP requests, per-provider auth, per-provider response parsing, no fallback, no quota tracking | One interface for every provider. API keys configured once. Results normalized to a common shape. Rate limits and quota tracked automatically. |
| Dedicated search APIs | Pay-per-query, vendor lock-in, opaque routing | Free-first design. DuckDuckGo, Wikipedia, and five other providers work with zero configuration. Upgrade paths for Brave, Exa, and Tavily. Self-hosted SearXNG for full privacy. |
| Other search MCP servers | Single-provider focus, no fallback, no convergence, no writing pipeline | Multi-provider with automatic fallback. Convergence engine cross-references independent sources. Bundled writing skills transform research into finished documents. |
| AI with built-in search | The model picks the search engine, serves stale cache, no reproducibility | You control the provider chain. Queries are reproducible. Fallback behavior is visible. The convergence engine verifies facts across independent sources. |

Every other search MCP server asks you to pick a provider and trust it.
Infobroker gives you a fleet — and picks the right one for each task.
When a provider fails, the next one takes over without you noticing.
When a claim matters, the convergence engine finds agreement,
contradiction, and gaps. The bundled skills close the loop from raw
research to finished writing. One server. Every source. Research that
delivers.

Last researched: August 6, 2026.

## Contribute

- **Node.js 20+.** `node --version`. Get it at
  [nodejs.org](https://nodejs.org).
- `npm install && npm run typecheck`
- Bundle your own skill in `skills/` to extend the research pipeline.
- Validate README structure: `npm run validate-readme`
- MCP protocol: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- Providers: [DuckDuckGo](https://duckduckgo.com) ·
  [Jina Reader](https://jina.ai/reader) ·
  [Wikipedia API](https://en.wikipedia.org/w/api.php)

## License

MIT.

## Spec

Built from `infobroker.md` v2026.08.06.
