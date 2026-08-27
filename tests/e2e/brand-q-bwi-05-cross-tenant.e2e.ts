import { test, expect } from '@playwright/test';
import { apiGet, apiPost, registerBrandOwner } from './helpers/brand-api';

test.describe('Q-BWI-05 cross tenant', () => {
  test('foreign tenant cannot read brand', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const t1 = await registerBrandOwner(request);
    const t2 = await registerBrandOwner(request);
    const brand = await apiPost(request, '/api/v1/brands', t1.cookies, { name: 'Secret Brand' });
    const brandBody = await brand.json();
    const probe = await apiGet(request, `/api/v1/brands/${brandBody.data.id}`, t2.cookies);
    expect(probe.status()).toBe(404);
  });
});
