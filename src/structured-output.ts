// @implements REQ-001 REQ-021j
// Structured-output plumbing shared by all tools: parse the `[OK]`/`[ERROR]`
// text envelope into an object, attach it beside the text as
// `structuredContent`, and extract raw page text for fetch_page's raw mode.
// Kept as pure functions so the contract is unit-testable without a server.
import { compactEnvelope } from "./verbosity.js";

export interface ToolResultLike {
  content?: unknown;
  structuredContent?: unknown;
  [key: string]: unknown;
}

/** Parse a prefixed envelope into its JSON object; undefined for non-envelopes. */
export function parseEnvelopeObject(text: string): Record<string, unknown> | undefined {
  const trimmed = text.trim();
  const body = trimmed.startsWith("[OK]")
    ? trimmed.slice(4)
    : trimmed.startsWith("[ERROR]")
      ? trimmed.slice(7)
      : undefined;
  if (body === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function firstText(result: ToolResultLike): string | undefined {
  const content = result.content;
  if (!Array.isArray(content)) return undefined;
  for (const item of content) {
    if (
      item &&
      typeof item === "object" &&
      (item as { type?: unknown }).type === "text" &&
      typeof (item as { text?: unknown }).text === "string"
    ) {
      return (item as { text: string }).text;
    }
  }
  return undefined;
}

/**
 * Attach `structuredContent` to a tool result. A handler that already set it
 * (raw mode) is respected; otherwise the text envelope is parsed. A handler
 * that returns text the parser cannot read still yields a minimal object, so a
 * declared output schema never fails validation.
 *
 * REQ-004: an optional `truncate` callback bounds the returned text. It runs
 * after the compact rewrite so a re-serialization cannot restore the full
 * body, and the structured envelope (built from the full text) stays intact
 * with `truncated`/`output_path` flags. A response that already reports a
 * truncation is left alone, so `fetch_page`'s own bound is unchanged.
 */
export function finalizeToolResult<T extends ToolResultLike>(
  result: T,
  notices: readonly unknown[],
  compact = false,
  truncate?: (text: string) => { text: string; truncated: boolean; outputPath?: string },
  requiredMetaKeys?: readonly string[],
): T & { structuredContent: Record<string, unknown> } {
  const base = { ...(result as Record<string, unknown>) };
  let structured =
    base.structuredContent && typeof base.structuredContent === "object" && !Array.isArray(base.structuredContent)
      ? (base.structuredContent as Record<string, unknown>)
      : undefined;

  if (!structured) {
    const text = firstText(result);
    structured = text !== undefined ? parseEnvelopeObject(text) : undefined;
    if (!structured) {
      structured = {
        status: "ok",
        provider: "none",
        results: [],
        ...(text !== undefined ? { message: text } : {}),
      };
    }
  }

  if (notices.length > 0 && !Array.isArray(structured.notices)) {
    structured = { ...structured, notices };
  }

  if (compact) {
    structured = compactEnvelope(structured, requiredMetaKeys);

    // REQ-079: the human-readable text must agree with the compacted
    // structuredContent. Raw mode has no JSON envelope, so its plain text is
    // left alone and only the structured object is compacted.
    const text = firstText(result);
    if (text !== undefined && parseEnvelopeObject(text) !== undefined) {
      const prefix = text.trim().startsWith("[ERROR]") ? "[ERROR]" : "[OK]";
      const rewritten = `${prefix} ${JSON.stringify(structured, null, 2)}`;
      const content = base.content;
      if (Array.isArray(content)) {
        let replaced = false;
        base.content = content.map((item) => {
          if (
            !replaced &&
            item &&
            typeof item === "object" &&
            (item as { type?: unknown }).type === "text"
          ) {
            replaced = true;
            return { ...(item as object), text: rewritten };
          }
          return item;
        });
      }
    }
  }

  // REQ-004: bound the returned text after the compact rewrite. The structured
  // envelope keeps the parsed body; only the text is clipped and flagged.
  const bounded = firstText(base);
  if (truncate && bounded !== undefined && structured.truncated !== true) {
    const clipped = truncate(bounded);
    if (clipped.truncated) {
      structured = {
        ...structured,
        truncated: true,
        ...(clipped.outputPath ? { output_path: clipped.outputPath } : {}),
      };
      base.content = replaceFirstText(base, clipped.text).content;
    }
  }

  return { ...(base as T), structuredContent: structured };
}

function replaceFirstText<T extends ToolResultLike>(result: T, text: string): T {
  const content = result.content;
  if (!Array.isArray(content)) return result;
  let replaced = false;
  const next = content.map((item) => {
    if (!replaced && item && typeof item === "object" && (item as { type?: unknown }).type === "text") {
      replaced = true;
      return { ...(item as object), text };
    }
    return item;
  });
  return { ...(result as Record<string, unknown>), content: next } as T;
}

/**
 * REQ-021j: raw mode is single-URL only and cannot be combined with crawl or
 * extract. Returns an error message when the request is invalid.
 */
export function rawRequestError(url: unknown, crawl: unknown, extract: unknown): string | undefined {
  if (Array.isArray(url) || crawl === true || extract === true) {
    return "raw mode requires a single URL and cannot be combined with crawl or extract";
  }
  return undefined;
}

/**
 * REQ-021j: the plain-text body a raw fetch returns. An error envelope has no
 * result snippets, so its message and remediation become the text rather than
 * an empty string (CR-10). Question mode keeps the top-ranked passage in
 * `results[].snippet`; the full-content path keeps the extracted text there
 * too. Falls back to the first snippet, then the note, then a top-level
 * message.
 */
export function rawTextFromEnvelope(envelope: Record<string, unknown>): string {
  const error = envelope.error;
  if (envelope.status === "error" && error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      const remediation = (error as { remediation?: unknown }).remediation;
      return typeof remediation === "string" && remediation.length > 0 ? `${message} ${remediation}` : message;
    }
  }

  const results = Array.isArray(envelope.results) ? envelope.results : [];
  const first = results[0] as Record<string, unknown> | undefined;
  if (first && typeof first.snippet === "string") return first.snippet;

  const snippets = Array.isArray(envelope.snippets) ? envelope.snippets : [];
  const firstSnippet = snippets[0] as Record<string, unknown> | undefined;
  if (firstSnippet && typeof firstSnippet.text === "string") return firstSnippet.text;

  if (typeof envelope.note === "string") return envelope.note;
  return typeof envelope.message === "string" ? envelope.message : "";
}
