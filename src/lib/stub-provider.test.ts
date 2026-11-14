// @implements REQ-024b
// The hermetic harness is the only way a spawned server receives its config, so
// an option it drops silently would leave a fixture running against a shipped
// default. These cases pin the config it writes and its rejection of a key it
// does not understand.
import { afterAll, describe, expect, it } from "vitest";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { writeHermeticConfig, type HermeticConfigOptions } from "./stub-provider.js";

const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function written(options: HermeticConfigOptions): { root: string; config: Record<string, any> } {
  const cfg = writeHermeticConfig("http://127.0.0.1:1", options);
  roots.push(cfg.root);
  return { root: cfg.root, config: JSON.parse(readFileSync(join(cfg.root, "config.json"), "utf-8")) };
}

describe("hermetic config option forwarding", () => {
  it("merges preservation and source_quality over the shipped blocks", () => {
    const { config } = written({
      preservation: { enabled: false },
      source_quality: { blocklist: ["example.com"] },
    });
    // The shipped sibling keys survive the override.
    expect(config.preservation).toMatchObject({ enabled: false, max_bytes: 2_000_000 });
    expect(config.source_quality).toMatchObject({
      enabled: true,
      blocklist: ["example.com"],
    });
  });

  it("throws on an option it does not understand instead of dropping it", () => {
    expect(() =>
      writeHermeticConfig("http://127.0.0.1:1", { bogus: {} } as unknown as HermeticConfigOptions),
    ).toThrow(/unknown option "bogus"/);
  });

  it("keeps the isolated knowledge base under the temp root", () => {
    const baseRun = written({});
    const base = baseRun.config.kb as Record<string, unknown>;
    expect(base.storage_path).toBe(join(baseRun.root, "knowledge-base"));
    expect(base.auto_index).toBe(false);

    const { root, config } = written({ kb: { auto_index: true } });
    const kb = config.kb as Record<string, unknown>;
    expect(kb.storage_path).toBe(join(root, "knowledge-base"));
    expect(kb.auto_index).toBe(true);
  });
});
