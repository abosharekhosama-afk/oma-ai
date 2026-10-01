/**
 * Phase 4 — read-only Planable capture via OMA References CDP :9333.
 * Never mutates (no create/save/upload/approve/schedule/publish/settings).
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { assertCaptureReady, scrubUrl, settlePage } from './lib/settle.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'artifacts/oma-planable-pixel-parity/planable-reference');
const META = path.join(ROOT, '.reference/009-planable-pixel-parity/reference');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(META, { recursive: true });

const LOGIN_HINT = /\/(login|signin|sign-in|auth|sso|oauth|mfa|challenge|verify)(\/|\?|$)/i;
const manifest = [];

function fname(id, view, state, locale, vp) {
  return `${id}-${view}-${state}-${locale}-${vp}.png`;
}

async function measureCore(page) {
  return page.evaluate(() => {
    const pick = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 80),
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
        padding: s.padding,
        margin: s.margin,
        font: s.fontFamily,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
        fontWeight: s.fontWeight,
        color: s.color,
        background: s.backgroundColor,
        border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
        borderRadius: s.borderRadius,
        boxShadow: s.boxShadow,
        zIndex: s.zIndex,
        transition: s.transition,
      };
    };
    const byText = (re) =>
      [...document.querySelectorAll('button, a, [role="tab"], [role="button"]')].find((el) =>
        re.test(
          (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim(),
        ),
      );
    const nav = document.querySelector('nav, [class*="Sidebar"], [class*="sidebar"]');
    const main = document.querySelector('main, [role="main"]');
    return {
      sidebar: pick(nav),
      main: pick(main),
      calendarBtn: pick(byText(/^Calendar$/i)),
      feedBtn: pick(byText(/^Feed$/i)),
      gridBtn: pick(byText(/^Grid$/i)),
      listBtn: pick(byText(/^List$/i)),
      filterBtn: pick(byText(/filter/i)),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      rootFont: getComputedStyle(document.body).fontFamily,
    };
  });
}

async function shot(page, { id, view, state, locale, width, height, note }) {
  await settlePage(page);
  const ready = await assertCaptureReady(page, { width, height });
  const file = fname(id, view, state, locale, `${width}x${height}`);
  await page.screenshot({ path: path.join(OUT, file), fullPage: false });
  const geometry = await measureCore(page);
  const entry = {
    evidenceId: id,
    product: 'Planable',
    sourceLevel: 'LIVE_VERIFIED',
    view,
    state,
    locale,
    viewport: { width, height },
    screenshot: file,
    urlPath: scrubUrl(page.url()),
    note,
    geometry,
    brokenImages: ready.broken,
    timestamp: new Date().toISOString(),
    pii: 'path-scrubbed-no-workspace-ids-in-filename',
  };
  fs.writeFileSync(
    path.join(META, `${file.replace(/\.png$/, '')}.json`),
    JSON.stringify(entry, null, 2),
  );
  manifest.push(entry);
  console.log('ok', file, scrubUrl(page.url()));
}

async function clickView(page, label) {
  const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first();
  if (await btn.count()) {
    await btn.click({ timeout: 5_000 });
    await page.waitForTimeout(500);
    return true;
  }
  const tab = page.getByRole('tab', { name: new RegExp(`^${label}$`, 'i') }).first();
  if (await tab.count()) {
    await tab.click({ timeout: 5_000 });
    await page.waitForTimeout(500);
    return true;
  }
  // Link fallback
  const link = page.getByRole('link', { name: new RegExp(`^${label}$`, 'i') }).first();
  if (await link.count()) {
    await link.click({ timeout: 5_000 });
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

async function waitForAuth(page, maxMs = 20 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const url = page.url();
    if (!LOGIN_HINT.test(url) && /app\.planable\.io/i.test(url)) {
      const title = await page.title();
      if (!/sign in|log in/i.test(title)) return true;
    }
    if (LOGIN_HINT.test(url) || /sign in|log in/i.test(await page.title())) {
      if (Date.now() === start || (Date.now() - start) % 60_000 < 12_000) {
        console.log('AUTH_REQUIRED_PLANABLE_REFERENCE');
      }
    }
    await page.waitForTimeout(10_000);
  }
  return false;
}

async function main() {
  let browser;
  try {
    browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  } catch (err) {
    console.error('CDP_UNAVAILABLE', String(err));
    process.exit(2);
  }
  const context = browser.contexts()[0];
  if (!context) {
    console.error('CDP_NO_CONTEXT');
    process.exit(2);
  }
  let page = context.pages().find((p) => /app\.planable\.io/i.test(p.url())) ?? context.pages()[0];
  if (!page) {
    page = await context.newPage();
    await page.goto('https://app.planable.io/', { waitUntil: 'domcontentloaded' });
  }
  await page.bringToFront();

  if (LOGIN_HINT.test(page.url()) || /sign in|log in/i.test(await page.title())) {
    console.log('AUTH_REQUIRED_PLANABLE_REFERENCE');
    const ok = await waitForAuth(page);
    if (!ok) {
      console.error('AUTH_TIMEOUT');
      process.exit(3);
    }
  }

  // Ensure app origin
  if (!/app\.planable\.io/i.test(page.url())) {
    await page.goto('https://app.planable.io/', { waitUntil: 'domcontentloaded' });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await settlePage(page);

  await shot(page, {
    id: 'PL-SHELL',
    view: 'workspace',
    state: 'default',
    locale: 'en',
    width: 1440,
    height: 900,
    note: 'Authenticated shell — read-only',
  });

  for (const label of ['Calendar', 'Feed', 'Grid', 'List']) {
    const ok = await clickView(page, label);
    if (ok) {
      await shot(page, {
        id: 'PL-CONTENT',
        view: label.toLowerCase(),
        state: 'default',
        locale: 'en',
        width: 1440,
        height: 900,
        note: `View switch ${label} — no mutate`,
      });
    } else {
      manifest.push({
        evidenceId: 'PL-CONTENT',
        view: label.toLowerCase(),
        state: 'default',
        sourceLevel: 'ACCESS_BLOCKED',
        note: `Control ${label} not found`,
        timestamp: new Date().toISOString(),
      });
      console.log('missing', label);
    }
  }

  // Filters open if available (view only)
  const filter = page.getByRole('button', { name: /filter/i }).first();
  if (await filter.count()) {
    await filter.click();
    await page.waitForTimeout(400);
    await shot(page, {
      id: 'PL-CONTENT',
      view: 'calendar',
      state: 'filters-open',
      locale: 'en',
      width: 1440,
      height: 900,
      note: 'Filters opened — dismiss without applying mutations if needed',
    });
    await page.keyboard.press('Escape').catch(() => {});
  }

  // Responsive
  await page.setViewportSize({ width: 1024, height: 768 });
  await clickView(page, 'Calendar');
  await shot(page, {
    id: 'PL-CONTENT',
    view: 'calendar',
    state: 'default',
    locale: 'en',
    width: 1024,
    height: 768,
    note: 'Tablet width',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, {
    id: 'PL-CONTENT',
    view: 'calendar',
    state: 'mobile',
    locale: 'en',
    width: 390,
    height: 844,
    note: 'Mobile width — read-only',
  });

  // Restore desktop
  await page.setViewportSize({ width: 1440, height: 900 });

  fs.writeFileSync(
    path.join(META, 'manifest.json'),
    JSON.stringify({ count: manifest.length, items: manifest }, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT, 'manifest.json'),
    JSON.stringify({ count: manifest.length, items: manifest }, null, 2),
  );
  console.log('DONE', manifest.length, 'planable captures');
  // Do not close the shared CDP browser
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
