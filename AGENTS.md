# AGENTS.md — Infobroker MCP Server (v2026.08.10)

## Layer Map

```
src/types.ts  →  src/config.ts  →  src/rate-limiter.ts  →  src/quota.ts  →  src/normalizer.ts  →  src/providers/ (→ src/converge.ts)  →  src/index.ts
```

## Tool Surface (13 tools)

| Tool | Purpose |
|------|---------|
| `infobroker_web_search` | Unified search across providers with fallback chain |
| `infobroker_fetch_page` | Fetch URL content via Jina Reader (default) or native HTTP |
| `infobroker_search_suggestions` | Query autocomplete (DuckDuckGo) |
| `infobroker_choose_provider` | Recommend best provider for a task type |
| `infobroker_list_providers` | All configured providers with status and quota |
| `infobroker_provider_health` | Detailed health for a specific provider |
| `infobroker_converge` | Multi-pass truth-finding with cross-source verification |
| `infobroker_reload_config` | Hot-reload config.json without restart |
| `infobroker_spec_health` | Build health: counts, uptime, request stats |
| `infobroker_kb_search` | Semantic and keyword hybrid search over local knowledge base |
| `infobroker_kb_ingest` | Ingest text or URL content into the knowledge base |
| `infobroker_kb_stats` | Knowledge base operational metrics |
| `infobroker_kb_delete` | Remove content from the knowledge base |

## Provider Backends

| Provider | File | Tier |
|----------|------|------|
| DuckDuckGo | `src/providers/duckduckgo.ts` | builtin |
| Jina Reader | `src/providers/jina.ts` | free_http |
| Wikipedia | `src/providers/wikipedia.ts` | free_http |
| Wiktionary | `src/providers/wiktionary.ts` | free_http |
| Wikidata | `src/providers/wikidata.ts` | free_http |
| OpenStreetMap | `src/providers/openstreetmap.ts` | free_http |
| Internet Archive | `src/providers/internet_archive.ts` | free_http |
| arXiv | `src/providers/arxiv.ts` | free_http |
| Semantic Scholar | `src/providers/semantic_scholar.ts` | free_http |
| Stack Exchange | `src/providers/stack_exchange.ts` | free_http |
| GitHub | `src/providers/github.ts` | free_http |
| CORE | `src/providers/core.ts` | free_http |
| Marginalia | `src/providers/marginalia.ts` | builtin |
| Mojeek | `src/providers/mojeek.ts` | builtin |
| Brave Search | `src/providers/brave.ts` | keyed_http |
| Exa | `src/providers/exa.ts` | keyed_http |
| Tavily | `src/providers/tavily.ts` | keyed_http |
| SearXNG | `src/providers/searxng.ts` | self_hosted_http |

Provider auth requirements are generated from `config.json` into
`skills/infobroker/references/provider-auth.md` (`npm run generate-auth`).

## Running

```
npm run start       # start server via tsx
npm run typecheck   # tsc --noEmit
```

## State Model

- **Config**: `config.json` (shipped default) — provider config, dispatch tables, limits, hot-reloadable. A user layer at `config.local.json` (or `INFOBROKER_CONFIG_LOCAL`) is merged over the shipped default; user values take precedence and survive updates (REQ-010, REQ-042, REQ-043). `config.local.json` is git-ignored.
- **Quota**: `$TMPDIR/infobroker/quota.json` — daily/monthly counters, persists across restarts.
- **Truncation**: `$TMPDIR/infobroker/trunc-*.txt` — full content of truncated responses.

## Response Contract

All tool responses use `[OK]` / `[ERROR]` prefix with JSON bodies per REQ-001. Errors include `code`, `message`, `provider`, and `remediation` fields (REQ-002).

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `INFOBROKER_CONFIG` | Path to config.json (default: `./config.json`) |
| `INFOBROKER_<PROVIDER>_API_KEY` | API key for keyed providers |
| `INFOBROKER_<PROVIDER>_URL` | URL for self-hosted providers (SearXNG) |

## Spec Authoring

Before adding or modifying any REQ in `infobroker.md`, apply the standing
rule tests in SR-011 (contracts, not implementations) and SR-012
(red-team every REQ). See Appendices B and C for full authoring conventions
and SDD discipline.

At minimum, every new REQ must pass:
- (a) states *what*, not *how* — no parameter types, default values, or
  algorithms in REQ prose
- (b) verifiable by a gate (G0/G1/G2/G3)
- (c) not duplicating content elsewhere in the spec
- (d) no "Default:" clause
- (e) valid across multiple implementation choices

When implementation behavior changes, update the corresponding REQ in
the same commit. `npm run validate-spec` must pass before committing.

## Gates

Run before committing or after any change to `infobroker.md` or `src/`:

```
npm run check
```

This runs:

| Command              | What it checks                                     |
|----------------------|----------------------------------------------------|
| `npm run typecheck`  | TypeScript type checking (`tsc --noEmit`)          |
| `npm run validate-spec` | Spec-code traceability, REQ body hygiene, bidirectional coverage |
| `npm run validate-readme` | README structure, tool names, links, comparison table |
| `npm run test`       | Vitest unit and integration tests                  |

All must pass. `npm run validate-spec` exits non-zero on errors (uncited
REQs with no waiver in DECISIONS.md, undocumented source files, REQ body
violations per SR-011).

Shell scripts (`scripts/*.sh`, `scripts/pipeline/*.sh`, `.githooks/*`) are
gate-checked with `bash -n`. Running `shellcheck` on them before committing
is recommended but not required — it is not installed as a devDependency and
is not part of `npm run check`.
