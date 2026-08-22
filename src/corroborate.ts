// @implements REQ-026 REQ-026a REQ-026b REQ-026c REQ-026d
import type { SearchResult, CorroborationResult, CorroborationFinding } from "./types.js";
import { PROVIDERS, resolveProvider } from "./providers/index.js";
import { getConfig, getActiveProviders } from "./config.js";
import { throttle } from "./rate-limiter.js";
import { checkQuota, increment } from "./quota.js";
import { retryWithBackoff } from "./retry.js";
import { getDomain } from "tldts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

function readVersion(): string {
  try {
    const pkgPath = join(fileURLToPath(import.meta.url), "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

type Searcher = (query: string, opts?: { max_results?: number }) => Promise<SearchResult[]>;

export const SEARCHERS: Record<string, Searcher> = {};
for (const [slug, provider] of Object.entries(PROVIDERS)) {
  if (provider.search) {
    SEARCHERS[slug] = provider.search as Searcher;
  }
}

export function resolveSearcher(
  slug: string,
  searchers: Record<string, Searcher> = SEARCHERS
): Searcher | undefined {
  if (searchers[slug]) return searchers[slug];
  return resolveProvider(slug)?.search as Searcher | undefined;
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
  claim?: string;
  source_type?: string;
  original_source?: string;
}

export function reconcileClaims(
  findings: Map<string, CorroborationFinding>,
  results: SearchResult[],
  similarityThreshold = 0.3,
  authorityWeights?: Record<string, number>,
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
        sources: [{ title: r.title, url: r.url, snippet: r.snippet, claim: r.snippet || r.title, source_type: r.source_type, original_source: r.original_source }],
      });
    } else {
      const alreadyHasSource = existing.sources.some((s) => s.url === r.url);
      if (!alreadyHasSource) {
        existing.sources.push({ title: r.title, url: r.url, snippet: r.snippet, claim: r.snippet || r.title, source_type: r.source_type, original_source: r.original_source });
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
        if (jaccardSimilarity(source.snippet, cluster.representative) >= similarityThreshold) {
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
      finding.confidence = computeConfidence(dominant.members, authorityWeights);
      if (dominant.members.length >= 2 && finding.confidence >= 0.5) {
        finding.verdict = "confirmed";
      } else {
        finding.verdict = "unverified";
      }
    } else if (dominant.members.length >= 2) {
      finding.confidence = computeConfidence(dominant.members, authorityWeights);
      finding.verdict = "confirmed";
    } else {
      finding.confidence = Math.max(
        computeConfidence(dominant.members, authorityWeights),
        0.1
      );
      finding.verdict = "contested";
      finding.perspectives = clusters.map((c) => c.representative);
    }
  }
}

const MULTI_LABEL_TLDS = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au",
  "co.nz", "co.jp", "com.br", "com.mx", "co.in", "com.cn", "com.sg",
]);

function registrableDomain(hostname: string): string {
  const domain = getDomain(hostname);
  if (domain) return domain;
  const labels = hostname.split(".").filter(Boolean);
  if (labels.length <= 2) return hostname;
  const lastTwo = labels.slice(-2).join(".");
  if (MULTI_LABEL_TLDS.has(lastTwo) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }
  return lastTwo;
}

export function computeConfidence(
  sources: Source[],
  authorityWeights?: Record<string, number>,
): number {
  const uniqueDomains = new Map<string, string>();
  for (const s of sources) {
    let domain: string;
    try {
      domain = registrableDomain(new URL(s.url).hostname);
    } catch {
      domain = s.url;
    }
    if (!uniqueDomains.has(domain)) {
      uniqueDomains.set(domain, s.source_type ?? s.url);
    }
  }

  const count = uniqueDomains.size;
  let base: number;
  if (count >= 5) base = 1.0;
  else if (count >= 3) base = 0.9;
  else if (count >= 2) base = 0.7;
  else if (count === 1) base = 0.3;
  else base = 0.0;

  if (!authorityWeights) return base;
  const weights = [...uniqueDomains.values()].map((st) => authorityWeights[st] ?? 1.0);
  const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
  return Math.min(1.0, base * avgWeight);
}

function getGaps(
  findings: Map<string, CorroborationFinding>,
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
  findings: CorroborationFinding[],
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

export async function corroborate(
  query: string,
  options: {
    max_iterations?: number;
    confidence_threshold?: number;
    providers?: string[];
    searchers?: Record<string, Searcher>;
  } = {}
): Promise<CorroborationResult> {
  const config = getConfig();
  const maxIterations = Math.min(
    options.max_iterations ?? config.corroboration.max_iterations,
    10
  );
  const confidenceThreshold =
    options.confidence_threshold ?? config.corroboration.confidence_threshold;
  const maxCalls = config.corroboration.max_http_calls;
  const firstPassMaxResults = config.corroboration.first_pass_max_results;
  const similarityThreshold = config.corroboration.similarity_threshold;
  const authorityWeights = config.corroboration.authority_weights;
  const searchers = options.searchers ?? SEARCHERS;

  const providerList = options.providers
    || getActiveProviders()
         .filter(([, p]) => p.capabilities.includes("web_search"))
         .map(([slug]) => slug);
  const availableProviders = providerList.filter((p) => resolveSearcher(p, searchers));

  if (availableProviders.length === 0) {
    return {
      findings: [],
      agreement_map: { green: [], yellow: [], red: [] },
      synthesis: "No claims were corroborated.",
      iteration_count: 0,
      providers_used: [],
      total_sources: 0,
      corroboration: "partial",
    };
  }

  const findings = new Map<string, CorroborationFinding>();
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
          const searcher = resolveSearcher(slug, searchers);
          if (!searcher) return null;
          const results = await retryWithBackoff(
            async () => searcher(query, { max_results: firstPassMaxResults }),
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
          reconcileClaims(findings, result.value.results, similarityThreshold, authorityWeights);
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
            const searcher = resolveSearcher(gapProvider, searchers);
            if (!searcher) throw new Error(`No searcher for ${gapProvider}`);
            return await searcher(refinedQuery, { max_results: 3 });
          };
          const results = await retryWithBackoff(doCall, config.providers[gapProvider]);
          totalCalls++;
          providersUsed.add(gapProvider);
          increment(gapProvider, config.providers[gapProvider]?.rate_limit);

          reconcileClaims(findings, results, similarityThreshold, authorityWeights);
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

  const condensed = findingsArray.map((f) => ({
    ...f,
    sources: f.sources.slice(0, 3),
  }));

  if (config.corroboration.archive_sources === true) {
    await archiveCondensedSources(condensed);
  }

  const synthesis = buildSynthesis(condensed);

  const sourceTypes: Record<string, number> = {};
  for (const f of condensed) {
    for (const s of f.sources) {
      const t = s.source_type ?? "unknown";
      sourceTypes[t] = (sourceTypes[t] ?? 0) + 1;
    }
  }

  return {
    findings: condensed,
    agreement_map: agreementMap,
    synthesis,
    iteration_count: iteration,
    providers_used: [...providersUsed],
    total_sources: condensed.reduce((sum, f) => sum + f.sources.length, 0),
    corroboration:
      condensed.length > 0 && condensed.every((f) => f.confidence >= confidenceThreshold)
        ? "complete"
        : "partial",
    provenance: {
      tool: "infobroker",
      version: readVersion(),
      max_iterations: maxIterations,
      confidence_threshold: confidenceThreshold,
      source_types: sourceTypes,
    },
  };
}

function buildSynthesis(findings: CorroborationFinding[]): string {
  if (findings.length === 0) return "No claims were corroborated.";

  const sentences: string[] = [];
  for (const f of findings) {
    if (f.verdict === "confirmed") {
      sentences.push(`${f.sources.length} independent source(s) confirm ${f.topic}: ${truncateClaim(f.claim)}`);
    } else if (f.verdict === "contested" && f.perspectives && f.perspectives.length >= 2) {
      sentences.push(`Sources disagree on ${f.topic}: ${truncateClaim(f.perspectives[0])} versus ${truncateClaim(f.perspectives[1])}`);
    } else {
      sentences.push(`Unverified: ${f.topic}.`);
    }
  }
  return sentences.join(" ");
}

function truncateClaim(text: string): string {
  const t = (text || "").trim();
  return t.length > 140 ? `${t.slice(0, 140)}…` : t;
}

const ARCHIVE_CONCURRENCY = 4;
const ARCHIVE_TIMEOUT_MS = 4000;

async function archiveOne(url: string): Promise<string | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ARCHIVE_TIMEOUT_MS);
  try {
    const resp = await fetch(`https://web.archive.org/save/${encodeURIComponent(url)}`, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "Infobroker/1.0" },
    });
    const loc = resp.headers.get("location");
    if (!loc) return undefined;
    return new URL(loc, "https://web.archive.org").toString();
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

async function archiveCondensedSources(findings: CorroborationFinding[]): Promise<void> {
  const targets: Array<{ finding: CorroborationFinding; source: CorroborationFinding["sources"][number] }> = [];
  for (const f of findings) {
    for (const s of f.sources) {
      if (!s.archived_url && /^https?:\/\//i.test(s.url)) {
        targets.push({ finding: f, source: s });
      }
    }
  }

  let idx = 0;
  async function worker(): Promise<void> {
    while (idx < targets.length) {
      const i = idx++;
      const { source } = targets[i];
      source.archived_url = await archiveOne(source.url);
    }
  }

  const workers = Array.from({ length: Math.min(ARCHIVE_CONCURRENCY, targets.length) }, worker);
  await Promise.allSettled(workers);
}