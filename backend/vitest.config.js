import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 120000,
    hookTimeout: 120000,
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    env: {
      NODE_ENV: 'test',
      ALLOW_DESTRUCTIVE_TESTS: 'true',
      DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '',
      DIRECT_URL: process.env.TEST_DIRECT_URL || process.env.DIRECT_URL || '',
    },
  },
});
