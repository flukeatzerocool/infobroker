// @implements REQ-081
// tool-footprint.ts — derivation of the token-footprint record from the live
// tool registration and the recent-response window.
//
// The advertised JSON Schema is produced by the SDK's own encoder with the
// same options the list handler uses (input: pipeStrategy "input", output:
// "output"), so `tool_schema_bytes` measures the schemas a client actually
// receives rather than a Zod internal representation. Tools are filtered by
// `enabled`, exactly as the list handler filters them, so the two sets agree.

import { normalizeObjectSchema } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";

export interface RegisteredTool {
  enabled?: boolean;
  inputSchema?: unknown;
  outputSchema?: unknown;
}

function schemaBytes(schema: unknown, direction: "input" | "output"): number {
  const object = normalizeObjectSchema(schema as Parameters<typeof normalizeObjectSchema>[0]);
  if (!object) return 0;
  return JSON.stringify(toJsonSchemaCompat(object, { strictUnions: true, pipeStrategy: direction })).length;
}

/** Bytes of every advertised schema (input and output) for the enabled tools. */
export function advertisedSchemaBytes(tools: Record<string, RegisteredTool> | undefined): number {
  if (!tools) return 0;
  let total = 0;
  for (const tool of Object.values(tools)) {
    if (tool.enabled === false) continue;
    total += schemaBytes(tool.inputSchema, "input");
    total += schemaBytes(tool.outputSchema, "output");
  }
  return total;
}

/** Median of the last `window` values; 0 when the window is empty. */
export function medianOfWindow(values: number[], window: number): number {
  const held = values.slice(-window);
  if (held.length === 0) return 0;
  const sorted = [...held].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}
