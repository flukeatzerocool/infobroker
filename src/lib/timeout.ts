// @implements REQ-035
// timeout.ts — one guarded timeout race for provider calls (REQ-035). The
// timer is cleared as soon as the work settles, so a fast success does not
// leave a pending timer behind, and it is unref'd so a live timer cannot keep
// the process alive on its own. No network, no clock of its own.

export interface UnrefTimer {
  unref?: () => void;
}

/**
 * Resolve `work`, rejecting with an error built from `message()` when
 * `timeoutMs` elapses first. A missing or non-positive timeout passes the work
 * through unchanged. The losing branch is always discarded: `Promise.race`
 * subscribes to both, so a late timeout rejection is handled, not unhandled.
 */
export async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number | undefined,
  message: () => string,
): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return work;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message())), timeoutMs);
        // Fake timers and non-Node timer types may not implement `unref`.
        (timer as UnrefTimer).unref?.();
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
