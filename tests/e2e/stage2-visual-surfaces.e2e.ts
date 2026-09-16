import { test, expect } from '@playwright/test';
import { installOwnerSession, uiCreateBrandConnectAndStartScan } from './helpers/brand-ui';
import { msg } from './helpers/i18n';

test.describe('Stage 2 Command Center / Brand / Strategy visuals', () => {
  test('command center hierarchy and brand portfolio density', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'Uses EN fixture helpers');
    const owner = await installOwnerSession(page, request);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await expect(page.getByTestId('product-home')).toBeVisible();
    await expect(page.locator('.oma-workboard-split')).toBeVisible();
    await expect(page.locator('.oma-panel--priority')).toBeVisible();
    await expect(page.locator('.oma-metric-rail')).toBeVisible();

    await page
      .getByRole('link', { name: msg(testInfo, 'home.viewPortfolio') })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app\/brands/);
    await expect(page.getByTestId('brand-portfolio')).toBeVisible();

    await uiCreateBrandConnectAndStartScan(page, request, owner);
    await page.goto('/app/brands');
    await expect(page.getByTestId('brand-workspace-grid')).toBeVisible();
    await expect(page.locator('.oma-workspace-card').first()).toBeVisible();
    await page.locator('.oma-workspace-card').first().getByRole('link').first().click();
    await expect(page.getByTestId('brand-workspace')).toBeVisible();
    await expect(page.locator('.oma-brand-nav')).toBeVisible();
    await expect(page.locator('.oma-brand-header')).toBeVisible();
  });

  test('discovery evidence drawer and strategy tracks', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'Uses EN fixture helpers');
    const owner = await installOwnerSession(page, request);
    const { brandId } = await uiCreateBrandConnectAndStartScan(page, request, owner);

    await page.goto(`/app/brands/${brandId}/discovery/pages`);
    await expect(page.getByTestId('brand-workspace')).toBeVisible();
    const evidenceBtn = page.locator('[data-testid^="view-evidence-"]').first();
    if (await evidenceBtn.count()) {
      await evidenceBtn.click();
      await expect(
        page.getByRole('dialog', { name: msg(testInfo, 'brand.evidence.title') }),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('dialog', { name: msg(testInfo, 'brand.evidence.title') }),
      ).toHaveCount(0);
    }

    await page.goto(`/app/brands/${brandId}/strategies`);
    await expect(page.getByTestId('strategy-create')).toBeVisible();
  });
});
