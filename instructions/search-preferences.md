# Search Preferences

For research, fact-checking, comparison, literature review, monitoring,
red-teaming, vetting, or writing tasks, load the `infobroker` skill and
follow it before invoking tools directly; it classifies the request into a
workflow shape and routes through the writing pipeline. High-stakes,
decision-driving questions escalate to the `analysis-loop` skill. Simple
factual lookups may use `infobroker_search_web` directly.

Prefer Infobroker tools over the built-in `websearch`/`webfetch`
equivalents. If an Infobroker tool returns an error or is quota-exhausted,
retry with the built-in equivalent. When
`infobroker_fetch_page` hits an anti-bot challenge or an empty
JS-rendered shell, use the `playwright-cli` skill and archive the text with
`infobroker_manage_kb (action: ingest)`.

`infobroker_search_web` performs knowledge base recall
automatically before external providers. Do not issue a separate
`infobroker_manage_kb (action: search)` for the same query first; reserve
direct `infobroker_manage_kb (action: search)` for stored-content-only
answers, knowledge base inspection, or maintenance. If knowledge base
results suffice, use them; otherwise external providers are the fallback.

Archive finished reports with `infobroker_manage_kb (action: ingest, source_type: report)`; cite source URLs with every claim.
