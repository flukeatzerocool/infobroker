// @implements REQ-021i wikidata-claim wikipedia-infobox wikipedia-table not-found
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  detectFactKind,
  entityQuery,
  enrichStructuredFacts,
  unitLabel,
  wikipediaFacts,
} from "./structured-fact.js";

const mockFetch = vi.fn(async (_url: string): Promise<Response> => new Response("{}", { status: 200 }));

vi.mock("./http.js", () => ({
  infobrokerFetch: (url: string) => mockFetch(url),
}));
vi.mock("./rate-limiter.js", () => ({ throttle: async () => {} }));
vi.mock("./cooldown.js", () => ({ inCooldown: () => false }));

const INFOBOX_HTML = `<table class="infobox"><tbody>
  <tr><th>Attendance</th><td>20,593</td></tr>
  <tr><th>Venue</th><td>Molson Centre</td></tr>
</tbody></table><p>Survivor Series was a professional wrestling pay-per-view event.</p>`;

const PARSE_BODY = JSON.stringify({ parse: { text: { "*": INFOBOX_HTML } } });

function claimsBody(claims: unknown): string {
  return JSON.stringify({ claims });
}

describe("structured-fact detection (REQ-021i)", () => {
  it("detects measurable attributes and ignores ordinary queries", () => {
    expect(detectFactKind("Survivor Series 1997 attendance")).toBe("attendance");
    expect(detectFactKind("population of Austin")).toBe("population");
    expect(detectFactKind("what percent of Americans trust news")).toBe("percentage");
    expect(detectFactKind("what date did the Montreal Screwjob happen")).toBe("date");
    expect(detectFactKind("best pizza in Chicago")).toBeNull();
  });

  it("detects birth and death date questions", () => {
    expect(detectFactKind("when was Ada Lovelace born")).toBe("date");
    expect(detectFactKind("when did Ada Lovelace die")).toBe("date");
    expect(detectFactKind("death toll of the earthquake")).toBeNull();
    expect(detectFactKind("birthplace of Ada Lovelace")).toBeNull();
  });

  it("strips a leading preposition from the entity query", () => {
    expect(entityQuery("population of Austin")).toBe("Austin");
    expect(entityQuery("the population of Austin")).toBe("Austin");
    expect(entityQuery("population of The Hague")).toBe("The Hague");
    expect(entityQuery("when was Ada Lovelace born")).toBe("Ada Lovelace");
  });

  it("removes the dimension words before the entity lookup", () => {
    expect(entityQuery("Survivor Series 1997 attendance")).toBe("Survivor Series 1997");
    expect(entityQuery("what percent of Americans trust news")).toContain("Americans trust news");
  });
});

describe("structured-fact resolution (REQ-021i)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("resolves a Wikidata quantity claim with unit and as-of date", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("wbgetclaims")) {
        return new Response(
          claimsBody({
            P1110: [
              {
                rank: "normal",
                mainsnak: { datavalue: { value: { amount: "+20593", unit: "http://www.wikidata.org/entity/Q5" } } },
                qualifiers: { P585: [{ datavalue: { value: { time: "+1997-11-09T00:00:00Z" } } }] },
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });

    const result = await enrichStructuredFacts("Survivor Series 1997 attendance", {
      results: [
        { title: "Survivor Series", url: "https://www.wikidata.org/wiki/Q80695", snippet: "" },
      ],
    });
    expect(result?.fact_status).toBe("resolved");
    expect(result?.facts[0]).toMatchObject({
      kind: "attendance",
      value: 20593,
      display: "20,593",
      unit: "people",
      property: "P1110",
      as_of: "1997-11-09",
      source: "wikidata",
    });
  });

  it("falls back to the Wikipedia infobox when Wikidata has no claim", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("wbgetclaims")) return new Response(claimsBody({}), { status: 200 });
      if (url.includes("action=parse")) return new Response(PARSE_BODY, { status: 200 });
      return new Response("{}", { status: 200 });
    });

    const result = await enrichStructuredFacts("Survivor Series 1997 attendance", {
      results: [
        { title: "Survivor Series", url: "https://www.wikidata.org/wiki/Q80695", snippet: "" },
        { title: "Survivor Series (1997)", url: "https://en.wikipedia.org/wiki/Survivor_Series_(1997)", snippet: "" },
      ],
    });
    expect(result?.fact_status).toBe("resolved");
    expect(result?.facts[0]).toMatchObject({
      kind: "attendance",
      value: 20593,
      display: "20,593",
      source: "wikipedia",
    });
  });

  it("reports ambiguous when the page has two different values", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("action=parse")) {
        return new Response(
          JSON.stringify({
            parse: {
              text: {
                "*": `${INFOBOX_HTML}<table class="wikitable"><tr><th>Attendance</th><td>20,000</td></tr></table>`,
              },
            },
          }),
          { status: 200 }
        );
      }
      return new Response(claimsBody({}), { status: 200 });
    });

    const result = await wikipediaFacts("https://en.wikipedia.org/wiki/X", "attendance");
    expect(result.fact_status).toBe("ambiguous");
    expect(result.facts).toEqual([]);
  });

  it("reads a fact from a header-plus-data table", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          parse: {
            text: {
              "*": `<table class="wikitable"><tr><th>Attendance</th><th>Venue</th></tr><tr><td>17,000</td><td>Molson Centre</td></tr></table>`,
            },
          },
        }),
        { status: 200 }
      )
    );
    const result = await wikipediaFacts("https://en.wikipedia.org/wiki/X", "attendance");
    expect(result.fact_status).toBe("resolved");
    expect(result.facts[0]).toMatchObject({ value: 17000, display: "17,000", source: "wikipedia" });
  });

  it("reports ambiguous when a multi-row table has several values", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          parse: {
            text: {
              "*": `<table class="wikitable"><tr><th>Year</th><th>Attendance</th></tr><tr><td>1996</td><td>17,000</td></tr><tr><td>1997</td><td>20,593</td></tr></table>`,
            },
          },
        }),
        { status: 200 }
      )
    );
    const result = await wikipediaFacts("https://en.wikipedia.org/wiki/X", "attendance");
    expect(result.fact_status).toBe("ambiguous");
    expect(result.facts).toEqual([]);
  });

  it("reports not_found when no row matches", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(JSON.stringify({ parse: { text: { "*": "<p>no table</p>" } } }), { status: 200 })
    );
    const result = await enrichStructuredFacts("population of Austin", {
      results: [{ title: "Austin", url: "https://en.wikipedia.org/wiki/Austin,_Texas", snippet: "" }],
    });
    expect(result?.fact_status).toBe("not_found");
    expect(result?.facts).toEqual([]);
  });

  it("returns a percentage value with its unit", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          parse: {
            text: { "*": `<table class="infobox"><tr><th>Share</th><td>25%</td></tr></table>` },
          },
        }),
        { status: 200 }
      )
    );
    const result = await wikipediaFacts("https://en.wikipedia.org/wiki/Trust", "percentage");
    expect(result.fact_status).toBe("resolved");
    expect(result.facts[0]).toMatchObject({ kind: "percentage", value: 25, unit: "%", display: "25%" });
  });

  it("maps every known Wikidata unit QID and omits an unknown one", () => {
    const UNIT_QIDS: Array<[string, string]> = [
      ["Q5", "people"],
      ["Q712226", "km²"],
      ["Q25343", "m²"],
      ["Q35852", "ha"],
      ["Q11573", "m"],
      ["Q3710", "ft"],
    ];
    for (const [qid, label] of UNIT_QIDS) {
      expect(unitLabel(`http://www.wikidata.org/entity/${qid}`)).toBe(label);
    }
    expect(unitLabel("http://www.wikidata.org/entity/Q999999")).toBeUndefined();
    expect(unitLabel(undefined)).toBeUndefined();
  });

  it("emits the unit for a Wikidata area claim", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("wbgetclaims")) {
        return new Response(
          claimsBody({
            P2046: [
              {
                rank: "normal",
                mainsnak: {
                  datavalue: { value: { amount: "+2.5", unit: "http://www.wikidata.org/entity/Q712226" } },
                },
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });

    const result = await enrichStructuredFacts("area of Testville", {
      results: [{ title: "Testville", url: "https://www.wikidata.org/wiki/Q100", snippet: "" }],
    });
    expect(result?.fact_status).toBe("resolved");
    expect(result?.facts[0]).toMatchObject({ kind: "area", value: 2.5, unit: "km²", property: "P2046" });
  });

  it("emits the unit for a Wikidata elevation claim", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("wbgetclaims")) {
        return new Response(
          claimsBody({
            P2044: [
              {
                rank: "normal",
                mainsnak: {
                  datavalue: { value: { amount: "+1234", unit: "http://www.wikidata.org/entity/Q11573" } },
                },
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });

    const result = await enrichStructuredFacts("elevation of Testville", {
      results: [{ title: "Testville", url: "https://www.wikidata.org/wiki/Q100", snippet: "" }],
    });
    expect(result?.fact_status).toBe("resolved");
    expect(result?.facts[0]).toMatchObject({ kind: "elevation", value: 1234, unit: "m", property: "P2044" });
  });

  it("omits the unit for an unmapped Wikidata unit", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("wbgetclaims")) {
        return new Response(
          claimsBody({
            P2046: [
              {
                rank: "normal",
                mainsnak: { datavalue: { value: { amount: "+3", unit: "http://www.wikidata.org/entity/Q999999" } } },
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });

    const result = await enrichStructuredFacts("area of Testville", {
      results: [{ title: "Testville", url: "https://www.wikidata.org/wiki/Q100", snippet: "" }],
    });
    expect(result?.facts[0]).not.toHaveProperty("unit");
  });

  it("reads the unit next to the value in a Wikipedia area row", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          parse: {
            text: { "*": `<table class="infobox"><tr><th>Area</th><td>12.5 km2 (4.8 sq mi)</td></tr></table>` },
          },
        }),
        { status: 200 }
      )
    );
    const result = await wikipediaFacts("https://en.wikipedia.org/wiki/Testville", "area");
    expect(result.facts[0]).toMatchObject({ kind: "area", value: 12.5, unit: "km²" });
  });

  it("reads the unit next to the value in a Wikipedia elevation row", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          parse: {
            text: { "*": `<table class="infobox"><tr><th>Elevation</th><td>1,234 m (4,049 ft)</td></tr></table>` },
          },
        }),
        { status: 200 }
      )
    );
    const result = await wikipediaFacts("https://en.wikipedia.org/wiki/Testville", "elevation");
    expect(result.facts[0]).toMatchObject({ kind: "elevation", value: 1234, unit: "m" });
  });

  it("resolves a birth date from a Wikidata P569 claim", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("wbgetclaims")) {
        return new Response(
          claimsBody({
            P569: [
              {
                rank: "normal",
                mainsnak: { datavalue: { value: { time: "+1815-12-10T00:00:00Z" } } },
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });

    const result = await enrichStructuredFacts("when was Ada Lovelace born", {
      results: [{ title: "Ada Lovelace", url: "https://www.wikidata.org/wiki/Q7259", snippet: "" }],
    });
    expect(result?.fact_status).toBe("resolved");
    expect(result?.facts[0]).toMatchObject({ kind: "date", display: "1815-12-10", property: "P569" });
  });

  it("resolves a death date from a Wikidata P570 claim", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("wbgetclaims")) {
        return new Response(
          claimsBody({
            P570: [
              {
                rank: "normal",
                mainsnak: { datavalue: { value: { time: "+1852-11-27T00:00:00Z" } } },
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });

    const result = await enrichStructuredFacts("when did Ada Lovelace die", {
      results: [{ title: "Ada Lovelace", url: "https://www.wikidata.org/wiki/Q7259", snippet: "" }],
    });
    expect(result?.fact_status).toBe("resolved");
    expect(result?.facts[0]).toMatchObject({ kind: "date", display: "1852-11-27", property: "P570" });
  });

  it("does not let a point-in-time claim answer a birth query", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("wbgetclaims")) {
        return new Response(
          claimsBody({
            P585: [
              {
                rank: "normal",
                mainsnak: { datavalue: { value: { time: "+1900-01-01T00:00:00Z" } } },
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });

    const result = await enrichStructuredFacts("when was Ada Lovelace born", {
      results: [{ title: "Ada Lovelace", url: "https://www.wikidata.org/wiki/Q7259", snippet: "" }],
    });
    expect(result?.fact_status).toBe("not_found");
  });

  it("resolves a birth date from a Wikipedia Born row", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          parse: { text: { "*": `<table class="infobox"><tr><th>Born</th><td>10 December 1815</td></tr></table>` } },
        }),
        { status: 200 }
      )
    );
    const result = await wikipediaFacts("https://en.wikipedia.org/wiki/Ada_Lovelace", "date");
    expect(result.fact_status).toBe("resolved");
    expect(result.facts[0]).toMatchObject({ kind: "date", display: "10 December 1815" });
  });

  it("does not read a Birth place row as a date", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          parse: {
            text: { "*": `<table class="infobox"><tr><th>Birth place</th><td>London, England</td></tr></table>` },
          },
        }),
        { status: 200 }
      )
    );
    const result = await wikipediaFacts("https://en.wikipedia.org/wiki/Ada_Lovelace", "date");
    expect(result.fact_status).toBe("not_found");
    expect(result.facts).toEqual([]);
  });

  it("returns null when the query names no measurable attribute", async () => {
    expect(await enrichStructuredFacts("best pizza in Chicago", { results: [] })).toBeNull();
  });

  it("degrades to unavailable when the provider throws", async () => {
    mockFetch.mockImplementation(async () => {
      throw new Error("network down");
    });
    const result = await enrichStructuredFacts("Survivor Series 1997 attendance", {
      results: [{ title: "Survivor Series", url: "https://en.wikipedia.org/wiki/X", snippet: "" }],
    });
    expect(result?.fact_status).toBe("unavailable");
  });
});
