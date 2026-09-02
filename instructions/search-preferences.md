# Search Preferences

For research, fact-checking, comparison, literature review, monitoring,
red-teaming, vetting, or writing tasks, load the `infobroker` skill (via
the skill tool) and follow it before invoking tools directly. It
classifies the request into a workflow shape and routes through the
writing pipeline. For high-stakes, decision-driving questions, it
escalates to the `analysis-loop` skill. Simple factual lookups may use
`infobroker_infobroker_web_search` directly without loading a skill.

Infobroker tools provide multi-provider search with fallback chains,
quota tracking, and cross-source verification. Prefer them over
built-in `websearch`/`webfetch` equivalents. If an Infobroker tool returns
an error or is quota-exhausted, retry with the built-in equivalent.

`infobroker_infobroker_web_search` performs knowledge-base recall
automatically before external providers, so do not issue a separate
`infobroker_infobroker_manage_kb` (action search) for the same query before it.
Use `infobroker_infobroker_manage_kb` (action search) directly only to answer
entirely from stored content, to inspect what is stored, or to maintain
the knowledge base. If the knowledge base returns results sufficient to
answer, use them — do not repeat the external search.

After producing a report or written research deliverable, archive it with
`infobroker_infobroker_manage_kb` (action ingest) using `source_type: "report"`,
so it is stored in the knowledge base by default (`save_to` defaults to
`manage_kb`) and can be revisited later. To review past reports, use `manage_kb` (action
list) to enumerate them and `manage_kb` (action get) to retrieve one in full. A
stored report carries a `source_updated_at` date when its source date was
known at ingest. To refresh an outdated report, retrieve it with `manage_kb`
(action get), then fetch the current state of its sources with
`infobroker_infobroker_fetch_page` and compare each source's `last_updated`
against the stored `source_updated_at`. When a source's last-updated date
is unchanged, the report on that source remains current; when it has
changed or is absent, re-research the fresh state with
`infobroker_infobroker_web_search` and ingest the updated report under the
same title to replace it. Stored reports are dated snapshots — verify them
against fresh sources before treating their content as current.

Use `infobroker_infobroker_web_search` instead of the built-in
`websearch` tool.
Use `infobroker_infobroker_fetch_page` instead of the built-in
`webfetch` tool.
Use `infobroker_infobroker_web_search` with `suggest: true` for query
autocomplete (no built-in equivalent).
Use `infobroker_infobroker_verify_claims` for multi-source truth-finding and
deep research tasks.
Use `infobroker_infobroker_inspect_providers` (action list or health) when unsure
which search backend to use or to check provider status.
Use `infobroker_infobroker_web_search` with an array of queries to batch
several searches in one call (no built-in equivalent).
Use `infobroker_infobroker_web_search` with `expand: true` to generate query
variants before a deep search (no built-in equivalent).
Use `infobroker_infobroker_web_search` with `deep: true` to read the top
results and return each page's passages ranked against the query, so a
deep search yields the answering text rather than links (no built-in
equivalent).
Use `infobroker_infobroker_fetch_page` with a `question` when reading a page
to answer a specific question — it returns the ranked passages that address it
rather than the whole page.
Use `infobroker_infobroker_get_citations` for BibTeX references in scholarly work.
Cite URLs with every claim sourced from the web.
