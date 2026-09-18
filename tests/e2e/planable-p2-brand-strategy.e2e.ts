import { test, expect } from '@playwright/test';
import { installOwnerSession, uiCreateBrandConnectAndStartScan } from './helpers/brand-ui';
import { msg } from './helpers/i18n';

test.describe('P2 Planable brand and strategy surfaces', () => {
  test.describe.configure({ timeout: 180_000 });

  test('command center, portfolio, create dialog, workspace, discovery, strategy', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'desktop P2 journey');
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    const owner = await installOwnerSession(page, request);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await expect(page.getByTestId('product-home')).toBeVisible();
    await expect(page.getByRole('heading', { name: msg(testInfo, 'home.title') })).toBeVisible();
    await expect(page.getByTestId('demo-command-center')).toBeVisible();
    await expect(page.getByTestId('command-center-workspaces')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(true);

    await page
      .getByRole('link', { name: msg(testInfo, 'home.viewPortfolio') })
      .first()
      .click();
    await expect(page.getByTestId('brand-portfolio')).toBeVisible();
    await page.getByLabel(msg(testInfo, 'brand.list.searchLabel')).fill('Horizon');
    await page.getByTestId('brand-portfolio').getByRole('button', { name: 'Search' }).click();
    // Wait for search settle before create — racing the list reload drops the soft nav.
    await expect(
      page.getByRole('heading', { name: msg(testInfo, 'brand.list.noResults') }),
    ).toBeVisible({ timeout: 15_000 });

    const createBrand = page
      .getByTestId('brand-portfolio')
      .locator('header.oma-page-header')
      .getByRole('link', { name: msg(testInfo, 'brand.list.create') });
    await Promise.all([
      page.waitForURL(/\/app\/brands\/new/, { timeout: 15_000 }),
      createBrand.click(),
    ]);
    await expect(
      page.getByRole('dialog', { name: msg(testInfo, 'brand.create.title') }),
    ).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/app\/brands\/?$/, { timeout: 15_000 });
    await expect(page.getByTestId('brand-portfolio')).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/app\/brands\/new/, { timeout: 15_000 }),
      page
        .getByTestId('brand-portfolio')
        .locator('header.oma-page-header')
        .getByRole('link', { name: msg(testInfo, 'brand.list.create') })
        .click(),
    ]);
    await page
      .getByLabel(msg(testInfo, 'brand.create.nameLabel'))
      .fill(`P2 ${Date.now().toString().slice(-4)}`);
    await page.getByRole('button', { name: msg(testInfo, 'brand.create.submit') }).click();
    await expect(page.getByTestId('brand-workspace')).toBeVisible({ timeout: 20_000 });
    const brandNav = page.getByRole('navigation', { name: msg(testInfo, 'brand.nav.label') });
    await expect(brandNav).toBeVisible();

    const { brandId } = await uiCreateBrandConnectAndStartScan(page, request, owner);
    await page.goto(`/app/brands/${brandId}`);
    await expect(brandNav).toBeVisible({ timeout: 15_000 });
    await Promise.all([
      page.waitForURL(new RegExp(`/app/brands/${brandId}/connect`), { timeout: 15_000 }),
      brandNav.getByRole('link', { name: msg(testInfo, 'brand.nav.website'), exact: true }).click(),
    ]);
    await Promise.all([
      page.waitForURL(new RegExp(`/app/brands/${brandId}/discovery`), { timeout: 15_000 }),
      brandNav.getByRole('link', { name: msg(testInfo, 'brand.nav.discovery') }).click(),
    ]);
    const evidenceBtn = page.locator('[data-testid^="view-evidence-"]').first();
    if (await evidenceBtn.count()) {
      await evidenceBtn.click();
      await expect(
        page.getByRole('dialog', { name: msg(testInfo, 'brand.evidence.title') }),
      ).toBeVisible({ timeout: 15_000 });
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('dialog', { name: msg(testInfo, 'brand.evidence.title') }),
      ).toHaveCount(0);
    }
    await Promise.all([
      page.waitForURL(new RegExp(`/app/brands/${brandId}/profiles`), { timeout: 15_000 }),
      brandNav
        .getByRole('link', { name: msg(testInfo, 'brand.nav.intelligence'), exact: true })
        .click(),
    ]);
    await Promise.all([
      page.waitForURL(new RegExp(`/app/brands/${brandId}/strategies`), { timeout: 15_000 }),
      brandNav.getByRole('link', { name: msg(testInfo, 'brand.nav.strategies') }).click(),
    ]);
    await expect(page.getByTestId('strategy-create')).toBeVisible({ timeout: 20_000 });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/app');
    await expect(page.getByTestId('product-home')).toBeVisible();
    expect(consoleErrors.filter((e) => /hydrat/i.test(e))).toEqual([]);
  });
});
