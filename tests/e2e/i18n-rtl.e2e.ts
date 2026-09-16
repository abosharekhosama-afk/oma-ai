import { test, expect } from '@playwright/test';

const origin = process.env.WEB_BASE_URL ?? process.env.WEB_ORIGIN ?? 'http://127.0.0.1:3000';

test('arabic locale sets rtl when cookie present', async ({ page, context }) => {
  await context.addCookies([{ name: 'oma_locale', value: 'ar', url: origin }]);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
});

test('english locale sets ltr', async ({ page, context }) => {
  await context.addCookies([{ name: 'oma_locale', value: 'en', url: origin }]);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});
