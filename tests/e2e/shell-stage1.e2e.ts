import { test, expect } from '@playwright/test';
import { installOwnerSession } from './helpers/brand-ui';
import { msg } from './helpers/i18n';

test.describe('Stage 1 Planable shell', () => {
  test.describe.configure({ timeout: 120_000 });

  test('grouped nav, collapse preference, overlays, responsive, RTL', async ({
    page,
    request,
  }, testInfo) => {
    await installOwnerSession(page, request);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await expect(page.locator('.oma-shell')).toBeVisible();

    const sections = page.locator('.oma-nav-section');
    await expect(sections).toHaveCount(6);
    await expect(
      page
        .getByRole('navigation', { name: /main navigation|التنقل الرئيسي/i })
        .getByRole('link', { name: msg(testInfo, 'nav.home') }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: /main navigation|التنقل الرئيسي/i })
        .getByRole('link', { name: msg(testInfo, 'nav.campaigns') }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: /main navigation|التنقل الرئيسي/i })
        .getByRole('link', { name: msg(testInfo, 'nav.settings') }),
    ).toBeVisible();
    await expect(page.getByTestId('shell-create')).toBeVisible();
    await expect(page.getByRole('button', { name: msg(testInfo, 'shell.search') })).toBeVisible();
    await expect(
      page.getByRole('button', { name: msg(testInfo, 'shell.notifications') }),
    ).toBeVisible();

    const railBox = await page.locator('.oma-rail').boundingBox();
    expect(railBox?.width).toBeGreaterThanOrEqual(252);
    expect(railBox?.width).toBeLessThanOrEqual(260);

    const createBox = await page.getByTestId('shell-create').boundingBox();
    expect(createBox?.height).toBeGreaterThanOrEqual(30);
    expect(createBox?.height).toBeLessThanOrEqual(34);

    await expect(
      page.locator('.oma-rail').getByRole('button', { name: msg(testInfo, 'shell.search') }),
    ).toBeVisible();
    await expect(
      page.locator('.oma-rail').getByRole('button', { name: msg(testInfo, 'shell.notifications') }),
    ).toBeVisible();
    await expect(
      page.locator('.oma-rail').getByRole('button', { name: msg(testInfo, 'shell.account') }),
    ).toBeVisible();

    await page.getByRole('button', { name: msg(testInfo, 'shell.collapseNav') }).click();
    await expect(page.locator('.oma-shell')).toHaveAttribute('data-rail', 'collapsed');
    await expect
      .poll(async () => (await page.locator('.oma-rail').boundingBox())?.width ?? 999, {
        timeout: 5_000,
      })
      .toBeLessThanOrEqual(72);
    expect(await page.evaluate(() => localStorage.getItem('oma.shell.railCollapsed'))).toBe('1');

    await page.reload();
    await expect(page.locator('.oma-shell')).toHaveAttribute('data-rail', 'collapsed');
    await page.getByRole('button', { name: msg(testInfo, 'shell.expandNav') }).click();
    await expect(page.locator('.oma-shell')).toHaveAttribute('data-rail', 'expanded');

    await page.getByRole('button', { name: msg(testInfo, 'shell.search') }).click();
    const dialog = page.getByRole('dialog', { name: msg(testInfo, 'shell.searchTitle') });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    await page.getByRole('button', { name: msg(testInfo, 'shell.account') }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page
      .getByRole('navigation', { name: /main navigation|التنقل الرئيسي/i })
      .locator('a[href="/app/campaigns"]')
      .click();
    await expect(page).toHaveURL(/\/app\/campaigns/);
    await expect(
      page
        .getByRole('navigation', { name: /main navigation|التنقل الرئيسي/i })
        .locator('a[href="/app/campaigns"]'),
    ).toHaveAttribute('aria-current', 'page');

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/app');
    const tabletRail = await page.locator('.oma-rail').boundingBox();
    expect(tabletRail?.width).toBeGreaterThanOrEqual(252);
    expect(tabletRail?.width).toBeLessThanOrEqual(260);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app');
    await expect(page.locator('.oma-rail')).toBeHidden();
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
    expect(noOverflow).toBe(true);
    await page.getByRole('button', { name: msg(testInfo, 'shell.openNav') }).click();
    await expect(page.getByRole('dialog', { name: msg(testInfo, 'nav.primary') })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: msg(testInfo, 'nav.primary') })).toHaveCount(0);

    const origin = testInfo.project.use.baseURL ?? 'http://127.0.0.1:3000';
    await page.context().addCookies([{ name: 'oma_locale', value: 'ar', url: origin }]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const borderSide = await page.locator('.oma-rail').evaluate((el) => {
      const styles = getComputedStyle(el);
      return {
        inlineEnd: styles.borderInlineEndWidth,
        inlineStart: styles.borderInlineStartWidth,
      };
    });
    expect(Number.parseFloat(borderSide.inlineEnd)).toBeGreaterThan(0);
  });
});
