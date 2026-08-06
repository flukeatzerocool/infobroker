# AGENTS.md — Infobroker MCP Server (v2026.08.06)

## Layer Map

```
src/types.ts  →  src/config.ts  →  src/rate-limiter.ts  →  src/quota.ts  →  src/normalizer.ts  →  src/providers/ (→ src/converge.ts)  →  src/index.ts
```

## Tool Surface (9 tools)

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

## Provider Backends

| Provider | File | Tier | Auth |
|----------|------|------|------|
| DuckDuckGo | `src/providers/duckduckgo.ts` | builtin | None (HTML scraping) |
| Jina Reader | `src/providers/jina.ts` | free_http | None |
| Wikipedia | `src/providers/wikipedia.ts` | free_http | None |
| Wiktionary | `src/providers/wiktionary.ts` | free_http | None |
| Wikidata | `src/providers/wikidata.ts` | free_http | None |
| OpenStreetMap | `src/providers/openstreetmap.ts` | free_http | None |
| Internet Archive | `src/providers/internet_archive.ts` | free_http | None |
| Brave/Exa/Tavily | configured via config.json | keyed_http | `INFOBROKER_<NAME>_API_KEY` |

## Running

```
npm run start       # start server via tsx
npm run typecheck   # tsc --noEmit
```

## State Model

- **Config**: `config.json` — provider config, dispatch tables, limits. Hot-reloadable.
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

All must pass. `npm run validate-spec` exits non-zero on errors (uncited
REQs with no waiver in DECISIONS.md, undocumented source files, REQ body
violations per SR-011).
