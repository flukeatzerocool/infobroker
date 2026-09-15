// @implements REQ-021a
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

// Deny-list of IPv4 ranges that must never be fetched as a public target.
// Beyond RFC1918/loopback/link-local this covers the unspecified address
// (0.0.0.0, which connecting to reaches the local host on Linux), CGNAT,
// IETF protocol assignments, TEST-NET documentation ranges, benchmarking,
// multicast, and the reserved 240/4 block (including 255.255.255.255).
const PRIVATE_V4_BLOCKS: Array<[number, number]> = [
  [0x00000000, 0x00ffffff], // 0.0.0.0/8 (this network / unspecified)
  [0x0a000000, 0x0affffff], // 10.0.0.0/8
  [0x64400000, 0x647fffff], // 100.64.0.0/10 (CGNAT)
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8 (loopback)
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 (link-local, incl. metadata)
  [0xac100000, 0xac1fffff], // 172.16.0.0/12
  [0xc0000000, 0xc00000ff], // 192.0.0.0/24 (IETF protocol assignments)
  [0xc0000200, 0xc00002ff], // 192.0.2.0/24 (TEST-NET-1)
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16
  [0xc6120000, 0xc613ffff], // 198.18.0.0/15 (benchmarking)
  [0xc6336400, 0xc63364ff], // 198.51.100.0/24 (TEST-NET-2)
  [0xcb007100, 0xcb0071ff], // 203.0.113.0/24 (TEST-NET-3)
  [0xe0000000, 0xefffffff], // 224.0.0.0/4 (multicast)
  [0xf0000000, 0xffffffff], // 240.0.0.0/4 (reserved)
];

function ipv4ToInt(addr: string): number {
  return addr.split(".").reduce((acc, octet) => (acc << 8) | (Number(octet) & 0xff), 0) >>> 0;
}

function isPrivateV4(addr: string): boolean {
  const int = ipv4ToInt(addr);
  return PRIVATE_V4_BLOCKS.some(([lo, hi]) => int >= lo && int <= hi);
}

// Recover the embedded IPv4 address of an IPv4-mapped IPv6 address
// (`::ffff:a.b.c.d` / `::ffff:7f00:1`, or the fully expanded form), so the
// mapped address is judged by the same IPv4 deny-list. Returns null when the
// address is not IPv4-mapped.
function ipv4MappedToV4(addr: string): string | null {
  let tail: string | null = null;
  if (addr.startsWith("::ffff:")) {
    tail = addr.slice("::ffff:".length);
  } else {
    const m = addr.match(/^(?:0{1,4}:){5}ffff:(.+)$/);
    if (m) tail = m[1];
  }
  if (!tail) return null;
  if (tail.includes(".")) return tail;
  const groups = tail.split(":").filter((g) => g.length > 0);
  if (groups.length < 2) return null;
  const hi = parseInt(groups[groups.length - 2], 16);
  const lo = parseInt(groups[groups.length - 1], 16);
  if (Number.isNaN(hi) || Number.isNaN(lo)) return null;
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function isReservedV6(addr: string): boolean {
  const lower = addr.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 unique-local (RFC4193)
  if (lower.startsWith("ff")) return true; // ff00::/8 multicast
  if (lower.startsWith("2001:db8:")) return true; // documentation
  if (/^2001:0{1,4}:/.test(lower)) return true; // Teredo (2001::/32)
  if (lower.startsWith("2002:")) return true; // 6to4 (embeds IPv4)
  if (lower.startsWith("64:ff9b:")) return true; // NAT64 (embeds IPv4)
  if (lower.startsWith("100::")) return true; // 100::/64 discard-only
  const mapped = ipv4MappedToV4(lower);
  if (mapped !== null) return isPrivateV4(mapped);
  return false;
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
