// @implements REQ-004
import { describe, it, expect } from "vitest";
import { maybeTruncate } from "./truncate.js";

describe("maybeTruncate (REQ-004)", () => {
  it("returns text unchanged when within the max length", () => {
    const r = maybeTruncate("short", 100);
    expect(r.truncated).toBe(false);
    expect(r.text).toBe("short");
    expect(r.outputPath).toBeUndefined();
  });

  it("truncates, sets the flag, reports a path, and appends an in-band note", () => {
    const r = maybeTruncate("a".repeat(1000), 100);
    expect(r.truncated).toBe(true);
    expect(r.outputPath).toContain("trunc-");
    expect(r.text.length).toBeGreaterThan(100);
    expect(r.text).toContain("a".repeat(100) + "...");
    expect(r.text).toContain("truncated at 100 chars");
    expect(r.text).toContain("full content written to");
    expect(r.text).toContain(r.outputPath!);
  });
});
