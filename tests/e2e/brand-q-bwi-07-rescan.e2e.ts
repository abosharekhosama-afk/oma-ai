import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';
import {
  apiGet,
  apiPost,
  createBrandFlow,
  pollScan,
  registerBrandOwner,
} from './helpers/brand-api';

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
});
