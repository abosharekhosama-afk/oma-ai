import { test, expect } from '@playwright/test';
import { msg } from './helpers/i18n';

test('login has labels and main', async ({ page }, testInfo) => {
  await page.goto('/login');
  await expect(page.locator('main#main')).toBeVisible();
  await expect(page.getByLabel(msg(testInfo, 'auth.email'))).toBeVisible();
  await expect(page.getByLabel(msg(testInfo, 'auth.password'))).toBeVisible();
  await page.keyboard.press('Tab');
});
