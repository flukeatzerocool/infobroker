// @implements REQ-138 envelope
// @implements REQ-138 additive
// @implements REQ-079 compact-required
// The marker is enforced at the one envelope seam, so these tests drive that seam
// rather than each tool.
import { describe, expect, it } from "vitest";
import { finalizeToolResult } from "./structured-output.js";
import {
  EXTERNAL_TEXT_TOOLS,
  UNTRUSTED_MARKER,
  carriesExternalText,
  contentTrustBlock,
} from "./trust-marker.js";

function envelope(payload: Record<string, unknown>): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text" as const, text: `[OK] ${JSON.stringify(payload, null, 2)}` }] };
}

function body(result: { content?: unknown }): string {
  const item = (result.content as Array<{ text: string }>)[0]!;
  return item.text;
}

function parsed(result: { content?: unknown }): Record<string, unknown> {
  return JSON.parse(body(result).replace(/^\[(?:OK|ERROR)\] /, "")) as Record<string, unknown>;
}

const SEARCH = {
  status: "ok",
  provider: "duckduckgo",
  results: [{ title: "T", url: "https://a.example/1", snippet: "retrieved body text" }],
};

describe("untrusted-content marker", () => {
  it("names the trust class and the marker token", () => {
    expect(contentTrustBlock()).toMatchObject({ class: "untrusted_external", marker: UNTRUSTED_MARKER });
    expect(UNTRUSTED_MARKER.startsWith("<")).toBe(true);
  });

  it("detects payloads that carry retrieved text", () => {
    expect(carriesExternalText(SEARCH)).toBe(true);
    expect(carriesExternalText({ status: "ok", chunk_count: 4 })).toBe(false);
    expect(carriesExternalText({ status: "ok", results: [] })).toBe(false);
  });

  it("adds the block as the first key without altering retrieved bytes", () => {
    const result = finalizeToolResult(envelope(SEARCH), [], false, undefined, undefined, "infobroker_search_web");
    const payload = parsed(result);
    expect(Object.keys(payload)[0]).toBe("content_trust");
    expect(payload.content_trust).toMatchObject({ class: "untrusted_external" });
    // REQ-138 additive: every retrieved value is byte-identical.
    expect((payload.results as Array<{ snippet: string }>)[0]!.snippet).toBe("retrieved body text");
    expect(body(result)).toContain(UNTRUSTED_MARKER);
    expect(result.structuredContent.content_trust).toMatchObject({ class: "untrusted_external" });
  });

  it("omits the block for a tool that carries no external text", () => {
    const stats = finalizeToolResult(
      envelope({ status: "ok", chunk_count: 7 }),
      [],
      false,
      undefined,
      undefined,
      "infobroker_manage_kb",
    );
    expect(parsed(stats)).not.toHaveProperty("content_trust");

    const exempt = finalizeToolResult(
      envelope(SEARCH),
      [],
      false,
      undefined,
      undefined,
      "infobroker_inspect_providers",
    );
    expect(parsed(exempt)).not.toHaveProperty("content_trust");
    expect(EXTERNAL_TEXT_TOOLS.has("infobroker_inspect_providers")).toBe(false);
  });

  it("omits the block from an error envelope", () => {
    const error = finalizeToolResult(
      { content: [{ type: "text" as const, text: `[ERROR] ${JSON.stringify({ status: "error", code: "x" })}` }] },
      [],
      false,
      undefined,
      undefined,
      "infobroker_fetch_page",
    );
    expect(parsed(error)).not.toHaveProperty("content_trust");
  });

  it("keeps the block in compact output", () => {
    const compact = finalizeToolResult(
      envelope(SEARCH),
      [],
      true,
      undefined,
      undefined,
      "infobroker_search_web",
    );
    const payload = parsed(compact);
    expect(payload.content_trust).toMatchObject({ class: "untrusted_external" });
    // REQ-079 still trims per-result fields.
    expect((payload.results as Array<Record<string, unknown>>)[0]).toEqual({
      title: "T",
      url: "https://a.example/1",
      snippet: "retrieved body text",
    });
  });

  it("leaves a plain-text (raw) body untouched and marks the structured side", () => {
    const raw = finalizeToolResult(
      {
        content: [{ type: "text" as const, text: "raw page bytes" }],
        structuredContent: { ...SEARCH },
      },
      [],
      false,
      undefined,
      undefined,
      "infobroker_fetch_page",
    );
    // REQ-001 plain-text clause: the requested text is returned verbatim.
    expect(body(raw)).toBe("raw page bytes");
    expect(raw.structuredContent.content_trust).toMatchObject({ class: "untrusted_external" });
  });

  it("survives truncation because the marker leads the envelope", () => {
    const truncated = finalizeToolResult(
      envelope({ ...SEARCH, results: [{ title: "T", url: "https://a.example/1", snippet: "x".repeat(4000) }] }),
      [],
      false,
      (text) => ({ text: text.slice(0, 400), truncated: true }),
      undefined,
      "infobroker_fetch_page",
    );
    expect(body(truncated).length).toBeLessThanOrEqual(400);
    expect(body(truncated)).toContain("content_trust");
    expect(body(truncated)).toContain(UNTRUSTED_MARKER);
    expect(truncated.structuredContent.truncated).toBe(true);
  });
});
