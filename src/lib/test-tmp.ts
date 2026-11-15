// @implements REQ-055
// Test temp-root lifecycle: every root a test or gate creates is registered,
// and each one has a removal path.
//
// Under vitest all roots live directly under one run root exported by
// `vitest.global-setup.ts`; `vitest.setup.ts` removes this file's roots after
// its own `afterAll` hooks (vitest runs hooks in reverse registration order,
// so a setup hook registered first runs last). Outside vitest (gate scripts)
// roots are flat siblings in the system temp dir and are removed on process
// exit.
//
// Roots are flat, not nested per file: `tsx` derives its IPC pipe name from
// `os.tmpdir()`, and a Unix socket path is limited to ~104 bytes, so deep
// nesting makes a spawned server crash with `listen EINVAL`.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Directory prefixes the harness creates under `$TMPDIR`. The reaper
 *  (`scripts/clean-test-tmp.ts`) removes nothing outside this list. */
export const TEMP_PREFIXES: readonly string[] = [
  "infobroker-",
  "ib-",
  "ibk-",
  "keypool-",
  "core-pool-",
  "generic-pool-",
  "watchlist-run-",
  "debate-club-",
  "eval-lab-",
];

/** Environment variable carrying the run root into vitest workers. */
export const RUN_ROOT_ENV = "INFOBROKER_TEST_TMP";

/** Prefix of the per-run root. */
export const RUN_ROOT_PREFIX = "infobroker-run-";

/** Roots this process created, in creation order. */
const created = new Set<string>();
let exitHookRegistered = false;

function inVitest(): boolean {
  return process.env["VITEST"] === "true";
}

/**
 * The directory every temp root belongs to. Under vitest it is the run root
 * exported by `vitest.global-setup.ts`; requiring it (rather than falling back)
 * makes an unpropagated worker fail loudly instead of leaking silently.
 * Outside vitest it is the system temp dir and removal is per process.
 */
export function runRoot(): string {
  if (!inVitest()) return tmpdir();
  const value = process.env[RUN_ROOT_ENV];
  if (!value) {
    throw new Error(
      `${RUN_ROOT_ENV} is unset under vitest: the run root must come from vitest.global-setup.ts`,
    );
  }
  return value;
}

/** Keep temp roots after the process exits; for a test that inspects a gate's
 *  isolated writes, which would otherwise be reaped before the assertion. */
function keepTmp(): boolean {
  return process.env["INFOBROKER_TEST_KEEP_TMP"] === "1";
}

function registerExitHook(): void {
  if (inVitest() || exitHookRegistered || keepTmp()) return;
  exitHookRegistered = true;
  // `exit` handlers may only run synchronous code; `rmSync` qualifies. A
  // SIGKILL or SIGTERM skips it, which is what the reaper's age bound covers.
  process.once("exit", () => removeTestTmp());
}

/** A private, registered directory for the current test or gate process. */
export function testTmpDir(prefix: string): string {
  const dir = mkdtempSync(join(runRoot(), prefix));
  created.add(dir);
  registerExitHook();
  return dir;
}

/** The roots this process created and has not yet removed. */
export function createdTestTmpDirs(): string[] {
  return [...created];
}

/**
 * Remove a root (all of this process's roots by default). Best effort: a
 * leaked root is reaped by the age bound, and failing an otherwise green
 * suite over it would be worse than the leak.
 */
export function removeTestTmp(path: string | null = null): void {
  const targets = path === null ? [...created] : [path];
  for (const target of targets) {
    try {
      rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch (error) {
      process.stderr.write(`test-tmp: could not remove ${target}: ${(error as Error).message}\n`);
    }
    created.delete(target);
  }
}
