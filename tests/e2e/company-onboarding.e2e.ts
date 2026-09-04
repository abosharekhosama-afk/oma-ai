import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';

/**
 * True UI journey: register → onboarding → create company → Brand Intelligence via nav.
 * No cookie injection, no API brand create, no page.evaluate tenant activate.
 */
test.describe('Company onboarding UI', () => {
  test('register create company and open brands from navigation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const email = `ui-owner-${newId().slice(-8).toLowerCase()}@example.com`;
    const password = 'ChangeMe_UI_Owner_1!';

    await page.goto('/register');
    await page.getByLabel('Name').fill('UI Owner');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account|register/i }).click();
    await page.waitForURL(/\/app/);

    // Zero membership → onboarding
    await expect(page.getByRole('heading', { name: /set up your company/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /create a company/i }).click();
    await page.getByLabel(/company name/i).fill(`UI Co ${newId().slice(-4)}`);
    await page.getByRole('button', { name: /^create company$/i }).click();

    await expect(page.getByRole('heading', { name: /workspace/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('navigation').getByRole('link', { name: 'Brand Intelligence' }).click();
    await expect(page).toHaveURL(/\/app\/brands/);
    await expect(page.getByRole('heading', { name: /brand intelligence/i })).toBeVisible();

    // Create brand through the form
    await page.getByRole('link', { name: 'Create brand' }).first().click();
    await page.getByLabel(/brand name/i).fill(`UI Brand ${newId().slice(-4)}`);
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page).toHaveURL(/\/app\/brands\/[^/]+$/);

    // Refresh persistence
    await page.reload();
    await expect(page.getByRole('heading', { name: /overview|brand/i }).first()).toBeVisible();

    // Relogin persistence
    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL(/\/(login)?$/);
    if (!page.url().includes('/login')) {
      await page.goto('/login');
    }
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/app/);
    await page.getByRole('navigation').getByRole('link', { name: 'Brand Intelligence' }).click();
    await expect(page.getByText(/UI Brand/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
