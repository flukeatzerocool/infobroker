// @implements REQ-072 boilerplate-only
/**
 * REQ-072 dedup false-positive bound.
 *
 * The knowledge base recognises a document as the same as one already stored
 * when their meaning substantially matches. On templated corpora, shared
 * boilerplate dominates the lexical comparison, so a distinct document can be
 * merged into another (the R6 cost measurement recorded 36 of 200 collapsing).
 * This suite pins the bound: a document that differs in its identifying
 * content — a name, a date, a case number — is never merged.
 *
 * The corpora are generated deterministically from fixed word lists, so the
 * rates are reproducible without seeding a random source.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync } from "node:fs";
import { testTmpDir } from "./lib/test-tmp.js";
import { initKb, kbIngest, kbList, kbGet, kbStats } from "./kb.js";
import type { KbConfig } from "./types.js";

const dir = testTmpDir("kb-bound-test-");

function makeConfig(): KbConfig {
  return {
    storage_path: dir,
    embedding_model: "signed-hash-tfidf",
    chunk_size: 512,
    chunk_overlap: 64,
    auto_index: false,
    default_collection: "default",
    max_results: 50,
    maintenance_interval_minutes: 60,
    kb_first_relevance_threshold: 0.3,
    kb_first_confidence_threshold: 0.5,
    freshness: {
      tiers: {
        ephemeral: { decay_hours: 24, expiry_hours: 168 },
        recent: { decay_hours: 168, expiry_hours: 720 },
        stable: { decay_hours: 720, expiry_hours: 0 },
        evergreen: { decay_hours: 0, expiry_hours: 0 },
      },
      auto_classify: false,
      default_tier: "stable",
    },
  };
}

/**
 * Twenty procedural sentences. A template is eight of them, chosen by group,
 * so two groups share at most two sentences: a templated site is modelled as
 * shared text plus a varying slot, and different templates stay unrelated.
 */
const SENTENCES = [
  "The quarterly review confirms that procurement records were reconciled against the approved ledger before publication.",
  "Staffing allocations follow the establishment table, with every vacancy recorded in the regional rota and reviewed monthly.",
  "Facilities maintenance is scheduled against the asset register so that inspections are completed within the agreed window.",
  "Records retention follows the disposal schedule, and every destruction decision is minuted by the responsible officer.",
  "Publication notices are issued to the distribution list at least ten working days before the effective date.",
  "Training commitments are tracked in the competence matrix and renewed before the certification expires.",
  "Transport requests are consolidated with the depot so that vehicle movements are planned a week ahead.",
  "Security arrangements are reviewed with the premises team whenever the occupancy or access rules change.",
  "Catering contracts are monitored against the agreed service standard and reported to the hospitality panel.",
  "Logistics support is booked through the warehouse so that stock levels never fall below the reserve threshold.",
  "The archive transfer is verified against the accession list before any material leaves the reading room.",
  "Laboratory equipment is calibrated on the published cycle and the certificates are held with the quality record.",
  "Fleet servicing is arranged around the duty rota to keep a spare vehicle available for emergencies.",
  "Workshop consumables are reordered when the stock check shows fewer than two weeks of supply remain.",
  "The dispensary reconciles its register at the close of each session and reports any discrepancy the same day.",
  "The canteen publishes its allergen information at the counter and on the staff noticeboard.",
  "Depot movements are logged at the gate and reconciled with the delivery notes at the end of the shift.",
  "Hangar access is restricted to the engineering team while the airframe inspection is in progress.",
  "Slipway bookings are coordinated with the harbour office so that tidal windows are respected.",
  "Thatchers and masons coordinate their schedules so that the roof and the parapet are finished together.",
];

/** The shared template body: eight sentences chosen from the pool by group. */
function template(group: number): string {
  return Array.from({ length: 8 }, (_, j) => SENTENCES[(group * 3 + j) % 20]).join(" ");
}

/** A document unique to `i`: one pool sentence plus its own observation line. */
function distinctDoc(i: number): { title: string; text: string; id: string } {
  return {
    title: `Field note ${i}`,
    text: `${SENTENCES[i % SENTENCES.length]} ${SENTENCES[(i * 7 + 3) % SENTENCES.length]} Observation ${i} was filed separately.`,
    id: `https://example.com/field-${i}`,
  };
}

const NAMES = ["Ashford", "Bramley", "Caldwell", "Denholm", "Eastwick", "Fairhaven", "Grimsby", "Halloway"];
const MONTHS = ["January", "March", "May", "July", "September", "November"];
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024];

/** A templated document whose slot carries identity: a name, a month, a year, an id. */
function identityDoc(group: number, variant: number): { title: string; text: string; id: string } {
  const caseId = 5000 + group * 4 + variant;
  return {
    title: `Regional bulletin ${NAMES[group % NAMES.length]} case ${caseId}`,
    text: `Case ${caseId}. ${template(group)}`,
    id: `https://example.com/identity-${caseId}`,
  };
}

/** A templated document whose slot carries no identity: lowercase words only. */
function commonWordDoc(group: number, variant: number): { title: string; text: string; id: string } {
  const slots = ["harbour lease", "museum roof", "library budget", "ferry timetable"];
  return {
    title: `Operations bulletin ${group} ${variant}`,
    text: `${template(group)} The ${slots[variant]} review was completed.`,
    id: `https://example.com/common-${group}-${variant}`,
  };
}

function ingest(doc: { title: string; text: string; id: string }, collection: string): void {
  kbIngest(doc.text, doc.title, doc.id, "test", collection, "web_search");
}

const LONG_BODY =
  "The committee approved the quay budget after three hours of debate. " +
  "Members reviewed the harbour levy, the dredging schedule, and the ferry subsidy. " +
  "The chair recorded that the vote was unanimous. " +
  "A written summary was circulated to every member before the session closed. ";

/** A short distinctive opener, so separate pairs in one collection never compare. */
function subject(i: number): string {
  return SENTENCES[i % SENTENCES.length];
}

/** The duplicate set: 15 positives (must merge) and 5 negatives (must not). */
const POSITIVE_IDENTICAL_TITLED = 10;
const POSITIVE_ADDED_SENTENCE = 5;
const NEGATIVE_IDENTITY = 5;

beforeAll(() => {
  initKb(makeConfig());
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("dedup false-positive bound (REQ-072)", () => {
  it("keeps every templated document that carries distinct identity", () => {
    const collection = "bound-identity";
    for (let group = 0; group < 20; group++) {
      for (let variant = 0; variant < 4; variant++) ingest(identityDoc(group, variant), collection);
    }
    for (let i = 0; i < 120; i++) ingest(distinctDoc(i), collection);
    // Twenty template groups of four documents plus 120 distinct documents.
    // Before the fix every group merged into one document (80 documents become
    // 20); the bound is that no templated document is lost.
    expect(kbList(collection, "web_search")).toHaveLength(200);
  });

  it("records, without bounding, the rate on common-word slots", () => {
    const collection = "bound-common";
    for (let group = 0; group < 20; group++) {
      for (let variant = 0; variant < 2; variant++) ingest(commonWordDoc(group, variant), collection);
    }
    // Recorded rate, pinned for determinism: the guard abstains when neither
    // body carries identity, and similarity alone decides. This is the
    // documented residual of REQ-072's bound, not a target.
    expect(kbList(collection, "web_search")).toHaveLength(20);
  });

  it("merges an identical body under a different title", () => {
    for (let i = 0; i < POSITIVE_IDENTICAL_TITLED; i++) {
      const collection = `bound-positive-${i}`;
      const body = `${subject(i)} ${LONG_BODY}`;
      kbIngest(body, `Quay budget note ${i}`, `https://example.com/pos-a-${i}`, "test", collection, "web_search");
      kbIngest(body, `Quay budget summary ${i}`, `https://example.com/pos-b-${i}`, "test", collection, "web_search");
      expect(kbGet(`https://example.com/pos-b-${i}`)).toBeNull();
      expect(kbGet(`https://example.com/pos-a-${i}`)).not.toBeNull();
    }
    const events = kbStats().events.filter((e) => e.includes("Dedup at") && e.includes("pos-b-0"));
    expect(events.some((e) => e.includes("basis similarity-only"))).toBe(true);
  });

  it("merges a long body that gained a sentence, including one with shared identity", () => {
    for (let i = 0; i < POSITIVE_ADDED_SENTENCE; i++) {
      const collection = `bound-update-${i}`;
      // Shared non-empty identity on the last pair: the collapse rests on
      // identity agreement, and the event says so.
      // Identity inside the compared window on the last pair: the collapse
      // rests on identity agreement, and the event says so.
      const slot = i === POSITIVE_ADDED_SENTENCE - 1 ? "Ashford January 2019 " : "";
      const body = `${slot}${subject(200 + i)} ${LONG_BODY}`;
      kbIngest(body, `Quay budget update ${i}`, `https://example.com/up-a-${i}`, "test", collection, "web_search");
      kbIngest(
        `${body} An appendix records the vote by division.`,
        `Quay budget update ${i} revised`,
        `https://example.com/up-b-${i}`,
        "test",
        collection,
        "web_search"
      );
      expect(kbGet(`https://example.com/up-b-${i}`)).toBeNull();
      expect(kbGet(`https://example.com/up-a-${i}`)).not.toBeNull();
    }
    const events = kbStats().events.filter((e) => e.includes("Dedup at") && e.includes("up-b-4"));
    expect(events.some((e) => e.includes("basis identity"))).toBe(true);
  });

  it("does not merge documents whose identifying names, dates, or numbers differ", () => {
    for (let i = 0; i < NEGATIVE_IDENTITY; i++) {
      const collection = `bound-negative-${i}`;
      const first = `${subject(300 + i)} The ${NAMES[i]} ${MONTHS[i]} ${YEARS[i]} review under case ${6000 + i} was completed. ${LONG_BODY}`;
      const second = `${subject(300 + i)} The ${NAMES[i + 1]} ${MONTHS[i + 1]} ${YEARS[i + 1]} review under case ${6100 + i} was completed. ${LONG_BODY}`;
      kbIngest(first, `Regional review ${i} first`, `https://example.com/neg-a-${i}`, "test", collection, "web_search");
      kbIngest(second, `Regional review ${i} second`, `https://example.com/neg-b-${i}`, "test", collection, "web_search");
      expect(kbGet(`https://example.com/neg-a-${i}`)).not.toBeNull();
      expect(kbGet(`https://example.com/neg-b-${i}`)).not.toBeNull();
    }
  });
});
