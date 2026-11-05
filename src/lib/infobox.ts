// @implements REQ-021i wikipedia-infobox wikipedia-table
// Infobox and table extraction for structured facts. Wikipedia's parse HTML
// renders both the infobox and article tables as ordinary tables; flattening
// the page to prose (stripHtml) loses the key/value structure a fact query
// needs. This module keeps that structure and is deliberately bounded so a
// large article cannot turn into an unbounded fact harvest.
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

export interface InfoboxRow {
  key: string;
  value: string;
}

export const MAX_INFOBOX_ROWS = 200;
export const MAX_TABLES = 5;
export const MAX_TABLE_ROWS = 200;

function cleanText(text: string): string {
  return text
    // Footnote markers ("[1]", "[citation needed]") are not part of the value.
    .replace(/\[\s*(?:\d+|citation needed|note \d+)\s*\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cellsToRow(cells: Array<{ key: string; value: string }>): InfoboxRow | null {
  // A section header spans both columns and has no value cell.
  for (const cell of cells) {
    if (!cell.key || !cell.value) continue;
    return { key: cell.key, value: cell.value };
  }
  return null;
}

function rowFromElement($: CheerioAPI, el: unknown): InfoboxRow | null {
  const node = $(el as never);
  const headers = node
    .find("th")
    .toArray()
    .map((cell) => cleanText($(cell).text()));
  const values = node
    .find("td")
    .toArray()
    .map((cell) => cleanText($(cell).text()));
  if (values.length === 0) return null;
  const key = headers.filter(Boolean).join(" ");
  const value = values.filter(Boolean).join(" | ");
  return cellsToRow([{ key, value }]);
}

export function collectInfoboxRows($: CheerioAPI): InfoboxRow[] {
  const rows: InfoboxRow[] = [];
  $("table.infobox tr").each((_i, el) => {
    if (rows.length >= MAX_INFOBOX_ROWS) return false;
    const row = rowFromElement($, el);
    if (row) rows.push(row);
    return undefined;
  });
  return rows;
}

export function collectTableRows($: CheerioAPI): InfoboxRow[] {
  const rows: InfoboxRow[] = [];
  const tables = $("table.wikitable").toArray().slice(0, MAX_TABLES);
  for (const table of tables) {
    $(table)
      .find("tr")
      .each((_i, el) => {
        if (rows.length >= MAX_TABLE_ROWS) return false;
        const row = rowFromElement($, el);
        // A table row key must contain a letter; numeric-only cells are data,
        // not a dimension the caller can ask for.
        if (row && /[A-Za-z]/.test(row.key)) rows.push(row);
        return undefined;
      });
  }
  return rows;
}

export function parseInfobox(html: string): InfoboxRow[] {
  const $ = cheerio.load(html);
  return collectInfoboxRows($);
}

export function parseTables(html: string): InfoboxRow[] {
  const $ = cheerio.load(html);
  return collectTableRows($);
}
