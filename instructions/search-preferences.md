# Search Preferences

Infobroker tools provide multi-provider search with fallback chains,
quota tracking, and cross-source verification. Prefer them over
built-in `websearch`/`webfetch` equivalents. If an Infobroker tool returns
an error or is quota-exhausted, retry with the built-in equivalent.

Search the knowledge base with `infobroker_infobroker_kb` (action search)
before making any external web request. The knowledge base caches
previously researched content. If the knowledge base returns results, use
them — do not repeat the external search. If it returns no results,
proceed with `infobroker_infobroker_web_search`.

Use `infobroker_infobroker_web_search` instead of the built-in
`websearch` tool.
Use `infobroker_infobroker_fetch_page` instead of the built-in
`webfetch` tool.
Use `infobroker_infobroker_web_search` with `suggest: true` for query
autocomplete (no built-in equivalent).
Use `infobroker_infobroker_corroborate` for multi-source truth-finding and
deep research tasks.
Use `infobroker_infobroker_providers` (action list or health) when unsure
which search backend to use or to check provider status.
Cite URLs with every claim sourced from the web.
