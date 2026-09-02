// @implements REQ-027
export interface CitationFields {
  type: "article" | "misc";
  key: string;
  title: string;
  authors: string[];
  year?: string;
  venue?: string;
  url?: string;
}

function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[{}]/g, (c) => (c === "{" ? "\\{" : "\\}"))
    .replace(/([&%$#_])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function citationKey(author?: string, year?: string): string {
  const last = (author || "").split(/[,\s]+/)[0] || "anon";
  const slug = last.toLowerCase().replace(/[^a-z0-9]/g, "");
  const y = year || "nd";
  return `${slug}${y}`;
}

export function formatBibtex(fields: CitationFields): string {
  const authorField = fields.authors.length > 0
    ? fields.authors.map((a) => escapeLatex(a)).join(" and ")
    : undefined;

  const lines: string[] = [`@${fields.type}{${escapeLatex(fields.key)},`];
  lines.push(`  title = {${escapeLatex(fields.title)}}`);
  if (authorField) lines.push(`  author = {${authorField}}`);
  if (fields.year) lines.push(`  year = {${fields.year}}`);
  if (fields.venue) lines.push(fields.type === "article" ? `  journal = {${escapeLatex(fields.venue)}}` : `  howpublished = {${escapeLatex(fields.venue)}}`);
  if (fields.url) lines.push(`  url = {${fields.url}}`);
  lines.push("}");
  return lines.join("\n");
}

export function citationFor(title: string, authors: string[], year?: string, venue?: string, url?: string): string {
  const key = citationKey(authors[0], year || undefined);
  return formatBibtex({
    type: authors.length > 0 ? "article" : "misc",
    key,
    title,
    authors,
    year,
    venue,
    url,
  });
}
