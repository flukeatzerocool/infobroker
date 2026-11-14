// @implements REQ-081
// tool-footprint.test.ts — the footprint helpers derive from their inputs.
//
// A hardcoded number cannot satisfy these: each case changes the input surface
// or the window and requires the output to change with it.

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { advertisedSchemaBytes, medianOfWindow, type RegisteredTool } from "./tool-footprint.js";

function tool(marker: string, enabled = true, withOutput = false): RegisteredTool {
  return {
    enabled,
    inputSchema: { query: z.string().describe(`query ${marker}`) },
    outputSchema: withOutput ? { status: z.string().describe(`status ${marker}`) } : undefined,
  };
}

describe("medianOfWindow", () => {
  it("returns 0 for an empty window", () => {
    expect(medianOfWindow([], 100)).toBe(0);
  });

  it("returns the middle value for an odd count", () => {
    expect(medianOfWindow([9, 1, 5], 100)).toBe(5);
  });

  it("averages the two middle values for an even count", () => {
    expect(medianOfWindow([1, 2, 3, 4], 100)).toBe(2.5);
  });

  it("holds only the last window values", () => {
    expect(medianOfWindow([1000, 1, 2, 3], 3)).toBe(2);
    expect(medianOfWindow([1000, 1, 2, 3], 4)).toBe(2.5);
  });
});

describe("advertisedSchemaBytes", () => {
  it("returns 0 when no registration is available", () => {
    expect(advertisedSchemaBytes(undefined)).toBe(0);
  });

  it("grows with each advertised tool", () => {
    const one = advertisedSchemaBytes({ a: tool("a") });
    const two = advertisedSchemaBytes({ a: tool("a"), b: tool("b") });
    expect(one).toBeGreaterThan(0);
    expect(two).toBeGreaterThan(one);
  });

  it("counts the output schema too", () => {
    const without = advertisedSchemaBytes({ a: tool("a") });
    const withOutput = advertisedSchemaBytes({ a: tool("a", true, true) });
    expect(withOutput).toBeGreaterThan(without);
  });

  it("excludes a disabled tool, as the list handler does", () => {
    const enabledOnly = advertisedSchemaBytes({ a: tool("a") });
    const withDisabled = advertisedSchemaBytes({ a: tool("a"), b: tool("b", false) });
    expect(withDisabled).toBe(enabledOnly);
  });
});
