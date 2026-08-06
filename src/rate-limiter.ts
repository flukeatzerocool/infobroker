// @implements REQ-030
interface RateLimit {
  perSecond: number;
  lastCall: number;
}

const limits: Map<string, RateLimit> = new Map();

export function configureProviderRateLimit(
  slug: string,
  config: { per_second?: number }
): void {
  limits.set(slug, {
    perSecond: config.per_second ?? 0,
    lastCall: 0,
  });
}

export async function throttle(slug: string): Promise<void> {
  const limit = limits.get(slug);
  if (!limit || limit.perSecond <= 0) return;

  const now = Date.now();
  const elapsed = now - limit.lastCall;
  const minInterval = 1000 / limit.perSecond;

  if (elapsed < minInterval) {
    const delay = minInterval - elapsed;
    await sleep(delay);
  }

  limits.set(slug, { ...limit, lastCall: Date.now() });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function removeProvider(slug: string): void {
  limits.delete(slug);
}
