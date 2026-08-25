import { test, expect } from '@playwright/test';

test('login has labels and main', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('main#main')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await page.keyboard.press('Tab');
});
