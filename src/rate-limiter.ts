// @implements REQ-030
import type { Config, ProviderConfig } from "./types.js";

interface RateLimit {
  perSecond: number;
  lastCall: number;
  jitterMs: number;
  random: () => number;
}

const limits: Map<string, RateLimit> = new Map();
// Per-provider serialization: a concurrent burst must queue behind the
// previous call instead of all reading the same lastCall and firing together.
const queues: Map<string, Promise<void>> = new Map();

export function configureProviderRateLimit(
  slug: string,
  config: ProviderConfig["rate_limit"],
  random: () => number = Math.random,
): void {
  const perSecond = config.per_second;
  if (!perSecond || perSecond <= 0) return;
  const jitter = config.jitter_ms;
  limits.set(slug, {
    perSecond,
    lastCall: 0,
    jitterMs: typeof jitter === "number" && jitter > 0 ? jitter : 0,
    random,
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
    // REQ-030: jitter decorrelates a burst without reducing the minimum
    // interval. A per-provider random function keeps tests deterministic.
    const jitter = limit.jitterMs > 0 ? limit.random() * limit.jitterMs : 0;
    const wait = minInterval - elapsed + jitter;

    if (wait > 0) {
      await sleep(wait);
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
