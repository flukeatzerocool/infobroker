---
name: infobroker
description: >
  Use when the user asks to research a topic, fact-check claims, find
  information from multiple sources, or produce written output backed by
  web research. Orchestrates: Infobroker MCP tools → deep-research →
  fact-checking → summarization → technical-writing → proofreading →
  translation. For high-stakes questions requiring gated analytic rigor,
  escalate to analysis-loop.
---

# Infobroker — Research & Writing Professional

## When to Use

- User asks to research a topic and produce a written report, article, or analysis
- User asks to fact-check claims with web sources and cross-reference
- User asks to find and synthesize information from multiple sources
- User asks to verify technical claims with authoritative sources
- User asks to find code solutions or evaluate technical answers from the web
- User asks to translate findings or produce multilingual output
- User asks a complex question that benefits from multi-provider web search

## When NOT to Use

- Simple factual lookup (single Wikipedia visit) — use `web_search` directly
- Purely conversational questions with no research component
- Tasks that require only the AI's internal knowledge, no web lookup

## Pipeline: Research Professional

Use this for reports, articles, documentation, and in-depth analysis.

```
Phase 0: RECALL
  Infobroker `kb` (action search) — check local knowledge base for previously indexed results
  → If results found and freshness-adjusted scores are sufficient, skip to Phase 2
  → If results are empty or stale, continue to Phase 1 (SEARCH)

Phase 1: SEARCH
  Infobroker `web_search` (multi-provider, with fallback)
  → Infobroker `corroborate` (if truth-finding or cross-source verification needed)

Phase 2: EXTRACT
  Infobroker `fetch_page` on key URLs for full content (Jina Reader for clean Markdown)

Phase 3: VERIFY
  `deep-research` skill — Phase 3 (verify & triangulate) and Phase 4 (synthesize)
  `fact-checking` skill — for specific claims that need confidence-scored verdicts

Phase 4: SUMMARIZE
  `summarization` skill — condense findings before writing

Phase 5: WRITE
  `technical-writing` skill — for reports, documentation, tutorials, specs

Phase 6: POLISH
  `proofreading` skill — grammar, spelling, style, clarity, tone verification

Phase 7: TRANSLATE
  `translation` skill — produce multilingual output when findings are
  requested in a language other than English

Phase 8: CITE
  Include source URLs from Phase 1/2 with every factual claim.
  Use the `evidence-based-reporting` instruction pattern.
```

## Pipeline: Fact-Check

Use this when the user wants to verify specific claims.

```
0. RECALL: Infobroker `kb` (action search) on all claims — check if previously verified
1. EXTRACT claims from the user's input
2. SEARCH each claim with Infobroker `web_search` (targeted, per-claim queries)
3. CROSS-REFERENCE with Infobroker `corroborate` for multi-source verification
4. VERDICT: `fact-checking` skill — assign confidence score and justification
5. SUMMARIZE: `summarization` skill — executive summary of findings
6. CITE: Source URLs with every verdict
```

## Tool Selection Quick Guide

| Intent | Tool | Provider hint |
|--------|------|--------------|
| Search web broadly | `web_search` | Auto-selected (default: DuckDuckGo) |
| Read/scrape a URL | `fetch_page` | Jina Reader (auto Markdown) |
| Autocomplete a query | `web_search` (`suggest: true`) | DuckDuckGo |
| "Which tool should I use?" | `web_search` | Auto-selection returns serving provider |
| Multi-source truth-finding | `corroborate` | Uses all active providers |
| Check provider status | `providers` (action list/health) | N/A |
| Reload config at runtime | `reload_config` | N/A |
| Search local knowledge base | `kb` (action search) | Semantic + keyword hybrid |
| Ingest into knowledge base | `kb` (action ingest) | Text or URL |
| Knowledge base stats | `kb` (action stats) | Operational metrics |
| Delete from knowledge base | `kb` (action delete) | By collection or source URL |
| Translate findings | `translation` skill | Multilingual output |

## When to Escalate

Use the `analysis-loop` skill instead of the standard pipeline when the
question is high-stakes or decision-driving and requires gated analytic
rigor: confidence-scored findings, source-reliability grading, structured
analytic techniques (analysis of competing hypotheses, devil's advocacy),
and explicit refinement rounds. This skill runs the lighter research-and-write
path; `analysis-loop` runs the disciplined, gated path.

## Best Practices

- Always use `web_search` before `fetch_page` — verify the URL exists
- Use `corroborate` for claims where the truth might be contested; use `web_search` for simple lookups
- When writing output, route through the full pipeline (search → verify → summarize → write → polish)
- Cite sources with URLs for every factual claim
- Fall back to built-in `websearch`/`webfetch` only when Infobroker tools error
- Check `providers` (action health) if searches return empty or slow — a provider may be exhausted
