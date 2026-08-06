// @implements REQ-032

const DELAYS = [1000, 2000, 4000];

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
  return /429|503/.test(e.message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
