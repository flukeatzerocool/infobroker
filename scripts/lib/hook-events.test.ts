// hook-events.test — the hook log reader and its path rule. Role: test.

import { createHash } from "node:crypto";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendHookEvent,
  hookEventsPath,
  readHookEvents,
  summarizeHooks,
  type HookEvent,
} from "./hook-events.js";

const dirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "hook-events-test-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("hookEventsPath", () => {
  it("keys the path on the resolved repository root", () => {
    const root = tempRoot();
    const key = createHash("sha256").update(realpathSync(root)).digest("hex").slice(0, 12);
    expect(hookEventsPath(root)).toContain(`hook-events-${key}.jsonl`);
  });
});

describe("readHookEvents", () => {
  it("reads a line in the hook's exact shape", () => {
    const root = tempRoot();
    const path = hookEventsPath(root);
    writeFileSync(
      path,
      `${JSON.stringify({
        at: "2026-11-07T12:00:00.000Z",
        event: "pre-push",
        action: "skipped",
        head: "deadbeef",
      })}\n`,
    );
    const events = readHookEvents(root);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("pre-push");
    expect(events[0].action).toBe("skipped");
    expect(events[0].head).toBe("deadbeef");
  });

  it("appends and reads back through the writer", () => {
    const root = tempRoot();
    appendHookEvent(root, { event: "pre-commit", action: "ran" });
    appendHookEvent(root, { event: "pre-push", action: "failed" });
    const events = readHookEvents(root);
    expect(events.map((event) => event.action)).toEqual(["ran", "failed"]);
  });

  it("skips a corrupt line instead of failing", () => {
    const root = tempRoot();
    const path = hookEventsPath(root);
    const valid = JSON.stringify({ at: "2026-11-07T12:00:00.000Z", event: "pre-push", action: "ran" });
    writeFileSync(path, `${valid}\n{not json}\n`);
    expect(readHookEvents(root)).toHaveLength(1);
  });

  it("treats an absent log as empty", () => {
    expect(readHookEvents(tempRoot())).toEqual([]);
  });
});

describe("summarizeHooks", () => {
  it("counts each action", () => {
    const events = [
      { at: "t", event: "pre-commit", action: "ran" },
      { at: "t", event: "pre-push", action: "skipped" },
      { at: "t", event: "pre-push", action: "skipped" },
    ] as HookEvent[];
    expect(summarizeHooks(events)).toEqual({ ran: 1, skipped: 2, failed: 0 });
  });
});
