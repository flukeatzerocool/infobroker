// @implements REQ-020k
// Document-origin identity for result reconciliation. `original_source` is
// populated by several paths and carries no documented contract until REQ-020k,
// so this module states the rule once and the inventory below keeps every
// producer visible.
//
// The rule separates a document from a publisher, a section, and a feed: a bare
// site root is a publisher, a section or feed suffix is not part of the document
// identity, and query strings are tracking or navigation rather than identity.
// Path case is preserved because two case-different paths can be two documents.

export type OriginProducerKind = "extract" | "merge";

export interface OriginProducer {
  /** Repository-relative path of the file that assigns `original_source`. */
  file: string;
  kind: OriginProducerKind;
  /** What value the site puts in the field. */
  semantics: string;
}

/**
 * Every site that originates an `original_source` value. `extract` sites derive
 * it from a provider payload; `merge` sites carry an existing value forward.
 */
export const ORIGIN_PRODUCERS: readonly OriginProducer[] = [
  {
    file: "src/normalizer.ts",
    kind: "extract",
    semantics: "raw original_source | origin | source from a provider item",
  },
  {
    file: "src/providers/generic-http.ts",
    kind: "extract",
    semantics: "the configured field_map key for original_source",
  },
  {
    file: "src/providers/yep.ts",
    kind: "extract",
    semantics: "item.source.url | .site | .name",
  },
  {
    file: "src/dedup.ts",
    kind: "merge",
    semantics: "carries a collapsed duplicate's value onto the representative",
  },
  {
    file: "src/corroborate.ts",
    kind: "merge",
    semantics: "copies the field into a corroboration source record",
  },
];

/** Files that declare the field's type rather than producing a value. */
export const ORIGIN_DECLARATIONS: readonly string[] = [
  "src/types.ts",
  "src/deep-search.ts",
  "src/calibration.ts",
];

/** Files that mention the identifier without producing or declaring it. */
export const ORIGIN_REFERENCES: readonly string[] = ["src/verbosity.ts", "src/origin-identity.ts"];

/** Section and feed suffixes that do not change which document a path names. */
const SECTION_SUFFIX = /\/(?:amp|print|feed|rss)\/?$/i;
const FEED_EXTENSION = /(?:\.rss|\.atom|atom\.xml)$/i;

/**
 * REQ-020k: the document identity of an `original_source` value, or null when it
 * identifies no document. Never throws on a malformed value.
 */
export function originIdentity(value: string | undefined | null): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  let path = url.pathname;
  path = path.replace(SECTION_SUFFIX, "");
  path = path.replace(FEED_EXTENSION, "");
  path = path.replace(/\/+$/, "");
  // A site root identifies a publisher, not a document.
  if (path.length === 0) return null;

  const host = url.hostname.toLowerCase();
  const port = url.port.length > 0 ? `:${url.port}` : "";
  return `${host}${port}${path}`;
}
