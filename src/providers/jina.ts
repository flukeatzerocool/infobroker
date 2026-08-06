// @implements REQ-021
const JINA_BASE = "https://r.jina.ai/";

export async function jinaFetchPage(url: string): Promise<string> {
  const target = `${JINA_BASE}${url}`;
  const resp = await fetch(target, {
    headers: {
      "User-Agent": "Infobroker/1.0",
    },
  });

  if (!resp.ok) {
    if (resp.status === 429) {
      throw new Error("Jina rate limited");
    }
    throw new Error(`Jina returned HTTP ${resp.status}`);
  }

  return resp.text();
}

export async function jinaHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const start = Date.now();
  try {
    const resp = await fetch(`${JINA_BASE}https://example.com`, {
      headers: { "User-Agent": "Infobroker/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    const elapsed = Date.now() - start;
    if (resp.ok) {
      return { status: "active", avgLatencyMs: elapsed };
    }
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}
