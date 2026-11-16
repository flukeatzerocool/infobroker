// @implements REQ-137
// Outbound response bounds. Every provider body read goes through one of these
// helpers so a hostile or accidental multi-gigabyte response cannot be read
// into memory. Text is truncated at the cap and marked; a structured body that
// cannot parse at the truncation point is a failure.
import { ParseError } from "../retry.js";
import { getConfig } from "../config.js";

export interface CappedText {
  text: string;
  truncatedAtBytes: boolean;
}

/** The structural subset the readers need, so an injected fetch works too. */
export interface BodyResponse {
  headers: { get(name: string): string | null };
  body?: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
}

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

/** The configured byte cap, with the shipped default as the fallback. */
export function responseByteCap(): number {
  const configured = getConfig().fetch?.max_response_bytes;
  return typeof configured === "number" && Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_BYTES;
}

/** Wrap a response so `text()` and `json()` enforce the byte cap. */
export function cappedResponse(resp: Response, maxBytes: number = responseByteCap()): Response {
  return new Proxy(resp, {
    get(target, prop) {
      if (prop === "text") return async () => (await readTextCapped(target, maxBytes)).text;
      if (prop === "json") return async () => readJsonCapped(target, maxBytes);
      return Reflect.get(target, prop, target);
    },
  });
}

/**
 * Read a response body as UTF-8 text, stopping at `maxBytes` of decompressed
 * bytes. `Content-Length` is only a hint: a missing or lying header still
 * meets the streaming counter.
 */
export async function readTextCapped(resp: BodyResponse, maxBytes: number = DEFAULT_MAX_BYTES): Promise<CappedText> {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    return { text: await resp.text(), truncatedAtBytes: false };
  }
  if (!resp.body) {
    const text = await resp.text();
    if (Buffer.byteLength(text, "utf-8") <= maxBytes) return { text, truncatedAtBytes: false };
    return { text: Buffer.from(text, "utf-8").subarray(0, maxBytes).toString("utf-8"), truncatedAtBytes: true };
  }

  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = maxBytes - total;
      if (value.byteLength > remaining) {
        if (remaining > 0) chunks.push(value.subarray(0, remaining));
        total = maxBytes;
        truncated = true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return { text: body.toString("utf-8"), truncatedAtBytes: truncated };
}

/** Read a JSON body under the cap; a truncated body is a provider failure. */
export async function readJsonCapped<T = unknown>(resp: BodyResponse, maxBytes: number = DEFAULT_MAX_BYTES): Promise<T> {
  const { text, truncatedAtBytes } = await readTextCapped(resp, maxBytes);
  if (truncatedAtBytes) {
    throw new ParseError(`Response body exceeded the ${maxBytes}-byte cap and could not be parsed`);
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new ParseError(`Response body was not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}
