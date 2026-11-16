// @implements REQ-004
import { describe, it, expect } from "vitest";
import { existsSync, statSync, utimesSync } from "node:fs";
import { maybeTruncate } from "./truncate.js";
import { runMaintenance } from "./kb.js";

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

// REQ-100: the spill file is owner-only, and a stale one is reaped by the
// maintenance tick even when no freshness tiers are configured.
describe("spill-file hygiene (REQ-100)", () => {
  it("creates the spill file owner-readable only", () => {
    const r = maybeTruncate("b".repeat(500), 100);
    expect(statSync(r.outputPath!).mode & 0o777).toBe(0o600);
  });

  it("removes a stale spill file on the maintenance tick", () => {
    const r = maybeTruncate("c".repeat(500), 100);
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    utimesSync(r.outputPath!, old, old);
    runMaintenance();
    expect(existsSync(r.outputPath!)).toBe(false);
  });
});
