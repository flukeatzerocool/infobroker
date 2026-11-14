// @implements REQ-021d same-origin-link-discovery
// @implements REQ-021e json-ld
// @implements REQ-021e opengraph
// @implements REQ-021e microdata
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

  it("attaches a nested item's properties to the nested item, not its parent", () => {
    // F-R4-C-11: a nested itemscope declares its own properties. Flattening
    // them onto the parent reports the author's name as the product's.
    const html = `
      <html><body>
        <div itemscope itemtype="https://schema.org/Product">
          <span itemprop="name" content="Widget">Widget</span>
          <span itemprop="brand" content="Acme">Acme</span>
          <div itemscope itemtype="https://schema.org/Person">
            <span itemprop="name" content="Ada Lovelace">Ada Lovelace</span>
            <span itemprop="email" content="ada@example.com">ada@example.com</span>
          </div>
        </div>
      </body></html>`;
    const out = extractStructured(html);

    expect(out.microdata).toHaveLength(2);
    const product = out.microdata.find((item) => item.type.endsWith("Product"))!;
    const person = out.microdata.find((item) => item.type.endsWith("Person"))!;
    expect(product.properties.name).toBe("Widget");
    expect(product.properties.brand).toBe("Acme");
    expect(product.properties.email).toBeUndefined();
    expect(person.properties.name).toBe("Ada Lovelace");
    expect(person.properties.email).toBe("ada@example.com");
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
