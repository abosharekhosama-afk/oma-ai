import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const out = path.resolve(process.argv[2] ?? '.reference/002-rebuild/after');
fs.mkdirSync(out, { recursive: true });
const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const base = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';
const creds = JSON.parse(fs.readFileSync('.review/002-credentials.json', 'utf8'));
const email = creds.accounts.owner.email;
const password = creds.accounts.owner.password;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shot(name) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  fs.writeFileSync(
    path.join(out, `${name}.meta.json`),
    JSON.stringify(
      {
        route: page.url().replace(base, ''),
        role: 'owner',
        locale: 'en',
        viewport: '1440x900',
        gitSha: sha,
      },
      null,
      2,
    ),
  );
}

await page.goto(`${base}/login`, { waitUntil: 'networkidle', timeout: 60000 });
await page.getByLabel(/email/i).fill(email);
await page.getByLabel(/password/i).fill(password);
await page.getByRole('button', { name: /sign in/i }).click();
await page.waitForURL(/\/app/, { timeout: 30000 });
await page.waitForSelector('[data-testid="product-home"], h1', { timeout: 20000 });
await shot('01-home');

await page.goto(`${base}/app/brands`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid="brand-portfolio"], table, h1', { timeout: 20000 });
await shot('02-brands');

const brandLink = page.getByRole('link', { name: /Acme Retail/i }).first();
await brandLink.click();
await page.waitForSelector('[data-testid="brand-workspace"], h1', { timeout: 20000 });
await shot('03-brand-overview');

const scanBadge = page.getByRole('link', { name: /SUCCEEDED|PARTIAL/i }).first();
if (await scanBadge.count()) {
  await scanBadge.click();
  await page.waitForTimeout(1000);
  await shot('04-scan');
}

await browser.close();
console.log('after shots', fs.readdirSync(out).filter((f) => f.endsWith('.png')));
