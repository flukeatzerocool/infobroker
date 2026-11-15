// Vitest global setup: create one run root per `vitest run`, export it to the
// workers through the environment, and remove it in teardown. The root is what
// `src/lib/test-tmp.ts` resolves under vitest, so every test temp root lives
// and dies inside it.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RUN_ROOT_ENV, RUN_ROOT_PREFIX } from "./src/lib/test-tmp.js";

export default function setup(): () => void {
  const root = mkdtempSync(join(tmpdir(), RUN_ROOT_PREFIX));
  process.env[RUN_ROOT_ENV] = root;
  const remove = (): void => {
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch (error) {
      // A worker that outlives teardown can write into the root between removal
      // and process exit; the exit handler gets the last attempt, and
      // `npm run clean:tmp` covers a killed run.
      process.stderr.write(`vitest: could not remove ${root}: ${(error as Error).message}\n`);
    }
  };
  // Teardown runs while the pool may still be winding down, so a late worker
  // can recreate the root; the exit handler is the last word.
  process.once("exit", remove);
  return remove;
}
