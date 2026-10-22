// @implements REQ-021 REQ-071
import { describe, it, expect } from "vitest";
import { htmlToText, stripHtml } from "./html.js";

describe("htmlToText", () => {
  it("returns plain text unchanged", () => {
    expect(htmlToText("hello world")).toBe("hello world");
  });

  it("removes tags and collapses whitespace", () => {
    expect(htmlToText("<p>Hello   <b>world</b></p>")).toBe("Hello world");
  });

  it("drops script and style content instead of leaking it as text", () => {
    const html = "<html><head><style>.a{color:red}</style><script>var x=1;</script></head><body><p>Body text</p></body></html>";
    expect(htmlToText(html)).toBe("Body text");
  });

  it("decodes entities", () => {
    expect(htmlToText("<p>a &amp; b &quot;c&quot;</p>")).toBe('a & b "c"');
  });

  it("keeps stripHtml as a compatible wrapper", () => {
    expect(stripHtml("<div><span>fallback</span></div>")).toBe("fallback");
  });
});
