// @implements REQ-001 REQ-002 REQ-003 REQ-073 REQ-102
// Debate-club contract assertions for the Infobroker tool response envelope.
// Pure and offline: parse the [OK]/[ERROR] text prefix and validate the JSON
// body against REQ-001/002 without touching the network or a model.

export type EnvelopePrefix = "[OK]" | "[ERROR]";

export interface ParsedEnvelope {
  prefix: EnvelopePrefix;
  ok: boolean;
  body: Record<string, unknown>;
  bytes: number;
}

export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}

export function parseEnvelope(text: string): ParsedEnvelope {
  const prefix: EnvelopePrefix | null = text.startsWith("[OK] ")
    ? "[OK]"
    : text.startsWith("[ERROR] ")
      ? "[ERROR]"
      : null;
  if (!prefix) {
    throw new ContractError(`response missing [OK]/[ERROR] prefix: ${JSON.stringify(text.slice(0, 80))}`);
  }
  const jsonText = text.slice(prefix.length + 1);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    throw new ContractError("response body is not valid JSON");
  }
  // The prefix is authoritative for ok/error; `expectOk` additionally enforces
  // the REQ-001 standard body {status, provider, results} for every tool.
  return { prefix, ok: prefix === "[OK]", body, bytes: text.length };
}

export function expectOk(text: string): Record<string, unknown> {
  const e = parseEnvelope(text);
  if (!e.ok) {
    throw new ContractError(`expected [OK], got [ERROR]: ${JSON.stringify(e.body.error ?? e.body)}`);
  }
  if (e.body.status !== "ok") {
    throw new ContractError("standard [OK] body missing status:'ok' (REQ-001)");
  }
  if (typeof e.body.provider !== "string") {
    throw new ContractError("standard [OK] body missing string `provider`");
  }
  if (!Array.isArray(e.body.results)) {
    throw new ContractError("standard [OK] body missing `results` array");
  }
  return e.body;
}

export function expectError(text: string, code?: string): Record<string, unknown> {
  const e = parseEnvelope(text);
  if (e.ok) {
    throw new ContractError("expected [ERROR], got [OK]");
  }
  const err = e.body.error as Record<string, unknown> | undefined;
  if (!err || typeof err.code !== "string" || typeof err.message !== "string" || typeof err.remediation !== "string") {
    throw new ContractError("error envelope missing code/message/remediation (REQ-002)");
  }
  if (code && err.code !== code) {
    throw new ContractError(`expected error code ${code}, got ${String(err.code)}`);
  }
  return e.body;
}

export function expectSearchResultShape(results: Array<Record<string, unknown>>): void {
  for (const r of results) {
    if (typeof r.title !== "string" || typeof r.url !== "string" || typeof r.snippet !== "string") {
      throw new ContractError(`result missing title/url/snippet (REQ-003): ${JSON.stringify(r)}`);
    }
  }
}

export function countResults(body: Record<string, unknown>): number {
  const results = body.results as unknown[];
  return Array.isArray(results) ? results.length : 0;
}

export function providerOf(body: Record<string, unknown>): string {
  return String(body.provider ?? "");
}
