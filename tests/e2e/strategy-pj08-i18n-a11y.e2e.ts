import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';
import { collectPageErrors } from './helpers/brand-ui';

/** PJ-08 — AR/RTL + keyboard focus on strategy create. */
test.describe('PJ-08 i18n a11y', () => {
  test('ar-desktop sets rtl dir', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'ar-desktop', 'arabic project only');
    const errors = collectPageErrors(page);
    await page.goto('/register');
    await page.waitForTimeout(500);
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('rtl');
    expect(
      errors.filter((e) => !/hydration|favicon|Failed to load resource|409|401|403|404/i.test(e)),
    ).toEqual([]);
  });

  test('keyboard can focus strategy create control', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const errors = collectPageErrors(page);
    const email = `pj08-${newId().slice(-8).toLowerCase()}@example.com`;
    const password = 'ChangeMe_Strategy_1!';

    await page.goto('/register');
    await page.getByLabel('Name').fill('PJ08 Owner');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account|register/i }).click();
    await expect(page.getByRole('heading', { name: /set up your company/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /create a company/i }).click();
    await page.getByLabel(/company name/i).fill(`PJ08 Co ${newId().slice(-4)}`);
    await page.getByRole('button', { name: /^create company$/i }).click();
    await expect(page.getByRole('heading', { name: /command center|workspace/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto('/app/brands/new');
    await page.getByLabel(/brand name/i).fill(`PJ08 Brand ${newId().slice(-4)}`);
    await page.getByRole('button', { name: /create brand/i }).click();
    await expect(page).toHaveURL(/\/app\/brands\/(?!new$)[^/]+$/, { timeout: 20_000 });
    const brandId = page.url().split('/').pop()!;

    await page.goto(`/app/brands/${brandId}/strategies`);
    await expect(page.getByTestId('strategy-create')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('strategy-create').focus();
    await expect(page.getByTestId('strategy-create')).toBeFocused();
    expect(
      errors.filter((e) => !/hydration|favicon|Failed to load resource|409|401|403|404/i.test(e)),
    ).toEqual([]);
  });
});
