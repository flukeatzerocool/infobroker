// @implements REQ-020i REQ-021
// Batch execution seam: run each array element independently so one failed or
// thrown element becomes a per-input error envelope instead of rejecting the
// whole batch. mergeItems (src/batch.ts) already merges partial envelopes; this
// module closes the remaining hole — a rejection from Promise.all.

export type BatchItemRunner = (item: string) => Promise<string>;
export type BatchThrowHandler = (item: string, error: unknown) => string;

/**
 * REQ-020i / REQ-021: settle every item, converting a rejection into the
 * envelope `onThrow` returns. Output order matches input order.
 */
export async function settleBatch(
  items: string[],
  runOne: BatchItemRunner,
  onThrow: BatchThrowHandler,
): Promise<string[]> {
  const settled = await Promise.allSettled(items.map((item) => runOne(item)));
  return settled.map((result, index) =>
    result.status === "fulfilled" ? result.value : onThrow(items[index], result.reason),
  );
}
