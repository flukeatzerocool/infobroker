// @implements REQ-021c date-determinable REQ-021c date-absent
import { describe, it, expect } from "vitest";
import { detectDocumentDate } from "./datetime.js";

describe("detectDocumentDate (REQ-021c)", () => {
  it("reads a last-modified header as high-confidence", () => {
    const r = detectDocumentDate("<html></html>", { "last-modified": "Wed, 12 Mar 2025 10:00:00 GMT" });
    expect(r).toBeDefined();
    expect(r!.source).toBe("header");
    expect(r!.confidence).toBe("high");
    expect(r!.kind).toBe("modified");
    expect(r!.date).toMatch(/^2025-03-1/);
  });

  it("reads an article:modified_time meta tag", () => {
    const html = '<html><head><meta property="article:modified_time" content="2025-05-06T14:30:00Z"></head></html>';
    const r = detectDocumentDate(html);
    expect(r!.source).toBe("meta");
    expect(r!.kind).toBe("modified");
    expect(r!.date).toBe("2025-05-06");
  });

  it("reads JSON-LD dateModified", () => {
    const html = '<html><head><script type="application/ld+json">{"datePublished":"2024-01-01","dateModified":"2025-06-07"}</script></head></html>';
    const r = detectDocumentDate(html);
    expect(r!.source).toBe("jsonld");
    expect(r!.kind).toBe("modified");
    expect(r!.date).toBe("2025-06-07");
  });

  it("classifies a publication-only page as published evidence (F-R4-C-2)", () => {
    const html = '<html><head><meta property="article:published_time" content="2024-03-05T10:00:00Z"></head></html>';
    const r = detectDocumentDate(html);
    expect(r!.kind).toBe("published");
    expect(r!.confidence).toBe("medium");
    expect(r!.date).toBe("2024-03-05");
  });

  it("classifies JSON-LD datePublished as published evidence (F-R4-C-2)", () => {
    const html = '<html><head><script type="application/ld+json">{"datePublished":"2023-11-02"}</script></head></html>';
    const r = detectDocumentDate(html);
    expect(r!.kind).toBe("published");
    expect(r!.date).toBe("2023-11-02");
  });

  it("prefers modification evidence when a page carries both", () => {
    const html =
      '<html><head><meta property="article:published_time" content="2024-03-05T10:00:00Z">' +
      '<meta property="og:updated_time" content="2025-07-09T08:00:00Z"></head></html>';
    const r = detectDocumentDate(html);
    expect(r!.kind).toBe("modified");
    expect(r!.date).toBe("2025-07-09");
    expect(r!.confidence).toBe("high");
  });

  it("reports an ambiguous time tag as low-confidence published evidence", () => {
    const html = '<html><body><time datetime="2023-01-02">posted</time></body></html>';
    const r = detectDocumentDate(html);
    expect(r!.kind).toBe("published");
    expect(r!.confidence).toBe("low");
    expect(r!.date).toBe("2023-01-02");
  });

  it("returns undefined when no date is determinable", () => {
    const r = detectDocumentDate("<html><head></head><body>no dates here</body></html>", {});
    expect(r).toBeUndefined();
  });
});
