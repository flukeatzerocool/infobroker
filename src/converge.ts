// @implements REQ-026
import type { SearchResult, ConvergenceResult, ConvergenceFinding } from "./types.js";
import {
  duckduckgoSearch,
  wikipediaSearch,
  wikidataSearch,
  wiktionarySearch,
  openstreetmapSearch,
  internetArchiveSearch,
  arxivSearch,
  semanticScholarSearch,
  stackExchangeSearch,
  githubSearch,
  coreSearch,
  marginaliaSearch,
  mojeekSearch,
  braveSearch,
  exaSearch,
  tavilySearch,
  searxngSearch,
} from "./providers/index.js";
import { getConfig, getDispatchChain } from "./config.js";
import { throttle } from "./rate-limiter.js";
import { checkQuota, increment } from "./quota.js";
import { retryWithBackoff } from "./retry.js";

type Searcher = (query: string, opts?: { max_results?: number }) => Promise<SearchResult[]>;

const SEARCHERS: Record<string, Searcher> = {
  duckduckgo: duckduckgoSearch as Searcher,
  wikipedia: wikipediaSearch as Searcher,
  wikidata: wikidataSearch as Searcher,
  wiktionary: wiktionarySearch as Searcher,
  openstreetmap: openstreetmapSearch as Searcher,
  internet_archive: internetArchiveSearch as Searcher,
  arxiv: arxivSearch as Searcher,
  semantic_scholar: semanticScholarSearch as Searcher,
  stack_exchange: stackExchangeSearch as Searcher,
  github: githubSearch as Searcher,
  core: coreSearch as Searcher,
  marginalia: marginaliaSearch as Searcher,
  mojeek: mojeekSearch as Searcher,
  brave: braveSearch as Searcher,
  exa: exaSearch as Searcher,
  tavily: tavilySearch as Searcher,
  searxng: searxngSearch as Searcher,
};

interface Claim {
  topic: string;
  text: string;
  source: { title: string; url: string; snippet: string };
}

export async function converge(
  query: string,
  options: {
    max_iterations?: number;
    confidence_threshold?: number;
    providers?: string[];
  } = {}
): Promise<ConvergenceResult> {
  const config = getConfig();
  const maxIterations = Math.min(
    options.max_iterations ?? config.convergence.max_iterations,
    10
  );
  const confidenceThreshold =
    options.confidence_threshold ?? config.convergence.confidence_threshold;
  const maxCalls = config.convergence.max_http_calls;

  const providerList = options.providers || getDispatchChain("general_web");
  const availableProviders = providerList.filter((p) => SEARCHERS[p]);

  if (availableProviders.length === 0) {
    return {
      findings: [],
      agreement_map: { green: [], yellow: [], red: [] },
      iteration_count: 0,
      providers_used: [],
      total_sources: 0,
      convergence: "partial",
    };
  }

  const findings = new Map<string, ConvergenceFinding>();
  let totalCalls = 0;
  let iteration = 0;
  const providersUsed = new Set<string>();
  const searchedQueries = new Set<string>();

  while (iteration < maxIterations && totalCalls < maxCalls) {
    const prevFindingsCount = findings.size;

    if (iteration === 0) {
      // Phase 1: Broad search across available providers
      for (const slug of availableProviders) {
        if (totalCalls >= maxCalls) break;
        const q = checkQuota(slug, config.providers[slug]?.rate_limit);
        if (q.exhausted) continue;

        try {
          await throttle(slug);
          const doCall = async () => {
            const searcher = SEARCHERS[slug];
            if (!searcher) throw new Error(`No searcher for ${slug}`);
            return await searcher(query, { max_results: 5 });
          };
          const results = await retryWithBackoff(doCall, slug);
          totalCalls++;
          providersUsed.add(slug);
          increment(slug, config.providers[slug]?.rate_limit);

          processClaims(findings, results, slug);
        } catch {
          // provider failed, skip
        }
      }
    } else {
      // Phase 3: Refinement — search for gap topics
      const gaps = getGaps(findings, confidenceThreshold);
      if (gaps.length === 0) break;

      for (const gapTopic of gaps.slice(0, 3)) {
        if (totalCalls >= maxCalls) break;
        const refinedQuery = deriveRefinedQuery(gapTopic, query);
        if (searchedQueries.has(refinedQuery)) continue;
        searchedQueries.add(refinedQuery);

        const gapProvider = availableProviders[0];
        const q = checkQuota(gapProvider, config.providers[gapProvider]?.rate_limit);
        if (q.exhausted) continue;

        try {
          await throttle(gapProvider);
          const doCall = async () => {
            const searcher = SEARCHERS[gapProvider];
            if (!searcher) throw new Error(`No searcher for ${gapProvider}`);
            return await searcher(refinedQuery, { max_results: 3 });
          };
          const results = await retryWithBackoff(doCall, gapProvider);
          totalCalls++;
          providersUsed.add(gapProvider);
          increment(gapProvider, config.providers[gapProvider]?.rate_limit);

          processClaims(findings, results, gapProvider);
        } catch {
          // skip
        }
      }
    }

    // Phase 2: Check if confidence threshold met for all findings
    const allConfirmed =
      findings.size > 0 &&
      [...findings.values()].every((f) => f.confidence >= confidenceThreshold);

    if (allConfirmed) break;

    // If no new findings in this iteration, exit
    if (iteration > 0 && findings.size === prevFindingsCount) break;

    iteration++;
  }

  const findingsArray = [...findings.values()];
  const agreementMap = buildAgreementMap(findingsArray, confidenceThreshold);

  return {
    findings: findingsArray,
    agreement_map: agreementMap,
    iteration_count: iteration,
    providers_used: [...providersUsed],
    total_sources: findingsArray.reduce((sum, f) => sum + f.sources.length, 0),
    convergence:
      findingsArray.length > 0 && findingsArray.every((f) => f.confidence >= confidenceThreshold)
        ? "complete"
        : "partial",
  };
}

function processClaims(
  findings: Map<string, ConvergenceFinding>,
  results: SearchResult[],
  slug: string
): void {
  for (const r of results) {
    const topic = r.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    if (!topic) continue;

    const existing = findings.get(topic);
    if (!existing) {
      findings.set(topic, {
        topic: r.title,
        claim: r.snippet,
        confidence: 0.3,
        verdict: "unverified",
        sources: [{ title: r.title, url: r.url, snippet: r.snippet }],
      });
    } else {
      const alreadyHasSource = existing.sources.some(
        (s) => s.url === r.url
      );
      if (!alreadyHasSource) {
        existing.sources.push({ title: r.title, url: r.url, snippet: r.snippet });
      }
      existing.confidence = computeConfidence(existing.sources);
      if (existing.confidence >= 0.5) {
        existing.verdict = "contested";
      }
      if (existing.confidence >= 0.8) {
        existing.verdict = "confirmed";
      }
    }
  }
}

function computeConfidence(sources: Array<{ title: string; url: string; snippet: string }>): number {
  const uniqueDomains = new Set<string>();
  for (const s of sources) {
    try {
      uniqueDomains.add(new URL(s.url).hostname);
    } catch {
      uniqueDomains.add(s.url);
    }
  }

  const count = uniqueDomains.size;
  if (count >= 5) return 1.0;
  if (count >= 3) return 0.9;
  if (count >= 2) return 0.7;
  if (count === 1) return 0.3;
  return 0.0;
}

function getGaps(
  findings: Map<string, ConvergenceFinding>,
  threshold: number
): string[] {
  return [...findings.entries()]
    .filter(([, f]) => f.confidence < threshold)
    .map(([topic]) => topic);
}

function deriveRefinedQuery(topic: string, originalQuery: string): string {
  const words = topic.split(/\s+/).filter((w) => w.length > 3);
  const keywords = words.slice(0, 4).join(" ");
  return keywords ? `${originalQuery} ${keywords}` : `${originalQuery} ${topic.slice(0, 50)}`;
}

function buildAgreementMap(
  findings: ConvergenceFinding[],
  threshold: number
): { green: string[]; yellow: string[]; red: string[] } {
  const map: { green: string[]; yellow: string[]; red: string[] } = {
    green: [],
    yellow: [],
    red: [],
  };

  for (const f of findings) {
    if (f.confidence >= threshold) {
      map.green.push(f.topic);
    } else if (f.confidence >= 0.5) {
      map.yellow.push(f.topic);
    } else {
      map.red.push(f.topic);
    }
  }

  return map;
}
