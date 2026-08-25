import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { today, normalizeSemver, readRootPackage, ROOT } from "./lib/version.js";

// Bump every version reference to today's calendar date (CalVer), or check
// that every reference is in sync. The version locations are enumerated once
// here so bump and check can never drift apart.

function bump(): void {
  const version = today();
  let ok = true;

  const pkgPath = join(ROOT, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  pkg.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`  OK   package.json: → ${version}`);

  const lockPath = join(ROOT, "package-lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
  lock.version = version;
  if (lock.packages && lock.packages[""]) {
    lock.packages[""].version = version;
  }
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
  console.log(`  OK   package-lock.json: → ${version}`);

  const indexPath = join(ROOT, "src", "index.ts");
  const idx = readFileSync(indexPath, "utf-8");
  if (!/(\bversion:\s*)"[^"]*"/.test(idx)) {
    console.error(`  FAIL  src/index.ts McpServer version: pattern not found`);
    ok = false;
  } else {
    writeFileSync(indexPath, idx.replace(/(\bversion:\s*)"[^"]*"/, `$1"${version}"`));
    console.log(`  OK   src/index.ts McpServer version: → ${version}`);
  }

  const serverJsonPath = join(ROOT, "server.json");
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

  seedChangelog(version) || (ok = false);

  if (!ok) {
    console.error("\nVersion bump FAILED.");
    process.exit(1);
  }

  console.log(`\nAll version references bumped to ${version}.`);
}

// Seed a CHANGELOG entry header dated with the new version, so the version and
// the CHANGELOG top entry stay in lockstep (check asserts the top entry date
// equals package.json).
function seedChangelog(version: string): boolean {
  const changelogPath = join(ROOT, "CHANGELOG.md");
  try {
    const changelog = readFileSync(changelogPath, "utf-8");
    const header = `## ${version} — \n`;
    const headerRe = /^## /m;
    if (changelog.match(new RegExp(`^## ${version}`, "m"))) {
      console.log("  OK   CHANGELOG: entry for this version already exists");
    } else if (headerRe.test(changelog)) {
      writeFileSync(changelogPath, changelog.replace(headerRe, `${header}\n## `));
      console.log(`  OK   CHANGELOG: seeded ${version} entry header`);
    } else {
      writeFileSync(changelogPath, `# Changelog\n\n${header}\n`);
      console.log(`  OK   CHANGELOG: created with ${version} entry header`);
    }
    return true;
  } catch {
    console.error("  FAIL  CHANGELOG: could not read or write — seed the entry manually");
    return false;
  }
}

function grepVersion(filePath: string, pattern: RegExp): string | null {
  const content = readFileSync(filePath, "utf-8");
  const match = content.match(pattern);
  return match ? match[1] : null;
}

function check(): void {
  const rootVersion = readRootPackage().version;
  let ok = true;

  function assert(label: string, value: string | null, expected: string): boolean {
    if (value === expected) {
      console.log(`  OK  ${label}: ${value}`);
      return true;
    }
    console.error(`  FAIL  ${label}: expected ${expected}, got ${value ?? "null"}`);
    return false;
  }

  const indexPath = join(ROOT, "src", "index.ts");

  // build_version is derived at runtime from package.json; the invariant is that
  // a hardcoded literal is absent, so a version bump cannot drift out of sync.
  const buildLiteral = grepVersion(indexPath, /build_version:\s*"([^"]+)"/);
  if (buildLiteral !== null) {
    console.error(`  FAIL  src/index.ts build_version is hardcoded ("${buildLiteral}") — should derive from package.json`);
    ok = false;
  } else {
    console.log("  OK  src/index.ts build_version: derived from package.json");
  }

  const mcpVersion = grepVersion(indexPath, /^\s+version:\s*"([^"]+)"/m);
  ok = assert("src/index.ts McpServer version", mcpVersion, rootVersion) && ok;

  const lockPath = join(ROOT, "package-lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
  ok = assert("package-lock.json version", lock.version ?? null, rootVersion) && ok;
  ok = assert("package-lock.json packages[\"\"] version", lock.packages?.[""]?.version ?? null, rootVersion) && ok;

  const changelogPath = join(ROOT, "CHANGELOG.md");
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
  ok = assert("CHANGELOG latest date", maxDate || null, rootVersion) && ok;
  ok = assert("CHANGELOG top entry date", firstDate, rootVersion) && ok;

  if (firstDate !== null && firstDate !== rootVersion) {
    console.error("");
    console.error(`    The CHANGELOG top entry is dated ${firstDate} but package.json is ${rootVersion}.`);
    console.error("    To add a release dated today, run `npm run version-bump` — it seeds a matching");
    console.error("    CHANGELOG entry header, or: press on with a CHANGELOG entry dated");
    console.error(`    ${rootVersion} to match the current package version.`);
  }

  const serverJsonPath = join(ROOT, "server.json");
  try {
    const serverManifest = JSON.parse(readFileSync(serverJsonPath, "utf-8"));
    const expectedSemver = normalizeSemver(rootVersion);
    ok = assert("server.json version", serverManifest.version ?? null, expectedSemver) && ok;
    const pkgVersion = (serverManifest.packages ?? [])[0]?.version ?? null;
    ok = assert("server.json packages[0].version", pkgVersion, expectedSemver) && ok;
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
}

const sub = process.argv[2];
if (sub === "bump") {
  bump();
} else if (sub === "check") {
  check();
} else {
  console.error("Usage: npx tsx scripts/version.ts <bump|check>");
  process.exit(1);
}
