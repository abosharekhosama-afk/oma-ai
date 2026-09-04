import { test, expect } from '@playwright/test';
import { BRAND_CAPABILITIES } from '@oma/domain';
import { apiGet, apiPost, registerBrandOwner, registerTenantMember } from './helpers/brand-api';

test.describe('Q-BWI-13 capabilities', () => {
  test('member without brand caps denied', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const member = await registerTenantMember(request, owner, [
      'notification.read',
    ]);

    for (const cap of BRAND_CAPABILITIES) {
      const path =
        cap === 'brand.read' ? '/api/v1/brands' : cap === 'brand.create' ? '/api/v1/brands' : null;
      if (!path) continue;
      const method = cap === 'brand.create' ? 'POST' : 'GET';
      const res =
        method === 'GET'
          ? await apiGet(request, path, member.cookies)
          : await apiPost(request, path, member.cookies, { name: 'Denied' });
      expect(res.status()).toBe(403);
    }
  });
});
