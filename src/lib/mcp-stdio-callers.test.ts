// @implements REQ-055 REQ-079
// One spawned-server client, one place. This check fails when a test suite
// reintroduces a local MCP client: a `withServer`/`startServer` helper, a spawn
// of `src/index.ts`, or a hand-rolled JSON-RPC envelope on stdin. Without it the
// extraction regresses the first time a suite needs a slightly different
// timeout — which is exactly how the ten copies drifted apart.
import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(import.meta.dirname, "..");

/** Test files under `src/` (the harness itself is a `.ts`, not a `.test.ts`). */
function testFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...testFiles(path));
    } else if (entry.name.endsWith(".test.ts")) {
      found.push(path);
    }
  }
  return found;
}

const LOCAL_HELPER = /\b(?:async\s+)?function\s+(withServer|withHeapedServer|startServer|startMcpServer)\b|\bconst\s+(withServer|withHeapedServer|startServer)\s*=/;
const SPAWNS_SERVER = /spawn\([\s\S]{0,240}?["'`]index\.ts["'`]/;
const HANDLES_RPC = /jsonrpc:\s*["']2\.0["']\s*,\s*id\s*:/;

describe("every spawned-server suite uses src/lib/mcp-stdio.ts", () => {
  const files = testFiles(SRC);

  test("the scan covers the suites that spawn a server", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  test("no suite declares its own server helper, spawns the entry point, or writes JSON-RPC by hand", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf-8");
      const where = relative(SRC, file);
      if (LOCAL_HELPER.test(text)) offenders.push(`${where}: local withServer/startServer helper`);
      if (SPAWNS_SERVER.test(text)) offenders.push(`${where}: spawns src/index.ts directly`);
      if (HANDLES_RPC.test(text)) offenders.push(`${where}: builds a JSON-RPC envelope by hand`);
    }
    expect(offenders, `use withServer/startMcpServer from src/lib/mcp-stdio.ts:\n${offenders.join("\n")}`).toEqual([]);
  });
});
