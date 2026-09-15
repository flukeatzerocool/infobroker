// @implements REQ-102
import { describe, it, expect } from "vitest";
import { sanitizeErrorMessage } from "./sanitize-error.js";

describe("sanitizeErrorMessage (REQ-102)", () => {
  it("strips absolute filesystem paths", () => {
    const out = sanitizeErrorMessage("ENOENT: no such file or directory, open '/home/fluke/Infobroker/src/kb.ts'");
    expect(out).not.toContain("/home/");
    expect(out).toContain("<path>");
  });

  it("strips stack-frame markers", () => {
    const out = sanitizeErrorMessage("at loadStore (src/kb.ts:123:45)");
    expect(out).not.toMatch(/\.ts:\d+:\d+/);
  });

  it("redacts credential-shaped values", () => {
    expect(sanitizeErrorMessage("INFOBROKER_BRAVE_API_KEY=sk-live-abcdef123456 rejected")).not.toContain("sk-live-abcdef123456");
    expect(sanitizeErrorMessage("auth failed with Bearer eyJhbGciOiJIUzI1NiJ9.abc.def")).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(sanitizeErrorMessage("key AKIAIOSFODNN7EXAMPLE rejected")).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(sanitizeErrorMessage("SERVICE_TOKEN: ghp_abcdefghijklmnopqrstuvwxyz0123")).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz0123");
  });

  it("leaves ordinary messages intact", () => {
    const out = sanitizeErrorMessage("Provider duckduckgo returned HTTP 429");
    expect(out).toBe("Provider duckduckgo returned HTTP 429");
  });
});