import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { API_PORT, BASE_URL, serverEnv } from './e2e/env';

const apiDir = resolve(fileURLToPath(new URL('.', import.meta.url)), '../api');

export default defineConfig({
  testDir: './e2e',
  // Event state is a global singleton, so the journeys run in order, not parallel.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: './e2e-results',
  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node --import tsx src/server.ts',
    cwd: apiDir,
    env: { ...process.env, ...serverEnv },
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  // Keep API_PORT available for debugging in reporters.
  metadata: { apiPort: API_PORT },
});
