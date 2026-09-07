import { test, expect } from '@playwright/test';
import { msg } from './helpers/i18n';

test('login page loads for authz journey entry', async ({ page }, testInfo) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: msg(testInfo, 'auth.login') })).toBeVisible();
});
