// @implements REQ-021i wikidata-claim wikipedia-infobox wikipedia-table not-found
// Structured-fact resolution: a measurable-attribute query ("attendance",
// "population", "percentage", "date") is answered from Wikidata claims first,
// then from a Wikipedia infobox or table, and only then left to prose.
//
// A fact is returned only when a source supplies it. Ambiguous or missing
// values are reported as such; nothing is computed from other numbers.
import * as cheerio from "cheerio";
import type { SearchResult, StructuredFact, StructuredFactKind } from "./types.js";
import { infobrokerFetch } from "./http.js";
import { throttle } from "./rate-limiter.js";
import { inCooldown } from "./cooldown.js";
import { collectInfoboxRows, collectTableRows, type InfoboxRow } from "./lib/infobox.js";
import { fetchParseHtml } from "./providers/wikipedia.js";

export type FactStatus = "resolved" | "not_found" | "ambiguous" | "unavailable";

export interface FactEnrichment {
  facts: StructuredFact[];
  fact_status: FactStatus;
  source?: string;
}

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

// Property map verified against Wikidata labels (P1110 attendance, P1082
// population, P2046 area, P2044 elevation). Dates try point in time, then
// publication date, then inception; a birth or death question names its own
// property so an unrelated point-in-time claim cannot answer it.
const FACT_PROPERTIES: Record<StructuredFactKind, string[]> = {
  attendance: ["P1110"],
  population: ["P1082"],
  area: ["P2046"],
  elevation: ["P2044"],
  percentage: [],
  date: ["P585", "P577", "P571"],
};

const DATE_INTENT_RULES: Array<[RegExp, string[]]> = [
  [/\b(?:born|birth date|date of birth)\b/i, ["P569"]],
  [/\b(?:died|die|death date|date of death)\b/i, ["P570"]],
];

function dateProperties(query: string): string[] {
  for (const [rule, properties] of DATE_INTENT_RULES) {
    if (rule.test(query)) return properties;
  }
  return FACT_PROPERTIES.date;
}

const FACT_RULES: Array<[StructuredFactKind, RegExp]> = [
  ["attendance", /\battendance\b/i],
  ["population", /\bpopulation\b/i],
  ["elevation", /\belevation\b/i],
  ["area", /\barea\b/i],
  ["percentage", /\b(?:percentage|percent|share of)\b/i],
  [
    "date",
    /\b(?:when did|when was|what date|date of birth|date of death|birth date|death date|date of|born|died|die|founded|established)\b/i,
  ],
];

// Words a caller uses to name the dimension are removed before the entity
// lookup, so "Survivor Series 1997 attendance" searches for the event, not the
// literal phrase (which returns no Wikidata entity).
const DIMENSION_WORDS_RE =
  /\b(?:date of birth|date of death|birth date|death date|share of|what date|when was|when did|attendance|population|elevation|area|percentage|percent|born|died|die|date of|founded|established|date)\b/gi;

const KEY_RULES: Record<StructuredFactKind, RegExp> = {
  attendance: /^attendance\b/i,
  population: /^population\b/i,
  area: /^area\b/i,
  elevation: /^elevation\b/i,
  percentage: /^(?:share|percentage|percent)\b/i,
  date: /^(?:date|born|died|birth date|death date|date of birth|date of death|founded|established|opened|first aired|point in time|occurred)\b/i,
};

export function detectFactKind(query: string): StructuredFactKind | null {
  for (const [kind, re] of FACT_RULES) {
    if (re.test(query)) return kind;
  }
  return null;
}

const LEADING_PREPOSITION_RE = /^(?:of|in|at|for|from|on|about|by)\b[\s,]*/i;
// An article is stripped only when a preposition follows it; otherwise a title
// like "The Hague" would be truncated to "Hague".
const LEADING_ARTICLE_RE = /^(?:the|a|an)\s+(?=(?:of|in|at|for|from|on|about|by)\b)/i;

export function entityQuery(query: string): string {
  let text = query
    .replace(DIMENSION_WORDS_RE, " ")
    .replace(/\s+/g, " ")
    .replace(/[?.!]+$/, "")
    .trim();
  for (;;) {
    const next = text.replace(LEADING_PREPOSITION_RE, "").replace(LEADING_ARTICLE_RE, "").trim();
    if (next === text) return text;
    text = next;
  }
}

function formatNumber(value: number): string {
  const [whole, fraction] = String(value).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

// Wikidata quantity units arrive as an entity URI; map the ones a structured
// fact can report to the short label the response carries. An unmapped unit is
// omitted rather than guessed.
const UNIT_LABELS: Record<string, string> = {
  Q5: "people",
  Q712226: "km²",
  Q25343: "m²",
  Q35852: "ha",
  Q11573: "m",
  Q3710: "ft",
};

export function unitLabel(unit: string | undefined): string | undefined {
  if (!unit) return undefined;
  const qid = /\/entity\/(Q\d+)$/.exec(unit)?.[1];
  return qid ? UNIT_LABELS[qid] : undefined;
}

// A Wikipedia value writes its unit next to the first number; a parenthetical
// conversion ("1,234 m (4,049 ft)") is not the primary unit.
const DISPLAY_UNITS: Record<StructuredFactKind, Record<string, string>> = {
  attendance: {},
  population: {},
  area: {
    km2: "km²",
    "km²": "km²",
    "sq km": "km²",
    "square kilometre": "km²",
    "square kilometres": "km²",
    "square kilometer": "km²",
    "square kilometers": "km²",
    m2: "m²",
    "m²": "m²",
    "sq m": "m²",
    "square metre": "m²",
    "square metres": "m²",
    "square meter": "m²",
    "square meters": "m²",
    ha: "ha",
    hectare: "ha",
    hectares: "ha",
    "sq mi": "sq mi",
    mi2: "sq mi",
    "mi²": "sq mi",
    "square mile": "sq mi",
    "square miles": "sq mi",
  },
  elevation: {
    m: "m",
    metre: "m",
    metres: "m",
    meter: "m",
    meters: "m",
    ft: "ft",
    foot: "ft",
    feet: "ft",
  },
  percentage: {},
  date: {},
};

function unitFromDisplay(kind: StructuredFactKind, display: string): string | undefined {
  const match = /^[^0-9]*[\d.,]+\s*([A-Za-zµ°²³0-9]+(?:\s+[A-Za-z]+)?)/.exec(display);
  if (!match) return undefined;
  const token = match[1].toLowerCase().replace(/\s+/g, " ");
  return DISPLAY_UNITS[kind][token];
}

function asOfFromQualifiers(qualifiers: Record<string, unknown> | undefined): string | undefined {
  const p585 = qualifiers?.["P585"];
  if (!Array.isArray(p585) || p585.length === 0) return undefined;
  const value = (p585[0] as { datavalue?: { value?: { time?: string } } })?.datavalue?.value?.time;
  return typeof value === "string" ? value.replace(/^\+/, "").slice(0, 10) : undefined;
}

function factFromSnak(
  kind: StructuredFactKind,
  snak: { datavalue?: { value?: unknown } } | undefined,
  property: string,
  url: string,
  asOf?: string,
): StructuredFact | null {
  const value = snak?.datavalue?.value as
    | { amount?: string; unit?: string; time?: string; text?: string }
    | string
    | undefined;
  if (value === undefined || value === null) return null;

  if (typeof value === "object" && typeof value.amount === "string") {
    const numeric = Number(value.amount.replace(/^\+/, ""));
    if (!Number.isFinite(numeric)) return null;
    const unit = unitLabel(value.unit);
    return {
      kind,
      value: numeric,
      display: formatNumber(numeric),
      ...(unit ? { unit } : {}),
      property,
      source: "wikidata",
      url,
      ...(asOf ? { as_of: asOf } : {}),
    };
  }

  const text = typeof value === "string" ? value : typeof value.time === "string" ? value.time : value.text;
  if (typeof text !== "string" || text.length === 0) return null;
  const display = kind === "date" ? text.replace(/^\+/, "").slice(0, 10) : text;
  return {
    kind,
    value: display,
    display,
    property,
    source: "wikidata",
    url,
    ...(asOf ? { as_of: asOf } : {}),
  };
}

async function fetchClaims(entityId: string, property: string): Promise<StructuredFact | null> {
  if (inCooldown("wikidata")) return null;
  await throttle("wikidata");
  const params = new URLSearchParams({
    action: "wbgetclaims",
    entity: entityId,
    property,
    format: "json",
    origin: "*",
  });
  const resp = await infobrokerFetch(`${WIKIDATA_API}?${params.toString()}`, { providerSlug: "wikidata" });
  if (!resp.ok) return null;
  const data = (await resp.json()) as {
    claims?: Record<string, Array<{ rank?: string; mainsnak?: { datavalue?: { value?: unknown } }; qualifiers?: Record<string, unknown> }>>;
  };
  const claims = data.claims?.[property];
  if (!Array.isArray(claims) || claims.length === 0) return null;
  const chosen = claims.find((c) => c.rank === "preferred") ?? claims.find((c) => c.rank !== "deprecated") ?? claims[0];
  const url = `https://www.wikidata.org/wiki/${entityId}#${property}`;
  return factFromSnak(property === "P585" || property === "P577" || property === "P571" ? "date" : factKindForProperty(property), chosen?.mainsnak, property, url, asOfFromQualifiers(chosen?.qualifiers));
}

function factKindForProperty(property: string): StructuredFactKind {
  if (property === "P1110") return "attendance";
  if (property === "P1082") return "population";
  if (property === "P2046") return "area";
  if (property === "P2044") return "elevation";
  return "date";
}

async function searchEntity(query: string): Promise<string | null> {
  if (inCooldown("wikidata")) return null;
  const search = entityQuery(query);
  if (!search) return null;
  await throttle("wikidata");
  const params = new URLSearchParams({
    action: "wbsearchentities",
    search,
    language: "en",
    limit: "1",
    format: "json",
    origin: "*",
  });
  const resp = await infobrokerFetch(`${WIKIDATA_API}?${params.toString()}`, { providerSlug: "wikidata" });
  if (!resp.ok) return null;
  const data = (await resp.json()) as { search?: Array<{ id?: string }> };
  const id = data.search?.[0]?.id;
  return typeof id === "string" && /^Q\d+$/.test(id) ? id : null;
}

function qidFromResults(results: SearchResult[]): string | null {
  for (const result of results) {
    const match = /wikidata\.org\/wiki\/(Q\d+)/.exec(result.url);
    if (match) return match[1];
  }
  return null;
}

function numberFromDisplay(display: string): number | null {
  const match = /-?\d[\d,.]*/.exec(display);
  if (!match) return null;
  const numeric = Number(match[0].replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function factFromRows(
  kind: StructuredFactKind,
  rows: InfoboxRow[],
  source: string,
  url: string,
): FactEnrichment {
  const matches = rows.filter((row) => KEY_RULES[kind].test(row.key));
  if (matches.length === 0) return { facts: [], fact_status: "not_found", source };

  const byDisplay = new Map<string, InfoboxRow>();
  for (const row of matches) {
    if (!row.value) continue;
    byDisplay.set(row.value, row);
  }
  if (byDisplay.size === 0) return { facts: [], fact_status: "not_found", source };
  if (byDisplay.size > 1) {
    return { facts: [], fact_status: "ambiguous", source };
  }

  const row = [...byDisplay.values()][0];
  const numeric = kind === "date" ? null : numberFromDisplay(row.value);
  const percent = kind === "percentage" && row.value.includes("%");
  const displayUnit =
    kind === "area" || kind === "elevation" ? unitFromDisplay(kind, row.value) : undefined;
  return {
    facts: [
      {
        kind,
        value: numeric ?? row.value,
        display: row.value,
        ...(kind === "attendance" ? { unit: "people" } : {}),
        ...(percent ? { unit: "%" } : {}),
        ...(displayUnit ? { unit: displayUnit } : {}),
        key: row.key,
        source,
        url,
      },
    ],
    fact_status: "resolved",
    source,
  };
}

export async function wikipediaFacts(url: string, kind: StructuredFactKind): Promise<FactEnrichment> {
  if (inCooldown("wikipedia")) return { facts: [], fact_status: "unavailable", source: "wikipedia" };
  await throttle("wikipedia");
  const html = await fetchParseHtml(url);
  if (!html) return { facts: [], fact_status: "not_found", source: "wikipedia" };
  const $ = cheerio.load(html);
  const rows = [...collectInfoboxRows($), ...collectTableRows($)];
  return factFromRows(kind, rows, "wikipedia", url);
}

function wikiUrlFromResults(results: SearchResult[]): string | null {
  for (const result of results) {
    if (/wikipedia\.org\/wiki\//i.test(result.url)) return result.url;
  }
  return null;
}

/**
 * Resolve a measurable-attribute query against the results a search already
 * returned. Returns null when the query names no measurable attribute, so the
 * caller can skip enrichment entirely.
 */
export async function enrichStructuredFacts(
  query: string,
  payload: { results?: SearchResult[] },
): Promise<FactEnrichment | null> {
  const kind = detectFactKind(query);
  if (!kind) return null;

  const results = Array.isArray(payload.results) ? payload.results : [];
  const properties = kind === "date" ? dateProperties(query) : FACT_PROPERTIES[kind];

  try {
    const entityId = qidFromResults(results) ?? (await searchEntity(query));
    if (entityId) {
      for (const property of properties) {
        const fact = await fetchClaims(entityId, property);
        if (fact) return { facts: [fact], fact_status: "resolved", source: "wikidata" };
      }
    }

    const wikiUrl = wikiUrlFromResults(results);
    if (wikiUrl) {
      return await wikipediaFacts(wikiUrl, kind);
    }

    return { facts: [], fact_status: "not_found" };
  } catch {
    // A fact lookup is an aid; a provider failure never fails the search.
    return { facts: [], fact_status: "unavailable" };
  }
}
