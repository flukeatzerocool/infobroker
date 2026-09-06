// @implements REQ-021a
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const PRIVATE_V4_BLOCKS: Array<[number, number]> = [
  [0x0a000000, 0x0affffff], // 10.0.0.0/8
  [0xac100000, 0xac1fffff], // 172.16.0.0/12
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 (link-local, incl. metadata)
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8 (loopback)
];

function ipv4ToInt(addr: string): number {
  return addr.split(".").reduce((acc, octet) => (acc << 8) | (Number(octet) & 0xff), 0) >>> 0;
}

function isPrivateV4(addr: string): boolean {
  const int = ipv4ToInt(addr);
  return PRIVATE_V4_BLOCKS.some(([lo, hi]) => int >= lo && int <= hi);
}

function isReservedV6(addr: string): boolean {
  const lower = addr.toLowerCase();
  return (
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fe80:") || // link-local
    lower.startsWith("fc") || lower.startsWith("fd") // unique-local (RFC4193)
  );
}

export function isPrivateHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return true;
  }
  const kind = isIP(host);
  if (kind === 4) return isPrivateV4(host);
  if (kind === 6) return isReservedV6(host);
  return false;
}

export class SsrRefusalError extends Error {}

export function assertPublicUrl(rawUrl: string, allowPrivate: boolean): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SsrRefusalError(`Refused non-HTTP protocol "${parsed.protocol}"`);
  }
  if (!allowPrivate && isPrivateHostname(parsed.hostname)) {
    throw new SsrRefusalError(`Refused private/internal network target "${parsed.hostname}"`);
  }
}

export type Resolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

export const defaultResolver: Resolver = async (hostname) => {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => ({ address: r.address, family: r.family }));
};

/**
 * REQ-021a "resolves to": beyond the string-level check, resolve a hostname
 * and refuse the fetch when any resolved address is loopback, private,
 * link-local, or metadata. Fail closed when resolution itself fails. The
 * resolver is injectable for tests; production uses the DNS default.
 */
export async function assertPublicUrlResolved(
  rawUrl: string,
  allowPrivate: boolean,
  resolver: Resolver = defaultResolver
): Promise<void> {
  assertPublicUrl(rawUrl, allowPrivate);
  const host = new URL(rawUrl).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(host) !== 0) return;
  if (isPrivateHostname(host)) return;

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await resolver(host);
  } catch {
    throw new SsrRefusalError(`Could not resolve host "${host}"`);
  }
  for (const addr of addresses) {
    if (allowPrivate) continue;
    const isPrivate = addr.family === 4 ? isPrivateV4(addr.address) : isReservedV6(addr.address);
    if (isPrivate) {
      throw new SsrRefusalError(`Refused resolved private/internal address "${addr.address}" for host "${host}"`);
    }
  }
}

export type FetchLike = (
  url: string,
  init?: { redirect?: "manual"; headers?: Record<string, string> },
) => Promise<{
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export async function fetchFollowRedirects(
  url: string,
  allowPrivate: boolean,
  fetchImpl: FetchLike,
  maxHops = 5,
  userAgent = "Infobroker/1.0",
  resolver: Resolver = defaultResolver,
): Promise<string> {
  await assertPublicUrlResolved(url, allowPrivate, resolver);
  let current = url;
  for (let hop = 0; hop < maxHops; hop++) {
    const resp = await fetchImpl(current, {
      redirect: "manual",
      headers: { "User-Agent": userAgent },
    });
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      if (!loc) throw new Error(`HTTP ${resp.status} with no Location header`);
      current = new URL(loc, current).toString();
      // REQ-021a: re-apply the SSRF guard (including resolution) at each hop.
      await assertPublicUrlResolved(current, allowPrivate, resolver);
      continue;
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  }
  throw new Error(`Too many redirects for ${url}`);
}
