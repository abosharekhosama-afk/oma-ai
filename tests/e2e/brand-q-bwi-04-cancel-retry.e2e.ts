import { test, expect } from '@playwright/test';
import {
  installOwnerSession,
  uiCreateBrandConnectAndStartScan,
  uiWaitForScanTerminal,
} from './helpers/brand-ui';

test.describe('Q-BWI-04 cancel retry', () => {
  test('cancel then retry from scan progress UI', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await installOwnerSession(page, request);
    const { brandId } = await uiCreateBrandConnectAndStartScan(page, request, owner);

    const cancel = page.getByRole('button', { name: 'Cancel scan' });
    if (await cancel.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await cancel.click();
      await expect(page.locator('.oma-badge', { hasText: 'CANCELLED' })).toBeVisible({
        timeout: 30_000,
      });
    } else {
      await uiWaitForScanTerminal(page);
      await page.getByRole('button', { name: 'Retry scan' }).click();
      await expect(page).toHaveURL(new RegExp(`/app/brands/${brandId}/scans/[^/]+$`));
      await page.getByRole('button', { name: 'Cancel scan' }).click();
      await expect(page.locator('.oma-badge', { hasText: 'CANCELLED' })).toBeVisible({
        timeout: 30_000,
      });
    }

    await page.getByRole('button', { name: 'Retry scan' }).click();
    await expect(page).toHaveURL(new RegExp(`/app/brands/${brandId}/scans/[^/]+$`));
    await uiWaitForScanTerminal(page);
  });
});
