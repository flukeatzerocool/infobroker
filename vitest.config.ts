import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    // One run root per `vitest run`, removed in teardown; per-file roots are
    // removed by the setup file. Together they keep $TMPDIR clean.
    globalSetup: ['vitest.global-setup.ts'],
    setupFiles: ['vitest.setup.ts'],
    // Several suites shell out (bash/git/npx) and are bounded by process
    // startup, not by their own assertions; the 5 s default turns them into
    // load-sensitive failures.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
