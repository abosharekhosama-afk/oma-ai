import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';
import { collectPageErrors } from './helpers/brand-ui';

/**
 * Feature 003 visible nav smoke: overview → foundation → organic → paid → evidence → review.
 * No page.evaluate tenant activation.
 */
test.describe('Strategy 003 nav smoke', () => {
  test('walks strategy surfaces without dead ends', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const errors = collectPageErrors(page);
    const email = `nav-${newId().slice(-8).toLowerCase()}@example.com`;
    const password = 'ChangeMe_Strategy_1!';

    await page.goto('/register');
    await page.getByLabel('Name').fill('Nav Owner');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account|register/i }).click();
    await expect(page.getByRole('heading', { name: /set up your company/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /create a company/i }).click();
    await page.getByLabel(/company name/i).fill(`Nav Co ${newId().slice(-4)}`);
    await page.getByRole('button', { name: /^create company$/i }).click();
    await expect(page.getByRole('heading', { name: /command center|workspace/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto('/app/brands/new');
    await page.getByLabel(/brand name/i).fill(`Nav Brand ${newId().slice(-4)}`);
    await page.getByRole('button', { name: /create brand/i }).click();
    await expect(page).toHaveURL(/\/app\/brands\/(?!new$)[^/]+$/, { timeout: 20_000 });
    const brandId = page.url().split('/').pop()!;
    expect(brandId).toBeTruthy();

    await page.getByRole('link', { name: /strategies/i }).click();
    await page.getByTestId('strategy-create').click();
    await page.getByTestId('strategy-name').fill('Nav Strategy');
    await page.getByRole('button', { name: /create draft/i }).click();
    await expect(page.getByTestId('strategy-name-heading')).toBeVisible({ timeout: 20_000 });

    for (const link of [
      'foundation',
      'organic',
      'paid',
      'evidence',
      'review',
      'versions',
    ] as const) {
      await page
        .getByTestId('strategy-subnav')
        .getByRole('link', { name: new RegExp(link, 'i') })
        .click();
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });
    }
    expect(
      errors.filter((e) => !/hydration|favicon|Failed to load resource|409|401|403|404/i.test(e)),
    ).toEqual([]);
  });
});
