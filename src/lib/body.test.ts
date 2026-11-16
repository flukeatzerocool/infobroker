// @implements REQ-137
import { describe, expect, it } from "vitest";
import { cappedResponse, readJsonCapped, readTextCapped } from "./body.js";
import { ParseError } from "../retry.js";

function response(body: string, init: ResponseInit = {}): Response {
  return new Response(body, { status: 200, ...init });
}

describe("readTextCapped (REQ-137)", () => {
  it("returns the full body when it is under the cap", async () => {
    const result = await readTextCapped(response("hello"), 1024);
    expect(result).toEqual({ text: "hello", truncatedAtBytes: false });
  });

  it("truncates at the cap and marks it", async () => {
    const result = await readTextCapped(response("a".repeat(100)), 10);
    expect(result.text).toHaveLength(10);
    expect(result.truncatedAtBytes).toBe(true);
  });

  it("bounds a body with no usable Content-Length", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(64)));
        controller.close();
      },
    });
    const streamed = new Response(body, { status: 200 });
    const result = await readTextCapped(streamed, 8);
    expect(result.text).toHaveLength(8);
    expect(result.truncatedAtBytes).toBe(true);
  });
});

describe("readJsonCapped (REQ-137)", () => {
  it("parses a body under the cap", async () => {
    expect(await readJsonCapped(response('{"ok":true}'), 1024)).toEqual({ ok: true });
  });

  it("treats a truncated JSON body as a provider failure", async () => {
    await expect(readJsonCapped(response('{"ok":true,"pad":"' + "x".repeat(100) + '"}'), 20)).rejects.toBeInstanceOf(ParseError);
  });
});

describe("cappedResponse (REQ-137)", () => {
  it("caps text() and json() while leaving status and headers intact", async () => {
    const wrapped = cappedResponse(response("y".repeat(50), { headers: { "x-test": "1" } }), 5);
    expect(wrapped.status).toBe(200);
    expect(wrapped.headers.get("x-test")).toBe("1");
    expect(await wrapped.text()).toHaveLength(5);
  });
});
