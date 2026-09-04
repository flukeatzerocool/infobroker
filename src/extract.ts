// @implements REQ-021d REQ-021e
import * as cheerio from "cheerio";

export interface StructuredExtraction {
  jsonld: unknown[];
  open_graph: Record<string, string>;
  microdata: Array<{ type: string; properties: Record<string, string> }>;
}

// REQ-021e: structured-metadata extraction — schema.org/JSON-LD, OpenGraph,
// and microdata. Pure and unit-testable: takes the fetched HTML, returns the
// discovered structured objects, never mutates or replaces the page content.
export function extractStructured(html: string): StructuredExtraction {
  const $ = cheerio.load(html);

  const jsonld: unknown[] = [];
  $('script[type="application/ld+json"]').each((_i, el) => {
    const text = $(el).html() || "";
    try {
      const parsed = JSON.parse(text);
      if (parsed !== undefined) jsonld.push(parsed);
    } catch {
      // malformed JSON-LD block — skipped, not fatal
    }
  });

  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"]').each((_i, el) => {
    const prop = $(el).attr("property");
    const content = $(el).attr("content");
    if (prop && content !== undefined) openGraph[prop] = content;
  });

  const microdata: StructuredExtraction["microdata"] = [];
  $("[itemscope]").each((_i, el) => {
    const itemtype = $(el).attr("itemtype") || "";
    const properties: Record<string, string> = {};
    $(el)
      .find("[itemprop]")
      .each((_j, child) => {
        const name = $(child).attr("itemprop");
        if (!name) return;
        const value = $(child).attr("content") || $(child).text().trim();
        if (!properties[name]) properties[name] = value;
      });
    if (itemtype || Object.keys(properties).length > 0) {
      microdata.push({ type: itemtype, properties });
    }
  });

  return { jsonld, open_graph: openGraph, microdata };
}

// REQ-021d: same-origin link discovery for the bounded crawl. Returns
// absolute http(s) URLs found in the page, resolved against the base.
export function extractLinks(html: string, base: string): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const resolved = new URL(href, base);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        resolved.hash = "";
        out.add(resolved.toString());
      }
    } catch {
      // non-resolvable href — skipped
    }
  });
  return [...out];
}

export function isSameOrigin(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin;
  } catch {
    return false;
  }
}
