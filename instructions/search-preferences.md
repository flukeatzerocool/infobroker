# Search Preferences

Infobroker tools provide multi-provider search with fallback chains,
quota tracking, and cross-source verification. Prefer them over
built-in equivalents.

Search the knowledge base with `infobroker_infobroker_kb_search` before
making any external web request. The knowledge base caches previously
researched content. If `kb_search` returns results, use them — do not
repeat the external search. If `kb_search` returns no results, proceed
with `infobroker_infobroker_web_search`.

Use `infobroker_infobroker_web_search` instead of the built-in
`websearch` tool.
Use `infobroker_infobroker_fetch_page` instead of the built-in
`webfetch` tool.
Use `infobroker_infobroker_search_suggestions` for query autocomplete
(no built-in equivalent).
Use `infobroker_infobroker_converge` for multi-source truth-finding and
deep research tasks.
Use `infobroker_infobroker_choose_provider` when unsure which search
backend to use.
If any Infobroker tool returns an error or quota-exhausted, retry with
the built-in `websearch` or `webfetch` equivalent.
Cite URLs with every claim sourced from the web.
Verify a URL exists via `infobroker_infobroker_web_search` before
fetching its content with `infobroker_infobroker_fetch_page`.
