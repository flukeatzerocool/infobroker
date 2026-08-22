// @implements REQ-013 REQ-014 REQ-070
import { provider as duckduckgo } from "./duckduckgo.js";
import { provider as jina } from "./jina.js";
import { provider as wikipedia } from "./wikipedia.js";
import { provider as wiktionary } from "./wiktionary.js";
import { provider as wikidata } from "./wikidata.js";
import { provider as openstreetmap } from "./openstreetmap.js";
import { provider as internet_archive } from "./internet_archive.js";
import { provider as arxiv } from "./arxiv.js";
import { provider as semantic_scholar } from "./semantic_scholar.js";
import { provider as stack_exchange } from "./stack_exchange.js";
import { provider as github } from "./github.js";
import { provider as core } from "./core.js";
import { provider as marginalia } from "./marginalia.js";
import { provider as mojeek } from "./mojeek.js";
import { provider as brave } from "./brave.js";
import { provider as exa } from "./exa.js";
import { provider as tavily } from "./tavily.js";
import { provider as searxng } from "./searxng.js";
import { provider as yep } from "./yep.js";
import { provider as wiby } from "./wiby.js";
import { createGenericProvider } from "./generic-http.js";
import { getConfig } from "../config.js";
import type { Provider } from "../types.js";

export const PROVIDERS: Record<string, Provider> = {
  duckduckgo,
  jina,
  wikipedia,
  wiktionary,
  wikidata,
  openstreetmap,
  internet_archive,
  arxiv,
  semantic_scholar,
  stack_exchange,
  github,
  core,
  marginalia,
  mojeek,
  brave,
  exa,
  tavily,
  searxng,
  yep,
  wiby,
};

const genericCache: Record<string, Provider> = {};

export function resolveProvider(slug: string): Provider | undefined {
  const registered = PROVIDERS[slug];
  if (registered) return registered;

  const cfg = getConfig().providers[slug];
  if (!cfg || cfg.tier !== "generic_http") return undefined;

  if (!genericCache[slug]) {
    genericCache[slug] = createGenericProvider(slug, cfg);
  }
  return genericCache[slug];
}
