import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';
import { collectPageErrors } from './helpers/brand-ui';

async function registerOwnerAndBrand(page: import('@playwright/test').Page) {
  const email = `pj01-${newId().slice(-8).toLowerCase()}@example.com`;
  const password = 'ChangeMe_Strategy_1!';
  const company = `PJ01 Co ${newId().slice(-4)}`;
  const brandName = `PJ01 Brand ${newId().slice(-4)}`;

  await page.goto('/register');
  await page.getByLabel('Name').fill('PJ01 Owner');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /create account|register/i }).click();
  await expect(page.getByRole('heading', { name: /set up your company/i })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: /create a company/i }).click();
  await page.getByLabel(/company name/i).fill(company);
  await page.getByRole('button', { name: /^create company$/i }).click();
  await expect(page.getByRole('heading', { name: /command center|workspace/i })).toBeVisible({
    timeout: 20_000,
  });

  await page.goto('/app/brands/new');
  await page.getByLabel(/brand name/i).fill(brandName);
  await page.getByRole('button', { name: /create brand/i }).click();
  await expect(page).toHaveURL(/\/app\/brands\/(?!new$)[^/]+$/, { timeout: 20_000 });
  return page.url().split('/').pop()!;
}

test.describe('PJ-01 profile gate', () => {
  test('create draft without profile; submit blocked', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const errors = collectPageErrors(page);
    const brandId = await registerOwnerAndBrand(page);

    await page.locator('.oma-brand-nav').getByRole('link', { name: /strategies/i }).click();
    await expect(page).toHaveURL(new RegExp(`/app/brands/${brandId}/strategies`));
    await page.getByTestId('strategy-create').click();
    await page.getByTestId('strategy-name').fill('Q3 Manual Strategy');
    await page.getByRole('button', { name: /create draft/i }).click();
    await expect(page.getByTestId('strategy-name-heading')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('strategy-missing-profile')).toBeVisible();

    await page
      .getByTestId('strategy-subnav')
      .getByRole('link', { name: /foundation/i })
      .click();
    await page.getByTestId('strategy-goals').fill('Grow organic reach');
    await page.getByTestId('strategy-positioning').fill('Trusted partner');
    await page.getByRole('button', { name: /save foundation/i }).click();
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10_000 });

    await page
      .getByTestId('strategy-subnav')
      .getByRole('link', { name: /review/i })
      .click();
    await page.getByTestId('strategy-unknowns').check();
    const submit = page.getByTestId('strategy-submit');
    // SubmitEligibility disables when profile missing (blocked UI), or server returns alert
    if (await submit.isDisabled()) {
      await expect(submit).toBeDisabled();
    } else {
      await submit.click();
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    }
    expect(
      errors.filter((e) => !/hydration|favicon|Failed to load resource|409|401|403|404/i.test(e)),
    ).toEqual([]);
  });
});
