---
name: infobroker
description: >
  Use this skill for any of the following research intents: research a
  topic, fact-check claims, find information from multiple sources, compare
  or evaluate options, do a literature review or state-of-the-art survey,
  monitor or track a topic over time, red-team or stress-test a plan, vet or
  run due diligence on a person or organization, or produce written output
  backed by web research. Load it and follow it BEFORE invoking tools
  directly. Routes the request to the matching workflow shape, then
  orchestrates Infobroker MCP tools → summarization → technical-writing →
  proofreading → translation. For high-stakes questions requiring gated
  analytic rigor, escalate to analysis-loop.
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
`references/workflows.md` for the full definition of the chosen shape and
`references/decision-tree.md` for the ordered disambiguation questions, the
tool-selection conditions, and the escalation rubric.

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
structured analytic techniques — score it with the rubric in
`references/decision-tree.md` §3 rather than judging by feel.

## Pipeline: Research & Write

Default shape for reports, articles, documentation, and analysis.

```
RECALL     Infobroker `web_search` KB-first (automatic); `manage_kb` search only for stored-only answers
SEARCH     Infobroker `web_search`; `verify_claims` for contested claims
EXTRACT    Infobroker `fetch_page` on key URLs (Jina Reader for Markdown); when
           reading a page to answer a specific question, pass `question` to get
           the ranked passages that address it instead of the whole page
VERIFY     cross-reference, score confidence, flag contradictions
SUMMARIZE  `summarization` skill — condense findings before writing
WRITE      `technical-writing` skill — reports, docs, tutorials, specs; use
           the skeleton in `references/report-template.md` so every report
           carries Executive Summary → Key Findings → Sources → Contradictions
           → Gaps → Source Register
POLISH     `proofreading` skill — grammar, spelling, style, clarity, tone
TRANSLATE  load and apply the `translation` skill — when the user asked for a
           non-English output; end that step with its `translation complete.`
           token
CITE       source URLs with every claim (see `instructions/search-preferences.md`)
```

Run every pipeline step that applies to the request, in order, and complete
the tail steps (WRITE, POLISH, TRANSLATE, CITE) before emitting the token.
The completion token is the final line of your reply, emitted only after the
TRANSLATE step has produced the non-English output the user asked for — do
not emit the token and drop the translation:

```
research complete. <N> sources | <K> findings | <gap> gaps noted
```

## Pipeline: Fact-Check

Use when the user wants to verify specific claims.

```
RECALL       Infobroker `web_search` KB-first (automatic); `manage_kb` search only for stored-only answers
EXTRACT      claims from the user's input
SEARCH       each claim with Infobroker `web_search` (per-claim queries)
CROSS-CHECK  Infobroker `verify_claims` for multi-source verification
VERDICT      assign True→Unverifiable + confidence + justification
SUMMARIZE    `summarization` skill — executive summary
CITE         source URLs with every verdict
```

Run every pipeline step that applies to the request before emitting the
token. End your reply with the shape's completion token, verbatim, as the
final line:

```
fact-check complete. <N> claims | <T/M/H/MF/F/U> verdicts
```

## Other Workflow Shapes

Competitive Evaluation, Literature Review, Monitoring/Delta,
Adversarial/Red-Team, and Vetting/Due-Diligence are defined in
`references/workflows.md`. Route to the matching shape after Phase 0
classification; each shape composes the same primitives (recall → search →
extract → verify → write → polish → cite) into its own sequence and ends with
its own output block in `references/report-template.md`. To add a shape of
your own, follow `references/skill-authoring.md`.

Always end your reply with the chosen shape's `Token:` line from
`references/workflows.md`, verbatim, as the final line. The token is a
required part of the deliverable, not an optional summary. Run every
pipeline step the shape defines before emitting the token — do not stop
early.

## Tool Selection Quick Guide

| Intent | Tool | Provider hint |
|--------|------|--------------|
| Search web broadly | `web_search` | Auto-selected (default: DuckDuckGo) |
| Read/scrape a URL | `fetch_page` | Jina Reader (auto Markdown); pass `question` to extract ranked passages |
| Autocomplete a query | `web_search` (`suggest: true`) | DuckDuckGo |
| "Which tool should I use?" | `web_search` | Auto-selection returns serving provider |
| Multi-source truth-finding | `verify_claims` | Uses all active providers |
| Academic citations | `get_citations` | BibTeX references from scholarly sources |
| Check provider status | `inspect_providers` (action list/health) | N/A |
| Reload config at runtime | `reload_config` | N/A |
| Search local knowledge base | `manage_kb` (action search) | Semantic + keyword hybrid |
| Ingest into knowledge base | `manage_kb` (action ingest) | Text or URL |
| Knowledge base stats | `manage_kb` (action stats) | Operational metrics |
| Delete from knowledge base | `manage_kb` (action delete) | By collection or source URL |
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
- Use `verify_claims` for claims where the truth might be contested; use `web_search` for simple lookups
- When writing output, route through the full pipeline (search → verify → summarize → write → polish)
- Cite sources with URLs for every factual claim
- Fall back to built-in `websearch`/`webfetch` only when Infobroker tools error
- Check `inspect_providers` (action health) if searches return empty or slow — a provider may be exhausted
