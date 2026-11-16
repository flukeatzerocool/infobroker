// citations.mjs — bounded-concurrency citation reachability sampling.
//
// Role: library module for the research-scenario evaluator. The caller injects
// `fetchImpl`, so tests run offline and the evaluator supplies the real fetch.
// A sample is advisory evidence only: it never gates a scenario. The cap bounds
// how long the loop may hold the run after the answer is already written.
//
// Exit contract: none (imported). Throws TypeError when `fetchImpl` is absent.

const DEFAULT_LIMIT = 4;
const DEFAULT_TIMEOUT_MS = 15_000;

async function classify(url, fetchImpl, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetchImpl(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal });
    } catch {
      response = await fetchImpl(url, { method: "GET", redirect: "follow", signal: ctrl.signal });
    }
    if (response.status >= 200 && response.status < 400) return "reachable";
    if (response.status === 403 || response.status === 429) return "blocked";
    if (response.status === 404 || response.status === 410) return "invalid";
    return `status-${response.status}`;
  } catch {
    return "error";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sample up to `count` URLs, at most `limit` in flight, preserving input order.
 *
 * @param {string[]} urls
 * @param {{count?: number, limit?: number, timeoutMs?: number, fetchImpl: typeof fetch}} options
 * @returns {Promise<Array<{url: string, status: string}>>}
 */
export async function sampleCitations(urls, options = {}) {
  const { count = urls.length, limit = DEFAULT_LIMIT, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl } = options;
  if (typeof fetchImpl !== "function") throw new TypeError("sampleCitations requires fetchImpl");
  const sample = urls.slice(0, Math.max(0, count));
  if (sample.length === 0) return [];
  const results = new Array(sample.length);
  let next = 0;
  async function worker() {
    while (next < sample.length) {
      const index = next++;
      results[index] = { url: sample[index], status: await classify(sample[index], fetchImpl, timeoutMs) };
    }
  }
  const width = Math.max(1, Math.min(limit, sample.length));
  await Promise.all(Array.from({ length: width }, worker));
  return results;
}
