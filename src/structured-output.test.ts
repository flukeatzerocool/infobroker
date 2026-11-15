// @implements REQ-001
// @implements REQ-021j
// @implements REQ-079
// Structured-output contract: the text envelope is parsed into
// `structuredContent` on every tool, and fetch_page's raw mode returns plain
// text with metadata in the structured object. Unit tests cover the pure
// helpers; one stdio test proves the live SDK accepts the registered schema.
import { test, expect } from "vitest";
import { isolatedConfigEnv } from "./lib/test-isolation.js";
import { withServer } from "./lib/mcp-stdio.js";
import {
  finalizeToolResult,
  parseEnvelopeObject,
  rawRequestError,
  rawTextFromEnvelope,
} from "./structured-output.js";

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

test("parseEnvelopeObject reads OK and ERROR envelopes", () => {
  expect(parseEnvelopeObject(`[OK] ${JSON.stringify({ status: "ok", provider: "wikipedia", results: [] })}`)).toEqual({
    status: "ok",
    provider: "wikipedia",
    results: [],
  });
  expect(
    parseEnvelopeObject(
      `[ERROR] ${JSON.stringify({ status: "error", provider: "none", error: { code: "rate_limited", message: "m" } })}`,
    ),
  ).toMatchObject({ status: "error", error: { code: "rate_limited" } });
});

test("parseEnvelopeObject rejects non-envelope text", () => {
  expect(parseEnvelopeObject("plain text")).toBeUndefined();
  expect(parseEnvelopeObject("[OK] not json")).toBeUndefined();
  expect(parseEnvelopeObject("[OK] [1,2]")).toBeUndefined();
});

test("finalizeToolResult attaches the parsed envelope", () => {
  const result = textResult(`[OK] ${JSON.stringify({ status: "ok", provider: "github", results: [{ title: "x" }] })}`);
  const finalized = finalizeToolResult(result, []);
  expect(finalized.structuredContent).toEqual({ status: "ok", provider: "github", results: [{ title: "x" }] });
});

test("finalizeToolResult synthesizes an object for non-JSON text", () => {
  const finalized = finalizeToolResult(textResult("plain text"), []);
  expect(finalized.structuredContent).toMatchObject({ status: "ok", provider: "none", results: [], message: "plain text" });
});

// REQ-027a: a tool may declare metadata that survives compact verbosity, and
// the retained keys must appear in both surfaces the shaper rewrites.
test("finalizeToolResult keeps a tool-scoped required meta set under compact verbosity", () => {
  const body = `[OK] ${JSON.stringify({
    status: "ok",
    provider: "academic",
    results: [{ title: "t", url: "u", authors: [], bibtex: "@misc{x}" }],
    meta: { query_time_ms: 4, providers: [{ slug: "openalex", status: "ok" }], no_results: true, diagnostic: "none" },
  })}`;
  const finalized = finalizeToolResult(textResult(body), [], true, undefined, ["providers", "no_results", "diagnostic"]);
  expect(finalized.structuredContent.meta).toEqual({
    providers: [{ slug: "openalex", status: "ok" }],
    no_results: true,
    diagnostic: "none",
  });
  const text = (finalized.content as Array<{ text: string }>)[0].text;
  expect(text).toContain('"providers"');
  expect(text).not.toContain("query_time_ms");
});

test("finalizeToolResult merges notices into structured content", () => {
  const notice = { code: "config_drift", message: "drift" };
  const result = textResult(`[OK] ${JSON.stringify({ status: "ok", provider: "x", results: [] })}`);
  const finalized = finalizeToolResult(result, [notice]);
  expect(finalized.structuredContent.notices).toEqual([notice]);
});

test("finalizeToolResult respects a handler-provided structuredContent", () => {
  const result = {
    ...textResult("raw page text"),
    structuredContent: { status: "ok", provider: "jina", results: [], raw: true },
  };
  const finalized = finalizeToolResult(result, []);
  expect(finalized.structuredContent).toMatchObject({ raw: true, provider: "jina" });
});

// F-R3-23 / REQ-004: an oversized tool response is truncated to the configured
// bound, written to disk, and flagged, while the structured body stays whole.
test("finalizeToolResult truncates the text and flags the response", () => {
  const body = `[OK] ${JSON.stringify({ status: "ok", provider: "x", results: [{ title: "t", url: "u", snippet: "s" }] })}`;
  const finalized = finalizeToolResult(textResult(body), [], false, () => ({
    text: `${body.slice(0, 10)}...\n\n[truncated at 10 chars — full content written to /tmp/opencode/trunc.txt]`,
    truncated: true,
    outputPath: "/tmp/opencode/trunc.txt",
  }));
  const content = finalized.content as Array<{ text: string }>;
  expect(content[0].text).toContain("[truncated at 10 chars");
  expect(finalized.structuredContent.truncated).toBe(true);
  expect(finalized.structuredContent.output_path).toBe("/tmp/opencode/trunc.txt");
  expect(finalized.structuredContent.results).toEqual([{ title: "t", url: "u", snippet: "s" }]);
});

test("finalizeToolResult truncates after the compact rewrite", () => {
  const body = `[OK] ${JSON.stringify({
    status: "ok",
    provider: "x",
    results: [{ title: "t", url: "u", snippet: "s", published_date: "2026-01-01" }],
  })}`;
  const finalized = finalizeToolResult(textResult(body), [], true, (text) => ({
    text: `${text.slice(0, 10)}...`,
    truncated: true,
    outputPath: "/tmp/opencode/compact-trunc.txt",
  }));
  const content = finalized.content as Array<{ text: string }>;
  expect(content[0].text.endsWith("...")).toBe(true);
  expect(finalized.structuredContent.published_date).toBeUndefined();
  expect((finalized.structuredContent.results as Array<Record<string, unknown>>)[0].published_date).toBeUndefined();
  expect(finalized.structuredContent.truncated).toBe(true);
});

test("finalizeToolResult leaves an already-truncated response alone", () => {
  const body = `[OK] ${JSON.stringify({ status: "ok", provider: "x", results: [], truncated: true, output_path: "/tmp/opencode/page.txt" })}`;
  const finalized = finalizeToolResult(textResult(body), [], false, () => ({
    text: "should not be used",
    truncated: true,
    outputPath: "/tmp/opencode/other.txt",
  }));
  const content = finalized.content as Array<{ text: string }>;
  expect(content[0].text).toBe(body);
  expect(finalized.structuredContent.output_path).toBe("/tmp/opencode/page.txt");
});

test("rawRequestError accepts only a single URL without crawl or extract", () => {
  expect(rawRequestError("https://example.com", false, false)).toBeUndefined();
  expect(rawRequestError(["https://a", "https://b"], false, false)).toMatch(/single URL/);
  expect(rawRequestError("https://example.com", true, false)).toMatch(/single URL/);
  expect(rawRequestError("https://example.com", false, true)).toMatch(/single URL/);
});

test("rawRequestError judges a JSON-array string by its coerced value", () => {
  // F-R4-D-4: a stringified array is a batch once doFetchPage coerces it, so
  // the guard must refuse it before that path runs.
  expect(rawRequestError(JSON.stringify(["https://a", "https://b"]), false, false)).toMatch(/single URL/);
  // A genuine coercion error is surfaced rather than deferred.
  expect(rawRequestError("[]", false, false)).toMatch(/empty array/);
  expect(rawRequestError(["  "], false, false)).toMatch(/non-string or empty/);
  // One URL, whatever its shape, stays a single-URL request for the guard;
  // doFetchPage's strict coercion judges it afterwards.
  expect(rawRequestError(JSON.stringify(["https://a"]), false, false)).toBeUndefined();
  expect(rawRequestError("[http://a", false, false)).toBeUndefined();
});

test("rawTextFromEnvelope prefers the top result, then snippets, then note", () => {
  expect(rawTextFromEnvelope({ results: [{ snippet: "top passage" }], snippets: [{ text: "other" }] })).toBe("top passage");
  expect(rawTextFromEnvelope({ results: [], snippets: [{ text: "first snippet" }] })).toBe("first snippet");
  expect(rawTextFromEnvelope({ results: [], note: "no passage addressed the question" })).toBe("no passage addressed the question");
});

test("plain-text mode returns unprefixed text and carries the envelope", () => {
  const envelope = {
    status: "ok",
    provider: "jina",
    results: [{ title: "x", url: "https://example.com/x", snippet: "Body text" }],
  };
  const text = rawTextFromEnvelope(envelope);
  expect(text.startsWith("[OK]")).toBe(false);
  const finalized = finalizeToolResult(
    { content: [{ type: "text" as const, text }], structuredContent: { ...envelope, raw: true } },
    [],
  );
  expect(finalized.content[0].text).toBe("Body text");
  expect(finalized.structuredContent).toMatchObject({ status: "ok", provider: "jina", raw: true });
});

test("compact mode rewrites the text envelope to match structuredContent", () => {
  const result = textResult(
    `[OK] ${JSON.stringify({
      status: "ok",
      provider: "x",
      results: [{ title: "t", url: "u", snippet: "s", published_date: "2026-01-01" }],
      meta: { query_time_ms: 4 },
    })}`,
  );
  const finalized = finalizeToolResult(result, [], true);
  expect(finalized.structuredContent.meta).toBeUndefined();
  expect(finalized.structuredContent.results).toEqual([{ title: "t", url: "u", snippet: "s" }]);
  expect(parseEnvelopeObject(finalized.content[0].text)).toEqual(finalized.structuredContent);
});

test("compact mode leaves raw plain text alone and compacts only the structured object", () => {
  const result = {
    ...textResult("raw page text"),
    structuredContent: { status: "ok", provider: "jina", results: [], raw: true, meta: { cache: "hit" } },
  };
  const finalized = finalizeToolResult(result, [], true);
  expect(finalized.content[0].text).toBe("raw page text");
  expect(finalized.structuredContent.raw).toBe(true);
  expect(finalized.structuredContent.meta).toBeUndefined();
});

// CR-10: an error envelope has no snippets, so raw mode must return its text
// instead of an empty string.
test("rawTextFromEnvelope returns the error message and remediation", () => {
  const text = rawTextFromEnvelope({
    status: "error",
    provider: "none",
    error: {
      code: "access_blocked",
      message: "The page is access-restricted (authentication, geographic, or legal block)",
      remediation: "Try an open-access copy. Use infobroker_inspect_providers action=health to see provider status.",
    },
  });
  expect(text).toContain("access-restricted");
  expect(text).toContain("open-access copy");
  expect(text.length).toBeGreaterThan(0);
});

test("live tools expose structuredContent and reject an invalid raw combination", async () => {
  await withServer({ env: isolatedConfigEnv() }, async (call) => {
    const listed = await call("tools/list", {});
    expect(listed.error).toBeUndefined();
    const tools = (listed.result as { tools?: Array<{ name: string; outputSchema?: Record<string, unknown> }> }).tools ?? [];
    expect(tools).toHaveLength(7);
    for (const tool of tools) {
      expect(tool.outputSchema, `${tool.name} missing outputSchema`).toBeTruthy();
      expect(Object.keys(tool.outputSchema!).length).toBeGreaterThan(0);
    }

    const listedCall = await call("tools/call", { name: "infobroker_inspect_providers", arguments: { action: "list" } });
    expect(listedCall.error).toBeUndefined();
    const result = listedCall.result as { content: Array<{ text: string }>; structuredContent?: Record<string, unknown> };
    expect(result.structuredContent, "inspect_providers returned no structuredContent").toBeTruthy();
    expect(result.structuredContent!.status).toBe("ok");
    expect(result.structuredContent).toEqual(parseEnvelopeObject(result.content[0].text));

    const rawInvalid = await call("tools/call", {
      name: "infobroker_fetch_page",
      arguments: { url: ["https://a.example", "https://b.example"], raw: true },
    });
    expect(rawInvalid.error).toBeUndefined();
    const invalid = rawInvalid.result as { content: Array<{ text: string }>; structuredContent?: Record<string, unknown> };
    expect(invalid.content[0].text.startsWith("[ERROR]")).toBe(true);
    expect(invalid.structuredContent!.status).toBe("error");
    expect((invalid.structuredContent!.error as { code: string }).code).toBe("invalid_input");
  });
}, 30000);

// CR-10: a failed fetch in raw mode returns the error text, not an empty
// string, while the structured object keeps the full error envelope.
test("raw mode returns the error text for a failed fetch", async () => {
  await withServer({ env: isolatedConfigEnv() }, async (call) => {
    const response = await call("tools/call", {
      name: "infobroker_fetch_page",
      arguments: { url: "file:///tmp/notes.md", raw: true },
    });
    expect(response.error).toBeUndefined();
    const result = response.result as {
      content: Array<{ text: string }>;
      structuredContent?: Record<string, unknown>;
    };
    expect(result.content[0].text).toContain("fetch_page only fetches http(s) URLs");
    expect(result.content[0].text).toContain("read tool");
    expect(result.structuredContent!.status).toBe("error");
    expect((result.structuredContent!.error as { code: string }).code).toBe("invalid_input");
  });
}, 30000);
