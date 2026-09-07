import { test, expect } from '@playwright/test';

test.describe('brand i18n rtl', () => {
  test('arabic locale sets rtl on document', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'ar-desktop', 'ar-desktop only');
    await page.goto('/app');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('english locale uses ltr', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'en-desktop only');
    await page.goto('/app');
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir === 'ltr' || dir === null).toBe(true);
  });
});
