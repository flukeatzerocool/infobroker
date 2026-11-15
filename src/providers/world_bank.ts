// @implements REQ-020 REQ-070 REQ-071 REQ-095
import type { SearchResult, Provider, SearchOptions } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const DOCUMENTS_API = "https://search.worldbank.org/api/v2/wds";
const COUNTRIES_API = "https://api.worldbank.org/v2/country";
const INDICATORS_BASE = "https://api.worldbank.org/v2/country";
const DATA_PAGE = "https://data.worldbank.org/indicator";

interface IndicatorAlias {
  /** Query phrase that selects the indicator. */
  match: string;
  /** World Bank indicator code. */
  id: string;
}

/**
 * Deterministic alias table. The World Bank indicator catalog is 5,909 pages
 * and accepts no text filter, so a query cannot be resolved against it inside
 * a provider call. Longest alias wins, so "gdp growth" beats "gdp".
 */
const INDICATOR_ALIASES: IndicatorAlias[] = [
  { match: "government debt", id: "GC.DOD.TOTL.GD.ZS" },
  { match: "life expectancy", id: "SP.DYN.LE00.IN" },
  { match: "co2 emissions", id: "EN.ATM.CO2E.PC" },
  { match: "interest rate", id: "FR.INR.LEND" },
  { match: "gdp per capita", id: "NY.GDP.PCAP.CD" },
  { match: "gdp growth", id: "NY.GDP.MKTP.KD.ZG" },
  { match: "unemployment", id: "SL.UEM.TOTL.ZS" },
  { match: "inflation", id: "FP.CPI.TOTL.ZG" },
  { match: "population", id: "SP.POP.TOTL" },
  { match: "poverty", id: "SI.POV.DDAY" },
  { match: "exports", id: "NE.EXP.GNFS.ZS" },
  { match: "gdp", id: "NY.GDP.MKTP.CD" },
].sort((a, b) => b.match.length - a.match.length);

const WORLD: CountryRecord = { id: "WLD", iso2Code: "1W", name: "World" };
const VALUE_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

interface CountryRecord {
  id?: string;
  iso2Code?: string;
  name?: string;
}

interface IndicatorObservation {
  indicator?: { id?: string; value?: string };
  country?: { id?: string; value?: string };
  countryiso3code?: string;
  date?: string;
  value?: number | null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchIndicator(query: string): IndicatorAlias | null {
  for (const alias of INDICATOR_ALIASES) {
    if (new RegExp(`\\b${escapeRegExp(alias.match)}\\b`, "i").test(query)) return alias;
  }
  return null;
}

/**
 * Country names match case-insensitively, longest name first. ISO-2 and ISO-3
 * codes match only in uppercase, because the ISO-2 set overlaps ordinary
 * English words (IN, IT, AT, TO, NO, BE, AS, US).
 *
 * A comparison query naming two countries resolves to the first one; splitting
 * it into a multi-country series is not part of REQ-095.
 */
function resolveCountry(query: string, countries: CountryRecord[]): CountryRecord | null {
  const names = countries
    .filter((country) => country.name && country.name.trim().length > 0)
    .map((country) => ({ country, name: country.name!.trim() }))
    .sort((a, b) => b.name.length - a.name.length);

  for (const { country, name } of names) {
    const pattern = new RegExp(`(^|[^a-z])${escapeRegExp(name)}([^a-z]|$)`, "i");
    if (pattern.test(query)) return country;
  }

  const byIso3 = countries.find((country) => country.id && new RegExp(`\\b${escapeRegExp(country.id)}\\b`).test(query));
  if (byIso3) return byIso3;

  return countries.find((country) => country.iso2Code && country.iso2Code.length === 2 && new RegExp(`\\b${escapeRegExp(country.iso2Code)}\\b`).test(query)) ?? null;
}

async function fetchCountries(options?: SearchOptions): Promise<CountryRecord[] | null> {
  try {
    const resp = await infobrokerFetch(`${COUNTRIES_API}?format=json&per_page=400`, { providerSlug: "world_bank", signal: options?.signal });
    if (!resp.ok) return null;
    const data = (await resp.json()) as unknown;
    if (!Array.isArray(data) || !Array.isArray(data[1])) return null;
    return (data[1] as CountryRecord[]).filter((record) => typeof record === "object" && record !== null);
  } catch {
    // A country list that cannot be read degrades to the document path; the
    // caller must not answer a geography-bound query with world aggregates.
    return null;
  }
}

async function searchIndicator(query: string, alias: IndicatorAlias, options?: SearchOptions): Promise<SearchResult[] | null> {
  const countries = await fetchCountries(options);
  if (!countries) return null;

  const country = resolveCountry(query, countries) ?? WORLD;
  const year = new Date().getFullYear();
  const params = new URLSearchParams({ format: "json", per_page: "10", date: `${year - 9}:${year}` });
  const url = `${INDICATORS_BASE}/${country.id}/indicator/${alias.id}?${params.toString()}`;
  const resp = await infobrokerFetch(url, { providerSlug: "world_bank", signal: options?.signal });

  if (!resp.ok) throw new RetryableError(`World Bank returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[1])) return [];

  const observations = (data[1] as IndicatorObservation[]).filter(
    (observation) => typeof observation?.value === "number" && Number.isFinite(observation.value)
  );

  const raw = observations.map((observation) => {
    const indicatorName = observation.indicator?.value ?? alias.id;
    const countryName = observation.country?.value ?? country.name ?? country.id ?? "World";
    const iso3 = observation.countryiso3code ?? country.id;
    const date = observation.date ?? "";
    return {
      title: `${countryName} — ${indicatorName} (${date})`,
      url: `${DATA_PAGE}/${alias.id}?locations=${iso3}`,
      snippet: `${VALUE_FORMAT.format(observation.value as number)} · ${date} · World Bank indicator`,
      source_type: "structured_fact",
    };
  });

  return normalize(raw, "world_bank");
}

async function searchDocuments(query: string, options?: SearchOptions): Promise<SearchResult[]> {
  const params = new URLSearchParams({ format: "json", qterm: query, rows: "10" });

  const resp = await infobrokerFetch(`${DOCUMENTS_API}?${params.toString()}`, {
    providerSlug: "world_bank",
    signal: options?.signal,
  });

  if (!resp.ok) throw new RetryableError(`World Bank returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    documents?: {
      documents?: Array<{ title?: string; url?: string; docdt?: string }>;
    };
  };

  const raw = (data.documents?.documents || []).map((item) => ({
    title: item.title || "(untitled)",
    url: item.url || "",
    snippet: item.docdt ? `published ${item.docdt.slice(0, 10)}` : "",
    published_date: item.docdt ? item.docdt.slice(0, 10) : undefined,
    source_type: "structured_fact",
  }));

  return normalize(raw, "world_bank");
}

async function search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
  const alias = matchIndicator(query);
  if (alias) {
    const indicatorResults = await searchIndicator(query, alias, options);
    if (indicatorResults) return indicatorResults;
  }
  return searchDocuments(query, options);
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${DOCUMENTS_API}?format=json&qterm=test&rows=1`, {
      providerSlug: "world_bank",
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "world_bank",
  tier: "free_http",
  capabilities: ["financial"],
  search,
  health,
};
