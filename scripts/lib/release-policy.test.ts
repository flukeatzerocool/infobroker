// release-policy.test — unit tests for the tag and run-mode decisions.
// Role: test. Vitest discovers scripts/**/*.test.ts via vitest.config.ts.

import { describe, expect, it } from "vitest";
import { planCommits, resolveRunMode, tagAction } from "./release-policy.js";

const base = {
  currentVersion: "2026.11.04",
  tagExists: true,
  remoteExists: false,
  tagVersion: "2026.11.04",
  isAncestor: true,
};

describe("tagAction", () => {
  it("creates a tag that does not exist", () => {
    expect(tagAction({ ...base, tagExists: false }).action).toBe("create");
  });

  it("moves a local-only tag for the same version when it is an ancestor", () => {
    expect(tagAction(base).action).toBe("move");
  });

  it("refuses a tag that is already published, even for the same version", () => {
    const decision = tagAction({ ...base, remoteExists: true });
    expect(decision.action).toBe("refuse");
    expect(decision.reason).toContain("already published");
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

  it("never moves a published tag regardless of ancestry", () => {
    expect(tagAction({ ...base, remoteExists: true, isAncestor: false }).action).toBe("refuse");
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
    expect(resolveRunMode({})).toEqual({ ok: true, noCommit: false, noPush: false });
  });

  it("honours --no-push and --no-commit on a full run", () => {
    expect(resolveRunMode({ noCommit: true, noPush: true })).toEqual({
      ok: true,
      noCommit: true,
      noPush: true,
    });
  });
});

describe("planCommits", () => {
  const base = { date: "2026-11-07", version: "2026.11.07" };

  it("orders buckets by convention: spec, source, tests, pipeline, docs, release", () => {
    const plan = planCommits({
      ...base,
      paths: [
        "package.json",
        "README.md",
        "scripts/version.ts",
        "test-fixtures/fixture.json",
        "src/structured-fact.test.ts",
        "src/structured-fact.ts",
        "infobroker.md",
      ],
    });
    expect(plan.map((c) => c.key)).toEqual([
      "spec",
      "source",
      "tests",
      "pipeline",
      "docs",
      "release",
    ]);
  });

  it("places every path in exactly one bucket", () => {
    const paths = ["infobroker.md", "src/a.ts", "src/a.test.ts", "scripts/x.ts", "README.md", "package.json"];
    const plan = planCommits({ ...base, paths });
    const placed = plan.flatMap((c) => c.paths);
    expect(placed.sort()).toEqual([...paths].sort());
    expect(new Set(placed).size).toBe(placed.length);
  });

  it("uses conventional subjects with the run date and the release version", () => {
    const plan = planCommits({ ...base, paths: ["infobroker.md", "package.json"] });
    expect(plan[0].subject).toBe("Spec: update for 2026-11-07");
    expect(plan[1].subject).toBe("Release: 2026.11.07");
  });

  it("sends CHANGELOG.md to the release commit when the version changed", () => {
    const plan = planCommits({ ...base, paths: ["CHANGELOG.md"], versionChanged: true });
    expect(plan).toHaveLength(1);
    expect(plan[0].key).toBe("release");
  });

  it("sends a docs-only CHANGELOG edit to the docs bucket", () => {
    const plan = planCommits({ ...base, paths: ["CHANGELOG.md", "AGENTS.md"], versionChanged: false });
    expect(plan).toHaveLength(1);
    expect(plan[0].key).toBe("docs");
    expect(plan[0].paths).toEqual(["CHANGELOG.md", "AGENTS.md"]);
  });

  it("classifies content files by their own bucket (the rewind isolates stamps)", () => {
    const plan = planCommits({ ...base, paths: ["infobroker.md", "src/index.ts", "README.md"] });
    expect(plan.map((c) => c.key)).toEqual(["spec", "source", "docs"]);
  });

  it("keeps a test in the bucket of the area it tests", () => {
    const plan = planCommits({
      ...base,
      paths: ["src/lib/infobox.test.ts", "src/lib/infobox.ts", "scripts/version.test.ts"],
    });
    expect(plan.map((c) => c.key)).toEqual(["source", "pipeline"]);
    expect(plan[0].paths).toEqual(["src/lib/infobox.test.ts", "src/lib/infobox.ts"]);
    expect(plan[1].paths).toEqual(["scripts/version.test.ts"]);
  });

  it("keeps standalone fixtures and harness tests in the tests bucket", () => {
    const plan = planCommits({ ...base, paths: ["test-fixtures/a.json", "debate-club/x.test.ts"] });
    expect(plan.map((c) => c.key)).toEqual(["tests"]);
  });

  it("sends unknown and manifest paths to release", () => {
    const plan = planCommits({ ...base, paths: [".gitignore", "server.json", "test-fixtures/x.json"] });
    expect(plan.map((c) => c.key)).toEqual(["tests", "release"]);
    expect(plan[1].paths).toEqual([".gitignore", "server.json"]);
  });

  it("omits empty buckets and survives an empty input", () => {
    expect(planCommits({ ...base, paths: [] })).toEqual([]);
    expect(planCommits({ ...base, paths: ["src/a.ts"] })).toHaveLength(1);
  });

  it("deduplicates repeated paths", () => {
    const plan = planCommits({ ...base, paths: ["src/a.ts", "src/a.ts"] });
    expect(plan[0].paths).toEqual(["src/a.ts"]);
  });
});
