// release-policy.test — unit tests for the tag and run-mode decisions.
// Role: test. Vitest discovers scripts/**/*.test.ts via vitest.config.ts.

import { describe, expect, it } from "vitest";
import { resolveRunMode, tagAction } from "./release-policy.js";

const base = {
  currentVersion: "2026.11.04",
  tagExists: true,
  tagVersion: "2026.11.04",
  isAncestor: true,
  force: false,
};

describe("tagAction", () => {
  it("creates a tag that does not exist", () => {
    expect(tagAction({ ...base, tagExists: false }).action).toBe("create");
  });

  it("moves an existing tag for the same version when it is an ancestor", () => {
    expect(tagAction(base).action).toBe("move");
  });

  it("refuses a same-version tag that is not an ancestor of HEAD", () => {
    expect(tagAction({ ...base, isAncestor: false }).action).toBe("refuse");
  });

  it("refuses to relabel a tag that points at a different version", () => {
    const decision = tagAction({ ...base, tagVersion: "2026.10.28" });
    expect(decision.action).toBe("refuse");
    expect(decision.reason).toContain("2026.10.28");
  });

  it("refuses an unreadable tag version instead of guessing", () => {
    expect(tagAction({ ...base, tagVersion: null }).action).toBe("refuse");
  });

  it("moves when --force-tag is set, even for a non-ancestor", () => {
    expect(tagAction({ ...base, isAncestor: false, force: true }).action).toBe("move");
  });
});

describe("resolveRunMode", () => {
  it("does not publish a truncated range", () => {
    expect(resolveRunMode({ start: "scan", end: "readme" })).toEqual({
      ok: true,
      noCommit: true,
      noPush: true,
    });
  });

  it("rejects --to combined with --commit", () => {
    const mode = resolveRunMode({ start: "scan", end: "readme", commit: true });
    expect(mode.ok).toBe(false);
  });

  it("treats --from alone as testing mode", () => {
    expect(resolveRunMode({ start: "scan" })).toEqual({
      ok: true,
      noCommit: true,
      noPush: true,
    });
  });

  it("allows --from with --commit to publish", () => {
    expect(resolveRunMode({ start: "scan", commit: true })).toEqual({
      ok: true,
      noCommit: false,
      noPush: false,
    });
  });

  it("publishes a full run by default", () => {
    expect(resolveRunMode({}).noCommit).toBe(false);
  });

  it("honours --no-push and --no-commit on a full run", () => {
    expect(resolveRunMode({ noCommit: true, noPush: true })).toEqual({
      ok: true,
      noCommit: true,
      noPush: true,
    });
  });
});
