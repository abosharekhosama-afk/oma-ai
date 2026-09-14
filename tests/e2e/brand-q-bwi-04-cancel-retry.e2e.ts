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

    // Cancel as soon as the control appears so the fixture worker cannot finish first.
    const cancel = page.getByRole('button', { name: 'Cancel scan' });
    await expect(cancel).toBeVisible({ timeout: 15_000 });
    await cancel.click();
    await expect(page.getByTestId('scan-status')).toHaveText('CANCELLED', { timeout: 30_000 });
    await expect(page.getByText(/scan cancelled|cancelled|تم الإلغاء/i).first()).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('button', { name: 'Retry scan' }).click();
    await expect(page).toHaveURL(new RegExp(`/app/brands/${brandId}/scans/[^/]+$`));
    await uiWaitForScanTerminal(page);
  });
});
