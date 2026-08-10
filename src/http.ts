// @implements REQ-035 REQ-071
import { getConfig } from "./config.js";
import { USER_AGENT } from "./lib/html.js";

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

  return fetch(url, {
    ...fetchInit,
    headers,
    signal,
  });
}
