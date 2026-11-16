// @implements REQ-001 REQ-002 REQ-102
import { describe, expect, it } from "vitest";
import { toolErrorEnvelope } from "./tool-wrapper.js";

function parse(text: string) {
  expect(text.startsWith("[ERROR] ")).toBe(true);
  return JSON.parse(text.slice("[ERROR] ".length)) as {
    status: string;
    provider: string;
    error: { code: string; message: string; remediation: string };
  };
}

describe("tool error envelope (REQ-001, REQ-002, REQ-102)", () => {
  it("converts a thrown handler into the documented error envelope", () => {
    const payload = parse(toolErrorEnvelope("infobroker_search_web", new Error("database is locked")));

    expect(payload.status).toBe("error");
    expect(payload.provider).toBe("system");
    expect(payload.error.code).toBe("internal_error");
    expect(payload.error.message).toContain("infobroker_search_web failed");
    expect(payload.error.message).toContain("database is locked");
    expect(payload.error.remediation).toBeTruthy();
  });

  it("strips an absolute path from the thrown message", () => {
    const payload = parse(
      toolErrorEnvelope("infobroker_manage_kb", new Error("ENOENT: /home/fluke/private/store/kb.sqlite: no such file"))
    );
    expect(payload.error.message).not.toContain("/home/fluke/private");
  });

  it("accepts a non-Error throw without losing the envelope shape", () => {
    const payload = parse(toolErrorEnvelope("t", "boom"));
    expect(payload.error.message).toContain("boom");
  });
});
