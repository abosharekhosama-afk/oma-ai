import { expect, test, type Page } from '@playwright/test';
import { apiGet, apiPost, createBrandFlow, registerBrandOwner } from './helpers/brand-api';

/**
 * audit41: EN/AR + RTL/LTR, notifications popover/page, account menu across desktop/tablet/mobile.
 * Set SHOT_DIR for audit41-*.png screenshots.
 */
const SHOT_DIR = process.env.SHOT_DIR;
if (process.env.PW_CHROME) test.use({ launchOptions: { executablePath: process.env.PW_CHROME } });
test.use({ actionTimeout: 20_000 });
/** Hide the Next.js dev-only issues badge so it can't sit on top of the sidebar footer in dev runs. */
async function hideDevOverlay(page: Page) {
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => undefined);
}
const shot = async (page: Page, name: string) => {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/audit41-${name}.png` });
};

const VIEWPORTS = [
  { id: '1440', width: 1440, height: 900 },
  { id: '1024', width: 1024, height: 768 },
  { id: '390', width: 390, height: 844 },
] as const;

const RAW_KEY = /\b(?:shell|demo|team|members|companies|errors?|wsPanel|content|notificationsPage|settingsPage|auth)\.[a-z_]+(?:\.[a-zA-Z_]+)*\b/;
const TECH = /\b(?:SCHEDULE_BLOCKED|PERMISSION_DENIED|TENANT_REQUIRED|CONFLICT_STATE|tenant\.manage|brand\.read)\b|Active tenant required/;

async function assertCleanText(page: Page, loc: 'en' | 'ar') {
  const text = await page.locator('body').innerText();
  expect(text, 'raw i18n key on screen').not.toMatch(RAW_KEY);
  expect(text, 'technical code on screen').not.toMatch(TECH);
  await expect(page.locator('html')).toHaveAttribute('dir', loc === 'ar' ? 'rtl' : 'ltr');
}

async function assertInViewport(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${selector} visible`).not.toBeNull();
  const vp = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);
  // topmost at its centre → nothing overlaps it
  const onTop = await page.evaluate((sel) => {
    const el = document.querySelector(sel)!;
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 40));
    return !!hit && el.contains(hit);
  }, selector);
  expect(onTop, `${selector} is not covered`).toBe(true);
}

async function openShellFooter(page: Page, mobile: boolean) {
  await hideDevOverlay(page);
  if (mobile) {
    await page.locator('[data-testid="mobile-nav-toggle"]:visible, [data-testid="mobile-nav-trigger"]:visible').first().click();
    await page.waitForTimeout(400);
  }
}

test('audit41 i18n, direction, notifications and popovers', async ({ page, request, baseURL }) => {
  test.setTimeout(600_000);
  const owner = await registerBrandOwner(request);
  const { brandId } = await createBrandFlow(request, owner.cookies);
  const mk = async (en: string, ar: string) =>
    (await (await apiPost(request, `/api/v1/brands/${brandId}/content`, owner.cookies, {
      title: { en, ar }, caption: { en, ar }, contentType: 'POST', channel: 'Instagram', track: 'ORGANIC',
      plannedAt: new Date(Date.now() + 2 * 864e5).toISOString(),
    })).json()).data as { id: string };
  for (const [en, ar] of [['Cardamom latte is back', 'عاد لاتيه الهيل'], ['Loyalty card relaunch', 'إعادة إطلاق بطاقة الولاء'], ['Winter menu teaser', 'تشويقة قائمة الشتاء']]) {
    const c = await mk(en!, ar!);
    await apiPost(request, `/api/v1/content/${c.id}/request-approval`, owner.cookies, {});
    await apiPost(request, `/api/v1/content/${c.id}/approve`, owner.cookies, {});
  }
  const notif = await (await apiGet(request, '/api/v1/notifications', owner.cookies)).json();
  expect(notif.items.length).toBeGreaterThan(0);

  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`[console.error] ${m.text().slice(0, 400)}`);
  });
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message.slice(0, 400)}`));
  page.on('load', () => void hideDevOverlay(page));
  const host = new URL(baseURL!).hostname;
  for (const loc of ['en', 'ar'] as const) {
    await page.context().clearCookies();
    await page.context().addCookies([
      ...Object.entries(owner.cookies).map(([name, value]) => ({ name, value: String(value), domain: host, path: '/' })),
      { name: 'oma_locale', value: loc, domain: host, path: '/' },
    ]);
    for (const vp of VIEWPORTS) {
      const mobile = vp.width < 768;
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const tag = `${vp.id}-${loc}`;

      // Notifications page
      await page.goto('/app/notifications');
      await expect(page.getByTestId('notifications-page-list')).toBeVisible({ timeout: 30_000 });
      await assertCleanText(page, loc);
      await shot(page, `notifications-page-${tag}`);
      await page.getByTestId('notifications-filter-unread').click();
      await expect(page.getByTestId('notifications-filter-unread')).toHaveAttribute('aria-selected', 'true');
      await page.getByTestId('notifications-filter-all').click();

      // Bell popover
      await page.goto('/app');
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await openShellFooter(page, mobile);
      await page.locator('[data-testid="shell-notifications-trigger"]:visible').first().click();
      await expect(page.getByTestId('shell-notifications-panel')).toBeVisible();
      await page.waitForTimeout(300);
      await assertInViewport(page, '[data-testid="shell-notifications-panel"]');
      await expect(page.getByTestId('shell-notifications-view-all')).toBeVisible();
      await assertCleanText(page, loc);
      await shot(page, `notifications-popover-${tag}`);
      await page.keyboard.press('Escape');
      await page.goto('/app');

      // Account menu
      await openShellFooter(page, mobile);
      await page.locator('[data-testid="shell-user-menu-trigger"]:visible').first().click();
      await expect(page.getByTestId('shell-user-menu-panel')).toBeVisible();
      await page.waitForTimeout(300);
      await assertInViewport(page, '[data-testid="shell-user-menu-panel"]');
      await shot(page, `account-menu-${tag}`);
      await page.keyboard.press('Escape');

      // Collapsed rail (desktop only): popovers still render outside the narrow rail
      if (vp.width >= 1024) {
        await page.goto('/app');
        const collapse = page.getByTestId('oma-rail-collapse');
        if (await collapse.isVisible().catch(() => false)) {
          await collapse.click();
          await page.locator('[data-testid="shell-notifications-trigger"]:visible').first().click();
          await expect(page.getByTestId('shell-notifications-panel')).toBeVisible();
          await page.waitForTimeout(300);
          await assertInViewport(page, '[data-testid="shell-notifications-panel"]');
          await shot(page, `notifications-popover-collapsed-${tag}`);
          await page.keyboard.press('Escape');
          await page.getByTestId('oma-rail-logo-expand').click().catch(() => undefined);
        }
      }

      // Sample of main pages
      for (const [name, path] of [['home', '/app'], ['team', '/app/team'], ['settings', '/app/settings'], ['content', '/app/content']] as const) {
        await page.goto(path);
        await page.waitForLoadState('networkidle').catch(() => undefined);
        await page.waitForTimeout(800);
        await assertCleanText(page, loc);
        await shot(page, `${name}-${tag}`);
      }
    }
  }

  // Mark-all from the page empties the unread filter
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/notifications');
  await page.getByTestId('notifications-page-mark-all').click();
  await page.getByTestId('notifications-filter-unread').click();
  await expect(page.getByTestId('notifications-page-empty')).toBeVisible();
});
