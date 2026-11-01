import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = '/workspace/oma-ai/docs/screenshots/planable-preview-schedule-nov01';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:3000';
const EMAIL = process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL || 'platform-owner@example.com';
const PASS = process.env.BOOTSTRAP_PLATFORM_OWNER_PASSWORD || 'ChangeMe_PlatformOwner_1!';

async function setLocale(context, locale) {
  await context.addCookies([{ name: 'oma_locale', value: locale, url: BASE }]);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 30000 });
  await page.fill('input[name="email"], input[type="email"]', EMAIL);
  await page.fill('input[name="password"], input[type="password"]', PASS);
  await Promise.all([
    page.waitForURL(/\/app/, { timeout: 45000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log('wrote', file);
}

async function runLocale(browser, locale) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: locale.startsWith('ar') ? 'ar' : 'en-US',
  });
  const page = await context.newPage();
  await setLocale(context, locale);
  await login(page);
  const tag = locale.startsWith('ar') ? 'ar' : 'en';

  // Schedule page
  await page.goto(`${BASE}/app/schedule`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => page.goto(`${BASE}/app/schedule`));
  await page.waitForTimeout(2500);
  // open filter
  const filterBtn = page.locator('[data-testid="demo-schedule-filter-toggle"]');
  if (await filterBtn.count()) {
    await filterBtn.click().catch(() => null);
    await page.waitForTimeout(800);
  }
  await shot(page, `schedule-filter-layout-${tag}`);

  // view popover
  const viewBtn = page.locator('[data-testid="demo-schedule-view-toggle"]');
  if (await viewBtn.count()) {
    await viewBtn.click().catch(() => null);
    await page.waitForTimeout(500);
    await shot(page, `schedule-view-popover-${tag}`);
    await page.keyboard.press('Escape').catch(() => null);
  }
  await shot(page, `schedule-calendar-cards-${tag}`);

  // Content calendar / preview
  await page.goto(`${BASE}/app/content`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => page.goto(`${BASE}/app/content`));
  await page.waitForTimeout(2500);
  await shot(page, `content-calendar-${tag}`);

  // Open first post if any
  const card = page.locator('.oma-pv-cal-card, [data-testid^="demo-content-item"], .oma-cal-cell button').first();
  if (await card.count()) {
    await card.click({ timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(1500);
    await shot(page, `preview-modal-${tag}`);
    // Feedback tab
    const fb = page.locator('button:has-text("Feedback"), button:has-text("التعليقات"), button:has-text("Comments")').first();
    if (await fb.count()) {
      await fb.click().catch(() => null);
      await page.waitForTimeout(800);
      await shot(page, `feedback-panel-${tag}`);
    }
    // more menu for hide / mark published
    const more = page.locator('[data-testid="content-modal-more"], button[aria-label*="More"], button[data-testid*="more"]').first();
    if (await more.count()) {
      await more.click().catch(() => null);
      await page.waitForTimeout(600);
      await shot(page, `preview-more-menu-${tag}`);
    }
  }

  // Media library
  const mediaBtn = page.locator('[data-testid="demo-content-open-media"]');
  if (await mediaBtn.count()) {
    await mediaBtn.click().catch(() => null);
    await page.waitForTimeout(1500);
    const wd = page.locator('button:has-text("WorkDrive"), button:has-text("Work Drive"), [data-testid*="workdrive"]').first();
    if (await wd.count()) await wd.click().catch(() => null);
    await page.waitForTimeout(1200);
    await shot(page, `media-library-${tag}`);
  }

  // Compose for post types
  const compose = page.locator('[data-testid="demo-create-content"]');
  if (await compose.count()) {
    await compose.click().catch(() => null);
    await page.waitForTimeout(1200);
    await shot(page, `compose-post-types-${tag}`);
  }

  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await runLocale(browser, 'en');
  await runLocale(browser, 'ar');
} finally {
  await browser.close();
}
console.log('done');
