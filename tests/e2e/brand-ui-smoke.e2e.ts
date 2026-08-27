import { test, expect } from '@playwright/test';
import { installOwnerSession, webOrigin } from './helpers/brand-ui';

test.describe('brand ui smoke', () => {
  test('brands list loads after login without console errors', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await installOwnerSession(page, request);
    await page.goto('/app/brands');
    await expect(page.getByRole('heading', { name: 'Brand Intelligence' })).toBeVisible({
      timeout: 15_000,
    });
    expect(errors).toHaveLength(0);
    expect(webOrigin()).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });
});
