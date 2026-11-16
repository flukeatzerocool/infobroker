// @implements REQ-021
import type { Provider } from "../types.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";
import { HttpStatusError } from "../lib/url-guard.js";
import { getEnvVar } from "../config.js";

const JINA_BASE = "https://r.jina.ai/";

/**
 * REQ-021: the reader endpoint is a deployment concern. `INFOBROKER_JINA_URL`
 * points the Jina-compatible renderer at a self-hosted reader (the same
 * convention `searxng` uses); the shipped default is unchanged. The value is
 * normalized to a trailing slash because the target is appended to it.
 */
export function jinaBaseUrl(): string {
  const override = getEnvVar("jina", "_URL");
  if (!override) return JINA_BASE;
  return override.endsWith("/") ? override : `${override}/`;
}

async function fetchPage(url: string, signal?: AbortSignal): Promise<string> {
  const target = `${jinaBaseUrl()}${url}`;
  const resp = await infobrokerFetch(target, { providerSlug: "jina", signal });

  if (!resp.ok) {
    throw new RetryableError(`Jina returned HTTP ${resp.status}`, resp.status);
  }

  const text = await resp.text();
  // Jina serves a 404/5xx page with HTTP 200 and a leading warning line. Treat
  // it as a renderer failure so the chain falls through to native_fetch; a page
  // that merely quotes the warning is served because content follows it.
  const lines = text.split(/\r?\n/);
  const warning = lines
    .map((line) => line.trim().match(/^Warning: Target URL returned error (\d{3})/))
    .find((match) => match !== null);
  if (warning) {
    // The warning line is Jina's own status report, so it is authoritative; a
    // real page that quotes it mid-sentence does not start a line with it.
    throw new HttpStatusError(`Jina reported HTTP ${warning[1]} for the target`, Number(warning[1]));
  }
  return text;
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${jinaBaseUrl()}https://example.com`, { providerSlug: "jina" });
    const elapsed = Date.now() - start;
    if (resp.ok) {
      return { status: "active", avgLatencyMs: elapsed };
    }
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "jina",
  tier: "free_http",
  capabilities: ["content_fetch"],
  search: async () => [],
  fetchPage,
  health,
};
