// @implements REQ-071
import * as cheerio from "cheerio";

export const USER_AGENT = "Infobroker/1.0";

// Convert an HTML document or fragment to readable text. Drops script/style/
// template content (which a tag-only regex leaves behind as CSS/JS noise),
// decodes entities via the parser, and collapses whitespace.
export function htmlToText(html: string): string {
  if (!html) return "";
  if (!/<[a-z!/?]/i.test(html)) return html.trim();
  const $ = cheerio.load(html);
  $("script,style,noscript,template,svg,iframe,head").remove();
  const body = $("body");
  const text = body.length > 0 ? body.text() : $.root().text();
  return text.replace(/\s+/g, " ").trim();
}

export function stripHtml(html: string): string {
  return htmlToText(html);
}
