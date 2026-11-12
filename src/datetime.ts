// @implements REQ-021c
// Date evidence is split into two kinds: a *modification* date answers
// "when was this last updated", a *publication* date does not. Only
// modification evidence may be reported as `last_updated`; publication
// evidence is reported separately rather than mislabelled (F-R4-C-2).
import * as cheerio from "cheerio";

export type DateEvidence = "header" | "meta" | "jsonld" | "time_tag";
export type DateKind = "modified" | "published";

export interface DetectedDate {
  date: string;
  source: DateEvidence;
  confidence: "high" | "medium" | "low";
  kind: DateKind;
}

function parseIso(value: string): string | undefined {
  const iso = value.match(/\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?/);
  return iso ? iso[0] : undefined;
}

function normalize(date: string): string {
  return date.slice(0, 10);
}

function fromHeaders(headers: Record<string, string | string[] | undefined>): DetectedDate[] {
  const get = (k: string) => {
    const v = headers[k] ?? headers[k.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };
  const lastModified = get("last-modified");
  if (lastModified) {
    const d = new Date(lastModified);
    if (!isNaN(d.getTime())) {
      return [{ date: d.toISOString().slice(0, 10), source: "header", confidence: "high", kind: "modified" }];
    }
  }
  return [];
}

// Selectors are ordered by the evidence they carry, not by convenience: a
// modification timestamp always outranks a publication timestamp, so the
// caller can report `last_updated` only when it was actually given one.
const MODIFIED_META: Array<[string, string]> = [
  ['meta[property="article:modified_time"]', "content"],
  ['meta[property="og:updated_time"]', "content"],
];

const PUBLISHED_META: Array<[string, string]> = [
  ['meta[property="article:published_time"]', "content"],
  ['meta[name="date"]', "content"],
  ['meta[name="dc.date"]', "content"],
  ['meta[name="citation_date"]', "content"],
];

function fromMeta($: cheerio.CheerioAPI): DetectedDate[] {
  const found: DetectedDate[] = [];
  for (const [sel, attr] of MODIFIED_META) {
    const iso = parseIso($(sel).attr(attr) ?? "");
    if (iso) {
      found.push({ date: normalize(iso), source: "meta", confidence: "high", kind: "modified" });
      break;
    }
  }
  for (const [sel, attr] of PUBLISHED_META) {
    const iso = parseIso($(sel).attr(attr) ?? "");
    if (iso) {
      found.push({ date: normalize(iso), source: "meta", confidence: "medium", kind: "published" });
      break;
    }
  }
  return found;
}

function fromJsonLd($: cheerio.CheerioAPI): DetectedDate[] {
  let modified: DetectedDate | undefined;
  let published: DetectedDate | undefined;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (modified && published) return;
    const text = $(el).html();
    if (!text) return;
    try {
      const data = JSON.parse(text);
      const candidates = Array.isArray(data) ? data : [data];
      for (const c of candidates) {
        if (!modified) {
          const v = c?.dateModified;
          if (typeof v === "string") {
            const iso = parseIso(v);
            if (iso) modified = { date: normalize(iso), source: "jsonld", confidence: "high", kind: "modified" };
          }
        }
        if (!published) {
          const v = c?.datePublished;
          if (typeof v === "string") {
            const iso = parseIso(v);
            if (iso) published = { date: normalize(iso), source: "jsonld", confidence: "medium", kind: "published" };
          }
        }
      }
    } catch {
      // malformed JSON-LD — skip
    }
  });
  return [modified, published].filter((d): d is DetectedDate => d !== undefined);
}

function fromTimeTag($: cheerio.CheerioAPI): DetectedDate[] {
  const val = $("time[datetime]").first().attr("datetime");
  if (!val) return [];
  const iso = parseIso(val);
  if (!iso) return [];
  // A <time> element states that a document carries a date, not which date it
  // is, so it is the weakest evidence in the set.
  return [{ date: normalize(iso), source: "time_tag", confidence: "low", kind: "published" }];
}

// Detect the document's dates from HTTP headers and document metadata. A
// modification date is returned whenever any source supplies one; otherwise a
// publication date is returned; otherwise undefined — an absence the caller
// reports rather than guessing.
export function detectDocumentDate(
  html: string,
  headers?: Record<string, string | string[] | undefined>
): DetectedDate | undefined {
  const candidates: DetectedDate[] = [];
  if (headers) candidates.push(...fromHeaders(headers));
  const $ = cheerio.load(html);
  candidates.push(...fromMeta($), ...fromJsonLd($), ...fromTimeTag($));
  return candidates.find((c) => c.kind === "modified") ?? candidates[0];
}
