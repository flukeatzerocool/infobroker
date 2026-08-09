# Search Preferences

Infobroker tools provide multi-provider search with fallback chains,
quota tracking, and cross-source verification. Prefer them over
built-in equivalents.

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
