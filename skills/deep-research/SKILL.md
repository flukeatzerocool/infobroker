---
name: deep-research
description: >
  Use when the user asks for deep dives, comprehensive reports, or systematic
  research with citations and confidence scoring. Phases: scope & clarify,
  parallel search, verify & triangulate, synthesize. Do not use for quick
  lookups, simple searches, or known-fact Q&A. For verifying specific claims,
  use fact-checking instead.
license: MIT
metadata:
  author: awesome-ai-agent-skills contributors (adapted for Opencode)
  source: https://github.com/seb1n/awesome-ai-agent-skills
  version: 1.0.0
---

# Deep Research

## When NOT to Use

- Simple factual queries answered by a single source.
- Known-fact Q&A with no need to triangulate.
- For individual claim verification, use `fact-checking` skill.

## Workflow

### Phase 1: Scope & Clarify

Clarify the research question. Break broad topics into discrete subtopics.
If the user's question is vague, ask targeted clarifying questions before
beginning research. Set a research scope and expected deliverable format.

### Phase 2: Parallel Search

For each subtopic, search independently with 2–3 variant query angles.
Prefer primary source discovery over secondary reporting.

**Infobroker Integration**: Prefer Infobroker `web_search` for multi-provider
coverage (DuckDuckGo default, falls back through Marginalia → Brave).
Use `choose_provider` to select the best search backend for the subtopic type
(e.g., Semantic Scholar for academic, Stack Exchange for code).

### Phase 3: Verify & Triangulate

Cross-check results from different sources. Use `converge` for multi-source
truth-finding on contested claims. Flag contradictions explicitly rather than
picking a side silently. Assign confidence scores based on source
independence and overlap.

### Phase 4: Synthesize

Compile findings into a structured report. Group by theme. Lead with
high-confidence conclusions. Note areas of uncertainty and contradiction.
Include source citations with URLs.

## Best Practices

- Search with multiple query angles per subtopic, not just one.
- Prefer primary sources (official docs, papers, data) over secondary reporting.
- Explicitly mark confidence levels for each finding.
- Flag contradictions; do not silently resolve them.
- Note when information is missing or unavailable.

## Edge Cases

- **No sources found**: Report the gap and suggest alternative angles.
- **All sources contradict**: Document the contradiction, present views, mark uncontestable.
- **Stale information**: Note the date of each source; flag if something may be outdated.
- **Overwhelming volume**: Prioritize most authoritative/recent sources first.

## Infobroker Integration

This skill is used as Phases 3–4 of the Infobroker Research Professional
pipeline. The Infobroker MCP server handles Phases 1–2 (search and
content extraction) via `web_search` and `fetch_page`. The AI should
route search output from Infobroker tools through this skill's verify
and synthesize phases before writing.
