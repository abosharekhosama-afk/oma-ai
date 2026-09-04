import { config as loadDotenv } from 'dotenv';
import { defineConfig, devices } from '@playwright/test';
import { randomUUID } from 'node:crypto';

loadDotenv();

const webPort = process.env.WEB_PORT ?? '3000';
const apiPort = process.env.API_PORT ?? '3001';
const workerHealthPort = process.env.WORKER_HEALTH_PORT ?? '3002';
const webBaseUrl = process.env.WEB_BASE_URL ?? `http://127.0.0.1:${webPort}`;
const apiPublicUrl = process.env.API_PUBLIC_URL ?? `http://127.0.0.1:${apiPort}`;
const webOrigin = process.env.WEB_ORIGIN ?? webBaseUrl;

const e2eRunId = process.env.OMA_E2E_RUN_ID ?? randomUUID().slice(0, 8);
const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://oma@127.0.0.1:5432/oma_ai_e2e?schema=public';
if (!/oma_ai_e2e|oma_ai_ci/i.test(e2eDatabaseUrl) && process.env.OMA_E2E_ALLOW_DEV_DB !== '1') {
  throw new Error('Playwright requires E2E_DATABASE_URL/DATABASE_URL for oma_ai_e2e or oma_ai_ci');
}
const baseRedis = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
const e2eRedisUrl =
  process.env.E2E_REDIS_URL ??
  (baseRedis.includes('/1') || baseRedis.includes('/2')
    ? baseRedis
    : baseRedis.replace(/\/?\d?$/, '') + '/1');

const sharedServerEnv = {
  ...process.env,
  WEB_PORT: webPort,
  API_PORT: apiPort,
  WORKER_HEALTH_PORT: workerHealthPort,
  WEB_BASE_URL: webBaseUrl,
  WEB_ORIGIN: webOrigin,
  API_PUBLIC_URL: apiPublicUrl,
  DATABASE_URL: e2eDatabaseUrl,
  REDIS_URL: e2eRedisUrl,
  OMA_E2E_RUN_ID: e2eRunId,
  BULLMQ_PREFIX: `oma-e2e-${e2eRunId}`,
  OMA_WRITE_OPENAPI: '0',
  BRAND_FIXTURE_CONNECTOR: '1',
  NODE_ENV: process.env.NODE_ENV ?? 'test',
};

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 90_000,
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  use: {
    baseURL: webBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer:
    process.env.E2E_REUSE_SERVERS === '1'
      ? undefined
      : [
          {
            command: 'pnpm --filter @oma/api exec tsx src/main.ts',
            url: `${apiPublicUrl}/api/v1/health/live`,
            reuseExistingServer: false,
            timeout: 120_000,
            env: sharedServerEnv,
          },
          {
            command: 'pnpm --filter @oma/worker exec tsx src/main.ts',
            url: `http://127.0.0.1:${workerHealthPort}/`,
            reuseExistingServer: false,
            timeout: 120_000,
            env: {
              ...sharedServerEnv,
              MAIL_PROVIDER: 'recording',
            },
          },
          {
            command: `pnpm --filter @oma/web exec next dev -p ${webPort} -H 127.0.0.1`,
            url: webBaseUrl,
            reuseExistingServer: false,
            timeout: 120_000,
            env: sharedServerEnv,
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
