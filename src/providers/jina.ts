// @implements REQ-021
import type { Provider } from "../types.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";
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

  return resp.text();
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
