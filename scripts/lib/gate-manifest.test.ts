// gate-manifest.test — unit tests for the gate manifest. Role: test.
//
// The manifest is the only definition of what `check` and `check:fast` run, so
// every entry must resolve to a real npm script and the fast subset must stay a
// strict subset of the full order.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GATES, fastGates, gateCommand, renderGatesBlock, renderGatesTable } from "./gate-manifest.js";

const ROOT = join(import.meta.dirname, "..", "..");
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as {
  scripts: Record<string, string>;
};

describe("gate manifest", () => {
  it("names only existing npm scripts", () => {
    const missing = GATES.filter((gate) => !(gate.name in PKG.scripts)).map((gate) => gate.name);
    expect(missing).toEqual([]);
  });

  it("has unique gate names", () => {
    const names = GATES.map((gate) => gate.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps the fast subset strict and in manifest order", () => {
    const fast = fastGates().map((gate) => gate.name);
    expect(fast.length).toBeGreaterThan(0);
    expect(fast.length).toBeLessThan(GATES.length);
    const full = GATES.map((gate) => gate.name);
    expect(fast).toEqual(full.filter((name) => fast.includes(name)));
    expect(fast).not.toContain("audit");
    expect(fast).not.toContain("check-pack");
    expect(fast).not.toContain("test-debate-club");
  });

  it("uses no table-breaking characters in descriptions", () => {
    for (const gate of GATES) {
      expect(gate.description).not.toContain("|");
      expect(gate.description).not.toContain("\n");
    }
  });

  it("renders one table row per gate", () => {
    const rows = renderGatesTable().split("\n");
    expect(rows[0]).toBe("| Gate | What it checks |");
    expect(rows[1]).toBe("|---|---|");
    expect(rows.length - 2).toBe(GATES.length);
    expect(renderGatesBlock()).toContain("<!-- gates:begin -->");
    expect(renderGatesBlock()).toContain("<!-- gates:end -->");
  });

  it("runs a gate through its npm script", () => {
    expect(gateCommand(GATES[0])).toEqual(["npm", "run", GATES[0].name]);
  });
});
