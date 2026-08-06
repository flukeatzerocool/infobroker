// @implements REQ-032

const DELAYS = [1000, 2000, 4000];

export class RetryableError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "RetryableError";
  }
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  slug: string,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= DELAYS.length; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (!isRetryable(lastError)) throw lastError;
      if (attempt < DELAYS.length) {
        await sleep(DELAYS[attempt]);
      }
    }
  }
  throw lastError!;
}

function isRetryable(e: Error): boolean {
  if (e instanceof RetryableError) {
    return e.status === 429 || e.status === 503;
  }
  const msg = e.message;
  return /429|503|rate.?limit|too many requests|service unavailable/i.test(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
