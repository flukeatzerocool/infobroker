import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const rootPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
const rootVersion = rootPkg.version;

function grepVersion(filePath: string, pattern: RegExp): string | null {
  const content = readFileSync(filePath, "utf-8");
  const match = content.match(pattern);
  return match ? match[1] : null;
}

function check(label: string, value: string | null, expected: string): boolean {
  if (value === expected) {
    console.log(`  OK  ${label}: ${value}`);
    return true;
  }
  console.error(`  FAIL  ${label}: expected ${expected}, got ${value ?? "null"}`);
  return false;
}

let ok = true;

const indexPath = join(root, "src", "index.ts");

// build_version is derived at runtime from package.json (BUILD_VERSION =
// readPackageVersion()); there is no hardcoded literal to compare. The
// invariant is that a hardcoded literal is absent, so a version bump cannot
// drift out of sync.
const buildLiteral = grepVersion(indexPath, /build_version:\s*"([^"]+)"/);
if (buildLiteral !== null) {
  console.error(`  FAIL  src/index.ts build_version is hardcoded ("${buildLiteral}") — should derive from package.json`);
  ok = false;
} else {
  console.log("  OK  src/index.ts build_version: derived from package.json");
}

const mcpVersion = grepVersion(indexPath, /^\s+version:\s*"([^"]+)"/m);
ok = check("src/index.ts McpServer version", mcpVersion, rootVersion) && ok;

if (!ok) {
  console.error("\nVersion sync FAILED. Update all version references to match root package.json.");
  console.error("Root package.json version:", rootVersion);
  process.exit(1);
}

console.log("\nVersion sync OK. Root version:", rootVersion);
process.exit(0);
