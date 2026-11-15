// @implements REQ-031b
// REQ-031b holds only if every provider forwards the cancellation signal into
// its outbound request. A provider that accepts `options` and drops `signal`
// cannot be cancelled, and no behavioural test can cover 26 modules cheaply —
// so this scan holds them together: every module with a `search` must forward
// `options?.signal` from that function (or a helper it calls).
import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PROVIDERS = join(import.meta.dirname);

interface ProviderModule {
  file: string;
  source: string;
}

function providerModules(): ProviderModule[] {
  return readdirSync(PROVIDERS)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((file) => ({ file, source: readFileSync(join(PROVIDERS, file), "utf-8") }))
    .filter((module) => /async function search\s*\(/.test(module.source));
}

/** The body of the module's `search` function, by brace balance. */
function searchBody(source: string): string {
  const start = source.search(/async function search\s*\(/);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return source.slice(open);
}

describe("every provider forwards the cancellation signal (REQ-031b)", () => {
  const modules = providerModules();

  test("the scan sees the provider modules", () => {
    expect(modules.length).toBeGreaterThanOrEqual(20);
  });

  test("a provider that takes options does not drop the signal", () => {
    const offenders: string[] = [];
    for (const { file, source } of modules) {
      const body = searchBody(source);
      const takesOptions = /async function search\s*\([^)]*options/.test(source);
      const forwards = /signal:\s*options\?\.signal/.test(source);
      if (!takesOptions) {
        offenders.push(`${file}: search() takes no options, so it cannot be cancelled`);
      } else if (!forwards && /infobrokerFetch\(|await fetch\(/.test(body)) {
        offenders.push(`${file}: search() fetches without passing signal`);
      }
    }
    expect(offenders, `forward options?.signal into the search fetch:\n${offenders.join("\n")}`).toEqual([]);
  });

  test("world_bank threads the signal through its helpers", () => {
    const source = readFileSync(join(PROVIDERS, "world_bank.ts"), "utf-8");
    for (const helper of ["fetchCountries", "searchIndicator", "searchDocuments"]) {
      expect(source, `${helper} must accept options`).toMatch(
        new RegExp(`async function ${helper}\\([^)]*options\\?\\.?:? ?SearchOptions`),
      );
    }
    expect(source.match(/signal: options\?\.signal/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});
