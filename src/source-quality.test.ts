// @implements REQ-020h
import { describe, it, expect } from "vitest";
import {
  filterBlocked,
  hostOf,
  isBlocked,
  matchesDomain,
  qualityScore,
  type SourceQualityConfig,
} from "./source-quality.js";

const BASE: SourceQualityConfig = {
  enabled: true,
  weight: 0.15,
  primary_source_suffixes: [".gov", ".edu"],
  trusted_domains: ["nature.com"],
  low_quality_domains: ["contentfarm.example"],
  blocklist: ["blocked.example", "*.wild.example"],
};

describe("source-quality matching (REQ-020h)", () => {
  it("extracts a lowercase host without www", () => {
    expect(hostOf("https://WWW.Example.COM/a/b")).toBe("example.com");
    expect(hostOf("ftp://example.com/x")).toBeNull();
    expect(hostOf("not a url")).toBeNull();
    expect(hostOf(undefined)).toBeNull();
  });

  it("matches a domain and its subdomains case-insensitively", () => {
    expect(matchesDomain("example.com", "Example.com")).toBe(true);
    expect(matchesDomain("news.example.com", "example.com")).toBe(true);
    expect(matchesDomain("example.com.evil.test", "example.com")).toBe(false);
  });

  it("treats a wildcard as subdomains only", () => {
    expect(matchesDomain("a.wild.example", "*.wild.example")).toBe(true);
    expect(matchesDomain("wild.example", "*.wild.example")).toBe(false);
  });
});

describe("source-quality blocklist (REQ-020h)", () => {
  it("blocks exact, subdomain, and wildcard hosts", () => {
    expect(isBlocked("https://blocked.example/page", BASE)).toBe(true);
    expect(isBlocked("https://news.blocked.example/page", BASE)).toBe(true);
    expect(isBlocked("https://a.wild.example/page", BASE)).toBe(true);
    expect(isBlocked("https://wild.example/page", BASE)).toBe(false);
    expect(isBlocked("https://allowed.example/page", BASE)).toBe(false);
  });

  it("never blocks a malformed URL and ignores an empty config", () => {
    expect(isBlocked("not a url", BASE)).toBe(false);
    expect(isBlocked("https://blocked.example/page", { ...BASE, enabled: false })).toBe(false);
    expect(isBlocked("https://blocked.example/page", { ...BASE, blocklist: [] })).toBe(false);
  });

  it("filters and reports the number excluded", () => {
    const results = [
      { url: "https://blocked.example/1" },
      { url: "https://ok.example/2" },
      { url: "https://a.wild.example/3" },
      { url: undefined },
    ];
    const { kept, blocked } = filterBlocked(results, BASE);
    expect(blocked).toBe(2);
    expect(kept.map((r) => r.url)).toEqual(["https://ok.example/2", undefined]);
  });
});

describe("source-quality ordering (REQ-020h)", () => {
  it("scores primary and trusted domains above neutral, low-quality below", () => {
    expect(qualityScore("https://agency.gov/report", BASE)).toBe(1);
    expect(qualityScore("https://www.nature.com/article", BASE)).toBe(0.6);
    expect(qualityScore("https://contentfarm.example/x", BASE)).toBe(-1);
    expect(qualityScore("https://news.example/x", BASE)).toBe(0);
  });

  it("returns zero when disabled or the URL is invalid", () => {
    expect(qualityScore("https://agency.gov/report", { ...BASE, enabled: false })).toBe(0);
    expect(qualityScore("not a url", BASE)).toBe(0);
  });
});
