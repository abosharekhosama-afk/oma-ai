import { test, expect } from '@playwright/test';

test.describe('auth e2e', () => {
  test('register and reach app', async ({ page }) => {
    const email = `e2e-${Date.now()}@example.com`;
    await page.goto('/register');
    await page.getByLabel('Name').fill('E2E User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('CorrectHorseBattery1!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/app/);
    await expect(page.getByText('Welcome to your workspace')).toBeVisible();
  });
});
