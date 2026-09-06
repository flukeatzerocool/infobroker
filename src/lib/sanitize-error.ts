// @implements REQ-102
// Exceptional-condition hygiene: tool error messages must never leak
// internals — absolute filesystem paths and stack-frame markers are stripped
// before a message is surfaced to the client.
export function sanitizeErrorMessage(message: string): string {
  return message.replace(/(?:\/[A-Za-z0-9_./-]+){2,}/g, "<path>").replace(/\.(?:ts|js):\d+:\d+/g, "");
}