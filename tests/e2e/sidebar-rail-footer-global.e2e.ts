import { test, expect } from '@playwright/test';
import { installOwnerSession } from './helpers/brand-ui';

/**
 * Account + notifications rail footer must stay visible on every main route
 * (not only Activity) across laptop / short / tablet viewports.
 */
const ROUTES = [
  '/app/activity',
  '/app/content',
  '/app/team',
  '/app/schedule',
  '/app/billing',
  '/app/settings',
] as const;

const VIEWPORTS = [
  { width: 1366, height: 768, name: 'laptop1366' },
  { width: 1440, height: 900, name: 'laptop1440' },
  { width: 1920, height: 1080, name: 'desktop1920' },
  { width: 1280, height: 700, name: 'short700' },
  { width: 1024, height: 768, name: 'tablet' },
] as const;

test.describe('sidebar rail footer global', () => {
  test.describe.configure({ timeout: 180_000 });

  test('footer visible on all main routes × viewports', async ({ page, request }, testInfo) => {
    test.skip(
      !['en-desktop', 'chromium', 'Desktop Chrome'].includes(testInfo.project.name) &&
        !testInfo.project.name.includes('desktop'),
      'desktop rail only',
    );
    await installOwnerSession(page, request);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const route of ROUTES) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.oma-shell')).toBeVisible({ timeout: 30_000 });
        const footer = page.locator('[data-testid="shell-rail-utilities"], .oma-shell > .oma-rail > .oma-rail-footer').first();
        await expect(footer, `${route} @ ${vp.name}`).toBeVisible();
        const box = await footer.boundingBox();
        expect(box, `${route} @ ${vp.name} has box`).toBeTruthy();
        if (box) {
          expect(box.height, `${route} @ ${vp.name} height`).toBeGreaterThan(20);
          // Footer should sit within the viewport (not clipped below fold).
          expect(box.y + box.height, `${route} @ ${vp.name} in viewport`).toBeLessThanOrEqual(vp.height + 2);
        }
        await expect(footer.locator('[data-testid="notifications-bell"], button').first()).toBeVisible();
      }
    }
  });
});
