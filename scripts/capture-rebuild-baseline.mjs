import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const out = path.resolve(process.argv[2] ?? '.reference/002-rebuild/before');
fs.mkdirSync(out, { recursive: true });
const sha = process.env.GIT_SHA ?? '980a83c';
const base = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';
const email = process.env.REVIEW_EMAIL ?? 'review-owner-002@oma.local';
const password = process.env.REVIEW_PASSWORD ?? 'ReviewOwner_002_ChangeMe!';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shot(name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  fs.writeFileSync(
    path.join(out, `${name}.meta.json`),
    JSON.stringify(
      { route: page.url(), role: 'owner', locale: 'en', viewport: '1440x900', gitSha: sha },
      null,
      2,
    ),
  );
}

await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.fill('input[type="email"], input[name="email"]', email);
await page.fill('input[type="password"], input[name="password"]', password);
await Promise.all([
  page.waitForURL(/\/app/, { timeout: 30000 }),
  page.click('button[type="submit"]'),
]);
await shot('01-home');
await page.goto(`${base}/app/brands`, { waitUntil: 'networkidle' });
await shot('02-brands');
const link = page
  .locator('a.oma-brand-list-item, a[href*="/app/brands/"]')
  .filter({ hasText: /Demo|Acme|Globex|Northwind/i })
  .first();
if (await link.count()) {
  await link.click();
  await page.waitForLoadState('networkidle');
  await shot('03-brand-overview');
  const scanLink = page
    .getByRole('link', { name: /SUCCEEDED|PARTIAL|FAILED|QUEUED|RUNNING/i })
    .first();
  if (await scanLink.count()) {
    await scanLink.click();
    await page.waitForLoadState('networkidle');
    await shot('04-scan');
  }
  await page
    .goto(page.url().replace(/\/scans\/.*/, '/profiles'), { waitUntil: 'networkidle' })
    .catch(() => {});
}
await browser.close();
console.log('shots ok', fs.readdirSync(out));
