// @implements REQ-127 topics
// @implements REQ-127 entities
// @implements REQ-127 clusters
// @implements REQ-127 timeline
// @implements REQ-127 no-results
import { describe, it, expect } from "vitest";
import type { SearchResult } from "./types.js";
import {
  analyzeResults,
  extractTopics,
  extractEntities,
  clusterResults,
  buildTimeline,
} from "./analysis.js";

const RESULTS: SearchResult[] = [
  {
    title: "Electric vehicles reduce urban emissions",
    url: "https://example.com/ev",
    snippet: "Battery electric cars lower carbon emissions in cities as reported 2026-03-04.",
    published_date: "2026-03-04",
    source_type: "news",
  },
  {
    title: "Battery cars and urban air quality",
    url: "https://news.example.org/air",
    snippet: "Electric cars improve urban emissions and air quality.",
    published_date: "20260305",
    source_type: "news",
  },
  {
    title: "Bananas are a tropical fruit",
    url: "https://fruit.example.net/banana",
    snippet: "Bananas contain natural sugars and fiber.",
    source_type: "encyclopedia",
  },
];

describe("analysis topics", () => {
  it("ranks frequent, distinctive terms and maps them to results", () => {
    const topics = extractTopics(RESULTS, { max_topics: 5 });
    expect(topics.length).toBeGreaterThan(0);
    expect(topics.length).toBeLessThanOrEqual(5);
    expect(topics.map((t) => t.term)).toContain("electric");
    const electric = topics.find((t) => t.term === "electric")!;
    expect(electric.results).toEqual([0, 1]);
    expect(electric.score).toBeGreaterThan(0);
  });
});

describe("analysis entities", () => {
  it("extracts proper nouns, domains, and dates", () => {
    const entities = extractEntities(RESULTS, { max_entities: 20 });
    const domains = entities.filter((e) => e.kind === "domain").map((e) => e.text);
    expect(domains).toContain("example.com");
    expect(domains).toContain("news.example.org");
    expect(entities.some((e) => e.kind === "date" && e.text === "2026-03-04")).toBe(true);
    expect(entities.length).toBeLessThanOrEqual(20);
  });
});

describe("analysis clusters", () => {
  it("groups near-duplicate results without dropping them", () => {
    const pair: SearchResult[] = [
      { title: "Electric vehicles cut urban emissions", url: "https://a.example/1", snippet: "Electric vehicles cut urban carbon emissions." },
      { title: "Electric vehicles cut urban emissions", url: "https://b.example/2", snippet: "Electric vehicles cut urban carbon emissions significantly." },
      { title: "Bananas are a tropical fruit", url: "https://c.example/3", snippet: "Bananas contain natural sugars and fiber." },
    ];
    const clusters = clusterResults(pair, { cluster_threshold: 0.5, min_cluster_size: 2 });
    expect(clusters.length).toBe(1);
    expect(clusters[0].members).toEqual([0, 1]);
    const grouped = clusters.reduce((sum, c) => sum + c.members.length, 0);
    expect(grouped).toBeLessThanOrEqual(pair.length);
  });

  it("returns no clusters for a single result", () => {
    expect(clusterResults([RESULTS[0]], {})).toEqual([]);
  });
});

describe("analysis timeline", () => {
  it("orders dated results chronologically and counts undated ones", () => {
    const timeline = buildTimeline(RESULTS, {});
    expect(timeline.dated.map((e) => e.date)).toEqual(["2026-03-04", "2026-03-05"]);
    expect(timeline.dated[1].precision).toBe("day");
    expect(timeline.undated).toBe(1);
  });

  it("does not invent a date for undated results", () => {
    const timeline = buildTimeline([RESULTS[2]], {});
    expect(timeline.dated).toEqual([]);
    expect(timeline.undated).toBe(1);
  });
});

describe("analysis empty state", () => {
  it("returns empty sections rather than fabricating output", () => {
    expect(analyzeResults([], {})).toEqual({
      topics: [],
      entities: [],
      clusters: [],
      timeline: { dated: [], undated: 0 },
    });
  });
});
