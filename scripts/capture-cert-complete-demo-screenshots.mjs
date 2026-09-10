/**
 * Certification screenshots for Complete Product Demo Owner preview.
 * Requires: pnpm review:004 (OMA_DEMO_MODE=1) and .review/004-credentials.json
 * (seed-review-003 writes 003-credentials; review:004 copies/symlinks or uses 003).
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const out = path.resolve(process.argv[2] ?? 'artifacts/certification-complete-demo');
fs.mkdirSync(out, { recursive: true });
const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const base = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';

function loadCreds() {
  for (const f of ['.review/004-credentials.json', '.review/003-credentials.json']) {
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  }
  throw new Error(
    'Missing .review/004-credentials.json or 003-credentials.json — run pnpm review:004',
  );
}

const creds = loadCreds();
const email = creds.accounts.owner.email;
const password = creds.accounts.owner.password;

const browser = await chromium.launch({ headless: true });

async function shotPage(page, name, locale, viewport) {
  await page.waitForTimeout(700);
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  fs.writeFileSync(
    path.join(out, `${name}.meta.json`),
    JSON.stringify(
      {
        route: page.url().replace(base, ''),
        role: 'owner',
        locale,
        viewport,
        gitSha: sha,
      },
      null,
      2,
    ),
  );
  console.log('shot', name, page.url());
}

async function login(page) {
  await page.goto(`${base}/login`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });
}

// EN desktop 1440
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(page);
  await page.waitForSelector('[data-testid="product-home"]', { timeout: 20_000 });
  await shotPage(page, '01-command-center', 'en', '1440x900');

  await page
    .getByRole('navigation')
    .getByRole('link', { name: /^campaigns$/i })
    .click();
  await page.waitForSelector('[data-testid="demo-campaigns"]');
  await shotPage(page, '02-campaigns', 'en', '1440x900');

  await page
    .getByRole('navigation')
    .getByRole('link', { name: /content/i })
    .click();
  await page.waitForSelector('[data-testid="demo-content"]');
  await page.getByRole('button', { name: /calendar/i }).click();
  await shotPage(page, '03-content-calendar', 'en', '1440x900');

  await page
    .getByRole('navigation')
    .getByRole('link', { name: /^tasks$/i })
    .click();
  await page.waitForSelector('[data-testid="demo-tasks"]');
  await shotPage(page, '04-kanban-tasks', 'en', '1440x900');

  await page.goto(`${base}/app/deliverables/demo-deliv-carousel`);
  await page.waitForSelector('[data-testid="demo-deliverable-detail"]');
  await shotPage(page, '05-deliverable-review', 'en', '1440x900');

  await page
    .getByRole('navigation')
    .getByRole('link', { name: /^schedule$/i })
    .click();
  await page.waitForSelector('[data-testid="demo-schedule"]');
  await shotPage(page, '06-scheduling', 'en', '1440x900');

  await page
    .getByRole('navigation')
    .getByRole('link', { name: /^analytics$/i })
    .click();
  await page.waitForSelector('[data-testid="demo-analytics"]');
  await shotPage(page, '07-analytics', 'en', '1440x900');
  await page.close();
}

// Arabic mobile 390
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'ar',
  });
  await context.addCookies([{ name: 'oma_locale', value: 'ar', url: base }]);
  const page = await context.newPage();
  await login(page);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /المحتوى|content/i })
    .click();
  await page.waitForSelector('[data-testid="demo-content"]');
  await shotPage(page, '08-arabic-mobile-content', 'ar', '390x844');
  await context.close();
}

fs.writeFileSync(
  path.join(out, 'CERT_META.json'),
  JSON.stringify({ gitSha: sha, capturedAt: new Date().toISOString(), base }, null, 2) + '\n',
);

await browser.close();
console.log('Done →', out);
