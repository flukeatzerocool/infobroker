// @implements REQ-124
// Query-operator parsing for `search_web` (REQ-124). Operators are passed
// through to providers that understand them; providers with structured APIs
// do not, so the response reports them as ignored rather than pretending they
// were applied.

export interface ParsedQuery {
  raw: string;
  normalized: string;
  sites: string[];
  filetypes: string[];
  phrases: string[];
  exclusions: string[];
  hasOperators: boolean;
}

const OPERATOR_CAPABLE = new Set([
  "duckduckgo",
  "mojeek",
  "marginalia",
  "wiby",
  "yep",
  "searxng",
]);

export function providerSupportsOperators(slug: string): boolean {
  return OPERATOR_CAPABLE.has(slug);
}

export function parseQuery(raw: string): ParsedQuery {
  const text = (raw ?? "").trim();
  const sites = [...text.matchAll(/\bsite:([^\s]+)/gi)].map((m) => m[1]!);
  const filetypes = [...text.matchAll(/\bfiletype:([^\s]+)/gi)].map((m) => m[1]!);
  const phrases = [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
  const exclusions = [...text.matchAll(/(?:^|\s)-([^\s-][^\s]*)/g)].map((m) => m[1]!);
  return {
    raw: text,
    normalized: text.replace(/\s+/g, " ").trim(),
    sites,
    filetypes,
    phrases,
    exclusions,
    hasOperators: sites.length + filetypes.length + phrases.length + exclusions.length > 0,
  };
}

export function ignoredOperators(slug: string, parsed: ParsedQuery): string[] {
  if (!parsed.hasOperators || providerSupportsOperators(slug)) return [];
  return [
    ...(parsed.sites.length > 0 ? ["site"] : []),
    ...(parsed.filetypes.length > 0 ? ["filetype"] : []),
    ...(parsed.phrases.length > 0 ? ["phrase"] : []),
    ...(parsed.exclusions.length > 0 ? ["exclusion"] : []),
  ];
}
