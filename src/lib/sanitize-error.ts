// @implements REQ-102
// Exceptional-condition hygiene: tool error messages must never leak
// internals — absolute filesystem paths, stack-frame markers, and
// credential-shaped values are stripped before a message reaches the client.
export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/(?:\/[A-Za-z0-9_./-]+){2,}/g, "<path>")
    .replace(/\.(?:ts|js):\d+:\d+/g, "")
    // Credentials never surface (REQ-011) even when a provider echoes them
    // back inside an error message.
    .replace(/\b[A-Z0-9_]+_(?:API_KEYS?|TOKEN|SECRET|PASSWORD)\s*[=:]\s*\S+/gi, "<redacted>")
    .replace(/\b(?:sk|pk|ghp|gho|ghs|ghu|xox[baprs])-[A-Za-z0-9_-]{12,}\b/g, "<redacted>")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "<redacted>")
    .replace(/\bBearer\s+[A-Za-z0-9._-]{12,}/gi, "Bearer <redacted>");
}