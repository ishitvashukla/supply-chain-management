import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // The in-memory Mongo binary can take a moment to start on a cold CI runner.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: ['src/**/*.test.ts'],
  },
});
