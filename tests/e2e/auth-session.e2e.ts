import { test, expect } from '@playwright/test';
import { msg } from './helpers/i18n';

test.describe('auth e2e', () => {
  test('register reaches company onboarding', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const email = `e2e-${Date.now()}@example.com`;
    await page.goto('/register');
    await page.getByLabel(msg(testInfo, 'auth.name')).fill('E2E User');
    await page.getByLabel(msg(testInfo, 'auth.email')).fill(email);
    await page.getByLabel(msg(testInfo, 'auth.password')).fill('CorrectHorseBattery1!');
    await page.getByRole('button', { name: msg(testInfo, 'auth.register') }).click();
    await expect(page).toHaveURL(/\/app\/onboarding/);
    await expect(
      page.getByRole('heading', { name: msg(testInfo, 'onboarding.title'), level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
