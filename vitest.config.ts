import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    // Several suites shell out (bash/git/npx) and are bounded by process
    // startup, not by their own assertions; the 5 s default turns them into
    // load-sensitive failures.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
