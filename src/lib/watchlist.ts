// @implements REQ-125
// Deterministic watchlist parsing and due calculation for the monitoring
// runner. No network, filesystem, or clock side effects beyond the `now`
// argument, so the schedule logic is testable offline.

export interface WatchTopic {
  id: string;
  query: string;
  interval_hours: number;
  last_run?: string;
}

export interface Watchlist {
  topics: WatchTopic[];
}

export interface DueTopic extends WatchTopic {
  due: boolean;
}

export function parseWatchlist(raw: unknown): Watchlist {
  if (typeof raw !== "object" || raw === null || !Array.isArray((raw as Watchlist).topics)) {
    throw new Error("watchlist must be an object with a topics array");
  }
  const topics = (raw as Watchlist).topics.map((topic, index) => {
    if (typeof topic.id !== "string" || topic.id.trim() === "") throw new Error(`topics[${index}].id must be a non-empty string`);
    if (typeof topic.query !== "string" || topic.query.trim() === "") throw new Error(`topics[${index}].query must be a non-empty string`);
    if (typeof topic.interval_hours !== "number" || topic.interval_hours <= 0) throw new Error(`topics[${index}].interval_hours must be a positive number`);
    return topic;
  });
  return { topics };
}

export function dueTopics(watchlist: Watchlist, now: Date = new Date()): DueTopic[] {
  return watchlist.topics.map((topic) => {
    if (!topic.last_run) return { ...topic, due: true };
    const last = Date.parse(topic.last_run);
    if (!Number.isFinite(last)) return { ...topic, due: true };
    return { ...topic, due: now.getTime() - last >= topic.interval_hours * 3_600_000 };
  });
}

export interface RunDelta {
  new: string[];
  changed: string[];
  removed: string[];
}

export function diffClaims(previous: string[], current: string[]): RunDelta {
  const before = new Set(previous);
  const after = new Set(current);
  return {
    new: current.filter((claim) => !before.has(claim)),
    changed: [],
    removed: previous.filter((claim) => !after.has(claim)),
  };
}
