// @implements REQ-021c date-determinable REQ-021c date-absent
import { describe, it, expect } from "vitest";
import { detectUpdatedAt } from "./datetime.js";

describe("detectUpdatedAt (REQ-021c)", () => {
  it("reads a last-modified header as high-confidence", () => {
    const r = detectUpdatedAt("<html></html>", { "last-modified": "Wed, 12 Mar 2025 10:00:00 GMT" });
    expect(r).toBeDefined();
    expect(r!.source).toBe("header");
    expect(r!.confidence).toBe("high");
    expect(r!.date).toMatch(/^2025-03-1/);
  });

  it("reads an article:modified_time meta tag", () => {
    const html = '<html><head><meta property="article:modified_time" content="2025-05-06T14:30:00Z"></head></html>';
    const r = detectUpdatedAt(html);
    expect(r!.source).toBe("meta");
    expect(r!.date).toBe("2025-05-06");
  });

  it("reads JSON-LD dateModified", () => {
    const html = '<html><head><script type="application/ld+json">{"datePublished":"2024-01-01","dateModified":"2025-06-07"}</script></head></html>';
    const r = detectUpdatedAt(html);
    expect(r!.source).toBe("jsonld");
    expect(r!.date).toBe("2025-06-07");
  });

  it("returns undefined when no date is determinable", () => {
    const r = detectUpdatedAt("<html><head></head><body>no dates here</body></html>", {});
    expect(r).toBeUndefined();
  });
});
