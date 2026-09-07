import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';
import {
  apiGet,
  apiPost,
  createBrandFlow,
  pollScan,
  registerBrandOwner,
} from './helpers/brand-api';
import { uiApproveProfile, uiSubmitForReviewIfNeeded, webOrigin } from './helpers/brand-ui';

test.describe('Q-BWI-07 rescan new draft', () => {
  test('approved unchanged until new version approved', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const flow = await createBrandFlow(request, owner.cookies);
    const profile = await apiGet(
      request,
      `/api/v1/brands/${flow.brandId}/profiles/${flow.profileVersionId}`,
      owner.cookies,
    );
    const profileBody = await profile.json();
    await apiPost(
      request,
      `/api/v1/brands/${flow.brandId}/profiles/${flow.profileVersionId}/approve`,
      owner.cookies,
      {
        row_version: profileBody.data.row_version,
        acknowledge_incomplete: true,
        confirm_summary: true,
      },
    );

    const rescan = await apiPost(
      request,
      `/api/v1/brands/${flow.brandId}/scans`,
      owner.cookies,
      { trigger: 'RESCAN', config: { max_pages: 2 } },
      { 'idempotency-key': newId() },
    );
    expect(rescan.status()).toBe(202);
    const rescanBody = await rescan.json();
    await pollScan(request, owner.cookies, flow.brandId, rescanBody.data.scan_attempt_id, [
      'PARTIAL',
      'SUCCEEDED',
      'FAILED',
    ]);

    const brand = await apiGet(request, `/api/v1/brands/${flow.brandId}`, owner.cookies);
    const brandBody = await brand.json();
    expect(brandBody.data.current_approved_profile_version_id).toBe(flow.profileVersionId);
  });

  test('UI retry/start scan after approval leaves approved profile untouched', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const flow = await createBrandFlow(request, owner.cookies);
    expect(flow.profileVersionId).toBeTruthy();

    const origin = webOrigin();
    await page.context().addCookies([
      { name: 'oma_session', value: owner.cookies.oma_session, url: origin },
      { name: 'oma_csrf', value: owner.cookies.oma_csrf, url: origin },
    ]);

    await page.goto(`/app/brands/${flow.brandId}/profiles/${flow.profileVersionId}`);
    await expect(page.getByRole('heading', { name: 'Brand intelligence' })).toBeVisible({
      timeout: 30_000,
    });
    await uiSubmitForReviewIfNeeded(page);
    await uiApproveProfile(page);

    // Prefer Retry on the completed scan when available; otherwise Start scan.
    await page.goto(`/app/brands/${flow.brandId}/scans/${flow.scanId}`);
    await expect(page.getByRole('heading', { name: /scan/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    const retry = page.getByRole('button', { name: /retry scan/i });
    if (await retry.isVisible()) {
      await retry.click();
      await expect(page).toHaveURL(new RegExp(`/app/brands/${flow.brandId}/scans/[^/]+$`), {
        timeout: 20_000,
      });
    } else {
      await page.goto(`/app/brands/${flow.brandId}/scans/new`);
      await page.getByLabel(/understand these crawl limits/i).check();
      await page.getByRole('button', { name: 'Start scan' }).click();
      await expect(page).toHaveURL(new RegExp(`/app/brands/${flow.brandId}/scans/[^/]+$`));
    }

    await expect(
      page.locator('.oma-badge', { hasText: /PARTIAL|SUCCEEDED|FAILED|CANCELLED|RUNNING|QUEUED/ }),
    ).toBeVisible({ timeout: 90_000 });

    const brand = await apiGet(request, `/api/v1/brands/${flow.brandId}`, owner.cookies);
    const brandBody = await brand.json();
    expect(brandBody.data.current_approved_profile_version_id).toBe(flow.profileVersionId);
  });
});
