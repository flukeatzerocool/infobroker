// @implements REQ-021i wikidata-claim wikipedia-infobox wikipedia-table not-found
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  detectFactKind,
  entityQuery,
  enrichStructuredFacts,
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
