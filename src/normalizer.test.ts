// @implements REQ-073 REQ-003
import { describe, it, expect } from "vitest";
import { normalize, normalizeUrl } from "./normalizer.js";

describe("normalize minimum viable result (REQ-073)", () => {
  it("discards results with an empty URL", () => {
    const out = normalize(
      [
        { title: "kept", url: "https://example.com/kept", snippet: "text" },
        { title: "dropped", url: "", snippet: "text" },
        { title: "also dropped" },
      ],
      "test"
    );
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("https://example.com/kept");
  });

  it("preserves the provider result count for downstream max_results", () => {
    const raw = Array.from({ length: 5 }, (_, i) => ({
      title: `r${i}`,
      url: i < 2 ? `https://example.com/${i}` : "",
    }));
    expect(normalize(raw, "test")).toHaveLength(2);
  });

  it("applies provider-specific field overrides (REQ-003)", () => {
    const out = normalize([{ title: "T", url: "https://example.com/x", extract: "wikipedia body" }], "wikipedia");
    expect(out[0].snippet).toBe("wikipedia body");
  });

  it("keeps a provider-supplied Wikipedia snippet", () => {
    const out = normalize([{ title: "T", url: "https://example.com/x", snippet: "the real snippet", extract: "body" }], "wikipedia");
    expect(out[0].snippet).toBe("the real snippet");
  });

  it("makes scheme-less result URLs absolute (REQ-020/REQ-028)", () => {
    expect(normalizeUrl("example.com/a")).toBe("https://example.com/a");
    expect(normalizeUrl("//example.com/a")).toBe("https://example.com/a");
    expect(normalizeUrl("http://example.com/a")).toBe("http://example.com/a");
    const out = normalize([{ title: "T", url: "example.com/a", snippet: "s" }], "duckduckgo");
    expect(out[0].url).toBe("https://example.com/a");
  });

  it("discards non-http(s) and unparseable URLs", () => {
    expect(normalizeUrl("file:///etc/passwd")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });

  it("passes scholarly metadata through when supplied (REQ-003)", () => {
    const out = normalize(
      [
        {
          title: "A Paper",
          url: "https://example.com/paper",
          snippet: "abstract text",
          doi: "10.1234/ABC",
          authors: ["Ada Lovelace", "", 7],
          venue: "Journal of Things",
          abstract: "abstract text",
          citation_count: 42,
        },
      ],
      "openalex"
    );
    expect(out[0].doi).toBe("10.1234/ABC");
    expect(out[0].authors).toEqual(["Ada Lovelace"]);
    expect(out[0].venue).toBe("Journal of Things");
    expect(out[0].abstract).toBe("abstract text");
    expect(out[0].citation_count).toBe(42);
  });

  it("omits absent scholarly metadata instead of adding empty fields (REQ-003)", () => {
    const out = normalize([{ title: "T", url: "https://example.com/x", snippet: "s" }], "duckduckgo");
    expect(out[0]).not.toHaveProperty("doi");
    expect(out[0]).not.toHaveProperty("authors");
    expect(out[0]).not.toHaveProperty("venue");
    expect(out[0]).not.toHaveProperty("abstract");
    expect(out[0]).not.toHaveProperty("citation_count");
  });
});
