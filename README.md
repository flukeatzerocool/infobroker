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
    Skills → Providers → Configuration → How It Compares → Contribute →
    License → Spec. No other ordering. Canonical h2 headings are enforced
    by validate-readme.

  Audience split: §2 is for developers who want to start the server.
    §3 describes what users can do with it. The Skills section (§3.5)
    describes the bundled client skills and instructions. §4-5 are
    configuration. §6 is competitive context. §7-9 are
    contributor/license/spec.

  Skills section: Prose only — no tables, no blockquotes, no feature
    bullet lists. Lists the six bundled skills and the workflow shapes the
    orchestrator routes to, with analysis-loop as the escalation shape.
    Cross-links to the skill references (pipeline-map.md, workflows.md).

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
behind a single tool surface. Fifteen zero-config providers ship in the
box — search the web, look up facts, fetch articles — with nothing to
configure. Five more providers unlock with API keys or self-hosting. A built-in corroboration engine cross-references independent
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
  "instructions": [
    "<path-to-Infobroker>/instructions/search-preferences.md"
  ],
  "skills": {
    "paths": [
      "<path-to-Infobroker>/skills",
      "<path-to-opencode-config>/skills"
    ]
  },
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

The `mcp` block starts the server; the `instructions` and `skills` blocks
are what activate the bundled client skills. Without them the skills ship
in the repository but stay inert.

Free providers work immediately. API-keyed providers — Brave, Exa,
Tavily, SearXNG — unlock higher throughput and specialized search:

```bash
export INFOBROKER_BRAVE_API_KEY="your-key"
export INFOBROKER_EXA_API_KEY="your-key"
```

Requirements: Node.js 20+.

## MCP Server

Your research backend. Six tools, twenty providers, one
corroboration engine. The complete feature inventory is documented in the
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
best backend for your task, weighing capability, quota, and latency —
or routes by your intent when you ask for privacy, speed, or free-only
sources. `providers` surfaces every configured source and drills into a
single provider's uptime and error history. No other search MCP server
gives you operational visibility into every backend.

### Multi-Source Verification

> "Verify whether the Empire really destroyed Alderaan."
> "Find the consensus on who fired first — Han or Greedo."

`corroborate` runs a multi-pass truth-finding loop: broad
search across active providers, claim extraction, cross-source
reconciliation, and targeted follow-up for gaps. Claims corroborated
across independent sources score high confidence, weighted by each
source's authority; every source is bound to the claim it supports.
Contradictions are surfaced with all perspectives. Gaps trigger refined
queries. You get a structured report — confirmed, contested, and
unverified findings — with source provenance, per-source claims, and
confidence scores. Every other search tool returns a list of links;
Infobroker finds the truth and tells you how sure it is.

### Knowledge Base

> "Search what you already found about the Rebel Alliance fleet."
> "Ingest this article so it's cached for next time."

Every search, fetch, and corroboration run is cached in a local knowledge
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

Infobroker doesn't stop at search results. Bundled client skills chain
its tools into writing pipelines, routing every request through a solved
workflow shape and the writing sub-skills until a finished document comes
out the other end. Everything lives in the repository — no external paths
or separate install. The full pipeline — the six skills, the workflow
shapes, and the escalation path — is detailed in the [Skills
section](#skills). Other search MCP servers produce search results;
Infobroker produces finished work.

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

## Skills

The MCP server is one half of the product. The bundled skills are the
other. Six client skills ship in the repository — no external dependency,
no separate install — and they turn raw research into finished work.

The orchestrator skill (`infobroker`) opens with a classify gate that
maps your request to a workflow shape: research-and-write, fact-check,
deep-dive, competitive evaluation, literature review, monitoring,
red-team, vetting, or gated analysis. Each shape composes the same
primitives — recall from the knowledge base, search, extract, verify,
write, and cite — into its own sequence and ends with a grep-able
completion token so you can confirm the outcome. Four writing sub-skills
execute the writing phases: `summarization` condenses findings before
writing, `technical-writing` drafts reports and docs, `proofreading`
polishes language, and `translation` produces multilingual output.

Gated analysis is the escalation shape. When a question is high-stakes or
decision-driving, the classify gate routes to the `analysis-loop` skill —
a disciplined path with confidence-scored findings, source-reliability
grading, and structured analytic techniques — rather than the lighter
research-and-write route. It shares the same primitives and Infobroker
tools but runs its own gated workflow, so you get the rigor without
leaving the pipeline.

A single instruction file, `search-preferences.md`, routes your client
toward these tools: the knowledge base first, external providers only
when the cache falls short. Wire it and the skills directory into your
OpenCode config once — the Quick Start above shows the exact snippet —
and every research request follows the pipeline automatically.

Write your own skill into `skills/` to add a workflow shape of your own.
The pipeline diagram lives in `references/pipeline-map.md` and the
workflow-shape definitions in `references/workflows.md`. Other search MCP
servers return links; Infobroker ships the writers that turn them into
documented answers.

## Providers

Twenty providers. Fifteen work with zero configuration.

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
| Wiby | Built-in | Small web | No |
| Brave Search | Keyed HTTP | Web, News | Yes |
| Exa | Keyed HTTP | Semantic | Yes |
| Tavily | Keyed HTTP | Synthesis | Yes |
| Yep | Keyed HTTP | Web, Semantic | Yes |
| SearXNG | Self-hosted | Full privacy | Yes (self) |

Built-in and free-HTTP providers are active out of the box. Keyed
providers enable with an API key. Self-hosted providers point at a server
you run yourself:

```bash
export INFOBROKER_BRAVE_API_KEY="BSA-..."
export INFOBROKER_SEARXNG_URL="http://localhost:8080"
```

Then set `"enabled": true` in `config.json` for the provider.

SearXNG is the only shipped self-hosted provider, and it is optional
through and through. Nothing in the server requires it, and nothing is
bundled or installed on its behalf — SearXNG runs as a container you
operate, and Infobroker queries its JSON endpoint like any other backend.
Leave it disabled (the default) and you lose nothing: the
privacy-critical chain still serves via DuckDuckGo and Mojeek. Enable it
only when you want full query privacy, in which case only your own
SearXNG instance sees your queries.

## Configuration

| Variable | Purpose |
|----------|---------|
| `INFOBROKER_CONFIG` | Path to config.json (default: `./config.json`) |
| `INFOBROKER_CONFIG_LOCAL` | Optional path to a user config layer (default: `config.local.json`) |
| `INFOBROKER_<NAME>_API_KEY` | API key for keyed providers |
| `INFOBROKER_<NAME>_URL` | URL for self-hosted providers |

`config.json` ships with the repository and holds the defaults: which
providers are enabled, their priority in fallback chains, rate limits,
corroboration parameters, and the task-to-provider dispatch table.
Hot-reloadable via `reload_config` — edit the file, call the tool, and
changes take effect without a restart.

Your own overrides live in a separate user layer — `config.local.json`
in the project directory (or a path you set via `INFOBROKER_CONFIG_LOCAL`).
This file is git-ignored, so pulling updates from the repository never
overwrites your settings. Values in the user layer take precedence over
the shipped defaults; anything left out falls back to `config.json`.

The knowledge base ships empty. By default it writes to a user-scoped
path (`~/.local/share/infobroker/knowledge-base`) outside the repository,
so the content you research and cache stays on your machine and is never
committed. Each deployed instance accumulates its own store.

### Bring your own endpoint

Any HTTP search endpoint can become an Infobroker provider without
touching the source tree. Declare it in `config.local.json` as a
`generic_http` provider, then reference it from a dispatch chain:

```json
{
  "providers": {
    "my_search": {
      "tier": "generic_http",
      "capabilities": ["web_search"],
      "enabled": true,
      "priority": 20,
      "endpoint": "https://api.example.com/search",
      "query_param": "q",
      "results_path": "data.items",
      "field_map": { "title": "name", "url": "link", "snippet": "summary" }
    }
  },
  "dispatch": { "general_web": ["my_search", "duckduckgo"] }
}
```

The server GETs `endpoint?query_param=<query>`, walks `results_path`
(dot-separated into the response JSON), and maps each result to the
common shape using `field_map`. Add the slug to your `config.local.json`
override and call `reload_config` to use it immediately.

## How It Compares

| Tool name | What you're used to | How Infobroker differs |
|-----------|--------------------|-----------------------|
| Built-in `websearch` / `webfetch` | One search engine, one fetch mode, no configuration, no visibility into what backend is used | Fifteen zero-config providers with a unified tool surface. Choose the right source for each task. Fall back automatically on failure. See every provider's status and quota. |
| Raw API calls | Manual HTTP requests, per-provider auth, per-provider response parsing, no fallback, no quota tracking | One interface for every provider. API keys configured once. Results normalized to a common shape. Rate limits and quota tracked automatically. |
| Dedicated search APIs | Pay-per-query, vendor lock-in, opaque routing | Free-first design. DuckDuckGo, Wikipedia, and thirteen other providers work with zero configuration. Upgrade paths for Brave, Exa, and Tavily. Self-hosted SearXNG for full privacy. |
| Other search MCP servers | Single-provider focus, no fallback, no corroboration, no writing pipeline | Multi-provider with automatic fallback. Corroboration engine cross-references independent sources. Bundled writing skills transform research into finished documents. |
| AI with built-in search | The model picks the search engine, serves stale cache, no reproducibility | You control the provider chain. Queries are reproducible. Fallback behavior is visible. The corroboration engine verifies facts across independent sources. |

Every other search MCP server asks you to pick a provider and trust it.
Infobroker gives you a fleet — and picks the right one for each task.
When a provider fails, the next one takes over without you noticing.
When a claim matters, the corroboration engine finds agreement,
contradiction, and gaps. The bundled skills close the loop from raw
research to finished writing. One server. Every source. Research that
delivers.

Last updated: 2026-08-23.

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

MIT. Free to use, modify, and redistribute. The bundled client skills and
instruction files ship under the same license, so the full research pipeline
— server, skills, and documentation — is freely reusable in commercial and
open-source work alike. Third-party providers remain subject to their own
terms and API keys.

## Spec

The server is built from a single source specification, `infobroker.md`
(v2026.08.23), which defines every requirement and the gates that verify it.
Each requirement traces to an implementation file, and `npm run check`
reconciles the code, the spec, and this README so what is documented is what
the server actually delivers.
