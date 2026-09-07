import { test, expect } from '@playwright/test';
import { createBrandFlow, apiGet, apiPatch, registerBrandOwner } from './helpers/brand-api';

test.describe('Q-BWI-10 concurrency', () => {
  test('stale row_version returns 409', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const flow = await createBrandFlow(request, owner.cookies);
    const profile = await apiGet(
      request,
      `/api/v1/brands/${flow.brandId}/profiles/${flow.profileVersionId}`,
      owner.cookies,
    );
    const profileBody = await profile.json();
    const first = await apiPatch(
      request,
      `/api/v1/brands/${flow.brandId}/profiles/${flow.profileVersionId}`,
      owner.cookies,
      {
        row_version: profileBody.data.row_version,
        sections: { overview: { x: 1 } },
      },
    );
    expect(first.ok()).toBeTruthy();
    const stale = await apiPatch(
      request,
      `/api/v1/brands/${flow.brandId}/profiles/${flow.profileVersionId}`,
      owner.cookies,
      {
        row_version: profileBody.data.row_version,
        sections: { overview: { x: 2 } },
      },
    );
    expect(stale.status()).toBe(409);
  });
});
