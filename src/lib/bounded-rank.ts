// @implements REQ-075
// bounded-rank.ts — a fixed-capacity ranking buffer. `offer` keeps only the
// best `capacity` values seen so far in a binary min-heap keyed by `compare`,
// so a scan over an unbounded match set retains at most `capacity` objects
// instead of one per match. Ordering is deterministic: equal ranks break on
// insertion index ascending, which is what a stable descending sort produces.
// No I/O, no clock.

export type Compare<T> = (a: T, b: T) => number;

interface Entry<T> {
  value: T;
  seq: number;
}

export class BoundedRank<T> {
  private readonly capacity: number;
  private readonly compare: Compare<T>;
  private heap: Entry<T>[] = [];
  private nextSeq = 0;

  constructor(capacity: number, compare: Compare<T>) {
    this.capacity = Number.isFinite(capacity) ? Math.max(0, Math.floor(capacity)) : 0;
    this.compare = compare;
  }

  /** How many values are currently retained (never more than the capacity). */
  get size(): number {
    return this.heap.length;
  }

  /** True when `a` ranks before `b` in the final output. */
  private before(a: Entry<T>, b: Entry<T>): boolean {
    const order = this.compare(a.value, b.value);
    if (order !== 0) return order > 0;
    return a.seq < b.seq;
  }

  /** True when `a` is the worse of the two — the heap's root direction. */
  private worse(a: Entry<T>, b: Entry<T>): boolean {
    return this.before(b, a);
  }

  offer(value: T): void {
    if (this.capacity === 0) return;
    const entry: Entry<T> = { value, seq: this.nextSeq++ };
    if (this.heap.length < this.capacity) {
      this.heap.push(entry);
      this.siftUp(this.heap.length - 1);
      return;
    }
    // The root is the worst retained entry; keep the newcomer only if it
    // outranks it.
    const root = this.heap[0]!;
    if (this.before(entry, root)) {
      this.heap[0] = entry;
      this.siftDown(0);
    }
  }

  /** Retained values, best first. */
  values(): T[] {
    return [...this.heap]
      .sort((a, b) => (this.before(a, b) ? -1 : this.before(b, a) ? 1 : 0))
      .map((entry) => entry.value);
  }

  private siftUp(start: number): void {
    let i = start;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.worse(this.heap[i]!, this.heap[parent]!)) break;
      [this.heap[i], this.heap[parent]] = [this.heap[parent]!, this.heap[i]!];
      i = parent;
    }
  }

  private siftDown(start: number): void {
    let i = start;
    const n = this.heap.length;
    for (;;) {
      const left = i * 2 + 1;
      const right = left + 1;
      let worst = i;
      if (left < n && this.worse(this.heap[left]!, this.heap[worst]!)) worst = left;
      if (right < n && this.worse(this.heap[right]!, this.heap[worst]!)) worst = right;
      if (worst === i) return;
      [this.heap[i], this.heap[worst]] = [this.heap[worst]!, this.heap[i]!];
      i = worst;
    }
  }
}
