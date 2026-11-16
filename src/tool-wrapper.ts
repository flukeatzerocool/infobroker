// @implements REQ-001 REQ-002 REQ-102
// The last error path: a handler that throws must still return the documented
// [ERROR] envelope with a sanitized message, not raw text carried by the SDK's
// isError flag. Extracted so the conversion is unit-testable without a server.
import { err, providerRemediation } from "./error-envelope.js";
import { sanitizeErrorMessage } from "./lib/sanitize-error.js";

/** Build the [ERROR] envelope for a thrown handler. */
export function toolErrorEnvelope(name: string, error: unknown): string {
  const message = sanitizeErrorMessage(error instanceof Error ? error.message : String(error));
  return `[ERROR] ${JSON.stringify(
    err("system", "internal_error", `${name} failed: ${message}`, providerRemediation("Retry the request; if it persists, report the tool name and error code"))
  )}`;
}
