// hook-events.ts — the local hook-invocation log read by the loop audit.
//
// The git hooks append one JSON line per invocation (see the `hook_event`
// helper in .githooks/pre-commit and .githooks/pre-push). The path rule is
// shared with the gate-run record: $TMPDIR/infobroker/, keyed by the resolved
// repository root, so two checkouts on one machine never read each other's log.
//
// Local state only: no network, no wall-clock decisions (the timestamp is
// informational), and a corrupt line is skipped rather than failing the audit.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoKey, stateDir } from "./gate-run-manifest.js";

export const HOOK_EVENT_CAP = 2000;

export type HookEventName = "pre-commit" | "pre-push";
export type HookAction = "ran" | "skipped" | "failed";

export interface HookEvent {
  at: string;
  event: HookEventName;
  action: HookAction;
  head?: string;
}

/** hookEventsPath — the JSONL log for one checkout. */
export function hookEventsPath(root: string): string {
  return join(stateDir(), `hook-events-${repoKey(root)}.jsonl`);
}

/**
 * appendHookEvent — record one invocation. Best-effort: telemetry must never
 * turn a passing hook into a failing one.
 */
export function appendHookEvent(root: string, event: Omit<HookEvent, "at">): void {
  try {
    mkdirSync(stateDir(), { recursive: true, mode: 0o700 });
    const line = JSON.stringify({ at: new Date().toISOString(), ...event });
    appendFileSync(hookEventsPath(root), `${line}\n`, { mode: 0o600 });
  } catch {
    // A read-only state directory (or a full disk) is not a reason to block a
    // commit; the audit simply sees fewer events.
  }
}

/** readHookEvents — the recorded events, oldest first, capped to the last N. */
export function readHookEvents(root: string): HookEvent[] {
  const path = hookEventsPath(root);
  if (!existsSync(path)) return [];
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    // An unreadable log is treated as absent; the audit reports zero events.
    return [];
  }
  const events: HookEvent[] = [];
  for (const line of raw.split("\n").filter(Boolean).slice(-HOOK_EVENT_CAP)) {
    try {
      const parsed = JSON.parse(line) as HookEvent;
      if (!parsed.at || !parsed.event || !parsed.action) continue;
      events.push(parsed);
    } catch {
      // A truncated final line (interrupted write) is disposable telemetry;
      // skipping it keeps the audit running instead of failing on log damage.
    }
  }
  return events;
}

/** summarizeHooks — counts by action for the audit report. */
export function summarizeHooks(events: HookEvent[]): Record<HookAction, number> {
  const counts: Record<HookAction, number> = { ran: 0, skipped: 0, failed: 0 };
  for (const event of events) {
    if (event.action in counts) counts[event.action] += 1;
  }
  return counts;
}
