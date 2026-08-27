import { test, expect } from '@playwright/test';
import {
  installOwnerSession,
  uiApproveProfile,
  uiCreateBrandConnectAndStartScan,
  uiOpenProfileDraft,
  uiSubmitForReviewIfNeeded,
  uiWaitForScanTerminal,
} from './helpers/brand-ui';

test.describe('Q-BWI-01 approve journey', () => {
  test('create connect scan review approve persists in UI', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const owner = await installOwnerSession(page, request);

    const { brandId } = await uiCreateBrandConnectAndStartScan(page, request, owner);
    await uiWaitForScanTerminal(page);
    await uiOpenProfileDraft(page);
    await uiSubmitForReviewIfNeeded(page);
    await uiApproveProfile(page);

    await page.goto(`/app/brands/${brandId}`);
    await expect(page.getByText('Approved profile')).toBeVisible();
    expect(errors).toHaveLength(0);
  });
});
