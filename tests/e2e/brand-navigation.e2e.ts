import { test, expect } from '@playwright/test';
import {
  collectPageErrors,
  installOwnerSession,
  uiCreateBrandConnectAndStartScan,
  uiWaitForScanTerminal,
} from './helpers/brand-ui';

/**
 * Reaching a screen by typing its URL proves the route exists, not that a user
 * can find it. Every step here is a click.
 */
test.describe('brand intelligence discoverability', () => {
  test('a user reaches an intelligence version by navigation alone', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const errors = await collectPageErrors(page);
    const owner = await installOwnerSession(page, request);

    const { brandId, brandName } = await uiCreateBrandConnectAndStartScan(page, request, owner);
    await uiWaitForScanTerminal(page);

    // Start from the app home, as a user would after signing in.
    await page.goto('/app');
    await page.getByRole('link', { name: 'Brand Intelligence' }).first().click();
    await expect(page).toHaveURL('/app/brands');

    // Find the brand through search rather than a remembered id.
    await page.getByLabel('Search brands by name').fill(brandName);
    await page.getByTestId('brand-portfolio').getByRole('button', { name: 'Search' }).click();
    await page.getByRole('link', { name: new RegExp(brandName) }).click();
    await expect(page).toHaveURL(`/app/brands/${brandId}`);

    await page.getByRole('link', { name: 'Intelligence', exact: true }).click();
    await expect(page).toHaveURL(`/app/brands/${brandId}/profiles`);
    await expect(page.getByRole('heading', { name: 'Brand intelligence versions' })).toBeVisible();
    await expect(page.locator('.oma-brand-nav a[aria-current="page"]')).toHaveText('Intelligence');

    await page.getByRole('link', { name: 'Brand intelligence', exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/app/brands/${brandId}/profiles/[^/]+$`));
    await expect(page.getByRole('heading', { name: 'Brand intelligence' })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
