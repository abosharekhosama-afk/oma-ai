/**
 * Certification screenshots for Feature 002 Owner preview surfaces.
 * Requires review stack (pnpm review:002) and .review/002-credentials.json.
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const out = path.resolve(process.argv[2] ?? 'artifacts/certification-002/screenshots');
fs.mkdirSync(out, { recursive: true });
const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const base = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';
const creds = JSON.parse(fs.readFileSync('.review/002-credentials.json', 'utf8'));
const email = creds.accounts.owner.email;
const password = creds.accounts.owner.password;

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
await shot('01-command-center');

await page.goto(`${base}/app/brands`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid="brand-portfolio"], table, h1', { timeout: 20_000 });
const brandLink = page.getByRole('link', { name: /Acme Retail|acme/i }).first();
await brandLink.click();
await page.waitForSelector('[data-testid="brand-workspace"], h1', { timeout: 20_000 });

const scanLink = page
  .getByRole('link', { name: /SUCCEEDED|PARTIAL|scan|Scan/i })
  .or(page.getByTestId('scan-status'))
  .first();
if (await scanLink.count()) {
  await scanLink.click().catch(() => {});
  await page.waitForTimeout(1000);
}
await shot('02-scan');

const pagesLink = page.getByRole('link', { name: /pages|discovery/i }).first();
if (await pagesLink.count()) {
  await pagesLink.click();
  await page.waitForTimeout(1200);
} else {
  const href = page.url();
  const brandMatch = href.match(/\/app\/brands\/([^/]+)/);
  if (brandMatch) {
    await page.goto(`${base}/app/brands/${brandMatch[1]}/discovery/pages`, {
      waitUntil: 'networkidle',
    });
  }
}
await page.waitForTimeout(800);
const evidenceTrigger = page
  .getByRole('button', { name: /evidence/i })
  .or(page.getByRole('link', { name: /evidence/i }))
  .first();
if (await evidenceTrigger.count()) {
  await evidenceTrigger.click().catch(() => {});
  await page.waitForTimeout(800);
}
await shot('03-discovery-evidence');

const profileLink = page.getByRole('link', { name: /intelligence|profile|review/i }).first();
if (await profileLink.count()) {
  await profileLink.click();
  await page.waitForTimeout(1200);
} else {
  const href = page.url();
  const brandMatch = href.match(/\/app\/brands\/([^/]+)/);
  if (brandMatch) {
    await page.goto(`${base}/app/brands/${brandMatch[1]}`, { waitUntil: 'networkidle' });
    const intel = page.getByRole('link', { name: /intelligence|profile/i }).first();
    if (await intel.count()) await intel.click();
  }
}
await page.waitForSelector('h1, [data-testid="intelligence-editor"]', { timeout: 20_000 });
await shot('04-intelligence-editor');

const compare = page.getByRole('link', { name: /compare|history|version/i }).first();
const approve = page.getByRole('button', { name: /approve|partial/i }).first();
if (await compare.count()) {
  await compare.click();
  await page.waitForTimeout(1200);
  await shot('05-version-comparison');
} else if (await approve.count()) {
  await shot('05-partial-approval');
} else {
  await shot('05-partial-approval-or-comparison');
}

await browser.close();
const pngs = fs.readdirSync(out).filter((f) => f.endsWith('.png'));
console.log('cert screenshots', pngs);
if (consoleErrors.filter((e) => !/favicon/i.test(e)).length) {
  console.warn('console errors during capture', consoleErrors);
}
