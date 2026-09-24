/* global document */
/**
 * Read-only OMA screenshot inventory for the W1 visual differential.
 * Images go to artifacts/ (gitignored). Metadata JSON is written beside them
 * and copied to .reference/007 by the caller.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const phase = process.argv[2] === 'after' ? 'after-w1' : 'before';
const out = path.resolve(`artifacts/planable-oma-visual-differential/${phase}`);
fs.mkdirSync(out, { recursive: true });
const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const base = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';
const creds = JSON.parse(
  fs.readFileSync(
    fs.existsSync('.review/004-credentials.json')
      ? '.review/004-credentials.json'
      : '.review/003-credentials.json',
    'utf8',
  ),
);
const email = creds.accounts.owner.email;
const password = creds.accounts.owner.password;

const viewports = [
  { id: '1440', width: 1440, height: 900, locale: 'en' },
  { id: '1024', width: 1024, height: 768, locale: 'en' },
  { id: '390', width: 390, height: 844, locale: 'en' },
  { id: '1440-ar', width: 1440, height: 900, locale: 'ar' },
  { id: '390-ar', width: 390, height: 844, locale: 'ar' },
];

const routes = [
  ['login', '/login', false],
  ['register', '/register', false],
  ['command-center', '/app', true],
  ['brands', '/app/brands', true],
  ['campaigns', '/app/campaigns', true],
  ['content', '/app/content', true],
  ['requests', '/app/requests', true],
  ['tasks', '/app/tasks', true],
  ['deliverables', '/app/deliverables', true],
  ['reviews', '/app/reviews', true],
  ['schedule', '/app/schedule', true],
  ['analytics', '/app/analytics', true],
  ['team', '/app/team', true],
  ['activity', '/app/activity', true],
  ['settings', '/app/settings', true],
  ['members', '/app/company/members', true],
  ['notifications', '/app/notifications', true],
];

const manifest = [];
const browser = await chromium.launch({ headless: true });

async function login(page) {
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('[data-auth-ready="1"]');
  await page.locator('#email, input[name="email"]').first().fill(email);
  await page.locator('#password, input[name="password"]').first().fill(password);
  const submit = page.locator('button[type="submit"]');
  await submit.waitFor({ state: 'visible' });
  for (let i = 0; i < 20; i += 1) {
    if (await submit.isEnabled()) break;
    await page.waitForTimeout(250);
  }
  await submit.click();
  await page.waitForURL(/\/app/, { timeout: 20_000 });
}

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    locale: vp.locale === 'ar' ? 'ar' : 'en',
  });
  await context.addCookies([
    {
      name: 'oma_locale',
      value: vp.locale,
      url: base,
    },
  ]);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 180));
  });
  let authed = false;
  if (routes.some((r) => r[2])) {
    try {
      await login(page);
      authed = true;
    } catch (err) {
      console.log('login-failed', vp.id, String(err.message ?? err).slice(0, 200));
    }
  }
  for (const [name, route, needsAuth] of routes) {
    const id = `EV-OMA-${phase.toUpperCase()}-${name}-${vp.id}`;
    const file = `${name}-${vp.id}.png`;
    try {
      if (needsAuth && !authed) {
        throw new Error('login did not reach /app');
      }
      await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      await page.screenshot({ path: path.join(out, file), fullPage: false });
      const meta = {
        evidenceId: id,
        product: 'OMA',
        sourceLevel: 'LIVE_VERIFIED',
        route,
        viewport: `${vp.width}x${vp.height}`,
        locale: vp.locale,
        state: 'default-populated',
        timestamp: new Date().toISOString(),
        servedSha: sha,
        referenceUrl: null,
        screenshot: file,
        consoleErrors,
        overflow,
        notes: 'Viewport shot, not full page. Empty/error/denied states not forced.',
        piiScrub: 'demo-fixtures-only',
      };
      fs.writeFileSync(path.join(out, `${name}-${vp.id}.json`), JSON.stringify(meta, null, 2));
      manifest.push(meta);
      console.log('ok', file);
    } catch (err) {
      const meta = {
        evidenceId: id,
        product: 'OMA',
        sourceLevel: 'NOT_REPRODUCIBLE',
        route,
        viewport: `${vp.width}x${vp.height}`,
        locale: vp.locale,
        state: 'default-populated',
        timestamp: new Date().toISOString(),
        servedSha: sha,
        screenshot: null,
        notes: String(err.message ?? err).slice(0, 300),
        piiScrub: 'demo-fixtures-only',
      };
      manifest.push(meta);
      console.log('miss', name, vp.id, meta.notes);
    }
  }
  await context.close();
}

fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
await browser.close();
console.log('manifest', manifest.length);
