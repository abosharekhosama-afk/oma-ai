import { test, expect } from '@playwright/test';

test('login page loads for authz journey entry', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
