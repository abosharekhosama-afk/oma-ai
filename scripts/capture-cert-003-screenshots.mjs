/**
 * Certification screenshots for Feature 003 Owner preview surfaces.
 * Requires review stack (pnpm review:003) and .review/003-credentials.json.
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const out = path.resolve(process.argv[2] ?? 'artifacts/certification-003');
fs.mkdirSync(out, { recursive: true });
const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const base = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';
const creds = JSON.parse(fs.readFileSync('.review/003-credentials.json', 'utf8'));
const email = creds.accounts.owner.email;
const password = creds.accounts.owner.password;
const brandId = creds.brand.id;
const strategyId = creds.screenshots.strategy_id;
const leftId = creds.screenshots.compare_left_version_id;
const rightId = creds.screenshots.compare_right_version_id;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(e.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

async function shot(name) {
  await page.waitForTimeout(800);
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  fs.writeFileSync(
    path.join(out, `${name}.meta.json`),
    JSON.stringify(
      {
        route: page.url().replace(base, ''),
        role: 'owner',
        locale: 'en',
        viewport: '1440x900',
        gitSha: sha,
        consoleErrors: consoleErrors.filter((e) => !/favicon/i.test(e)),
      },
      null,
      2,
    ),
  );
  console.log('shot', name, page.url());
}

await page.goto(`${base}/login`, { waitUntil: 'networkidle', timeout: 60_000 });
await page.getByLabel(/email/i).fill(email);
await page.getByLabel(/password/i).fill(password);
await page.getByRole('button', { name: /sign in/i }).click();
await page.waitForURL(/\/app/, { timeout: 30_000 });
await page.waitForSelector('[data-testid="product-home"], h1', { timeout: 20_000 });

const stratBase = `${base}/app/brands/${brandId}/strategies/${strategyId}`;

await page.goto(stratBase, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForSelector('[data-testid="strategy-subnav"], h1, h2', { timeout: 20_000 });
await shot('strategy-overview');

await page.goto(`${stratBase}/edit`, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForSelector('h1, h2, form, [data-testid="strategy-subnav"]', { timeout: 20_000 });
await shot('foundation-editor');

await page.goto(`${stratBase}/organic`, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForSelector('h1, h2, [data-testid="strategy-subnav"]', { timeout: 20_000 });
await shot('organic-track');

await page.goto(`${stratBase}/paid`, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForSelector('h1, h2, [data-testid="strategy-subnav"]', { timeout: 20_000 });
await shot('paid-track');

await page.goto(`${stratBase}/evidence`, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForSelector(
  '[data-testid="strategy-evidence-list"], [data-testid="strategy-evidence-empty"], h2',
  { timeout: 20_000 },
);
await shot('evidence-review');

const compareUrl =
  leftId && rightId
    ? `${stratBase}/versions/compare?leftId=${leftId}&rightId=${rightId}`
    : `${stratBase}/versions`;
await page.goto(compareUrl, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForSelector(
  '[data-testid="strategy-compare-diff"], [data-testid="strategy-subnav"], h2',
  { timeout: 20_000 },
);
await shot('versions-compare-current');

await browser.close();
const pngs = fs.readdirSync(out).filter((f) => f.endsWith('.png'));
console.log('cert screenshots', pngs);
if (consoleErrors.filter((e) => !/favicon/i.test(e)).length) {
  console.warn('console errors during capture', consoleErrors);
}
