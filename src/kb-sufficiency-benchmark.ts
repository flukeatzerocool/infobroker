// @implements REQ-076b
// KB-first sufficiency measurement over a stored-chunk corpus. Seeds a temp
// SQLite store through the real KB layer, searches it with the real
// `kbSearch`, and applies the real admission predicate — so the report scores
// the server's own path, not a copy of it.
//
// The corpus is the committed retrieval fixture (26 cases, 114 results). One
// store holds every case's documents, so a query can retrieve another topic's
// chunk — which is the failure this measurement exists to observe. Labels come
// from `test-fixtures/kb-sufficiency/judgments.json`; a result the fixture does
// not judge is reported as `unjudged` and is never counted as irrelevant.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initKb, kbIngest, kbSearch, kbStats } from "./kb.js";
import { partitionBySufficiency, sufficiencyThresholds } from "./kb-sufficiency.js";
import { tokenize } from "./embed.js";
import type { KbConfig } from "./types.js";

export type SufficiencyScale = "snippet" | "page";
export type SufficiencyLabel = "relevant" | "irrelevant" | "unjudged";

/** Page-scale padding: neutral text that carries no query token. */
export const NEUTRAL_FILLER =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum";

interface FixtureResult {
  title?: string;
  url: string;
  snippet?: string;
}

interface FixtureCase {
  id: string;
  query: string;
  judgments: Array<{ url: string; grade: number }>;
  results: FixtureResult[];
}

interface Fixture {
  k: number;
  queries: FixtureCase[];
}

interface LabelFile {
  cases: Record<string, { query: string; relevant: Array<{ url: string; grade: number }>; unjudged: string[] }>;
}

export interface SufficiencyCaseReport {
  id: string;
  query: string;
  returned: number;
  admitted: number;
  labels: Record<SufficiencyLabel, number>;
  top_url: string | null;
  top_score: number | null;
  top_matched_tokens: number | null;
  top_label: SufficiencyLabel | null;
  binary_hit_admitted: number;
  /** Admitted rows with their evidence, so a decision can cite a specific chunk. */
  admitted_rows: Array<{ url: string; score: number; matched_tokens: number; label: SufficiencyLabel }>;
}

export interface SufficiencyReport {
  scale: SufficiencyScale;
  chunk_size: number;
  documents: number;
  stored_chunks: number;
  cases: SufficiencyCaseReport[];
  /** Admitted chunk instances labelled cross-topic, over all admitted instances. */
  admitted_irrelevant_rate: number;
  /** Admitted chunk instances the fixture does not judge; reported, never a signal. */
  admitted_unjudged_rate: number;
  /** Cases with at least one relevant admitted chunk, over cases with a relevant ingested document. */
  sufficiency_recall: number;
  /** Admitted chunks carrying one matched query token while the query has two or more. */
  binary_hit_admitted: number;
  /** Cases whose highest-ranked admitted chunk is a cross-topic document. */
  cases_with_irrelevant_top: number;
  /**
   * The roadmap's trigger condition: cases where KB-first sufficiency is
   * satisfied on chunks that are all cross-topic or unjudged — no relevant
   * document among them. A non-zero count means unrelated content alone
   * replaced external search.
   */
  cases_sufficient_on_non_relevant: number;
}

function fixturePath(name: string): string {
  return join(import.meta.dirname, "..", "test-fixtures", name);
}

export function loadSufficiencyFixtures(): { fixture: Fixture; labels: LabelFile } {
  const fixture = JSON.parse(readFileSync(fixturePath("retrieval/queries.json"), "utf8")) as Fixture;
  const labels = JSON.parse(
    readFileSync(fixturePath("kb-sufficiency/judgments.json"), "utf8"),
  ) as LabelFile;
  return { fixture, labels };
}

function padTo(text: string, size: number): string {
  if (text.length >= size) return text;
  const filler = NEUTRAL_FILLER.padEnd(size, ` ${NEUTRAL_FILLER}`);
  return `${text} ${filler.slice(0, size - text.length - 1).trim()}`;
}

export interface SufficiencyRunOptions {
  /** Base knowledge-base configuration; required fields fall back to defaults. */
  kb?: Partial<KbConfig>;
  scales?: SufficiencyScale[];
  /** Keep the temp store on disk for inspection (tests clean up themselves). */
  keepStore?: boolean;
}

/**
 * REQ-076b: run the measurement at one or both chunk scales. The store is a
 * temp directory that never touches the configured `storage_path`.
 */
export function runSufficiencyBenchmark(
  options: SufficiencyRunOptions = {},
): SufficiencyReport[] {
  const { fixture, labels } = loadSufficiencyFixtures();
  const scales = options.scales ?? ["snippet", "page"];
  const chunkSize = options.kb?.chunk_size ?? 1024;

  // A document belongs to the cases whose result set contains it; every other
  // case sees it as a cross-topic distractor.
  const owners = new Map<string, Set<string>>();
  for (const testCase of fixture.queries) {
    for (const result of testCase.results) {
      const set = owners.get(result.url) ?? new Set<string>();
      set.add(testCase.id);
      owners.set(result.url, set);
    }
  }

  const reports: SufficiencyReport[] = [];
  for (const scale of scales) {
    const root = mkdtempSync(join(tmpdir(), "infobroker-kb-suff-"));
    try {
      initKb({
        storage_path: root,
        embedding_model: options.kb?.embedding_model ?? "signed-hash-tfidf",
        chunk_size: chunkSize,
        chunk_overlap: options.kb?.chunk_overlap ?? 64,
        auto_index: false,
        default_collection: options.kb?.default_collection ?? "default",
        max_results: options.kb?.max_results ?? 50,
        kb_first_relevance_threshold: options.kb?.kb_first_relevance_threshold ?? 0.3,
        kb_first_confidence_threshold: options.kb?.kb_first_confidence_threshold ?? 0.5,
        maintenance_interval_minutes: 0,
        freshness: options.kb?.freshness,
        encryption: { enabled: false },
      });

      const seen = new Set<string>();
      let documents = 0;
      for (const testCase of fixture.queries) {
        for (const result of testCase.results) {
          if (seen.has(result.url)) continue;
          seen.add(result.url);
          documents++;
          const body = `${result.title ?? ""}. ${result.snippet ?? ""}`.trim();
          const text = scale === "page" ? padTo(body, chunkSize) : body;
          kbIngest(text, result.title ?? result.url, result.url, "fixture", `suff-${scale}`, "web_search");
        }
      }

      const thresholds = sufficiencyThresholds(options.kb ? { kb: options.kb } : undefined);
      const caseReports: SufficiencyCaseReport[] = [];
      let admittedInstances = 0;
      let irrelevantInstances = 0;
      let unjudgedInstances = 0;
      let binaryHits = 0;
      let recallNumerator = 0;
      let recallDenominator = 0;
      let irrelevantTop = 0;

      for (const testCase of fixture.queries) {
        const label = labels.cases[testCase.id];
        if (!label) throw new Error(`missing labels for case ${testCase.id}`);
        const relevant = new Set(label.relevant.filter((entry) => entry.grade > 0).map((entry) => entry.url));
        const unjudged = new Set(label.unjudged);
        const queryTokens = tokenize(testCase.query);

        const rows = kbSearch(testCase.query, 50, `suff-${scale}`);
        const { sufficient } = partitionBySufficiency(rows, thresholds);

        const counts: Record<SufficiencyLabel, number> = { relevant: 0, irrelevant: 0, unjudged: 0 };
        const admittedRows: SufficiencyCaseReport["admitted_rows"] = [];
        let caseBinary = 0;
        for (const row of sufficient) {
          let rowLabel: SufficiencyLabel;
          if (relevant.has(row.source_url)) rowLabel = "relevant";
          else if (unjudged.has(row.source_url)) rowLabel = "unjudged";
          else rowLabel = "irrelevant";
          counts[rowLabel]++;
          admittedInstances++;
          if (rowLabel === "irrelevant") irrelevantInstances++;
          if (rowLabel === "unjudged") unjudgedInstances++;
          admittedRows.push({
            url: row.source_url,
            score: Number(row.score.toFixed(4)),
            matched_tokens: row.matched_tokens ?? 0,
            label: rowLabel,
          });
          if ((row.matched_tokens ?? 0) === 1 && queryTokens.length >= 2) {
            caseBinary++;
            binaryHits++;
          }
        }
        if (relevant.size > 0 && seenHasAny(seen, relevant)) {
          recallDenominator++;
          if (counts.relevant > 0) recallNumerator++;
        }
        const top = sufficient[0];
        const topLabel = top
          ? relevant.has(top.source_url)
            ? "relevant"
            : unjudged.has(top.source_url)
              ? "unjudged"
              : "irrelevant"
          : null;
        if (topLabel === "irrelevant") irrelevantTop++;

        caseReports.push({
          id: testCase.id,
          query: testCase.query,
          returned: rows.length,
          admitted: sufficient.length,
          labels: counts,
          top_url: top?.source_url ?? null,
          top_score: top ? Number(top.score.toFixed(4)) : null,
          top_matched_tokens: top?.matched_tokens ?? null,
          top_label: topLabel,
          binary_hit_admitted: caseBinary,
          admitted_rows: admittedRows,
        });
      }

      reports.push({
        scale,
        chunk_size: chunkSize,
        documents,
        stored_chunks: kbStats().chunk_count,
        cases: caseReports,
        admitted_irrelevant_rate:
          admittedInstances === 0 ? 0 : Number((irrelevantInstances / admittedInstances).toFixed(4)),
        admitted_unjudged_rate:
          admittedInstances === 0 ? 0 : Number((unjudgedInstances / admittedInstances).toFixed(4)),
        sufficiency_recall: recallDenominator === 0 ? 0 : Number((recallNumerator / recallDenominator).toFixed(4)),
        binary_hit_admitted: binaryHits,
        cases_with_irrelevant_top: irrelevantTop,
        cases_sufficient_on_non_relevant: caseReports.filter(
          (entry) => entry.admitted > 0 && entry.labels.relevant === 0,
        ).length,
      });
    } finally {
      if (!options.keepStore) rmSync(root, { recursive: true, force: true });
    }
  }
  return reports;
}

function seenHasAny(seen: Set<string>, urls: Set<string>): boolean {
  for (const url of urls) if (seen.has(url)) return true;
  return false;
}
