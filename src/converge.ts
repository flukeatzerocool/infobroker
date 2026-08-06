import type { SearchResult, ConvergenceResult, ConvergenceFinding } from "./types.js";
import {
  duckduckgoSearch,
  wikipediaSearch,
  wikidataSearch,
} from "./providers/index.js";
import { jinaFetchPage } from "./providers/jina.js";
import { getConfig, getDispatchChain } from "./config.js";
import { throttle } from "./rate-limiter.js";

type Searcher = (query: string, opts?: { max_results?: number }) => Promise<SearchResult[]>;

const SEARCHERS: Record<string, Searcher> = {
  duckduckgo: duckduckgoSearch,
  wikipedia: wikipediaSearch,
  wikidata: wikidataSearch,
};

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
  if (providerList.length === 0) {
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

  while (iteration < maxIterations && totalCalls < maxCalls) {
    const activeProviders = providerList.filter(
      (p) => p === "duckduckgo" || p === "wikipedia" || p === "wikidata"
    );

    for (const slug of activeProviders) {
      if (totalCalls >= maxCalls) break;

      const searcher = SEARCHERS[slug];
      if (!searcher) continue;

      try {
        await throttle(slug);
        const results = await searcher(query, { max_results: 5 });
        totalCalls++;
        providersUsed.add(slug);

        const claims = extractClaims(results, slug);
        for (const claim of claims) {
          const key = normalizeTopic(claim.topic);
          const existing = findings.get(key);

          if (!existing) {
            findings.set(key, {
              topic: claim.topic,
              claim: claim.text,
              confidence: 0.3,
              verdict: "unverified",
              sources: [claim.source],
            });
          } else {
            existing.sources.push(claim.source);
            existing.confidence = computeConfidence(existing.sources);
            existing.verdict = getVerdict(existing.confidence, confidenceThreshold);
          }
        }
      } catch {
        // provider failed, skip
      }
    }

    const allConfirmed =
      findings.size > 0 &&
      [...findings.values()].every((f) => f.confidence >= confidenceThreshold);

    if (allConfirmed) break;

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
      findingsArray.every((f) => f.confidence >= confidenceThreshold)
        ? "complete"
        : "partial",
  };
}

function extractClaims(
  results: SearchResult[],
  slug: string
): Array<{ topic: string; text: string; source: { title: string; url: string; snippet: string } }> {
  return results.map((r) => ({
    topic: r.title,
    text: r.snippet,
    source: { title: r.title, url: r.url, snippet: r.snippet },
  }));
}

function normalizeTopic(topic: string): string {
  return topic.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

type SourceRef = { title: string; url: string; snippet: string };

function computeConfidence(sources: SourceRef[]): number {
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

function getVerdict(
  confidence: number,
  threshold: number
): "confirmed" | "contested" | "unverified" {
  if (confidence >= threshold) return "confirmed";
  if (confidence >= 0.5) return "contested";
  return "unverified";
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
