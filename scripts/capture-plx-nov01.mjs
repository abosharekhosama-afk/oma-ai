import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const OUT = path.resolve('docs/screenshots/planable-preview-schedule-nov01');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.WEB_BASE_URL || 'http://127.0.0.1:3000';
const EMAIL = process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL || 'platform-owner@example.com';
const PASS = process.env.BOOTSTRAP_PLATFORM_OWNER_PASSWORD || 'ChangeMe_PlatformOwner_1!';
const DEMO_TENANT = '01M6BAM32840YSR60NYBVBWSB2';
const ACME_BRAND = '01M6BAMQMB5PPB8ZQW55J2G8G8';
const CAROUSEL_ID = '01M6BAR3X48HG4HV2A5APAWDSF';
const STORY_ID = '01M6BAR3X8QG6XTV0AKS5SFAT8';
const REEL_ID = '01M6BAR3XBEXV37N8Q2HP3XTST';
const HIDDEN_ID = '01M6BAR3XDEDZZYEJ1SC1NFQNB';

function apiLogin() {
  // Flush redis rate limit keys lightly via redis-cli if available
  try {
    execSync(
      'LD_LIBRARY_PATH=/tmp/liblzf/usr/lib/x86_64-linux-gnu /tmp/redis-deb/usr/bin/redis-cli -p 56379 FLUSHDB',
      { stdio: 'ignore' },
    );
  } catch {}
  const jar = '/tmp/oma-capture-cookies.txt';
  try { fs.unlinkSync(jar); } catch {}
  const login = execSync(
    `curl -s -c ${jar} -b ${jar} -X POST ${BASE}/api/v1/auth/login -H 'content-type: application/json' -d '${JSON.stringify({ email: EMAIL, password: PASS })}'`,
    { encoding: 'utf8' },
  );
  const parsed = JSON.parse(login);
  if (!parsed.csrf_token) throw new Error(`login failed: ${login}`);
  const csrf = parsed.csrf_token;
  execSync(
    `curl -s -c ${jar} -b ${jar} -X POST ${BASE}/api/v1/tenants/active -H 'content-type: application/json' -H 'x-csrf-token: ${csrf}' -d '${JSON.stringify({ tenant_id: DEMO_TENANT })}'`,
    { encoding: 'utf8' },
  );
  const raw = fs.readFileSync(jar, 'utf8');
  const session = (raw.match(/oma_session\s+(\S+)/) || [])[1];
  const csrfCookie = (raw.match(/oma_csrf\s+(\S+)/) || [])[1] || csrf;
  if (!session) throw new Error('no session cookie');
  return { session, csrf: csrfCookie };
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log('wrote', file);
}

async function openAuthed(browser, locale, cookies) {
  const tag = locale.startsWith('ar') ? 'ar' : 'en';
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    locale: tag === 'ar' ? 'ar' : 'en-US',
  });
  await context.addCookies([
    { name: 'oma_session', value: cookies.session, url: BASE, httpOnly: true },
    { name: 'oma_csrf', value: cookies.csrf, url: BASE },
    { name: 'oma_locale', value: locale, url: BASE },
  ]);
  const page = await context.newPage();
  await page.addInitScript((brandId) => {
    localStorage.setItem('oma.activeBrandId', brandId);
  }, ACME_BRAND);
  return { context, page, tag };
}

async function captureLocale(browser, locale, cookies) {
  const { context, page, tag } = await openAuthed(browser, locale, cookies);

  await page.goto(`${BASE}/app/content?view=calendar`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2800);
  await shot(page, `01-content-calendar-${tag}`);

  await page.goto(`${BASE}/app/content?item=${CAROUSEL_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await shot(page, `02-preview-carousel-${tag}`);
  const next = page.locator('.oma-pp__nav--next').first();
  if (await next.count()) {
    await next.click().catch(() => null);
    await page.waitForTimeout(500);
    await next.click().catch(() => null);
    await page.waitForTimeout(500);
    await shot(page, `02b-preview-carousel-nav-${tag}`);
  }

  await page.goto(`${BASE}/app/content?item=${STORY_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await shot(page, `03-preview-story-${tag}`);

  await page.goto(`${BASE}/app/content?item=${REEL_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await shot(page, `04-preview-reels-${tag}`);

  await page.goto(`${BASE}/app/content?item=${CAROUSEL_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.locator('text=/Feedback|تعليقات|Comments/i').first().click().catch(() => null);
  await page.waitForTimeout(800);
  await shot(page, `05-feedback-panel-${tag}`);

  await page.goto(`${BASE}/app/content?item=${HIDDEN_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await shot(page, `06-hide-from-clients-${tag}`);

  const more = page.locator('[data-testid="content-modal-more"], button[aria-label*="More"], button[aria-label*="المزيد"]').first();
  if (await more.count()) {
    await more.click().catch(() => null);
    await page.waitForTimeout(700);
  }
  await shot(page, `07-mark-published-menu-${tag}`);
  await page.keyboard.press('Escape').catch(() => null);

  await page.goto(`${BASE}/app/content`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const mediaBtn = page.locator('[data-testid="demo-content-open-media"]');
  if (await mediaBtn.count()) {
    await mediaBtn.click();
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("WorkDrive"), button:has-text("Work Drive")').first().click().catch(() => null);
    await page.waitForTimeout(1500);
  }
  await shot(page, `08-media-library-${tag}`);
  await page.keyboard.press('Escape').catch(() => null);

  const compose = page.locator('[data-testid="demo-create-content"]');
  if (await compose.count()) {
    await compose.click();
    await page.waitForTimeout(1400);
    await shot(page, `09-compose-post-types-${tag}`);
    await page.locator('[data-testid="compose-type-STORY"], button:has-text("Story"), button:has-text("قصة")').first().click().catch(() => null);
    await page.waitForTimeout(600);
    await shot(page, `09b-compose-story-tab-${tag}`);
    await page.keyboard.press('Escape').catch(() => null);
  }

  await page.goto(`${BASE}/app/schedule`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);
  await shot(page, `10-schedule-calendar-${tag}`);

  const viewBtn = page.locator('[data-testid="demo-schedule-view-toggle"]');
  if (await viewBtn.count()) {
    await viewBtn.click();
    await page.waitForTimeout(500);
    await shot(page, `11-schedule-view-popover-${tag}`);
    await page.keyboard.press('Escape').catch(() => null);
  }
  const filterBtn = page.locator('[data-testid="demo-schedule-filter-toggle"]');
  if (await filterBtn.count()) {
    await filterBtn.click();
    await page.waitForTimeout(800);
    await shot(page, `12-schedule-filter-rail-${tag}`);
  }

  await context.close();
}

const cookies = apiLogin();
console.log('logged in');
const browser = await chromium.launch({ headless: true });
try {
  const only = (process.env.CAPTURE_LOCALE || '').toLowerCase();
  if (!only || only === 'en') await captureLocale(browser, 'en', cookies);
  if (!only || only === 'ar') await captureLocale(browser, 'ar', cookies);
} finally {
  await browser.close();
}
console.log('done', OUT);
