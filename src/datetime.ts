// @implements REQ-021c
import * as cheerio from "cheerio";

export type DateEvidence = "header" | "meta" | "jsonld" | "time_tag";

export interface DetectedDate {
  date: string;
  source: DateEvidence;
  confidence: "high" | "medium" | "low";
}

function parseIso(value: string): string | undefined {
  const iso = value.match(/\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?/);
  return iso ? iso[0] : undefined;
}

function normalize(date: string): string {
  return date.slice(0, 10);
}

function fromHeaders(headers: Record<string, string | string[] | undefined>): DetectedDate | undefined {
  const get = (k: string) => {
    const v = headers[k] ?? headers[k.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };
  const lastModified = get("last-modified");
  if (lastModified) {
    const d = new Date(lastModified);
    if (!isNaN(d.getTime())) {
      return { date: d.toISOString().slice(0, 10), source: "header", confidence: "high" };
    }
  }
  return undefined;
}

function fromMeta($: cheerio.CheerioAPI): DetectedDate | undefined {
  const metaSelectors: Array<[string, string]> = [
    ['meta[property="article:modified_time"]', "content"],
    ['meta[property="article:published_time"]', "content"],
    ['meta[name="date"]', "content"],
    ['meta[name="dc.date"]', "content"],
    ['meta[name="citation_date"]', "content"],
    ['meta[property="og:updated_time"]', "content"],
  ];
  for (const [sel, attr] of metaSelectors) {
    const val = $(sel).attr(attr);
    if (!val) continue;
    const iso = parseIso(val);
    if (iso) return { date: normalize(iso), source: "meta", confidence: "high" };
  }
  return undefined;
}

function fromJsonLd($: cheerio.CheerioAPI): DetectedDate | undefined {
  let found: DetectedDate | undefined;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (found) return;
    const text = $(el).html();
    if (!text) return;
    try {
      const data = JSON.parse(text);
      const candidates = Array.isArray(data) ? data : [data];
      for (const c of candidates) {
        for (const key of ["dateModified", "datePublished"]) {
          const v = c?.[key];
          if (typeof v === "string") {
            const iso = parseIso(v);
            if (iso) {
              found = { date: normalize(iso), source: "jsonld", confidence: "high" };
              return;
            }
          }
        }
      }
    } catch {
      // malformed JSON-LD — skip
    }
  });
  return found;
}

function fromTimeTag($: cheerio.CheerioAPI): DetectedDate | undefined {
  const val = $("time[datetime]").first().attr("datetime");
  if (!val) return undefined;
  const iso = parseIso(val);
  if (iso) return { date: normalize(iso), source: "time_tag", confidence: "medium" };
  return undefined;
}

// Detect the last-updated date of a page from HTML metadata and (optionally)
// HTTP headers. Returns undefined when no date is determinable — an absence the
// caller reports rather than guessing.
export function detectUpdatedAt(
  html: string,
  headers?: Record<string, string | string[] | undefined>
): DetectedDate | undefined {
  if (headers) {
    const h = fromHeaders(headers);
    if (h) return h;
  }
  const $ = cheerio.load(html);
  return fromMeta($) ?? fromJsonLd($) ?? fromTimeTag($);
}
