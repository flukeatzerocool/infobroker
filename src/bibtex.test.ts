// @implements REQ-027
import { describe, it, expect } from "vitest";
import { citationFor, formatBibtex } from "./bibtex.js";

describe("formatBibtex / citationFor (REQ-027)", () => {
  it("formats an article with authors, year, and venue", () => {
    const bib = citationFor("A Great Paper", ["Doe, Jane", "Roe, Richard"], "2024", "Journal of Things", "https://example.org/x");
    expect(bib).toContain("@article{");
    expect(bib).toContain("title = {A Great Paper}");
    expect(bib).toContain("author = {Doe, Jane and Roe, Richard}");
    expect(bib).toContain("year = {2024}");
    expect(bib).toContain("journal = {Journal of Things}");
    expect(bib).toContain("url = {https://example.org/x}");
  });

  it("falls back to @misc when there are no authors", () => {
    const bib = citationFor("Anonymous Work", [], "2024", undefined, "https://example.org/y");
    expect(bib).toContain("@misc{");
    expect(bib).not.toContain("author =");
  });

  it("escapes LaTeX special characters in the title", () => {
    const bib = formatBibtex({ type: "article", key: "k", title: "100% & $Done", authors: [] });
    expect(bib).toContain("100\\% \\& \\$Done");
  });
});
