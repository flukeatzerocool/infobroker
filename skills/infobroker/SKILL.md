---
name: infobroker
description: >
  Use when the user asks to research a topic, fact-check claims, find
  information from multiple sources, compare or evaluate options, do a
  literature review or state-of-the-art survey, monitor or track a topic
  over time, red-team or stress-test a plan, vet or run due diligence on a
  person or organization, or produce written output backed by web research.
  Routes the request to the matching workflow shape, then orchestrates
  Infobroker MCP tools → summarization → technical-writing → proofreading →
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
- User asks to compare or evaluate options, tools, vendors, or approaches
- User asks for a literature review, state-of-the-art survey, or related work
- User asks to monitor, track, or watch a topic and report what changed
- User asks to red-team or stress-test a plan, product, or conclusion
- User asks to vet or run due diligence on a person, organization, or product
- User asks to translate findings or produce multilingual output
- User asks a complex question that benefits from multi-provider web search

## When NOT to Use

- Simple factual lookup (single Wikipedia visit) — use `web_search` directly
- Purely conversational questions with no research component
- Tasks that require only the AI's internal knowledge, no web lookup

## Phase 0: Classify

Map the request to one workflow shape before any search. Consult
`references/workflows.md` for the full definition of the chosen shape.

| Intent marker | Workflow shape |
|---------------|----------------|
| "research/write a report/article", general | Research & Write |
| "fact-check / verify / is it true" | Fact-Check |
| "deep dive / comprehensive / thesis" | Deep-Dive |
| "compare / evaluate / which is best / X vs Y" | Competitive Evaluation |
| "literature review / state of the art / related work" | Literature Review |
| "what changed / monitor / track / brief me since" | Monitoring / Delta |
| "red-team / stress-test / what could go wrong" | Adversarial / Red-Team |
| "vet / background check / due diligence / is it legit" | Vetting |
| high-stakes, decision-driving, needs rigor | Gated Analysis (escalate to `analysis-loop`) |

The default is Research & Write. Escalate to `analysis-loop` when the
question is high-stakes and requires source-reliability grading and
structured analytic techniques.

## Pipeline: Research & Write

Default shape for reports, articles, documentation, and analysis.

```
RECALL     Infobroker `kb` (action search) — previously indexed results first
SEARCH     Infobroker `web_search`; `corroborate` for contested claims
EXTRACT    Infobroker `fetch_page` on key URLs (Jina Reader for Markdown)
VERIFY     cross-reference, score confidence, flag contradictions
SUMMARIZE  `summarization` skill — condense findings before writing
WRITE      `technical-writing` skill — reports, docs, tutorials, specs
POLISH     `proofreading` skill — grammar, spelling, style, clarity, tone
TRANSLATE  `translation` skill — when output is not English
CITE       source URLs with every claim (see `instructions/search-preferences.md`)
```

## Pipeline: Fact-Check

Use when the user wants to verify specific claims.

```
RECALL       Infobroker `kb` (action search) on all claims first
EXTRACT      claims from the user's input
SEARCH       each claim with Infobroker `web_search` (per-claim queries)
CROSS-CHECK  Infobroker `corroborate` for multi-source verification
VERDICT      assign True→Unverifiable + confidence + justification
SUMMARIZE    `summarization` skill — executive summary
CITE         source URLs with every verdict
```

## Other Workflow Shapes

Competitive Evaluation, Literature Review, Monitoring/Delta,
Adversarial/Red-Team, and Vetting/Due-Diligence are defined in
`references/workflows.md`. Route to the matching shape after Phase 0
classification; each shape composes the same primitives (recall → search →
extract → verify → write → polish → cite) into its own sequence and ends
with a grepable status token.

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
