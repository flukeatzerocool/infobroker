// @implements REQ-037 REQ-070
// Dependency-free registry of provider slugs that ship a module. Kept separate
// from providers/index.ts so config validation can reject a generic_http entry
// that collides with a built-in without importing the provider modules (which
// import config.ts and would create a cycle).
export const REGISTERED_PROVIDER_SLUGS: readonly string[] = [
  "duckduckgo",
  "jina",
  "wikipedia",
  "wiktionary",
  "wikidata",
  "openstreetmap",
  "internet_archive",
  "arxiv",
  "semantic_scholar",
  "stack_exchange",
  "github",
  "core",
  "marginalia",
  "mojeek",
  "exa",
  "tavily",
  "searxng",
  "yep",
  "wiby",
  "openalex",
  "europe_pmc",
  "crossref",
  "hacker_news",
  "gdelt",
  "sec_edgar",
  "world_bank",
];
