#!/usr/bin/env node
/**
 * Non-destructive screenshots of the local owner preview for A2 certification.
 * Images stay under gitignored artifacts/.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:3010';
const email = process.env.REVIEW_EMAIL;
const password = process.env.REVIEW_PASSWORD;
if (!email || !password) {
  console.error('REVIEW_EMAIL and REVIEW_PASSWORD are required');
  process.exit(1);
}

const out = join(process.cwd(), 'artifacts/planable-ant-design-a2-certification');
mkdirSync(out, { recursive: true });

const routes = [
  ['login', '/login'],
  ['command-center', '/app'],
  ['brands', '/app/brands'],
  ['brand-workspace', '/app/brands/01M2TC03GXKBM8MTZANB31BS71'],
  ['strategy', '/app/brands/01M2TC03GXKBM8MTZANB31BS71/strategies/01M2TC03JHH1D3EJVM8HB7HZ1R'],
  ['campaigns', '/app/campaigns'],
  ['content', '/app/content'],
  ['requests', '/app/requests'],
  ['tasks', '/app/tasks'],
  ['deliverables', '/app/deliverables'],
  ['reviews', '/app/reviews'],
  ['schedule', '/app/schedule'],
  ['analytics', '/app/analytics'],
  ['team', '/app/team'],
  ['activity', '/app/activity'],
  ['settings', '/app/settings'],
  ['members', '/app/company/members'],
];

const sizes = [
  ['en-1440', 1440, 900, 'en', false],
  ['en-1024', 1024, 800, 'en', false],
  ['en-390', 390, 844, 'en', false],
  ['ar-1440', 1440, 900, 'ar', false],
  ['ar-390', 390, 844, 'ar', true],
];

const criticalAr = new Set([
  'command-center',
  'content',
  'tasks',
  'reviews',
  'settings',
  'members',
]);

const shots = [];
const consoleErrors = [];
const browser = await chromium.launch({ headless: true });

for (const [sizeName, width, height, locale, criticalOnly] of sizes) {
  const context = await browser.newContext({
    viewport: { width, height },
    locale: locale === 'ar' ? 'ar' : 'en-US',
  });
  await context.addCookies([{ name: 'oma_locale', value: locale, url: base }]);
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push({ size: sizeName, text: msg.text() });
  });
  page.on('pageerror', (err) => {
    consoleErrors.push({ size: sizeName, text: String(err) });
  });

  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-auth-ready="1"]').waitFor({ timeout: 20_000 });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/app/, { timeout: 20_000 });

  for (const [name, path] of routes) {
    if (criticalOnly && !criticalAr.has(name)) continue;
    if (name === 'login') continue;
    await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const file = `${sizeName}-${name}.png`;
    await page.screenshot({ path: join(out, file), fullPage: false });
    const overflow = await page.evaluate(() => {
      const root = globalThis.document.documentElement;
      return root.scrollWidth > root.clientWidth + 1;
    });
    shots.push({ file, path, size: sizeName, overflow });
  }
  await context.close();
}

const loginContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const loginPage = await loginContext.newPage();
await loginPage.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
await loginPage.locator('[data-auth-ready="1"]').waitFor({ timeout: 20_000 });
await loginPage.screenshot({ path: join(out, 'en-1440-login.png'), fullPage: false });
shots.push({ file: 'en-1440-login.png', path: '/login', size: 'en-1440', overflow: false });
await loginContext.close();
await browser.close();

writeFileSync(join(out, 'capture-summary.json'), JSON.stringify({ shots, consoleErrors }, null, 2));
console.log(
  JSON.stringify({
    shots: shots.length,
    consoleErrors: consoleErrors.length,
    overflow: shots.filter((s) => s.overflow).length,
  }),
);
