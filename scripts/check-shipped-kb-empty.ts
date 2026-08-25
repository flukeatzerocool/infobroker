import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const violations: string[] = [];

// A KB artifact name that must never exist inside the shipped repository.
// `config.local.json` is a user layer (git-ignored) and must never ship.
const KB_NAME_RE =
  /^(config\.local\.json|vector-store.*\.json|.*\.vector-store\.json)$/;
const KB_DIR_NAMES = new Set(["knowledge-base", ".infobroker"]);

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".opencode"]);

function walk(dir: string): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      if (KB_DIR_NAMES.has(entry)) {
        violations.push(`${relative(ROOT, full)}/ — KB data directory must not ship`);
        continue;
      }
      walk(full);
    } else if (KB_NAME_RE.test(entry)) {
      violations.push(`${relative(ROOT, full)} — KB artifact must not ship`);
    }
  }
}

// 1. The knowledge base must point outside the repository tree. A
//    storage_path inside the repo would place KB content in the deploy tree.
const configPath = join(ROOT, "config.json");
const config = JSON.parse(readFileSync(configPath, "utf-8"));
const storagePath = config?.kb?.storage_path;
if (storagePath) {
  const expanded = storagePath.startsWith("~/")
    ? join(homedir(), storagePath.slice(2))
    : storagePath;
  const resolved = isAbsolute(expanded) ? expanded : resolve(ROOT, expanded);
  const rel = relative(ROOT, resolved);
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) {
    violations.push(
      `kb.storage_path (${storagePath}) resolves inside the repository — it must point outside the tree so the KB ships empty`
    );
  }
}

// 1b. The report storage directory must likewise live outside the repository.
//     An in-repo reports_dir would write disk-saved reports into the deploy
//     tree, violating REQ-042/REQ-067.
const reportsDir = config?.kb?.reports_dir;
if (reportsDir) {
  const expanded = reportsDir.startsWith("~/")
    ? join(homedir(), reportsDir.slice(2))
    : reportsDir;
  const resolved = isAbsolute(expanded) ? expanded : resolve(ROOT, expanded);
  const rel = relative(ROOT, resolved);
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) {
    violations.push(
      `kb.reports_dir (${reportsDir}) resolves inside the repository — reports must live outside the tree so the repo ships no user content`
    );
  }
}

// 2. No KB artifact file or directory may exist in the shipped tree.
walk(ROOT);

if (violations.length > 0) {
  console.error("\nShipped KB is NOT empty:");
  for (const v of violations) console.error(`  FAIL  ${v}`);
  console.error(
    "\nThe repository must ship an empty knowledge base. Personal KB data lives at the user-scoped storage_path and is never committed."
  );
  process.exit(1);
}

console.log("  OK  shipped KB is empty (storage_path outside the tree; no KB artifacts)");
process.exit(0);
