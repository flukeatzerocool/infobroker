// @implements REQ-001
// The shared machine-readable tool-output schema (REQ-001). Every tool
// registers this Zod object as its `outputSchema`; the MCP SDK converts it to
// JSON Schema for tools/list and validates `structuredContent` against it.
// It is deliberately permissive: providers and tools add their own result and
// meta fields, and the same schema must accept both the OK and the ERROR
// envelope (errors stay non-`isError` text so clients branch on status/code).
import { z } from "zod";

export const envelopeOutputSchema = z.looseObject({
  status: z.enum(["ok", "error"]),
  provider: z.string(),
  results: z.array(z.looseObject({})).optional(),
  error: z
    .looseObject({
      code: z.string(),
      message: z.string(),
      remediation: z.string().optional(),
    })
    .optional(),
  meta: z.looseObject({}).optional(),
  notices: z.array(z.looseObject({})).optional(),
});
