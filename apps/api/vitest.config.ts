import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['src/test/global-setup.ts'],
    // API tests share one temporary database; run files one at a time.
    fileParallelism: false,
  },
});
