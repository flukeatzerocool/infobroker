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

// The MCP Registry server.json manifest follows semantic versioning, which
// forbids leading zeros (package.json uses a calendar-date spelling, e.g.
// "2026.08.23"). normalizeSemver derives the semver form ("2026.8.23") by
// stripping leading zeros from each numeric segment. Idempotent.
function normalizeSemver(version: string): string {
  return version
    .split(".")
    .map((seg) => String(Number(seg)))
    .join(".");
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

const lockPath = join(root, "package-lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
ok = check("package-lock.json version", lock.version ?? null, rootVersion) && ok;
ok = check("package-lock.json packages[\"\"] version", lock.packages?.[""]?.version ?? null, rootVersion) && ok;

const changelogPath = join(root, "CHANGELOG.md");
const changelog = readFileSync(changelogPath, "utf-8");
const dateRe = /^##\s+(\d{4})[.-](\d{2})[.-](\d{2})\b/gm;
let maxDate = "";
let firstDate: string | null = null;
let m: RegExpExecArray | null;
while ((m = dateRe.exec(changelog)) !== null) {
  const date = `${m[1]}.${m[2]}.${m[3]}`;
  if (firstDate === null) firstDate = date;
  if (date > maxDate) maxDate = date;
}
ok = check("CHANGELOG latest date", maxDate || null, rootVersion) && ok;
ok = check("CHANGELOG top entry date", firstDate, rootVersion) && ok;

// server.json is the MCP Registry manifest. Its version follows semver
// (leading zeros stripped), derived from package.json's calendar-date
// spelling. Verify both the top-level and the first package's version.
const serverJsonPath = join(root, "server.json");
try {
  const serverManifest = JSON.parse(readFileSync(serverJsonPath, "utf-8"));
  const expectedSemver = normalizeSemver(rootVersion);
  ok = check("server.json version", serverManifest.version ?? null, expectedSemver) && ok;
  const pkgVersion = (serverManifest.packages ?? [])[0]?.version ?? null;
  ok = check("server.json packages[0].version", pkgVersion, expectedSemver) && ok;
} catch {
  console.error("  FAIL  server.json version: missing or unparseable server.json");
  ok = false;
}

if (!ok) {
  console.error("\nVersion sync FAILED. Update all version references to match root package.json.");
  console.error("Root package.json version:", rootVersion);
  process.exit(1);
}

console.log("\nVersion sync OK. Root version:", rootVersion);
process.exit(0);
