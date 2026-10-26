// @implements REQ-116
// HTML rendering for validated reports: the title is derived from the report
// heading and the manifest/source table survive into the rendered document.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderReportHtml, extractTitle } from "./lib/report-render.js";

const FIXTURES = join(import.meta.dirname, "..", "test-fixtures", "reports");

describe("report rendering", () => {
  const markdown = readFileSync(join(FIXTURES, "good-report.md"), "utf-8");

  it("derives the title from the first level-one heading", () => {
    expect(extractTitle(markdown)).toBe("Fixture Report");
  });

  it("renders a self-contained HTML document with the evidence table", () => {
    const html = renderReportHtml(markdown);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Fixture Report</title>");
    expect(html).toContain("<table>");
    expect(html).toContain("https://example.com/bridge-inspection");
    expect(html).toContain("</html>");
  });
});
