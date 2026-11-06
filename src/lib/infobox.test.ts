// @implements REQ-021i wikipedia-infobox wikipedia-table
import { describe, it, expect } from "vitest";
import { parseInfobox, parseTables } from "./infobox.js";

const HTML = `
<table class="infobox">
  <tbody>
    <tr><th colspan="2" class="infobox-above">Survivor Series</th></tr>
    <tr><th>Promotion</th><td>World Wrestling Federation</td></tr>
    <tr><th>Date</th><td>November 9, 1997<sup class="reference">[1]</sup></td></tr>
    <tr><th>Attendance</th><td>20,593</td></tr>
    <tr><th>Venue</th><td>Molson Centre</td></tr>
  </tbody>
</table>
<table class="wikitable sortable">
  <tbody>
    <tr><th>Attendance</th><td>18,000</td></tr>
    <tr><th>Venue</th><td>Molson Centre</td></tr>
    <tr><td>1996</td><td>17,000</td></tr>
  </tbody>
</table>
`;

const REAL_TABLE_HTML = `
<table class="wikitable sortable">
  <tbody>
    <tr><th>Year</th><th>Attendance</th><th>Venue</th></tr>
    <tr><td>1996</td><td>17,000</td><td>Molson Centre</td></tr>
    <tr><td>1997</td><td>20,593</td><td>Molson Centre</td></tr>
  </tbody>
</table>
`;

describe("infobox parsing (REQ-021i)", () => {
  it("keeps infobox key/value rows and strips footnote markers", () => {
    const rows = parseInfobox(HTML);
    expect(rows).toContainEqual({ key: "Attendance", value: "20,593" });
    expect(rows).toContainEqual({ key: "Date", value: "November 9, 1997" });
    expect(rows.find((row) => row.key === "Promotion")?.value).toBe("World Wrestling Federation");
  });

  it("skips section headers with no value cell", () => {
    const rows = parseInfobox(HTML);
    expect(rows.every((row) => row.value.length > 0)).toBe(true);
    expect(rows.find((row) => row.key === "Survivor Series")).toBeUndefined();
  });

  it("reads key/value rows from wikitables", () => {
    const rows = parseTables(HTML);
    expect(rows).toContainEqual({ key: "Attendance", value: "18,000" });
    // Numeric-only first cells are data, not a dimension key.
    expect(rows.some((row) => row.key === "1996")).toBe(false);
  });

  it("zips a header row with its data rows", () => {
    const rows = parseTables(REAL_TABLE_HTML);
    expect(rows).toContainEqual({ key: "Attendance", value: "17,000" });
    expect(rows).toContainEqual({ key: "Attendance", value: "20,593" });
    expect(rows).toContainEqual({ key: "Venue", value: "Molson Centre" });
  });

  it("does not turn the header row into a key/value row", () => {
    const rows = parseTables(REAL_TABLE_HTML);
    expect(rows.some((row) => row.key === "Year" && /Attendance/.test(row.value))).toBe(false);
  });

  it("skips a data row whose cell count does not match the header", () => {
    const html = `<table class="wikitable"><tbody>
      <tr><th rowspan="2">Year</th><th>Attendance</th></tr>
      <tr><td>17,000</td></tr>
    </tbody></table>`;
    expect(parseTables(html)).toEqual([]);
  });

  it("returns no rows for a page without tables", () => {
    expect(parseInfobox("<p>plain prose</p>")).toEqual([]);
    expect(parseTables("<p>plain prose</p>")).toEqual([]);
  });
});
