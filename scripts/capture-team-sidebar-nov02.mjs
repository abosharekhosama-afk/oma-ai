import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const OUT = path.resolve('docs/screenshots/plans-pricing-nov02');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.WEB_BASE_URL || 'http://127.0.0.1:3000';
const API = process.env.API_PUBLIC_URL || 'http://127.0.0.1:3001';
const EMAIL = process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL || 'platform-owner@example.com';
const PASS = process.env.BOOTSTRAP_PLATFORM_OWNER_PASSWORD || 'ChangeMe_PlatformOwner_1!';
const DEMO_TENANT = '01M6BAM32840YSR60NYBVBWSB2';

function apiLogin() {
  try {
    execSync(
      'LD_LIBRARY_PATH=/tmp/liblzf/usr/lib/x86_64-linux-gnu /tmp/redis-deb/usr/bin/redis-cli -p 56379 FLUSHDB',
      { stdio: 'ignore' },
    );
  } catch {}
  const jar = '/tmp/oma-team-sidebar-cookies.txt';
  try { fs.unlinkSync(jar); } catch {}
  const login = execSync(
    `curl -s -c ${jar} -b ${jar} -X POST ${API}/api/v1/auth/login -H 'content-type: application/json' -d '${JSON.stringify({ email: EMAIL, password: PASS })}'`,
    { encoding: 'utf8' },
  );
  const parsed = JSON.parse(login);
  if (!parsed.csrf_token) throw new Error(`login failed: ${login}`);
  execSync(
    `curl -s -c ${jar} -b ${jar} -X POST ${API}/api/v1/tenants/active -H 'content-type: application/json' -H 'x-csrf-token: ${parsed.csrf_token}' -d '${JSON.stringify({ tenant_id: DEMO_TENANT })}'`,
    { encoding: 'utf8' },
  );
  const raw = fs.readFileSync(jar, 'utf8');
  const session = (raw.match(/oma_session\s+(\S+)/) || [])[1];
  const csrfCookie = (raw.match(/oma_csrf\s+(\S+)/) || [])[1] || parsed.csrf_token;
  if (!session) throw new Error('no session');
  return { session, csrf: csrfCookie };
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('wrote', file);
}

async function open(browser, locale, cookies, viewport) {
  const tag = locale.startsWith('ar') ? 'ar' : 'en';
  const context = await browser.newContext({
    viewport,
    locale: tag === 'ar' ? 'ar' : 'en-US',
  });
  await context.addCookies([
    { name: 'oma_session', value: cookies.session, url: BASE, httpOnly: true },
    { name: 'oma_csrf', value: cookies.csrf, url: BASE },
    { name: 'oma_locale', value: locale, url: BASE },
  ]);
  const page = await context.newPage();
  return { context, page, tag };
}

const cookies = apiLogin();
const browser = await chromium.launch({ headless: true });

try {
  for (const locale of ['en', 'ar']) {
    const { context, page, tag } = await open(browser, locale, cookies, { width: 1440, height: 900 });
    await page.goto(`${BASE}/app/team?tab=permissions`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    const permCell = page.locator('[data-testid="team-permissions-scroll"] input[type="checkbox"]').nth(2);
    if (await permCell.count()) {
      await permCell.click();
      await page.waitForTimeout(1200);
    }
    await shot(page, `05-team-permissions-${tag}`);

    await page.goto(`${BASE}/app/team?tab=notifications`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2200);
    await shot(page, `06-team-notifications-${tag}`);
    await context.close();
  }

  const routes = [
    ['/app/activity', 'activity'],
    ['/app/content', 'content'],
    ['/app/team', 'team'],
    ['/app/billing', 'billing'],
  ];
  const viewports = [
    { width: 1366, height: 768, name: 'laptop1366' },
    { width: 1440, height: 900, name: 'laptop1440' },
    { width: 1280, height: 700, name: 'short700' },
    { width: 1024, height: 768, name: 'tablet' },
    { width: 390, height: 844, name: 'mobile' },
  ];

  for (const locale of ['en', 'ar']) {
    for (const vp of viewports) {
      for (const [route, label] of routes) {
        const keep =
          (vp.name === 'laptop1366' && ['activity', 'content', 'team', 'billing'].includes(label)) ||
          (vp.name === 'laptop1440' && label === 'team') ||
          (vp.name === 'short700' && label === 'content') ||
          (vp.name === 'tablet' && label === 'activity') ||
          (vp.name === 'mobile' && label === 'team');
        if (!keep) continue;
        const { context, page, tag } = await open(browser, locale, cookies, { width: vp.width, height: vp.height });
        await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(1400);
        if (vp.width <= 768) {
          const toggle = page.locator('[data-testid="mobile-nav-trigger"]').first();
          if (await toggle.count()) {
            await toggle.evaluate((el) => {
              el.style.visibility = 'visible';
              el.style.opacity = '1';
              el.style.pointerEvents = 'auto';
            });
            await toggle.click({ force: true }).catch(() => {});
            await page.waitForTimeout(800);
          }
        }
        const footer = page.locator('[data-testid="shell-rail-utilities"], .oma-drawer--nav .oma-rail-footer, .oma-rail-footer').first();
        if (await footer.count()) await footer.scrollIntoViewIfNeeded().catch(() => {});
        await shot(page, `07-sidebar-footer-${label}-${vp.name}-${tag}`);
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
console.log('done');
