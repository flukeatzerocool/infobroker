// @implements REQ-001 REQ-021j
// Structured-output plumbing shared by all tools: parse the `[OK]`/`[ERROR]`
// text envelope into an object, attach it beside the text as
// `structuredContent`, and extract raw page text for fetch_page's raw mode.
// Kept as pure functions so the contract is unit-testable without a server.

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
 */
export function finalizeToolResult<T extends ToolResultLike>(
  result: T,
  notices: readonly unknown[],
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

  return { ...(base as T), structuredContent: structured };
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
 * REQ-021j: the plain-text body a raw fetch returns. Question mode keeps the
 * top-ranked passage in `results[].snippet`; the full-content path keeps the
 * extracted text there too. Falls back to the first snippet, then the note.
 */
export function rawTextFromEnvelope(envelope: Record<string, unknown>): string {
  const results = Array.isArray(envelope.results) ? envelope.results : [];
  const first = results[0] as Record<string, unknown> | undefined;
  if (first && typeof first.snippet === "string") return first.snippet;

  const snippets = Array.isArray(envelope.snippets) ? envelope.snippets : [];
  const firstSnippet = snippets[0] as Record<string, unknown> | undefined;
  if (firstSnippet && typeof firstSnippet.text === "string") return firstSnippet.text;

  return typeof envelope.note === "string" ? envelope.note : "";
}
