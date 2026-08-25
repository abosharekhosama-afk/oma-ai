import { test, expect } from '@playwright/test';

test('quickstart index smoke', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'OMA AI' })).toBeVisible();
});
