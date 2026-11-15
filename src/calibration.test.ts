// @implements REQ-123
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCalibrationReport, capConfidence, brierScore, reliabilityCurve, isSecondaryOnly, parseGoldSet } from "./calibration.js";
import { computeConfidence } from "./corroborate.js";

const ROOT = join(import.meta.dirname, "..");
const FIXTURE = join(ROOT, "test-fixtures", "calibration", "gold.json");

describe("confidence calibration (REQ-123)", () => {
  it("caps secondary-only evidence", () => {
    expect(capConfidence(1.0, [{ source_type: "web_search" }, { source_type: "news" }], {
      enabled: true,
      secondaryOnlyCap: 0.7,
    })).toBe(0.7);
  });

  it("does not cap primary or mixed evidence", () => {
    expect(capConfidence(0.9, [{ source_type: "academic" }], { enabled: true, secondaryOnlyCap: 0.7 })).toBe(0.9);
    expect(capConfidence(0.9, [{ source_type: "web_search" }, { source_type: "encyclopedia" }], {
      enabled: true,
      secondaryOnlyCap: 0.7,
    })).toBe(0.9);
  });

  it("does not treat unknown source types as secondary", () => {
    expect(isSecondaryOnly([{ source_type: undefined }])).toBe(false);
  });

  it("computes Brier score and reliability buckets", () => {
    expect(brierScore([])).toBe(0);
    expect(brierScore([{ confidence: 1, correct: true }, { confidence: 0, correct: false }])).toBe(0);
    const curve = reliabilityCurve([
      { confidence: 0.9, correct: true },
      { confidence: 0.65, correct: false },
    ]);
    expect(curve.find((b) => b.band === "0.9-1.0")?.count).toBe(1);
    expect(curve.find((b) => b.band === "0.5-0.7")?.observedRate).toBe(0);
  });
});

// The shipped authority map, hardcoded on purpose: the numeric assertions must
// not read config.json, or a wrong constant would produce a self-consistent
// curve that no test can catch. The drift guard below reconciles this map
// against the shipped config separately.
const SHIPPED_WEIGHTS = {
  academic: 1.0,
  encyclopedia: 1.0,
  archive: 1.0,
  structured_fact: 1.0,
  definition: 1.0,
  location: 1.0,
  code: 0.9,
  semantic: 0.9,
  synthesis: 0.9,
  news: 0.8,
  web_search: 0.7,
};

// @implements REQ-026a
describe("calibration report under the authority adjustment", () => {

  it("applies the adjustment and the cap to each gold row", () => {
    const report = buildCalibrationReport(
      [
        { id: "x", confidence: 0.7, correct: true, sources: ["web_search", "news"] },
        { id: "y", confidence: 0.9, correct: false, sources: ["academic", "encyclopedia", "web_search"] },
      ],
      SHIPPED_WEIGHTS,
    );
    expect(report.entries).toBe(2);
    expect(report.rows[0]).toEqual({ id: "x", raw: 0.7, adjusted: 0.65625, correct: true });
    expect(report.rows[1]!.adjusted).toBeCloseTo(0.8775, 10);
    expect(report.brier_score).toBeCloseTo(0.44408515625, 10);
  });

  it("matches computeConfidence for a one-source-per-family set", () => {
    const report = buildCalibrationReport(
      [{ id: "m", confidence: 0.9, correct: true, sources: ["web_search", "encyclopedia", "academic"] }],
      SHIPPED_WEIGHTS,
    );
    const direct = computeConfidence(
      [
        { title: "a", url: "https://a.example/1", snippet: "x", source_type: "web_search" },
        { title: "b", url: "https://b.example/1", snippet: "x", source_type: "encyclopedia" },
        { title: "c", url: "https://c.example/1", snippet: "x", source_type: "academic" },
      ],
      SHIPPED_WEIGHTS,
    );
    expect(report.rows[0]!.adjusted).toBeCloseTo(direct, 10);
  });

  it("pins the ladder-to-reported values at the shipped weights", () => {
    const webFamilies = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        title: "w",
        url: `https://${i}.example/1`,
        snippet: "x",
        source_type: "web_search",
        source_family: `family-${i}`,
      }));
    expect(computeConfidence(webFamilies(1), SHIPPED_WEIGHTS)).toBeCloseTo(0.2775, 10);
    expect(computeConfidence(webFamilies(2), SHIPPED_WEIGHTS)).toBeCloseTo(0.6475, 10);
    expect(computeConfidence(webFamilies(3), SHIPPED_WEIGHTS)).toBeCloseTo(0.8325, 10);
  });
});

// @implements REQ-123
describe("committed gold set", () => {
  const parsed: unknown = JSON.parse(readFileSync(FIXTURE, "utf-8"));
  const entries = parseGoldSet(parsed, SHIPPED_WEIGHTS);
  const report = buildCalibrationReport(entries, SHIPPED_WEIGHTS, {
    enabled: true,
    secondaryOnlyCap: 0.7,
  });

  it("states a documented claim and a settling source on every row", () => {
    expect(report.entries).toBe(18);
    for (const entry of entries) {
      expect(entry.claim.length).toBeGreaterThan(0);
      expect(entry.label_basis).toBe("documented");
      expect(entry.truth_sources?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("populates every reliability band and both top-band outcomes", () => {
    for (const bucket of report.reliability) {
      expect(bucket.count).toBeGreaterThanOrEqual(2);
    }
    const top = report.rows.filter((row) => row.adjusted >= 0.9);
    expect(top.length).toBeGreaterThanOrEqual(2);
    expect(top.some((row) => row.correct)).toBe(true);
    expect(top.some((row) => !row.correct)).toBe(true);
  });

  it("locks the re-derived Brier score", () => {
    expect(report.brier_score).toBeCloseTo(0.2525, 4);
  });

  it("agrees with the shipped config", () => {
    const config = JSON.parse(readFileSync(join(ROOT, "config.json"), "utf-8")) as {
      corroboration?: {
        authority_weights?: Record<string, number>;
        calibration?: { enabled?: boolean; secondary_only_cap?: number };
      };
    };
    const weights = config.corroboration?.authority_weights ?? {};
    for (const type of new Set(entries.flatMap((entry) => entry.sources))) {
      expect(weights[type]).toBe(SHIPPED_WEIGHTS[type as keyof typeof SHIPPED_WEIGHTS]);
    }
    expect(config.corroboration?.calibration?.enabled).toBe(true);
    expect(config.corroboration?.calibration?.secondary_only_cap).toBe(0.7);
  });
});

// @implements REQ-123
describe("gold-set validation", () => {
  const validEntry = () => ({
    id: "x",
    claim: "A documented claim with a settling source.",
    confidence: 0.3,
    correct: true,
    sources: ["academic"],
    label_basis: "documented",
    truth_sources: ["https://example.org/claim"],
  });
  const withEntry = (patch: Record<string, unknown>) => ({
    version: 2,
    entries: [{ ...validEntry(), ...patch }],
  });

  it("accepts a well-formed set", () => {
    expect(parseGoldSet(withEntry({}), SHIPPED_WEIGHTS)).toHaveLength(1);
  });

  it("rejects a non-2 version", () => {
    expect(() => parseGoldSet({ ...withEntry({}), version: 1 }, SHIPPED_WEIGHTS)).toThrow(/version must be 2/);
  });

  it("rejects a missing claim", () => {
    const entry = validEntry();
    delete (entry as Record<string, unknown>)["claim"];
    expect(() => parseGoldSet({ version: 2, entries: [entry] }, SHIPPED_WEIGHTS)).toThrow(/missing non-empty 'claim'/);
  });

  it("rejects an unknown label basis", () => {
    expect(() => parseGoldSet(withEntry({ label_basis: "bogus" }), SHIPPED_WEIGHTS)).toThrow(/unknown label_basis/);
  });

  it("rejects a duplicate id and names it", () => {
    const entry = validEntry();
    expect(() => parseGoldSet({ version: 2, entries: [entry, entry] }, SHIPPED_WEIGHTS)).toThrow(/invalid gold entry x: duplicate id/);
  });

  it("rejects an unknown source type", () => {
    expect(() => parseGoldSet(withEntry({ sources: ["academik"] }), SHIPPED_WEIGHTS)).toThrow(/unknown source type 'academik'/);
  });

  it("rejects a repeated source type", () => {
    expect(() => parseGoldSet(withEntry({ sources: ["news", "news"] }), SHIPPED_WEIGHTS)).toThrow(/repeated source type/);
  });

  it("rejects a rung that disagrees with the family count", () => {
    expect(() => parseGoldSet(withEntry({ confidence: 0.7 }), SHIPPED_WEIGHTS)).toThrow(/is not the rung 0.3/);
  });

  it("requires a truth_note on a constructed row", () => {
    expect(() =>
      parseGoldSet(withEntry({ label_basis: "constructed", truth_sources: undefined }), SHIPPED_WEIGHTS),
    ).toThrow(/constructed rows require a truth_note/);
  });

  it("forbids truth_sources on a constructed row", () => {
    expect(() =>
      parseGoldSet(withEntry({ label_basis: "constructed", truth_note: "Stipulated outcome." }), SHIPPED_WEIGHTS),
    ).toThrow(/constructed rows carry no truth_sources/);
  });

  it("requires truth_sources on an observed row", () => {
    expect(() =>
      parseGoldSet(withEntry({ label_basis: "observed", truth_sources: undefined }), SHIPPED_WEIGHTS),
    ).toThrow(/observed rows require truth_sources/);
  });
});

// @implements REQ-123 disableable
describe("calibration disableability (F-R5-B-3)", () => {
  it("returns the underlying rung unchanged when the correction is disabled", () => {
    const secondary = [{ source_type: "web_search" }, { source_type: "news" }];
    expect(capConfidence(0.9, secondary, { enabled: false, secondaryOnlyCap: 0.7 })).toBe(0.9);
    // The same inputs cap when the correction is on, so the flag is the only
    // difference between the two results.
    expect(capConfidence(0.9, secondary, { enabled: true, secondaryOnlyCap: 0.7 })).toBe(0.7);
  });
});
