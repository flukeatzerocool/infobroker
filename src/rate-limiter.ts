// @implements REQ-030
import type { Config } from "./types.js";

interface RateLimit {
  perSecond: number;
  lastCall: number;
}

const limits: Map<string, RateLimit> = new Map();
// Per-provider serialization: a concurrent burst must queue behind the
// previous call instead of all reading the same lastCall and firing together.
const queues: Map<string, Promise<void>> = new Map();

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

export function throttle(slug: string): Promise<void> {
  const previous = queues.get(slug) ?? Promise.resolve();
  const next = previous.then(async () => {
    const limit = limits.get(slug);
    if (!limit || limit.perSecond <= 0) return;

    const elapsed = Date.now() - limit.lastCall;
    const minInterval = 1000 / limit.perSecond;

    if (elapsed < minInterval) {
      await sleep(minInterval - elapsed);
    }

    // Record the post-sleep timestamp so consecutive calls each enforce the
    // full minimum interval (a pre-sleep timestamp under-throttles the next
    // call).
    limits.set(slug, { ...limit, lastCall: Date.now() });
  });
  // Store a settled-safe tail so one rejection cannot poison the queue.
  queues.set(slug, next.catch(() => {}));
  return next;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
