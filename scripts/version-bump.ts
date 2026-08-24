import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${dd}`;
}

const version = today();

// server.json follows semver (leading zeros disallowed); derive it from the
// calendar-date spelling. Idempotent: an already-semver input is unchanged.
function normalizeSemver(v: string): string {
  return v.split(".").map((seg) => String(Number(seg))).join(".");
}

function replaceInFile(filePath: string, pattern: RegExp, replacement: string, label: string): boolean {
  const content = readFileSync(filePath, "utf-8");
  if (!content.match(pattern)) {
    console.error(`  FAIL  ${label}: pattern not found`);
    return false;
  }
  const updated = content.replace(pattern, replacement);
  writeFileSync(filePath, updated);
  console.log(`  OK   ${label}: → ${version}`);
  return true;
}

let ok = true;

const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`  OK   package.json: → ${version}`);

const lockPath = join(root, "package-lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
lock.version = version;
if (lock.packages && lock.packages[""]) {
  lock.packages[""].version = version;
}
writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
console.log(`  OK   package-lock.json: → ${version}`);

const indexPath = join(root, "src", "index.ts");

ok = replaceInFile(
  indexPath,
  /(\bversion:\s*)"[^"]*"/,
  `$1"${version}"`,
  "src/index.ts McpServer version"
) && ok;

const serverJsonPath = join(root, "server.json");
try {
  const serverManifest = JSON.parse(readFileSync(serverJsonPath, "utf-8"));
  const semver = normalizeSemver(version);
  serverManifest.version = semver;
  if (Array.isArray(serverManifest.packages) && serverManifest.packages.length > 0) {
    serverManifest.packages[0].version = semver;
  }
  writeFileSync(serverJsonPath, JSON.stringify(serverManifest, null, 2) + "\n");
  console.log(`  OK   server.json: → ${semver}`);
} catch {
  console.error(`  FAIL  server.json: missing or unparseable — leaving unchanged`);
  ok = false;
}

if (!ok) {
  console.error("\nVersion bump FAILED.");
  process.exit(1);
}

console.log(`\nAll version references bumped to ${version}.`);
process.exit(0);
