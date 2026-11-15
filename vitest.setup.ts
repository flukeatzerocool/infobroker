// Vitest per-file setup: remove the file's temp root after its own `afterAll`
// hooks have run. Vitest runs hooks in reverse registration order, so this
// hook — registered before any hook in the test file — runs last.
import { afterAll } from "vitest";
import { removeTestTmp } from "./src/lib/test-tmp.js";

afterAll(() => {
  removeTestTmp();
});
