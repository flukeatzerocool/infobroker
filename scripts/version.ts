#!/usr/bin/env npx tsx
// version.ts — build tool: rewrite every version reference to a target CalVer
// (bump = today), or check that every reference is in sync. The version
// locations are enumerated once here so bump, set, and check can never drift
// apart. `set` exists so the push pipeline can rewind the stamps to the
// pre-run version while it builds a split commit series, then re-apply them.
//
// Exit codes: 0 = pass; 1 = sync/rewrite failure or bad usage; 2 = unexpected.
// Usage: npx tsx scripts/version.ts <bump|check|set <YYYY.MM.DD>>

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { today, normalizeSemver, ROOT } from "./lib/version.js";
import { handleHelp } from "./lib/args.js";

const USAGE = `Usage: npx tsx scripts/version.ts <bump|check|set <YYYY.MM.DD>>

  bump            Rewrite every version reference to today's calendar date and
                  seed a matching CHANGELOG entry header.
  set <version>   Rewrite every version reference to an explicit CalVer
                  (2026.11.06). Does not touch CHANGELOG. Used by the push
                  pipeline to rewind stamps for a split commit series.
  check           Verify every version reference is in sync.
`;
handleHelp(process.argv, USAGE);

const SPEC_VERSION_RE = /^\*\*Spec version:\*\* [0-9.]+(?=\s*$)/m;
const README_SPEC_REF_RE = /\(v[0-9]+\.[0-9]+\.[0-9]+\)(?=, which defines every requirement)/;
const README_UPDATED_RE = /^Last updated: \d{4}-\d{2}-\d{2}\.(?=\s*$)/m;

function isoDate(version: string): string {
  return version.replace(/\./g, "-");
}

// Rewrite every enumerated version site to `version`. Returns false when a site
// cannot be found — a silently skipped site is a rewind that leaves the tree
// inconsistent, so a missing anchor is a hard failure.
function setVersion(version: string, root: string = ROOT): boolean {
  let ok = true;
  const fail = (label: string, detail: string): void => {
    console.error(`  FAIL  ${label}: ${detail}`);
    ok = false;
  };

  const pkgPath = join(root, "package.json");
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    pkg.version = version;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`  OK   package.json: → ${version}`);
  } catch {
    fail("package.json", "missing or unparseable");
  }

  const lockPath = join(root, "package-lock.json");
  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
    lock.version = version;
    if (lock.packages && lock.packages[""]) {
      lock.packages[""].version = version;
    }
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
    console.log(`  OK   package-lock.json: → ${version}`);
  } catch {
    fail("package-lock.json", "missing or unparseable");
  }

  const indexPath = join(root, "src", "index.ts");
  try {
    const idx = readFileSync(indexPath, "utf-8");
    if (!/(\bversion:\s*)"[^"]*"/.test(idx)) {
      fail("src/index.ts McpServer version", "pattern not found");
    } else {
      writeFileSync(indexPath, idx.replace(/(\bversion:\s*)"[^"]*"/, `$1"${version}"`));
      console.log(`  OK   src/index.ts McpServer version: → ${version}`);
    }
  } catch {
    fail("src/index.ts", "missing or unreadable");
  }

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
    fail("server.json", "missing or unparseable — leaving unchanged");
  }

  const agentsPath = join(root, "AGENTS.md");
  try {
    const agents = readFileSync(agentsPath, "utf-8");
    if (!/\(v[0-9.]+\)/.test(agents)) {
      fail("AGENTS.md", "version stamp '(vX.Y.Z)' not found");
    } else {
      writeFileSync(agentsPath, agents.replace(/\(v[0-9.]+\)/, `(v${version})`));
      console.log(`  OK   AGENTS.md: → (v${version})`);
    }
  } catch {
    fail("AGENTS.md", "missing or unreadable");
  }

  const specPath = join(root, "infobroker.md");
  try {
    const spec = readFileSync(specPath, "utf-8");
    if (!SPEC_VERSION_RE.test(spec)) {
      fail("infobroker.md", "`**Spec version:**` stamp not found");
    } else {
      writeFileSync(specPath, spec.replace(SPEC_VERSION_RE, `**Spec version:** ${version}`));
      console.log(`  OK   infobroker.md spec version: → ${version}`);
    }
  } catch {
    fail("infobroker.md", "missing or unreadable");
  }

  const readmePath = join(root, "README.md");
  try {
    let readme = readFileSync(readmePath, "utf-8");
    let changed = false;
    if (!README_SPEC_REF_RE.test(readme)) {
      fail("README.md", "spec reference '(vX.Y.Z), which defines every requirement' not found");
    } else {
      readme = readme.replace(README_SPEC_REF_RE, `(v${version})`);
      changed = true;
    }
    // The "Last updated" date is a CalVer-derived stamp, so it follows the
    // version. It is rewritten but not asserted by `check`.
    if (!README_UPDATED_RE.test(readme)) {
      fail("README.md", "`Last updated:` line not found");
    } else {
      readme = readme.replace(README_UPDATED_RE, `Last updated: ${isoDate(version)}.`);
      changed = true;
    }
    if (changed) {
      writeFileSync(readmePath, readme);
      console.log(`  OK   README.md: → (v${version}) / ${isoDate(version)}`);
    }
  } catch {
    fail("README.md", "missing or unreadable");
  }

  return ok;
}

function bump(): void {
  const version = today();
  if (!setVersion(version)) {
    console.error("\nVersion bump FAILED.");
    process.exit(1);
  }
  if (!seedChangelog(version)) {
    console.error("\nVersion bump FAILED.");
    process.exit(1);
  }
  console.log(`\nAll version references bumped to ${version}.`);
}

// Seed a CHANGELOG entry header dated with the new version, so the version and
// the CHANGELOG top entry stay in lockstep (check asserts the top entry date
// equals package.json).
function seedChangelog(version: string, root: string = ROOT): boolean {
  const changelogPath = join(root, "CHANGELOG.md");
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
    // Unreadable CHANGELOG is not fatal for `set` (it does not touch the file),
    // but it is for `bump`, which must seed the entry.
    console.error("  FAIL  CHANGELOG: could not read or write — seed the entry manually");
    return false;
  }
}

function grepVersion(filePath: string, pattern: RegExp): string | null {
  const content = readFileSync(filePath, "utf-8");
  const match = content.match(pattern);
  return match ? match[1] : null;
}

function check(root: string = ROOT): boolean {
  const rootVersion = JSON.parse(readFileSync(join(root, "package.json"), "utf-8")).version as string;
  let ok = true;

  function assert(label: string, value: string | null, expected: string): boolean {
    if (value === expected) {
      console.log(`  OK  ${label}: ${value}`);
      return true;
    }
    console.error(`  FAIL  ${label}: expected ${expected}, got ${value ?? "null"}`);
    return false;
  }

  const indexPath = join(root, "src", "index.ts");

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

  const lockPath = join(root, "package-lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
  ok = assert("package-lock.json version", lock.version ?? null, rootVersion) && ok;
  ok = assert("package-lock.json packages[\"\"] version", lock.packages?.[""]?.version ?? null, rootVersion) && ok;

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
  ok = assert("CHANGELOG latest date", maxDate || null, rootVersion) && ok;
  ok = assert("CHANGELOG top entry date", firstDate, rootVersion) && ok;

  if (firstDate !== null && firstDate !== rootVersion) {
    console.error("");
    console.error(`    The CHANGELOG top entry is dated ${firstDate} but package.json is ${rootVersion}.`);
    console.error("    To add a release dated today, run `npm run version-bump` — it seeds a matching");
    console.error("    CHANGELOG entry header, or: press on with a CHANGELOG entry dated");
    console.error(`    ${rootVersion} to match the current package version.`);
  }

  const serverJsonPath = join(root, "server.json");
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

  const agentsPath = join(root, "AGENTS.md");
  const agentsStamp = grepVersion(agentsPath, /\(v([0-9.]+)\)/);
  ok = assert("AGENTS.md version stamp", agentsStamp ? `v${agentsStamp}` : null, `v${rootVersion}`) && ok;

  const specPath = join(root, "infobroker.md");
  const specVersion = grepVersion(specPath, /^\*\*Spec version:\*\* ([0-9.]+)\s*$/m);
  ok = assert("infobroker.md spec version", specVersion, rootVersion) && ok;

  const readmePath = join(root, "README.md");
  const readmeSpec = grepVersion(readmePath, /\(v([0-9]+\.[0-9]+\.[0-9]+)\)(?=, which defines every requirement)/);
  ok = assert("README.md spec reference", readmeSpec, rootVersion) && ok;

  if (!ok) {
    console.error("\nVersion sync FAILED. Update all version references to match root package.json.");
    console.error("Root package.json version:", rootVersion);
    return false;
  }

  console.log("\nVersion sync OK. Root version:", rootVersion);
  return true;
}

// Guarded so `version.test.ts` can import the functions instead of running the
// CLI (the test drives an explicit `root` fixture tree).
function main(argv: string[]): number {
  const sub = argv[2];
  if (sub === "bump") {
    bump();
    return 0;
  }
  if (sub === "check") {
    return check() ? 0 : 1;
  }
  if (sub === "set") {
    const target = argv[3];
    if (!target || !/^\d{4}\.\d{2}\.\d{2}$/.test(target)) {
      console.error("Usage: npx tsx scripts/version.ts set <YYYY.MM.DD>");
      return 1;
    }
    if (!setVersion(target)) {
      console.error(`\nSetting version to ${target} FAILED.`);
      return 1;
    }
    console.log(`\nAll version references set to ${target}.`);
    return 0;
  }
  console.error(USAGE);
  return 1;
}

if (process.argv[1]?.endsWith("version.ts")) {
  try {
    process.exit(main(process.argv));
  } catch (err) {
    console.error(`version: ${(err as Error).message}`);
    process.exit(2);
  }
}

export { setVersion, check, bump };
