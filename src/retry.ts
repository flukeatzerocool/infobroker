// @implements REQ-032

const DEFAULT_BASE_DELAY = 1000;
const DEFAULT_RETRY_COUNT = 3;

export class RetryableError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "RetryableError";
  }
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retryConfig?: { retry_count?: number; retry_backoff_ms?: number },
): Promise<T> {
  const baseDelay = retryConfig?.retry_backoff_ms ?? DEFAULT_BASE_DELAY;
  const maxRetries = retryConfig?.retry_count ?? DEFAULT_RETRY_COUNT;
  const delays: number[] = [];
  for (let i = 0; i < maxRetries; i++) {
    delays.push(baseDelay * Math.pow(2, i));
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (!isRetryable(lastError)) throw lastError;
      if (attempt < delays.length) {
        await sleep(delays[attempt] * (0.5 + Math.random() * 0.5));
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
  return /\b429\b|\b503\b|rate.?limit|too many requests|service unavailable/i.test(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
