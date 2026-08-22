// @implements REQ-021a
import { isIP } from "node:net";

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

export function assertPublicUrl(rawUrl: string, allowPrivate: boolean): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Refused non-HTTP protocol "${parsed.protocol}"`);
  }
  if (!allowPrivate && isPrivateHostname(parsed.hostname)) {
    throw new Error(`Refused private/internal network target "${parsed.hostname}"`);
  }
}
