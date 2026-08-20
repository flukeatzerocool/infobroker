import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function sha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function sha256Str(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function aggregateHash(hashes: string[]): string {
  return sha256Str(hashes.sort().join("\n"));
}

function collectFiles(dir: string, ext?: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full, ext));
    } else if (!ext || entry.name.endsWith(ext)) {
      files.push(full);
    }
  }
  return files.sort();
}

const srcFiles = collectFiles(join(ROOT, "src"), ".ts");
const srcHashes: Record<string, string> = {};
for (const f of srcFiles) {
  srcHashes[basename(f)] = sha256(f);
}
const sourceAggregate = aggregateHash(Object.values(srcHashes));

const specHash = sha256(join(ROOT, "infobroker.md"));
const configHash = sha256(join(ROOT, "config.json"));
const pkgHash = sha256(join(ROOT, "package.json"));
const lockHash = existsSync(join(ROOT, "package-lock.json"))
  ? sha256(join(ROOT, "package-lock.json"))
  : "none";
const dependenciesAggregate = aggregateHash([pkgHash, lockHash]);

const artifactPaths = [
  join(ROOT, "README.md"),
  join(ROOT, "AGENTS.md"),
  ...collectFiles(join(ROOT, "skills")),
  ...collectFiles(join(ROOT, "instructions")),
];
const artifactHashes = artifactPaths.map((p) => sha256(p));
const artifactsAggregate = aggregateHash(artifactHashes);

const totalFingerprint = aggregateHash([specHash, configHash, sourceAggregate, dependenciesAggregate, artifactsAggregate]);

const generated = new Date().toISOString();

// Write local fingerprints file (gitignored)
const fpDir = join(tmpdir(), "infobroker");
if (!existsSync(fpDir)) {
  mkdirSync(fpDir, { recursive: true });
}

const fpContent = [
  `spec=${specHash}`,
  `config=${configHash}`,
  `source=${sourceAggregate}`,
  `dependencies=${dependenciesAggregate}`,
  `artifacts=${artifactsAggregate}`,
  `total=${totalFingerprint}`,
  `generated=${generated}`,
].join("\n");

writeFileSync(join(fpDir, "fingerprints.txt"), fpContent + "\n");

// Update DECISIONS.md with fingerprint block
const decisionsPath = join(ROOT, "DECISIONS.md");
let decisions = readFileSync(decisionsPath, "utf-8");

const fpBlock = [
  "",
  "### D-012: Build Fingerprint (auto-generated)",
  "",
  `**Spec hash:** \`${specHash}\``,
  `**Source hash:** \`${sourceAggregate}\``,
  `**Config hash:** \`${configHash}\``,
  `**Total fingerprint:** \`${totalFingerprint}\``,
  "",
];

const fpMarker = "### D-012: Build Fingerprint (auto-generated)";
if (decisions.includes(fpMarker)) {
  const start = decisions.indexOf(fpMarker);
  const end = decisions.indexOf("### D-", start + 1);
  const before = decisions.slice(0, start);
  const after = end > start ? decisions.slice(end) : "";
  decisions = (before.trimEnd() + "\n" + fpBlock.join("\n") + after).trimEnd() + "\n";
} else {
  decisions = decisions.replace(
    "## Active Decisions\n",
    "## Active Decisions\n" + fpBlock.join("\n")
  );
}
writeFileSync(decisionsPath, decisions);

console.log(`Manifest regenerated:`);
console.log(`  spec:       ${specHash.slice(0, 16)}...`);
console.log(`  source:     ${sourceAggregate.slice(0, 16)}...`);
console.log(`  config:     ${configHash.slice(0, 16)}...`);
console.log(`  total:      ${totalFingerprint.slice(0, 16)}...`);
console.log(`  generated:  ${generated}`);
console.log(`  fingerprints: ${join(fpDir, "fingerprints.txt")}`);
console.log(`  DECISIONS.md updated`);
