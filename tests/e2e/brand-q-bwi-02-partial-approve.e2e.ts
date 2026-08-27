import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';
import {
  apiGet,
  apiPost,
  FIXTURE_WEBSITE_URL,
  pollScan,
  registerBrandOwner,
} from './helpers/brand-api';

test.describe('Q-BWI-02 partial approve', () => {
  test('partial scan requires ack then approves', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const brand = await apiPost(request, '/api/v1/brands', owner.cookies, {
      name: 'Partial Brand',
    });
    const brandBody = await brand.json();
    await apiPost(
      request,
      `/api/v1/brands/${brandBody.data.id}/website`,
      owner.cookies,
      {
        url: FIXTURE_WEBSITE_URL,
        authorization_attested: true,
        version: brandBody.data.version,
      },
      { 'idempotency-key': newId() },
    );
    const scan = await apiPost(
      request,
      `/api/v1/brands/${brandBody.data.id}/scans`,
      owner.cookies,
      { config: { max_pages: 1 } },
      { 'idempotency-key': newId() },
    );
    const scanBody = await scan.json();
    await pollScan(request, owner.cookies, brandBody.data.id, scanBody.data.scan_attempt_id, [
      'PARTIAL',
      'SUCCEEDED',
      'FAILED',
    ]);
    const detail = await apiGet(
      request,
      `/api/v1/brands/${brandBody.data.id}/scans/${scanBody.data.scan_attempt_id}`,
      owner.cookies,
    );
    const detailBody = await detail.json();
    const versionId = detailBody.data.profile_version_id as string;
    const profile = await apiGet(
      request,
      `/api/v1/brands/${brandBody.data.id}/profiles/${versionId}`,
      owner.cookies,
    );
    const profileBody = await profile.json();

    const denied = await apiPost(
      request,
      `/api/v1/brands/${brandBody.data.id}/profiles/${versionId}/approve`,
      owner.cookies,
      {
        row_version: profileBody.data.row_version,
        acknowledge_incomplete: false,
        confirm_summary: true,
      },
    );
    expect(denied.status()).toBe(422);

    const ok = await apiPost(
      request,
      `/api/v1/brands/${brandBody.data.id}/profiles/${versionId}/approve`,
      owner.cookies,
      {
        row_version: profileBody.data.row_version,
        acknowledge_incomplete: true,
        confirm_summary: true,
      },
    );
    expect(ok.ok()).toBeTruthy();
  });
});
