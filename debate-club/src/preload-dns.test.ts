// Regression: the Arena is documented as offline, but the SSRF guard resolves
// a hostname before fetching. Without a replay-time resolver the suite depends
// on real DNS and failed once when example.com could not be resolved. This
// test drives the preload directly and fails if fixture hosts reach the network
// resolver again.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const PRELOAD = join(import.meta.dirname, "..", "scripts", "preload.mjs");
const STUB = "93.184.216.34";
const dirs: string[] = [];

afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function probe(): { stub: unknown; other: unknown } {
  const dir = mkdtempSync(join(tmpdir(), "arena-dns-"));
  dirs.push(dir);
  const fixtures = join(dir, "fixtures.json");
  writeFileSync(
    fixtures,
    JSON.stringify({
      fixtureHosts: ["arena-fixture.invalid"],
      entries: [{ host: "arena-fixture.invalid", method: "GET", path_regex: "^/.*$", body: "ok" }],
    })
  );
  const script = join(dir, "probe.mjs");
  writeFileSync(
    script,
    [
      'import { lookup } from "node:dns/promises";',
      "let stub;",
      "try { stub = await lookup(\"arena-fixture.invalid\", { all: true }); } catch (e) { stub = `ERROR:${e.code}`; }",
      "let other;",
      "try { other = await lookup(\"arena-nonfixture.invalid\", { all: true }); } catch (e) { other = `ERROR:${e.code}`; }",
      "process.stdout.write(JSON.stringify({ stub, other }));",
    ].join("\n")
  );
  const out = execFileSync(process.execPath, ["--import", PRELOAD, script], {
    encoding: "utf8",
    env: {
      ...process.env,
      DEBATE_CLUB_MODE: "replay",
      DEBATE_CLUB_FIXTURES: fixtures,
      DEBATE_CLUB_CAPTURE: "",
      DEBATE_CLUB_UNMATCHED: "",
    },
  });
  return JSON.parse(out) as { stub: unknown; other: unknown };
}

describe("replay DNS resolver", () => {
  it("resolves a fixture host offline", () => {
    const { stub } = probe();
    expect(stub).toEqual([{ address: STUB, family: 4 }]);
  });

  it("does not stub a host the fixtures do not cover", () => {
    const { other } = probe();
    const addresses = Array.isArray(other)
      ? (other as Array<{ address: string }>).map((row) => row.address)
      : [];
    expect(addresses).not.toContain(STUB);
  });
});
