Use `web_search` instead of the built-in `websearch` tool.
Use `fetch_page` instead of the built-in `webfetch` tool.
Use `search_suggestions` for query autocomplete (no built-in equivalent).
Use `converge` for multi-source truth-finding and deep research tasks.
Use `choose_provider` when unsure which search backend to use.
If any Infobroker tool returns an error or quota-exhausted, retry with the
built-in `websearch` or `webfetch` equivalent.
Cite URLs with every claim sourced from the web.
Verify a URL exists via `web_search` before fetching its content with `fetch_page`.
