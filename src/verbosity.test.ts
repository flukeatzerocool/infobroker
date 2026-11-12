// @implements REQ-079
import { describe, it, expect } from "vitest";
import { compactEnvelope, compactMode, compactResults } from "./verbosity.js";

describe("compactMode (REQ-079)", () => {
  it("is off when verbose is true or undefined", () => {
    expect(compactMode({ output: { verbose: true } })).toBe(false);
    expect(compactMode({ output: {} })).toBe(false);
    expect(compactMode({})).toBe(false);
  });

  it("is on when verbose is false", () => {
    expect(compactMode({ output: { verbose: false } })).toBe(true);
  });
});

describe("compactResults (REQ-079)", () => {
  it("retains title, url, and snippet while dropping optional per-result fields", () => {
    const full = [{ title: "t", url: "u", snippet: "s", published_date: "2026-01-01", source_type: "web", original_source: "src" }];
    expect(compactResults(full)).toEqual([{ title: "t", url: "u", snippet: "s" }]);
  });

  it("keeps every required field of the REQ-001 result shape", () => {
    const [result] = compactResults([{ title: "t", url: "u", snippet: "s" }]);
    expect(Object.keys(result).sort()).toEqual(["snippet", "title", "url"]);
  });

  it("preserves result order", () => {
    const out = compactResults([
      { title: "a", url: "1", snippet: "x" },
      { title: "b", url: "2", snippet: "y" },
    ]);
    expect(out.map((r) => r.title)).toEqual(["a", "b"]);
  });
});

describe("compactEnvelope (REQ-079)", () => {
  it("trims search-shaped results and optional meta", () => {
    const out = compactEnvelope({
      status: "ok",
      provider: "x",
      results: [{ title: "t", url: "u", snippet: "s", published_date: "2026-01-01" }],
      meta: { query_time_ms: 4, fallback_used: false },
    });
    expect(out.results).toEqual([{ title: "t", url: "u", snippet: "s" }]);
    expect(out).not.toHaveProperty("meta");
  });

  it("retains action-required notices and drops informational ones", () => {
    const out = compactEnvelope({
      status: "ok",
      provider: "x",
      results: [],
      notices: [
        { code: "config_drift", severity: "action_required", message: "fix", remediation: "reload" },
        { code: "update", severity: "info", message: "later", remediation: "" },
      ],
    });
    expect(out.notices).toHaveLength(1);
    expect((out.notices as Array<{ code: string }>)[0].code).toBe("config_drift");
  });

  it("retains required meta keys", () => {
    const out = compactEnvelope({
      status: "ok",
      provider: "x",
      results: [],
      meta: { query_time_ms: 4, per_query: [{ query: "a", status: "ok" }] },
    });
    expect(out.meta).toEqual({ per_query: [{ query: "a", status: "ok" }] });
  });

  it("leaves finding-shaped results intact", () => {
    const findings = [{ claim: "c", confidence: 0.9, sources: [] }];
    const out = compactEnvelope({ status: "ok", provider: "corroborate", results: findings });
    expect(out.results).toEqual(findings);
  });

  // F-R3-20 / REQ-128: the chain-wide language report is required, so compact
  // shaping retains it while still dropping optional metadata.
  it("retains the language report in compact verbosity", () => {
    const out = compactEnvelope({
      status: "ok",
      provider: "duckduckgo",
      results: [],
      meta: { query_time_ms: 4, language_unsupported: ["mojeek"] },
    });
    expect(out.meta).toEqual({ language_unsupported: ["mojeek"] });
  });
});
