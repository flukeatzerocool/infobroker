// @implements REQ-021
import type { Provider } from "../types.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const JINA_BASE = "https://r.jina.ai/";

async function fetchPage(url: string): Promise<string> {
  const target = `${JINA_BASE}${url}`;
  const resp = await infobrokerFetch(target, { providerSlug: "jina" });

  if (!resp.ok) {
    throw new RetryableError(`Jina returned HTTP ${resp.status}`, resp.status);
  }

  return resp.text();
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${JINA_BASE}https://example.com`, { providerSlug: "jina" });
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
