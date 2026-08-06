import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function run(cmd: string, cwd?: string): void {
  console.log("  $", cmd);
  execSync(cmd, { cwd: cwd ?? root, stdio: "inherit" });
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
const version = pkg.version;
const tag = `v${version}`;

console.log(`Infobroker push — version ${version}\n`);

console.log("=== Version sync check ===");
run("npx tsx scripts/version-check.ts");

console.log("\n=== Spec checks ===");
run("npm run check");

console.log(`\n=== Tagging ${tag} ===`);
const existingTags = execSync("git tag -l", { cwd: root, encoding: "utf-8" }).trim().split("\n");
if (existingTags.includes(tag)) {
  console.log(`  Tag ${tag} exists — force-moving to HEAD`);
  run(`git tag -f ${tag}`);
} else {
  run(`git tag ${tag}`);
}

console.log("\n=== Pushing ===");
run("git push origin master --tags");

console.log(`\nPush complete — ${tag}`);
