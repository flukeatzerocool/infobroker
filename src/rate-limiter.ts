// @implements REQ-030
import type { Config } from "./types.js";

interface RateLimit {
  perSecond: number;
  lastCall: number;
}

const limits: Map<string, RateLimit> = new Map();

export function configureProviderRateLimit(
  slug: string,
  config: { per_second?: number }
): void {
  const perSecond = config.per_second;
  if (!perSecond || perSecond <= 0) return;
  limits.set(slug, {
    perSecond,
    lastCall: 0,
  });
}

export function configureAllProviders(config: Config): void {
  for (const [slug, provider] of Object.entries(config.providers)) {
    if (provider.enabled) {
      configureProviderRateLimit(slug, provider.rate_limit);
    }
  }
}

export async function throttle(slug: string): Promise<void> {
  const limit = limits.get(slug);
  if (!limit || limit.perSecond <= 0) return;

  const elapsed = Date.now() - limit.lastCall;
  const minInterval = 1000 / limit.perSecond;

  if (elapsed < minInterval) {
    const delay = minInterval - elapsed;
    await sleep(delay);
  }

  // Record the post-sleep timestamp so consecutive calls each enforce the full
  // minimum interval (a pre-sleep timestamp under-throttles the next call).
  limits.set(slug, { ...limit, lastCall: Date.now() });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
