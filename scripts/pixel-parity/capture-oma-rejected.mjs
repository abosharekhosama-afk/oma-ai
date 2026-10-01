/**
 * Phase 3 — capture rejected OMA baseline at production preview (PIXEL_LEVEL).
 * Requires: production next on 3010, OMA_REVIEW_PASSWORD or .review/pixel-parity.env
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { assertCaptureReady, scrubUrl, settlePage } from './lib/settle.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SHA = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
const FULL_SHA = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const BASE = process.env.OMA_BASE || 'http://127.0.0.1:3010';
const OUT = path.join(ROOT, 'artifacts/oma-planable-pixel-parity/oma-rejected');
const META = path.join(ROOT, '.reference/009-planable-pixel-parity/oma-rejected');

function loadEnv() {
  const envPath = path.join(ROOT, '.review/pixel-parity.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}
loadEnv();

const EMAIL = process.env.OMA_REVIEW_EMAIL || 'review-owner-003@oma.local';
const PASS = process.env.OMA_REVIEW_PASSWORD;
if (!PASS) {
  console.error('Missing OMA_REVIEW_PASSWORD');
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(META, { recursive: true });

const consoleErrors = [];
const manifest = [];

function fname(id, route, view, state, locale, vp) {
  const r = route.replace(/[/?=&]/g, '-').replace(/^-|-$/g, '');
  return `${id}-${r}-${view}-${state}-${locale}-${vp}-${SHA}.png`;
}

async function capture(page, { id, route, view, state, locale, width, height }) {
  const file = fname(id, route, view, state, locale, `${width}x${height}`);
  await settlePage(page);
  const ready = await assertCaptureReady(page, { width, height });
  if (ready.broken > 0) {
    console.warn('broken_images', ready.broken, file);
  }
  const pngPath = path.join(OUT, file);
  await page.screenshot({ path: pngPath, fullPage: false });
  const geometry = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        sel,
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
        padding: s.padding,
        font: s.fontFamily,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
        fontWeight: s.fontWeight,
        color: s.color,
        background: s.backgroundColor,
        border: s.border,
        borderRadius: s.borderRadius,
        boxShadow: s.boxShadow,
        zIndex: s.zIndex,
      };
    };
    return {
      shell: pick('[data-testid="demo-shell"], .oma-shell, nav'),
      toolbar: pick('.oma-stage3-toolbar, [data-testid="demo-content-filters"]'),
      calendar: pick('[data-testid="demo-content-calendar"]'),
      grid: pick('[data-testid="demo-content-grid"], .oma-cal-grid'),
      saved: pick('.oma-cal-saved, [data-testid="demo-content-saved"]'),
      composer: pick('[data-testid="demo-content-composer"], .ant-modal'),
      dialog: pick('.ant-modal-content, [role="dialog"]'),
    };
  });
  const entry = {
    evidenceId: id,
    product: 'OMA',
    phase: 'rejected-baseline',
    route,
    view,
    state,
    locale,
    viewport: { width, height },
    sha: FULL_SHA,
    shaShort: SHA,
    screenshot: file,
    url: scrubUrl(page.url()),
    consoleErrors: [...consoleErrors],
    brokenImages: ready.broken,
    geometry,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(META, `${file.replace(/\.png$/, '')}.json`), JSON.stringify(entry, null, 2));
  manifest.push(entry);
  console.log('ok', file);
  consoleErrors.length = 0;
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type=email], input[name=email]', EMAIL);
  await page.fill('input[type=password], input[name=password]', PASS);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/app/, { timeout: 60_000 });
}

async function setLocale(context, page, locale) {
  await context.addCookies([{ name: 'oma_locale', value: locale, url: BASE }]);
  await page.reload({ waitUntil: 'domcontentloaded' });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'en-US',
    deviceScaleFactor: 1,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 240));
  });

  await login(page);

  const contentStates = [
    { view: 'calendar', state: 'default', path: '/app/content?view=calendar', after: null },
    {
      view: 'calendar',
      state: 'populated',
      path: '/app/content?view=calendar',
      after: async () => {},
    },
    {
      view: 'calendar',
      state: 'filters-open',
      path: '/app/content?view=calendar',
      after: async () => {
        const btn = page.getByTestId('demo-content-open-filters');
        if (await btn.count()) await btn.click();
      },
    },
    {
      view: 'calendar',
      state: 'filters-selected',
      path: '/app/content?view=calendar',
      after: async () => {
        const btn = page.getByTestId('demo-content-open-filters');
        if (await btn.count()) {
          await btn.click();
          const track = page.getByTestId('demo-content-filter-type').or(page.getByTestId('demo-content-filter-status'));
          if (await track.count()) {
            const opts = await track.locator('option').allTextContents();
            if (opts.length > 1) await track.selectOption({ index: 1 });
          }
          const apply = page.getByTestId('demo-content-filter-apply');
          if (await apply.count()) await apply.click();
        }
      },
    },
    { view: 'feed', state: 'default', path: '/app/content?view=feed', after: null },
    { view: 'grid', state: 'default', path: '/app/content?view=grid', after: null },
    { view: 'list', state: 'default', path: '/app/content?view=list', after: null },
    {
      view: 'calendar',
      state: 'composer-open',
      path: '/app/content?view=calendar',
      after: async () => {
        const create = page.getByTestId('demo-create-content').or(page.getByRole('button', { name: /create content/i }));
        if (await create.count()) await create.first().click();
      },
    },
  ];

  // EN desktop Content Plan
  for (const s of contentStates) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}${s.path}`, { waitUntil: 'domcontentloaded' });
    if (s.after) await s.after();
    await capture(page, {
      id: 'OMA-CONTENT',
      route: 'content',
      view: s.view,
      state: s.state,
      locale: 'en',
      width: 1440,
      height: 900,
    });
  }

  // EN mobile agenda
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/app/content?view=calendar`, { waitUntil: 'domcontentloaded' });
  await capture(page, {
    id: 'OMA-CONTENT',
    route: 'content',
    view: 'calendar',
    state: 'mobile-agenda',
    locale: 'en',
    width: 390,
    height: 844,
  });

  // EN tablet
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`${BASE}/app/content?view=calendar`, { waitUntil: 'domcontentloaded' });
  await capture(page, {
    id: 'OMA-CONTENT',
    route: 'content',
    view: 'calendar',
    state: 'default',
    locale: 'en',
    width: 1024,
    height: 768,
  });

  // AR RTL desktop + mobile
  await setLocale(context, page, 'ar');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/app/content?view=calendar`, { waitUntil: 'domcontentloaded' });
  await capture(page, {
    id: 'OMA-CONTENT',
    route: 'content',
    view: 'calendar',
    state: 'default',
    locale: 'ar',
    width: 1440,
    height: 900,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/app/content?view=calendar`, { waitUntil: 'domcontentloaded' });
  await capture(page, {
    id: 'OMA-CONTENT',
    route: 'content',
    view: 'calendar',
    state: 'mobile-agenda',
    locale: 'ar',
    width: 390,
    height: 844,
  });

  // Reset locale + remaining product surfaces (EN 1440)
  await setLocale(context, page, 'en');
  await page.setViewportSize({ width: 1440, height: 900 });
  const surfaces = [
    ['OMA-SHELL', '/app', 'command-center', 'default'],
    ['OMA-CAMPAIGNS', '/app/campaigns', 'portfolio', 'default'],
    ['OMA-REQUESTS', '/app/requests', 'inbox', 'default'],
    ['OMA-TASKS', '/app/tasks', 'board', 'default'],
    ['OMA-DELIVERABLES', '/app/deliverables', 'list', 'default'],
    ['OMA-REVIEWS', '/app/reviews', 'queue', 'default'],
    ['OMA-SCHEDULE', '/app/schedule', 'calendar', 'default'],
    ['OMA-ANALYTICS', '/app/analytics', 'overview', 'default'],
    ['OMA-BRANDS', '/app/brands', 'portfolio', 'default'],
    ['OMA-TEAM', '/app/team', 'list', 'default'],
    ['OMA-ACTIVITY', '/app/activity', 'feed', 'default'],
    ['OMA-SETTINGS', '/app/settings', 'general', 'default'],
    ['OMA-MEMBERS', '/app/company/members', 'list', 'default'],
  ];
  for (const [id, route, view, state] of surfaces) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await capture(page, {
      id,
      route: route.replace('/app/', '').replace('/app', 'app') || 'app',
      view,
      state,
      locale: 'en',
      width: 1440,
      height: 900,
    });
  }

  fs.writeFileSync(path.join(META, 'manifest.json'), JSON.stringify({ sha: FULL_SHA, count: manifest.length, items: manifest }, null, 2));
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ sha: FULL_SHA, count: manifest.length, items: manifest.map((m) => m.screenshot) }, null, 2));
  console.log('DONE', manifest.length, 'captures sha', SHA);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
