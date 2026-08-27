import { test, expect } from '@playwright/test';
import { createBrandFlow, apiGet, apiPost, registerBrandOwner } from './helpers/brand-api';

test.describe('Q-BWI-03 manual ai unavailable', () => {
  test('NOT_CONFIGURED ai path approves', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const flow = await createBrandFlow(request, owner.cookies);
    expect(flow.scan.ai_availability).toBe('NOT_CONFIGURED');
    const profile = await apiGet(
      request,
      `/api/v1/brands/${flow.brandId}/profiles/${flow.profileVersionId}`,
      owner.cookies,
    );
    const profileBody = await profile.json();
    expect(profileBody.data.ai_availability).toBe('NOT_CONFIGURED');
    const approved = await apiPost(
      request,
      `/api/v1/brands/${flow.brandId}/profiles/${flow.profileVersionId}/approve`,
      owner.cookies,
      {
        row_version: profileBody.data.row_version,
        acknowledge_incomplete: true,
        confirm_summary: true,
      },
    );
    expect(approved.ok()).toBeTruthy();
  });
});
