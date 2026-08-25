import { config as loadDotenv } from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

loadDotenv();

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm --filter @oma/api exec tsx src/main.ts',
      url: 'http://127.0.0.1:3001/api/v1/health/live',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
      },
    },
    {
      command: 'pnpm --filter @oma/web exec next dev -p 3000 -H 127.0.0.1',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
      },
    },
  ],
  projects: [
    {
      name: 'en-desktop',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'en-US',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'ar-desktop',
      use: { ...devices['Desktop Chrome'], locale: 'ar', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'en-tablet',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'en-US',
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: 'en-mobile',
      use: { ...devices['Desktop Chrome'], locale: 'en-US', viewport: { width: 390, height: 844 } },
    },
  ],
});
