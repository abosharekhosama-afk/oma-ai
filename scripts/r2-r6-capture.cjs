/**
 * Standalone R2–R6 capture (does not use Playwright test runner / global teardown).
 */
const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const req = createRequire(require.resolve('@playwright/test/package.json', { paths: [ROOT] }));
const { chromium } = req('playwright');

const OUT = path.join(ROOT, 'artifacts/oma-planable-forensic-parity/r2-r6');
const META = path.join(ROOT, '.reference/008-oma-planable-forensic-parity/r2-r6');
const OMA = process.env.OMA_BASE || 'http://127.0.0.1:3010';
const EMAIL = process.env.OMA_REVIEW_EMAIL || 'review-owner-003@oma.local';
const PASS = process.env.OMA_REVIEW_PASSWORD || 'ReviewOwner_003_ChangeMe!';

const ROUTES = [
  { id: 'command-center', path: '/app', feature: 'shell' },
  { id: 'campaigns', path: '/app/campaigns', feature: 'planning' },
  { id: 'content-calendar', path: '/app/content?view=calendar', feature: 'planning' },
  { id: 'content-feed', path: '/app/content?view=feed', feature: 'planning' },
  { id: 'content-grid', path: '/app/content?view=grid', feature: 'planning' },
  { id: 'content-list', path: '/app/content?view=list', feature: 'planning' },
  { id: 'requests', path: '/app/requests', feature: 'production' },
  { id: 'tasks', path: '/app/tasks', feature: 'production' },
  { id: 'deliverables', path: '/app/deliverables', feature: 'production' },
  { id: 'reviews', path: '/app/reviews', feature: 'review' },
  { id: 'schedule', path: '/app/schedule', feature: 'governance' },
  { id: 'analytics', path: '/app/analytics', feature: 'governance' },
  { id: 'team', path: '/app/team', feature: 'governance' },
  { id: 'activity', path: '/app/activity', feature: 'governance' },
  { id: 'settings', path: '/app/settings', feature: 'governance' },
  { id: 'brands', path: '/app/brands', feature: 'brand' },
  { id: 'members', path: '/app/company/members', feature: 'org' },
  { id: 'onboarding', path: '/app/onboarding', feature: 'org' },
];

function ensure(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function integrity(page) {
  return page.evaluate(() => {
    const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src).length;
    const nextDev = !!document.querySelector('#__next-build-watcher, [data-nextjs-toast], nextjs-portal');
    const overflowX = document.body.scrollWidth > document.body.clientWidth + 1;
    const clipped = [
      ...document.querySelectorAll(
        '.oma-content-face, .oma-cal-item, .oma-workspace-card, [data-testid^="demo-"]',
      ),
    ].filter((el) => {
      const s = getComputedStyle(el);
      return (
        s.overflow === 'hidden' &&
        el.scrollHeight > el.clientHeight + 2 &&
        el.clientHeight > 0 &&
        el.clientHeight < 40
      );
    }).length;
    return { broken, nextDev, overflowX, clipped, title: document.title, url: location.href };
  });
}

async function main() {
  ensure(path.join(OUT, 'oma-after'));
  ensure(path.join(OUT, 'interactions'));
  ensure(path.join(OUT, 'planable'));
  ensure(META);

  let planable = {
    status: 'DEFERRED',
    composer: 'REFERENCE_UNAVAILABLE_READ_ONLY_NO_MUTATE',
    note: 'Composer not opened (no mutate). Feed/List/Grid/Calendar already LIVE_VERIFIED under planable/*.png',
  };
  if (process.env.SKIP_PLANABLE_CDP !== '1') {
    try {
      const cdp = await chromium.connectOverCDP('http://127.0.0.1:9333');
      const ctx = cdp.contexts()[0];
      const page = ctx?.pages().find((p) => /planable/i.test(p.url())) || ctx?.pages()[0];
      if (page) {
        const detect = await page.evaluate(() => {
          const texts = [...document.querySelectorAll('button, a, [role=button]')].map((el) =>
            (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 80),
          );
          return {
            path: location.pathname,
            composeHints: texts
              .filter((t) => /compose|create post|new post|write/i.test(t))
              .slice(0, 10),
            title: document.title,
          };
        });
        planable = {
          status: 'PROBED',
          ...detect,
          composer: 'REFERENCE_UNAVAILABLE_READ_ONLY_NO_MUTATE',
        };
        fs.writeFileSync(
          path.join(OUT, 'planable/composer-probe.json'),
          JSON.stringify(planable, null, 2),
        );
      } else {
        planable = { status: 'NO_PAGE', composer: 'REFERENCE_UNAVAILABLE' };
      }
    } catch (err) {
      planable = { status: 'CDP_ERROR', error: String(err), composer: 'REFERENCE_UNAVAILABLE' };
    }
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto(`${OMA}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.fill('#email, input[name=email], input[type=email]', EMAIL);
  await page.fill('#password, input[name=password], input[type=password]', PASS);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/app/, { timeout: 60000 });

  const rows = [];
  const summary = { brokenImages: 0, overflow: 0, clipped: 0, nextDev: false, consoleCritical: 0 };
  const viewports = [
    { id: '1440', width: 1440, height: 900 },
    { id: '1024', width: 1024, height: 768 },
    { id: '390', width: 390, height: 844 },
  ];

  for (const route of ROUTES) {
    for (const vp of viewports) {
      const need =
        vp.id === '1440' ||
        route.id.startsWith('content') ||
        ['command-center', 'campaigns', 'tasks', 'reviews'].includes(route.id);
      if (!need) continue;
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${OMA}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(800);
      const shot = `oma-after/${route.id}-${vp.id}.png`;
      await page.screenshot({ path: path.join(OUT, shot), fullPage: false });
      const integ = await integrity(page);
      summary.brokenImages += integ.broken;
      if (integ.overflowX) summary.overflow += 1;
      summary.clipped += integ.clipped;
      if (integ.nextDev) summary.nextDev = true;
      rows.push({ route: route.path, feature: route.feature, viewport: vp.id, shot, ...integ });
      process.stdout.write('.');
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.cookie = 'oma_locale=ar; path=/';
  });
  await page.goto(`${OMA}/app`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.screenshot({ path: path.join(OUT, 'oma-after/shell-ar-rtl-1440.png'), fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${OMA}/app`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.screenshot({ path: path.join(OUT, 'oma-after/shell-ar-rtl-390.png'), fullPage: false });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.cookie = 'oma_locale=en; path=/';
  });
  await page.goto(`${OMA}/app/content?view=calendar`, { waitUntil: 'domcontentloaded' });
  for (const mode of ['calendar', 'feed', 'grid', 'list']) {
    const tab = page.locator(`[data-testid="demo-content-view-${mode}"]`);
    if ((await tab.count()) > 0) {
      await tab.first().click();
      await page.waitForTimeout(280);
      await page.screenshot({
        path: path.join(OUT, `interactions/content-view-${mode}.png`),
        fullPage: false,
      });
    }
  }

  const createBtn = page.locator('[data-testid="demo-create-content"]');
  if ((await createBtn.count()) > 0) {
    await createBtn.first().click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(OUT, 'interactions/composer-create-open.png'),
      fullPage: false,
    });
    await page.keyboard.press('Escape');
  }

  const filtersBtn = page.locator('[data-testid="demo-content-open-filters"]');
  if ((await filtersBtn.count()) > 0) {
    await filtersBtn.first().click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(OUT, 'interactions/content-filters-open.png'),
      fullPage: false,
    });
    await page.keyboard.press('Escape');
  }

  await page.goto(`${OMA}/app/tasks`, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(OUT, 'interactions/tasks-board.png'), fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${OMA}/app`, { waitUntil: 'domcontentloaded' });
  const menu = page.locator('.oma-top-start button, [data-testid="shell-mobile-menu"]').first();
  if ((await menu.count()) > 0) {
    await menu.click().catch(() => undefined);
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(OUT, 'interactions/mobile-nav-drawer.png'),
      fullPage: false,
    });
  }

  summary.consoleCritical = consoleErrors.filter((e) =>
    /hydrat|Minified React|Uncaught/i.test(e),
  ).length;
  summary.consoleSample = consoleErrors.slice(0, 15);

  const captured1440 = new Set(rows.filter((r) => r.viewport === '1440').map((r) => r.route));
  const meta = {
    stage: 'R2-R6',
    capturedAt: new Date().toISOString(),
    omaBase: OMA,
    planable,
    summary,
    routeCoveragePercent: Math.round((captured1440.size / ROUTES.length) * 1000) / 10,
    routes: ROUTES.length,
    capturedRoutes1440: captured1440.size,
    rows,
  };
  fs.writeFileSync(path.join(META, 'capture-summary.json'), JSON.stringify(meta, null, 2));
  fs.writeFileSync(path.join(OUT, 'capture-summary.json'), JSON.stringify(meta, null, 2));
  console.log('\n' + JSON.stringify({ ok: true, routeCoverage: meta.routeCoveragePercent, summary, planable }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
