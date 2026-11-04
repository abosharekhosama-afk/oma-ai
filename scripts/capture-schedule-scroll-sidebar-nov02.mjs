import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const OUT = path.resolve('docs/screenshots/schedule-scroll-sidebar-nov02');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.WEB_BASE_URL || 'http://127.0.0.1:3000';
const EMAIL = process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL || 'platform-owner@example.com';
const PASS = process.env.BOOTSTRAP_PLATFORM_OWNER_PASSWORD || 'ChangeMe_PlatformOwner_1!';
const DEMO_TENANT = '01M6BAM32840YSR60NYBVBWSB2';
const ACME_BRAND = '01M6BAMQMB5PPB8ZQW55J2G8G8';

function apiLogin() {
  try {
    execSync(
      'LD_LIBRARY_PATH=/tmp/liblzf/usr/lib/x86_64-linux-gnu /tmp/redis-deb/usr/bin/redis-cli -p 56379 FLUSHDB',
      { stdio: 'ignore' },
    );
  } catch {}
  const jar = '/tmp/oma-capture-cookies-nov02.txt';
  try {
    fs.unlinkSync(jar);
  } catch {}
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
  await page.screenshot({ path: file, fullPage: false });
  console.log('wrote', file);
}

async function forceCalendarOverflow(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.oma-sched-day__scroll').forEach((el, idx) => {
      if (idx > 2) return;
      const spacer = document.createElement('div');
      spacer.setAttribute('data-testid', 'capture-scroll-spacer');
      spacer.style.cssText =
        'height:900px;margin:4px 0;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc;display:flex;align-items:flex-start;justify-content:center;padding:8px;font-size:11px;color:#64748b;';
      spacer.textContent = 'scroll';
      el.appendChild(spacer);
    });
  });
}

async function measure(page) {
  return page.evaluate(() => {
    const day = document.querySelector('.oma-sched-day__scroll');
    const cal = document.querySelector('.oma-sched-calendar-scroll');
    const footer = document.querySelector('.oma-shell > .oma-rail .oma-rail-footer');
    const leftovers = [...document.querySelectorAll('.oma-drawer--nav, .ant-drawer-mask')].map(
      (el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          cls: el.className.toString().slice(0, 80),
          open: el.classList.contains('ant-drawer-open'),
          display: cs.display,
          w: Math.round(r.width),
          h: Math.round(r.height),
          opacity: cs.opacity,
          visibility: cs.visibility,
        };
      },
    );
    const box = (el) =>
      el
        ? {
            canY: el.scrollHeight > el.clientHeight + 1,
            canX: el.scrollWidth > el.clientWidth + 1,
            scrollH: el.scrollHeight,
            clientH: el.clientHeight,
            scrollW: el.scrollWidth,
            clientW: el.clientWidth,
            h: Math.round(el.getBoundingClientRect().height),
          }
        : null;
    const fb = footer?.getBoundingClientRect();
    return {
      day: box(day),
      cal: box(cal),
      footerVisible: fb
        ? fb.bottom <= innerHeight + 1 && fb.height > 0 && fb.top < innerHeight
        : false,
      footerBottom: fb ? Math.round(fb.bottom) : null,
      vh: innerHeight,
      leftovers,
    };
  });
}

async function openSchedule(page) {
  await page.goto(`${BASE}/app/schedule`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="demo-schedule"], .oma-sched-page', { timeout: 30000 });
  await page.waitForTimeout(2500);
  // Ensure calendar view
  const viewToggle = page
    .locator(
      '[data-testid="demo-schedule-view-toggle"], .oma-sched-view-wrap > button, .oma-sched-icon-btn',
    )
    .first();
  if ((await page.locator('[data-testid="demo-schedule-calendar"]').count()) === 0) {
    await viewToggle.click().catch(() => null);
    await page.waitForTimeout(300);
    await page
      .locator('.oma-sched-view-popover__item')
      .first()
      .click()
      .catch(() => null);
    await page.waitForTimeout(500);
  }
  await page
    .waitForSelector('[data-testid="demo-schedule-calendar"], .oma-sched-calendar', {
      timeout: 15000,
    })
    .catch(() => null);
}

async function captureLocale(browser, locale, cookies, viewport, prefix) {
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
  await page.addInitScript((brandId) => {
    localStorage.setItem('oma.activeBrandId', brandId);
  }, ACME_BRAND);

  await openSchedule(page);
  await forceCalendarOverflow(page);
  await page.waitForTimeout(300);

  // Scroll day column vertically
  await page.evaluate(() => {
    const day = document.querySelector('.oma-sched-day__scroll');
    if (day) day.scrollTop = Math.min(240, day.scrollHeight);
    const cal = document.querySelector('.oma-sched-calendar-scroll');
    if (cal && cal.scrollWidth > cal.clientWidth)
      cal.scrollLeft = Math.min(160, cal.scrollWidth / 4);
  });
  await page.waitForTimeout(200);
  console.log(prefix, tag, await measure(page));
  await shot(page, `after-${prefix}-calendar-scrolled-${tag}`);

  if (prefix === 'laptop') {
    await shot(page, `after-${prefix}-sidebar-footer-${tag}`);
  }

  if (prefix === 'mobile') {
    // open sidebar
    const openBtn = page
      .locator(
        'button[aria-controls="oma-mobile-nav"], [data-testid="shell-mobile-nav"], header button[aria-expanded="false"]',
      )
      .first();
    await openBtn.click();
    await page.waitForTimeout(700);
    await shot(page, `after-${prefix}-sidebar-open-${tag}`);
    // close via close button inside drawer
    const closeBtn = page
      .locator(
        '.oma-drawer--nav.ant-drawer-open .oma-mobile-drawer-header button, .oma-drawer--nav.ant-drawer-open button.oma-rail-collapse',
      )
      .first();
    if (await closeBtn.count()) {
      await closeBtn.click({ force: true });
    } else {
      await page.keyboard.press('Escape').catch(() => null);
      await page
        .locator('.oma-drawer--nav.ant-drawer-open .ant-drawer-mask')
        .click({ force: true })
        .catch(() => null);
    }
    await page.waitForTimeout(900);
    // force close state if needed
    await page.evaluate(() => {
      document.querySelectorAll('.oma-drawer--nav').forEach((el) => {
        // only observe; closing is React-driven
      });
    });
    const afterClose = await measure(page);
    console.log('mobile closed leftovers', tag, afterClose.leftovers);
    await shot(page, `after-${prefix}-sidebar-closed-${tag}`);
  }

  await context.close();
}

async function main() {
  const cookies = apiLogin();
  const browser = await chromium.launch({ headless: true });
  for (const locale of ['en', 'ar']) {
    await captureLocale(browser, locale, cookies, { width: 1366, height: 768 }, 'laptop');
    await captureLocale(browser, locale, cookies, { width: 390, height: 844 }, 'mobile');
  }
  await browser.close();
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
