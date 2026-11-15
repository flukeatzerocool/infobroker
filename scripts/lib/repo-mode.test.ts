// repo-mode.test — unit tests for the shared repo-mode config builder. Role: test.

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isolatedKbPaths, repoProjectConfig, withIsolatedKb } from "./repo-mode.js";

const KB_ROOT = join("/tmp", "opencode", "run-kb");

describe("withIsolatedKb", () => {
  it("pins both run-scoped paths on an empty layer", () => {
    expect(withIsolatedKb({}, KB_ROOT)).toEqual({
      kb: {
        storage_path: join(KB_ROOT, "knowledge-base"),
        reports_dir: join(KB_ROOT, "reports"),
      },
    });
  });

  it("treats a missing layer as empty", () => {
    expect(withIsolatedKb(undefined, KB_ROOT)).toEqual({
      kb: {
        storage_path: join(KB_ROOT, "knowledge-base"),
        reports_dir: join(KB_ROOT, "reports"),
      },
    });
  });

  it("preserves unrelated layer keys and kb settings", () => {
    const layer = { output: { fallback_depth: 2 }, kb: { auto_index: true } };
    expect(withIsolatedKb(layer, KB_ROOT)).toEqual({
      output: { fallback_depth: 2 },
      kb: {
        auto_index: true,
        storage_path: join(KB_ROOT, "knowledge-base"),
        reports_dir: join(KB_ROOT, "reports"),
      },
    });
  });

  it("leaves the constrained profile's explicit kb: null alone", () => {
    const layer = { kb: null, corroboration: { kb_recall: false } };
    expect(withIsolatedKb(layer, KB_ROOT)).toEqual(layer);
  });

  it("rejects a non-object layer", () => {
    expect(() => withIsolatedKb([], KB_ROOT)).toThrow(/must be a JSON object/);
  });
});

describe("isolatedKbPaths", () => {
  it("keeps the store and reports inside the run root", () => {
    const paths = isolatedKbPaths(KB_ROOT);
    expect(paths.storagePath).toBe(join(KB_ROOT, "knowledge-base"));
    expect(paths.reportsPath).toBe(join(KB_ROOT, "reports"));
    expect(paths.storagePath.startsWith(KB_ROOT + "/")).toBe(true);
    expect(paths.reportsPath.startsWith(KB_ROOT + "/")).toBe(true);
  });
});

describe("repoProjectConfig", () => {
  it("declares this tree's skills and the local MCP command", () => {
    const repo = join("/tmp", "opencode", "repo");
    const layer = join("/tmp", "opencode", "layer.json");
    expect(repoProjectConfig(repo, layer)).toEqual({
      "$schema": "https://opencode.ai/config.json",
      skills: [join(repo, "skills")],
      mcp: {
        infobroker: {
          type: "local",
          command: [join(repo, "node_modules", ".bin", "tsx"), join(repo, "src", "index.ts")],
          environment: {
            INFOBROKER_CONFIG: join(repo, "config.json"),
            INFOBROKER_CONFIG_LOCAL: layer,
          },
        },
      },
    });
  });
});
