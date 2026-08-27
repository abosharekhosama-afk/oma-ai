import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';
import { apiPost, registerBrandOwner } from './helpers/brand-api';

test.describe('Q-BWI-11 ssrf', () => {
  test('blocks credential and private urls', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const brand = await apiPost(request, '/api/v1/brands', owner.cookies, { name: 'SSRF Brand' });
    const brandBody = await brand.json();
    const bad = await apiPost(
      request,
      `/api/v1/brands/${brandBody.data.id}/website`,
      owner.cookies,
      {
        url: 'https://127.0.0.1/',
        authorization_attested: true,
        version: brandBody.data.version,
      },
      { 'idempotency-key': newId() },
    );
    expect(bad.status()).toBe(400);
  });
});
