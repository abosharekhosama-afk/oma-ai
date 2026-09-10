import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';
import { collectPageErrors } from './helpers/brand-ui';

/** PJ-06 — submit gate + double-action safety without approved profile. */
test.describe('PJ-06 concurrency idempotency', () => {
  test('submit control is gated without profile; status never becomes IN_REVIEW', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const errors = collectPageErrors(page);
    const email = `pj06-${newId().slice(-8).toLowerCase()}@example.com`;
    const password = 'ChangeMe_Strategy_1!';

    await page.goto('/register');
    await page.getByLabel('Name').fill('PJ06 Owner');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account|register/i }).click();
    await expect(page.getByRole('heading', { name: /set up your company/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /create a company/i }).click();
    await page.getByLabel(/company name/i).fill(`PJ06 Co ${newId().slice(-4)}`);
    await page.getByRole('button', { name: /^create company$/i }).click();
    await expect(page.getByRole('heading', { name: /command center|workspace/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto('/app/brands/new');
    await page.getByLabel(/brand name/i).fill(`PJ06 Brand ${newId().slice(-4)}`);
    await page.getByRole('button', { name: /create brand/i }).click();
    await expect(page).toHaveURL(/\/app\/brands\/(?!new$)[^/]+$/, { timeout: 20_000 });

    await page.getByRole('link', { name: /strategies/i }).click();
    await page.getByTestId('strategy-create').click();
    await page.getByTestId('strategy-name').fill('PJ06 Concurrent');
    await page.getByRole('button', { name: /create draft/i }).click();
    await expect(page.getByTestId('strategy-name-heading')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('strategy-missing-profile')).toBeVisible();

    await page
      .getByTestId('strategy-subnav')
      .getByRole('link', { name: /review/i })
      .click();
    await page.getByTestId('strategy-unknowns').check();
    const submit = page.getByTestId('strategy-submit');
    await expect(submit).toBeDisabled();
    // Force-click still must not promote to IN_REVIEW (server gate)
    await submit.click({ force: true });
    await expect(page.getByText(/IN_REVIEW/i)).toHaveCount(0);
    expect(
      errors.filter((e) => !/hydration|favicon|Failed to load resource|409|401|403|404/i.test(e)),
    ).toEqual([]);
  });
});
