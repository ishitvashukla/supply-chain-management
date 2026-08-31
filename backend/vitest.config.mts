import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // The in-memory Mongo binary can take a moment on a cold CI runner.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: ['src/**/*.test.ts'],
    /**
     * Hermetic by design. `config/env.ts` throws on a missing variable at
     * import time, so without these the suite passes locally (where a .env
     * exists) and fails on CI — exactly the false green this replaces.
     * The database URI is never used: tests connect to an in-memory server.
     */
    env: {
      NODE_ENV: 'test',
      MONGO_URI: 'mongodb://127.0.0.1:27017/unused-in-tests',
      JWT_SECRET: 'test-only-access-secret-not-used-anywhere-else',
      JWT_REFRESH_SECRET: 'test-only-refresh-secret-not-used-anywhere-else',
      JWT_EXPIRES_IN: '3d',
      JWT_REFRESH_EXPIRES_IN: '30d',
    },
  },
});
