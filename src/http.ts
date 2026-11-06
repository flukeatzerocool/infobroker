// @implements REQ-035 REQ-071 REQ-111a
import { getConfig } from "./config.js";
import { USER_AGENT } from "./lib/html.js";
import { recordHttp } from "./call-log.js";
import { sessionStats } from "./session-stats.js";

export interface InfobrokerFetchOptions extends Omit<RequestInit, "signal"> {
  providerSlug?: string;
  timeoutMs?: number;
}

export async function infobrokerFetch(
  url: string | URL,
  options: InfobrokerFetchOptions = {}
): Promise<Response> {
  const { providerSlug, timeoutMs, ...fetchInit } = options;
  const config = getConfig();

  let timeout = timeoutMs;
  if (!timeout && providerSlug) {
    timeout = config.providers[providerSlug]?.timeout ?? 15000;
  }
  if (!timeout) {
    timeout = 15000;
  }

  const headers = new Headers(fetchInit.headers);
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", USER_AGENT);
  }

  const signal = AbortSignal.timeout(timeout);
  const start = Date.now();

  try {
    const response = await fetch(url, {
      ...fetchInit,
      headers,
      signal,
    });
    if (providerSlug) {
      const elapsed = Date.now() - start;
      recordHttp(providerSlug, response.ok, elapsed, response.status);
      sessionStats.recordHttp(providerSlug, response.ok, elapsed);
    }
    return response;
  } catch (error) {
    if (providerSlug) {
      const elapsed = Date.now() - start;
      recordHttp(providerSlug, false, elapsed);
      sessionStats.recordHttp(providerSlug, false, elapsed);
    }
    throw error;
  }
}
