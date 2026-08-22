<!--
README DESIGN:

  Product principle.
    The README is the product — it answers three questions in under
    60 seconds: what this does, why you should care, how to use it.
    Readme-driven development: changes that affect the README's claims
    SHALL update the README before or alongside the code change. A README
    that promises something the server does not deliver is a defect.
    Every numeric claim (tool count, provider count, zero-config count)
    reconciles against src/index.ts and config.json — the validator
    enforces this (Surface reconciliation).

  Voice: Professional, confident, benefit-first. Direct address ("you").
    No first-person ("we", "I", "our"). Short declarative fragments in the
    tagline. Every sentence survives a reader who knows nothing about
    Infobroker.

  Demo: Natural-language prompts in blockquotes ("Search for..."), never
    full tool names (`infobroker_web_search`). Show the reader how to
    express what they want — the AI maps intent to tools. Every demo
    prompt SHALL be a valid natural-language command the reader could
    actually run; broken prompts are a README defect.

  Structure: Hero → North Star → Quick Start → MCP Server (§3 features) →
    Providers → Configuration → How It Compares → Contribute →
    License → Spec. No other ordering. Canonical h2 headings are enforced
    by validate-readme.

  Audience split: §2 is for developers who want to start the server.
    §3 describes what users can do with it. §4-5 are configuration.
    §6 is competitive context. §7-9 are contributor/license/spec.

  No repetition. One story vector per section. Don't explain the same
    concept in two places — the validator flags near-duplicate sentences.
    No feature bullet lists in prose. No tables for feature descriptions.

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
    — never a sentence or question. Enforced maximum 200 words
    (validate-readme). The tagline "One server. Every source. Research
    that delivers." is the repeated refrain — it appears exactly twice,
    in the Hero tagline and the comparison closing prose, and no more.
    The hero paragraph closes with "Free first. Privacy always." —
    distinct from the tagline. Updating any repeated line requires
    updating its echo.

  North Star: Single paragraph stating the Bothan Spynet metaphor and
    intelligence-cycle framing. No sub-headings, lists, or blockquotes.
    Maximum 100 words (enforced by validate-readme).

  Tables. Exactly two tables: the Providers table (§4) and the
    Comparison table (§6). No other tables. The Providers table lists
    every configured provider (excluding the `native_fetch` fallback
    renderer) — one row per provider, matching config.json.

  Word budget. Hero ≤ 200 words. North Star ≤ 100 words. Each §3 feature
    h3 ≤ 350 words. The validator's section-length check enforces these.

  Non-goals. The README is not an API reference, a tool catalog, a spec
    document, or a changelog. The complete tool inventory lives in the
    feature taxonomy (§D of infobroker.md), which the README links to.
    Tool names appear in prose only as shorthand in backticks where a
    feature is introduced (e.g. `kb`), never as a bare list.

  Validator. Rules marked "(validate-readme)" SHALL be checked by
    scripts/validate-readme.ts. Other rules are enforced by author/AI
    discipline. Adding an enforceable rule requires a corresponding
    validator check. Tool and provider names are derived from
    src/index.ts and config.json at validate time — never hardcoded.

  Binary style checklist (applies to every AI edit of this file):
    1. Second person ("you"), never first-person.
    2. Tool names in backticks, shorthand form; full `infobroker_`
       prefixes only in the design comment's "never do this" example.
    3. Blockquotes only in §3 feature subsections, 2-5 natural-language
       prompts each, no tool names.
    4. Tagline refrain "One server. Every source. Research that
       delivers." appears exactly twice (Hero + comparison closing).
    5. No bullet list of features in prose.
    6. Exactly two tables (Providers, Comparison), no others.
    7. Every numeric claim reconciles to src/index.ts + config.json.
    8. ATX headings only, no setext.
    9. One story vector per section, no near-duplicate sentences.
   10. "Last updated: YYYY-MM-DD." matches package.json version date.
-->

# Infobroker

**One server. Every source. Research that delivers.**

Infobroker is a multi-provider MCP server that unifies web search,
structured knowledge, academic, archive, and content-extraction APIs
behind a single tool surface. Fourteen zero-config providers ship in the
box — search the web, look up facts, fetch articles — with nothing to
configure. Four more providers unlock with API keys or self-hosting. A built-in convergence engine cross-references independent
sources to separate established facts from contested claims. Bundled
client skills transform raw research into polished writing. Free first.
Privacy always.

## North Star

Infobroker is the [Bothan Spynet](https://starwars.fandom.com/wiki/Bothan_Spynet/Legends) as a tool — a decentralized intelligence
network that queries independent sources and routes results through a
single, impartial interface. In intelligence-cycle terms, you supply the
direction and get the dissemination; the server handles the collection and
processing.

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

Your research backend. Six tools, eighteen providers, one
convergence engine. The complete feature inventory is documented in the
[feature taxonomy](infobroker.md#d-appendix-feature-taxonomy) in the
spec.

### Unified Search

> "Search for the location of the second Death Star."
> "Find scholarly papers on hyperspace travel theories."

`web_search` sends one query to every provider that can answer it. Search
across DuckDuckGo, Wikipedia, academic databases, news, code repositories —
or describe your task and the server picks the best source. Failed providers fall
back silently through a configurable chain so you get results, not
error messages. Other search tools lock you to one engine; Infobroker
routes every query to the right provider and keeps going when one
fails.

### Content Extraction

> "Fetch the article on the Battle of Yavin and summarize it."
> "Get the text of that page about the Death Star plans."

`fetch_page` hands any URL to Jina Reader, which renders it as clean
Markdown optimized for LLM consumption. Falls back to native HTTP when
Jina is throttled. Wikipedia and Internet Archive have dedicated
renderers for source-specific extraction. Built-in web fetchers return
raw HTML; Infobroker gives you clean, readable content from any source —
ready for summarization or analysis.

### Provider Intelligence

> "Which source should I use to research the Death Star's weakness?"
> "Show me all available sources and their quota status."

The server knows its own capabilities. `web_search` auto-selects the
best backend for your task, weighing capability, quota, and latency.
`providers` surfaces every configured source and drills into a single
provider's uptime and error history. No other search MCP server gives
you operational visibility into every backend.

### Multi-Source Verification

> "Verify whether the Empire really destroyed Alderaan."
> "Find the consensus on who fired first — Han or Greedo."

`converge` runs a multi-pass truth-finding loop: broad
search across active providers, claim extraction, cross-source
reconciliation, and targeted follow-up for gaps. Claims corroborated
across independent sources score high confidence. Contradictions are
surfaced with all perspectives. Gaps trigger refined queries. You get a
structured report — confirmed, contested, and unverified findings —
with source provenance and confidence scores. Every other search tool
returns a list of links; Infobroker finds the truth and tells you how
sure it is.

### Knowledge Base

> "Search what you already found about the Rebel Alliance fleet."
> "Ingest this article so it's cached for next time."

Every search, fetch, and convergence run is cached in a local knowledge
base. `kb` checks the cache before hitting external providers — only
falling back to the network when the cached results aren't fresh enough
or relevant enough. Its actions ingest new text or a URL by hand, report
what's cached, and remove content. Content is age-scored, expired on a
freshness schedule, and deduplicated by source. Other search MCP servers
re-fetch the same facts every session; Infobroker remembers and reuses
what it already found.

### Research Pipeline

> "Research the construction of the Death Star, then draft a summary."
> "Fact-check these claims about Darth Vader's origin."

Infobroker is a search backend — but it ships with bundled client
skills that chain its tools into writing pipelines. The orchestrator
skill routes through deep-research (multi-source investigation),
fact-checking (claim-to-verdict with confidence scoring), and
summarization before handing off to technical-writing, proofreading, and
translation. Every skill lives in the repository — no external paths
needed. For high-stakes questions requiring gated analytic rigor, the
analysis-loop skill escalates to a confidence-scored, source-graded
workflow. Other search MCP servers produce search results; Infobroker
produces finished work.

### Operational Visibility

> "Show server health."
> "Hot-reload my config without restarting."

Quota counters persist to disk and survive restarts. Rate limits are
enforced per-provider, not globally. Configuration is hot-reloadable
via `reload_config` — change providers, adjust chains, or tweak
thresholds without dropping connections. `web_search` doubles as
DuckDuckGo query autocomplete. `providers` reports the server's build
health and request stats. You always know what your search server is
doing and how much capacity remains.

## Providers

Eighteen providers. Fourteen work with zero configuration.

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
| `INFOBROKER_CONFIG_LOCAL` | Optional path to a user config layer (default: `config.local.json`) |
| `INFOBROKER_<NAME>_API_KEY` | API key for keyed providers |
| `INFOBROKER_<NAME>_URL` | URL for self-hosted providers |

`config.json` ships with the repository and holds the defaults: which
providers are enabled, their priority in fallback chains, rate limits,
convergence parameters, and the task-to-provider dispatch table.
Hot-reloadable via `reload_config` — edit the file, call the tool, and
changes take effect without a restart.

Your own overrides live in a separate user layer — `config.local.json`
in the project directory (or a path you set via `INFOBROKER_CONFIG_LOCAL`).
This file is git-ignored, so pulling updates from the repository never
overwrites your settings. Values in the user layer take precedence over
the shipped defaults; anything left out falls back to `config.json`.

## How It Compares

| Tool name | What you're used to | How Infobroker differs |
|-----------|--------------------|-----------------------|
| Built-in `websearch` / `webfetch` | One search engine, one fetch mode, no configuration, no visibility into what backend is used | Fourteen zero-config providers with a unified tool surface. Choose the right source for each task. Fall back automatically on failure. See every provider's status and quota. |
| Raw API calls | Manual HTTP requests, per-provider auth, per-provider response parsing, no fallback, no quota tracking | One interface for every provider. API keys configured once. Results normalized to a common shape. Rate limits and quota tracked automatically. |
| Dedicated search APIs | Pay-per-query, vendor lock-in, opaque routing | Free-first design. DuckDuckGo, Wikipedia, and twelve other providers work with zero configuration. Upgrade paths for Brave, Exa, and Tavily. Self-hosted SearXNG for full privacy. |
| Other search MCP servers | Single-provider focus, no fallback, no convergence, no writing pipeline | Multi-provider with automatic fallback. Convergence engine cross-references independent sources. Bundled writing skills transform research into finished documents. |
| AI with built-in search | The model picks the search engine, serves stale cache, no reproducibility | You control the provider chain. Queries are reproducible. Fallback behavior is visible. The convergence engine verifies facts across independent sources. |

Every other search MCP server asks you to pick a provider and trust it.
Infobroker gives you a fleet — and picks the right one for each task.
When a provider fails, the next one takes over without you noticing.
When a claim matters, the convergence engine finds agreement,
contradiction, and gaps. The bundled skills close the loop from raw
research to finished writing. One server. Every source. Research that
delivers.

Last updated: 2026-08-21.

## Contribute

- **Node.js 20+.** `node --version`. Get it at
  [nodejs.org](https://nodejs.org).
- `npm install && npm run typecheck`
- Bundle your own skill in `skills/` to extend the research pipeline.
- Validate README structure: `npm run validate-readme`
- **Versioning:** CalVer (`YYYY.MM.DD`). `npm run version-bump` stamps
  today's date into all version references. Pre-commit hooks verify
  consistency. `npm run push` checks, tags, and pushes.
- MCP protocol: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- Providers: [DuckDuckGo](https://duckduckgo.com) ·
  [Jina Reader](https://jina.ai/reader) ·
  [Wikipedia API](https://en.wikipedia.org/w/api.php)

## License

MIT.

## Spec

Built from `infobroker.md` v2026.08.21.
