import { test, expect } from '@playwright/test';
import { msg } from './helpers/i18n';

test.describe('auth e2e', () => {
  test('register and reach app', async ({ page }, testInfo) => {
    const email = `e2e-${Date.now()}@example.com`;
    await page.goto('/register');
    await page.getByLabel(msg(testInfo, 'auth.name')).fill('E2E User');
    await page.getByLabel(msg(testInfo, 'auth.email')).fill(email);
    await page.getByLabel(msg(testInfo, 'auth.password')).fill('CorrectHorseBattery1!');
    await page.getByRole('button', { name: msg(testInfo, 'auth.register') }).click();
    await expect(page).toHaveURL(/\/app/);
    await expect(
      page.getByRole('heading', { name: msg(testInfo, 'home.title'), level: 1 }),
    ).toBeVisible();
  });
});
