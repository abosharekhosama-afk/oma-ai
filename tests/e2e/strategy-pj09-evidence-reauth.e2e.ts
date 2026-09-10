import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';
import { collectPageErrors } from './helpers/brand-ui';

/** PJ-09 — evidence surface requires session; logout denies deep link. */
test.describe('PJ-09 evidence reauth', () => {
  test('evidence page loads while authenticated; denied after logout', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const errors = collectPageErrors(page);
    const email = `pj09-${newId().slice(-8).toLowerCase()}@example.com`;
    const password = 'ChangeMe_Strategy_1!';

    await page.goto('/register');
    await page.getByLabel('Name').fill('PJ09 Owner');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account|register/i }).click();
    await expect(page.getByRole('heading', { name: /set up your company/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /create a company/i }).click();
    await page.getByLabel(/company name/i).fill(`PJ09 Co ${newId().slice(-4)}`);
    await page.getByRole('button', { name: /^create company$/i }).click();
    await expect(page.getByRole('heading', { name: /command center|workspace/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto('/app/brands/new');
    await page.getByLabel(/brand name/i).fill(`PJ09 Brand ${newId().slice(-4)}`);
    await page.getByRole('button', { name: /create brand/i }).click();
    await expect(page).toHaveURL(/\/app\/brands\/(?!new$)[^/]+$/, { timeout: 20_000 });
    const brandId = page.url().split('/').pop()!;

    await page.getByRole('link', { name: /strategies/i }).click();
    await page.getByTestId('strategy-create').click();
    await page.getByTestId('strategy-name').fill('PJ09 Evidence');
    await page.getByRole('button', { name: /create draft/i }).click();
    await expect(page.getByTestId('strategy-name-heading')).toBeVisible({ timeout: 20_000 });

    await page
      .getByTestId('strategy-subnav')
      .getByRole('link', { name: /evidence/i })
      .click();
    await expect(page).toHaveURL(/\/evidence$/);
    await expect(page.getByRole('heading').first()).toBeVisible();

    await page.context().clearCookies();
    await page.goto(`/app/brands/${brandId}/strategies`);
    await expect(page).toHaveURL(/login|register|sign/i, { timeout: 15_000 });
    expect(
      errors.filter((e) => !/hydration|favicon|Failed to load resource|409|401|403|404/i.test(e)),
    ).toEqual([]);
  });
});
