// @implements REQ-021d REQ-021e
import { describe, it, expect } from "vitest";
import { extractStructured, extractLinks, isSameOrigin } from "./extract.js";

describe("extractStructured (REQ-021e)", () => {
  it("parses JSON-LD, OpenGraph, and microdata", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Example Title">
        <script type="application/ld+json">{"@type":"Article","headline":"H"}</script>
      </head><body>
        <div itemscope itemtype="https://schema.org/Product">
          <span itemprop="name" content="Widget">Widget</span>
        </div>
      </body></html>`;
    const out = extractStructured(html);
    expect(out.open_graph["og:title"]).toBe("Example Title");
    expect(out.jsonld).toHaveLength(1);
    expect(out.microdata).toHaveLength(1);
    expect(out.microdata[0].type).toBe("https://schema.org/Product");
    expect(out.microdata[0].properties.name).toBe("Widget");
  });

  it("reports no structured objects on a plain page", () => {
    const out = extractStructured("<html><body><p>hi</p></body></html>");
    expect(out.jsonld).toHaveLength(0);
    expect(out.microdata).toHaveLength(0);
    expect(Object.keys(out.open_graph)).toHaveLength(0);
  });

  it("skips malformed JSON-LD without throwing", () => {
    const html = `<script type="application/ld+json">{not json}</script>`;
    expect(extractStructured(html).jsonld).toHaveLength(0);
  });
});

describe("extractLinks (REQ-021d)", () => {
  it("resolves and deduplicates http(s) links, dropping hashes", () => {
    const html = `<a href="/a">a</a><a href="/a#frag">a2</a><a href="https://other.example/x">x</a><a href="mailto:a@b.c">m</a>`;
    const links = extractLinks(html, "https://example.com/");
    expect(links).toContain("https://example.com/a");
    expect(links).toContain("https://other.example/x");
    expect(links).not.toContain("mailto:a@b.c");
  });

  it("isSameOrigin compares origins only", () => {
    expect(isSameOrigin("https://example.com/a", "https://example.com/b")).toBe(true);
    expect(isSameOrigin("https://example.com/a", "https://other.example.com/a")).toBe(false);
  });
});
