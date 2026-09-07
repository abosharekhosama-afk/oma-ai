import { test, expect } from '@playwright/test';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import { createBrandFlow, registerBrandOwner } from './helpers/brand-api';
import {
  installOwnerSession,
  uiApproveProfile,
  uiCreateBrandConnectAndStartScan,
  uiOpenProfileDraft,
  uiSubmitForReviewIfNeeded,
  uiWaitForScanTerminal,
  webOrigin,
} from './helpers/brand-ui';

test.describe('Feature 002 visible surface gaps', () => {
  test('discovery pages open evidence side panel from real evidence API', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await installOwnerSession(page, request);
    const { brandId } = await uiCreateBrandConnectAndStartScan(page, request, owner);
    await uiWaitForScanTerminal(page);

    await page.goto(`/app/brands/${brandId}/discovery/pages`);
    await expect(page.getByRole('heading', { name: 'Discovered pages' })).toBeVisible({
      timeout: 30_000,
    });
    const evidenceButton = page.getByRole('button', { name: 'View evidence' }).first();
    await expect(evidenceButton).toBeVisible({ timeout: 20_000 });
    await evidenceButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Evidence' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('brand overview lists scan history and compare picker works', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await installOwnerSession(page, request);
    const { brandId } = await uiCreateBrandConnectAndStartScan(page, request, owner);
    await uiWaitForScanTerminal(page);
    await uiOpenProfileDraft(page);
    await uiSubmitForReviewIfNeeded(page);
    await uiApproveProfile(page);

    await page.goto(`/app/brands/${brandId}`);
    await expect(page.getByRole('heading', { name: 'Scan history' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('link', { name: 'Open' }).first()).toBeVisible();

    const profileLink = page.getByRole('link', { name: /view profile|approved/i }).first();
    await profileLink.click();
    await expect(page.getByTestId('immutable-banner')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('link', { name: 'Compare versions' }).click();
    await expect(page.getByTestId('compare-against')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Version comparison' })).toBeVisible();
  });

  test('notification deep link opens profile without API shortcut UI action', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const flow = await createBrandFlow(request, owner.cookies);
    expect(flow.profileVersionId).toBeTruthy();

    const prisma = getPrisma();
    const deepLinkPath = `/app/brands/${flow.brandId}/profiles/${flow.profileVersionId}`;
    await prisma.notification.create({
      data: {
        id: newId(),
        tenantId: owner.tenantId,
        recipientUserId: owner.userId,
        type: 'brand.profile.needs_review',
        objectType: 'ProfileVersion',
        objectId: flow.profileVersionId!,
        deepLinkPath,
        dedupeKey: `e2e-notif:${flow.profileVersionId}`,
      },
    });

    const origin = webOrigin();
    await page.context().addCookies([
      { name: 'oma_session', value: owner.cookies.oma_session, url: origin },
      { name: 'oma_csrf', value: owner.cookies.oma_csrf, url: origin },
    ]);
    await page.goto('/app');
    await page.evaluate(
      async ({ tenantId, csrf }) => {
        const res = await fetch('/api/v1/tenants/active', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
          body: JSON.stringify({ tenant_id: tenantId }),
        });
        if (!res.ok) throw new Error(`tenant activate failed: ${res.status}`);
      },
      { tenantId: owner.tenantId, csrf: owner.cookies.oma_csrf },
    );
    await page.reload();

    await page.getByRole('button', { name: 'Notifications' }).click();
    await page.locator('#notifications-panel a[data-testid^="notification-link-"]').first().click();
    await expect(page).toHaveURL(new RegExp(deepLinkPath.replace(/\//g, '\\/')));
    await expect(page.getByRole('heading', { name: 'Brand intelligence' })).toBeVisible({
      timeout: 20_000,
    });
  });
});
