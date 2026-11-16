// @implements REQ-020k document-identity
// @implements REQ-020k publisher-not-identity
// @implements REQ-020k feed-and-section
// @implements REQ-020k producer-inventory
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ORIGIN_DECLARATIONS,
  ORIGIN_PRODUCERS,
  ORIGIN_REFERENCES,
  originIdentity,
} from "./origin-identity.js";

const REPO = join(import.meta.dirname, "..");

describe("originIdentity", () => {
  it("keeps the document path and folds the host", () => {
    expect(originIdentity("https://Example.COM/Story/One")).toBe("example.com/Story/One");
  });

  it("ignores query strings and fragments", () => {
    expect(originIdentity("https://x.example/story?utm_source=feed#top")).toBe("x.example/story");
  });

  it("treats path case as identity", () => {
    expect(originIdentity("https://x.example/Story")).not.toBe(originIdentity("https://x.example/story"));
  });

  it("collapses a trailing slash", () => {
    expect(originIdentity("https://x.example/story/")).toBe(originIdentity("https://x.example/story"));
  });

  it("strips section and feed suffixes", () => {
    for (const variant of ["/story/feed", "/story/amp", "/story/print", "/story/rss", "/story.rss", "/story/atom.xml"]) {
      expect(originIdentity(`https://x.example${variant}`), variant).toBe("x.example/story");
    }
  });

  it("refuses a publisher root", () => {
    expect(originIdentity("https://x.example")).toBeNull();
    expect(originIdentity("https://x.example/")).toBeNull();
    expect(originIdentity("https://x.example/?p=1")).toBeNull();
  });

  it("drops a default port and keeps a non-default one", () => {
    expect(originIdentity("https://x.example:443/a")).toBe("x.example/a");
    expect(originIdentity("https://x.example:8443/a")).toBe("x.example:8443/a");
  });

  it("refuses a non-http value and a malformed one without throwing", () => {
    expect(originIdentity("ftp://x.example/a")).toBeNull();
    expect(originIdentity("not a url")).toBeNull();
    expect(originIdentity("")).toBeNull();
    expect(originIdentity(undefined)).toBeNull();
  });
});

/** Producer = a line that assigns the property, not a declaration or a read. */
function producerMatches(source: string): string[] {
  const found: string[] = [];
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("//") || line.startsWith("*")) continue;
    // .original_source = value  (direct assignment or spread merge)
    if (/\.original_source\s*=(?!=)/.test(line)) {
      found.push(line);
      continue;
    }
    // original_source: <value>  in an object literal, where the value is not a type
    const literal = line.match(/original_source\s*:\s*(.+)$/);
    if (literal) {
      const value = literal[1]!.trim();
      if (!/^(string|number|boolean|unknown|any|Record\b|Array\b)/.test(value)) found.push(line);
    }
  }
  return found;
}

describe("original_source producer inventory", () => {
  it("lists every producer, declaration, and reference exactly once", () => {
    const files = (readdirSync(join(REPO, "src"), { recursive: true }) as string[])
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map((file) => `src/${file.replaceAll("\\", "/")}`);

    const producers: string[] = [];
    const mentions: string[] = [];
    for (const file of files) {
      const source = readFileSync(join(REPO, file), "utf8");
      if (!source.includes("original_source")) continue;
      mentions.push(file);
      if (producerMatches(source).length > 0) producers.push(file);
    }

    const registeredProducers = [...ORIGIN_PRODUCERS.map((entry) => entry.file)].sort();
    expect(producers.sort()).toEqual(registeredProducers);

    // Every mention that is not a producer is accounted for by name.
    const classified = new Set([
      ...registeredProducers,
      ...ORIGIN_DECLARATIONS,
      ...ORIGIN_REFERENCES,
    ]);
    expect(mentions.filter((file) => !classified.has(file))).toEqual([]);
  });

  it("would not classify a declaration or a read as a producer", () => {
    expect(producerMatches("  original_source?: string;")).toEqual([]);
    expect(producerMatches("    original_source: string;")).toEqual([]);
    expect(producerMatches("  if (!s.original_source) return false;")).toEqual([]);
    expect(producerMatches("  original_source: r.original_source,")).toHaveLength(1);
    expect(producerMatches("  result.original_source = value;")).toHaveLength(1);
  });
});
