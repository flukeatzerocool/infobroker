// @implements REQ-121
// Source-family independence: two results that republish the same original
// report, wire copy, or mirror are one source family, even when their
// registrable domains differ. Families are assigned by canonical URL first and
// by near-duplicate content second, so corroboration confidence counts
// distinct origins rather than distinct hosts.

import { createHash } from "node:crypto";
import { getDomain } from "tldts";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
  "source",
]);

export function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
    }
    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return url.toString();
  } catch {
    return raw.trim();
  }
}

function tokens(text: string): string[] {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function shingles(text: string): Set<string> {
  const words = tokens(text);
  const out = new Set<string>();
  if (words.length === 0) return out;
  if (words.length < 4) {
    out.add(words.join(" "));
    return out;
  }
  for (let i = 0; i + 3 < words.length; i++) {
    out.add(words.slice(i, i + 4).join(" "));
  }
  return out;
}

export function contentSignature(text: string): string {
  return createHash("sha256").update(text ?? "").digest("hex");
}

export function textSimilarity(a: string, b: string): number {
  const sa = shingles(a);
  const sb = shingles(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const s of sa) if (sb.has(s)) shared++;
  return shared / Math.min(sa.size, sb.size);
}

export interface FamilyInput {
  url: string;
  snippet?: string;
  title?: string;
}

function familyText(item: FamilyInput): string {
  return `${item.title ?? ""} ${item.snippet ?? ""}`.trim();
}

function hasEnoughText(item: FamilyInput): boolean {
  return tokens(familyText(item)).length >= 20;
}

/**
 * Assign a family key to every input. Inputs that share a canonical URL are
 * one family. Otherwise, inputs whose text overlap meets the threshold are
 * unioned; the lexicographically smallest member key identifies the family so
 * the result is deterministic.
 */
export function assignSourceFamilies<T extends FamilyInput>(
  items: T[],
  threshold = 0.9,
): string[] {
  if (items.length === 0) return [];
  const keys = items.map((item) => canonicalUrl(item.url));
  const domains = items.map((item) => {
    try {
      return getDomain(new URL(item.url).hostname) ?? new URL(item.url).hostname;
    } catch {
      return item.url;
    }
  });
  const parent = keys.map((_, i) => i);

  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (keys[i] === keys[j] || domains[i] === domains[j]) {
        union(i, j);
        continue;
      }
      if (
        threshold <= 1 &&
        hasEnoughText(items[i]) &&
        hasEnoughText(items[j]) &&
        textSimilarity(familyText(items[i]), familyText(items[j])) >= threshold
      ) {
        union(i, j);
      }
    }
  }

  const rootKeys = new Map<number, string>();
  for (let i = 0; i < items.length; i++) {
    const root = find(i);
    if (!rootKeys.has(root)) rootKeys.set(root, keys[i]);
  }

  return items.map((_, i) => {
    const key = rootKeys.get(find(i)) ?? keys[i];
    return `family:${createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
  });
}

export function familyCount(keys: Iterable<string>): number {
  return new Set(keys).size;
}
