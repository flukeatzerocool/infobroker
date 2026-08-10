// @implements REQ-026
import type { SearchResult, ConvergenceResult, ConvergenceFinding } from "./types.js";
import { PROVIDERS } from "./providers/index.js";
import { getConfig, getActiveProviders } from "./config.js";
import { throttle } from "./rate-limiter.js";
import { checkQuota, increment } from "./quota.js";
import { retryWithBackoff } from "./retry.js";

type Searcher = (query: string, opts?: { max_results?: number }) => Promise<SearchResult[]>;

export const SEARCHERS: Record<string, Searcher> = {};
for (const [slug, provider] of Object.entries(PROVIDERS)) {
  if (provider.search) {
    SEARCHERS[slug] = provider.search as Searcher;
  }
}

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall", "should",
  "may", "might", "must", "can", "could", "it", "its", "this", "that", "these",
  "those", "not", "no", "nor", "so", "if", "then", "than", "too", "very",
  "just", "about", "also", "up", "out", "all", "any", "both", "each", "few",
  "more", "most", "other", "some", "such", "only", "own", "same", "into",
  "over", "after", "before", "between", "under", "again", "above", "below",
  "here", "there", "when", "where", "why", "how", "which", "who", "whom",
  "what", "while", "during", "through", "new", "many", "well", "now", "get",
  "make", "made", "know", "take", "see", "use", "used", "like", "much",
  "really", "still", "back", "even", "way", "say", "said", "thing", "work",
]);

export function extractTopic(title: string): string {
  const cleaned = title.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/);
  const keywords = cleaned.filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return keywords.slice(0, 4).join(" ") || title.slice(0, 50).toLowerCase();
}

export function jaccardSimilarity(a: string, b: string): number {
  const tokens = (s: string) => new Set(
    s.toLowerCase().split(/\W+/).filter((t) => t.length > 2)
  );
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection++;
  }
  return intersection / (ta.size + tb.size - intersection);
}

interface Source {
  title: string;
  url: string;
  snippet: string;
}

export function reconcileClaims(
  findings: Map<string, ConvergenceFinding>,
  results: SearchResult[],
): void {
  for (const r of results) {
    if (!r.title) continue;
    const topicKey = extractTopic(r.title);
    if (!topicKey) continue;

    const existing = findings.get(topicKey);
    if (!existing) {
      findings.set(topicKey, {
        topic: r.title,
        claim: r.snippet,
        confidence: 0.3,
        verdict: "unverified",
        sources: [{ title: r.title, url: r.url, snippet: r.snippet }],
      });
    } else {
      const alreadyHasSource = existing.sources.some((s) => s.url === r.url);
      if (!alreadyHasSource) {
        existing.sources.push({ title: r.title, url: r.url, snippet: r.snippet });
      }
    }
  }

  for (const [, finding] of findings) {
    const sources = finding.sources;
    if (sources.length < 2) {
      finding.confidence = 0.3;
      finding.verdict = "unverified";
      continue;
    }

    interface Cluster { members: Source[]; representative: string }
    const clusters: Cluster[] = [];

    for (const source of sources) {
      let placed = false;
      for (const cluster of clusters) {
        if (jaccardSimilarity(source.snippet, cluster.representative) >= 0.3) {
          cluster.members.push(source);
          placed = true;
          break;
        }
      }
      if (!placed) {
        clusters.push({ members: [source], representative: source.snippet });
      }
    }

    clusters.sort((a, b) => b.members.length - a.members.length);
    const dominant = clusters[0];

    if (clusters.length === 1) {
      finding.confidence = computeConfidence(dominant.members);
      if (dominant.members.length >= 2 && finding.confidence >= 0.5) {
        finding.verdict = "confirmed";
      } else {
        finding.verdict = "unverified";
      }
    } else if (dominant.members.length >= 2) {
      finding.confidence = computeConfidence(dominant.members);
      finding.verdict = "confirmed";
    } else {
      finding.confidence = Math.max(
        computeConfidence(dominant.members),
        0.1
      );
      finding.verdict = "contested";
      finding.perspectives = clusters.map((c) => c.representative);
    }
  }
}

export function computeConfidence(sources: Source[]): number {
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

function pickGapProvider(
  availableProviders: string[],
  config: ReturnType<typeof getConfig>,
  startIndex: number,
): string | null {
  for (let offset = 0; offset < availableProviders.length; offset++) {
    const idx = (startIndex + offset) % availableProviders.length;
    const slug = availableProviders[idx];
    const q = checkQuota(slug, config.providers[slug]?.rate_limit);
    if (!q.exhausted) return slug;
  }
  return null;
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

  const providerList = options.providers
    || getActiveProviders()
         .filter(([, p]) => p.capabilities.includes("web_search"))
         .map(([slug]) => slug);
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
      const searchPromises = availableProviders.map(async (slug) => {
        if (totalCalls >= maxCalls) return null;
        const q = checkQuota(slug, config.providers[slug]?.rate_limit);
        if (q.exhausted) return null;
        try {
          await throttle(slug);
          const searcher = SEARCHERS[slug];
          if (!searcher) return null;
          const results = await retryWithBackoff(
            async () => searcher(query, { max_results: 5 }),
            slug,
            config.providers[slug]
          );
          return { slug, results };
        } catch {
          return null;
        }
      });

      const settled = await Promise.allSettled(searchPromises);
      for (const result of settled) {
        if (result.status === "fulfilled" && result.value) {
          totalCalls++;
          providersUsed.add(result.value.slug);
          increment(result.value.slug, config.providers[result.value.slug]?.rate_limit);
          reconcileClaims(findings, result.value.results);
        }
      }
    } else {
      const gaps = getGaps(findings, confidenceThreshold);
      if (gaps.length === 0) break;

      for (const gapTopic of gaps.slice(0, 3)) {
        if (totalCalls >= maxCalls) break;
        const refinedQuery = deriveRefinedQuery(gapTopic, query);
        if (searchedQueries.has(refinedQuery)) continue;
        searchedQueries.add(refinedQuery);

        const gapProvider = pickGapProvider(availableProviders, config, totalCalls);
        if (!gapProvider) continue;

        try {
          await throttle(gapProvider);
          const doCall = async () => {
            const searcher = SEARCHERS[gapProvider];
            if (!searcher) throw new Error(`No searcher for ${gapProvider}`);
            return await searcher(refinedQuery, { max_results: 3 });
          };
          const results = await retryWithBackoff(doCall, gapProvider, config.providers[gapProvider]);
          totalCalls++;
          providersUsed.add(gapProvider);
          increment(gapProvider, config.providers[gapProvider]?.rate_limit);

          reconcileClaims(findings, results);
        } catch {
          // skip
        }
      }
    }

    const allConfirmed =
      findings.size > 0 &&
      [...findings.values()].every((f) => f.confidence >= confidenceThreshold);

    if (allConfirmed) break;

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
