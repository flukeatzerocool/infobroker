// cli-flags.test.ts — unit tests for the removed-CLI-flag rule used by
// check-script-discipline. Kept as a pure-function test so the gate needs no
// deliberately-broken fixture file in the tree.
import { describe, expect, it } from "vitest";
import { findRemovedFlags } from "./cli-flags.js";

const scan = (content: string) => findRemovedFlags([{ file: "sample.sh", content }]);

describe("findRemovedFlags", () => {
  it("flags a removed flag on an opencode run invocation", () => {
    const out = scan('opencode run --attach "$URL" --agent build "hi"');
    expect(out).toHaveLength(1);
    expect(out[0].line).toBe(1);
    expect(out[0].message).toContain("--server");
  });

  it("flags the flag when it is not the first argument", () => {
    expect(scan('opencode run --title "t" --attach "$URL" "p"')).toHaveLength(1);
  });

  it("reports the correct line number", () => {
    const out = scan('line one\necho ok\nopencode run --attach "$URL" "p"');
    expect(out[0].line).toBe(3);
  });

  it("ignores comment lines that name the flag", () => {
    expect(scan('# opencode v2 removed `run --attach`\n// opencode run --attach is gone')).toEqual([]);
  });

  it("ignores unrelated commands that mention the flag word", () => {
    expect(scan('git commit -m "drop --attach usage"')).toEqual([]);
    expect(scan("opencode run --server \"$URL\" \"p\"")).toEqual([]);
  });

  it("does not match a flag with a longer suffix", () => {
    expect(scan("opencode run --attachment x")).toEqual([]);
  });

  it("scans every file it is given", () => {
    const out = findRemovedFlags([
      { file: "a.sh", content: 'opencode run --attach "$U" "p"' },
      { file: "b.mjs", content: 'execSync(`opencode run --attach $U "p"`)' },
    ]);
    expect(out.map((v) => v.file)).toEqual(["a.sh", "b.mjs"]);
  });
});
