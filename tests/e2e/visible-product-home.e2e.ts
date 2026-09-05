import { test, expect } from '@playwright/test';

/**
 * Visible product experience — Owner landing must explain itself.
 * Uses the normal login form; no page.evaluate tenant activation.
 */
test.describe('Visible product home', () => {
  test('owner landing shows portfolio summary and needs-action', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');

    // Prefer review credentials when present; otherwise skip (CI uses e2e seed).
    const reviewEmail = process.env.OMA_REVIEW_OWNER_EMAIL;
    const reviewPassword = process.env.OMA_REVIEW_OWNER_PASSWORD;
    test.skip(!reviewEmail || !reviewPassword, 'review owner credentials not configured');

    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(reviewEmail!);
    await page.getByLabel(/password/i).fill(reviewPassword!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app/, { timeout: 30_000 });

    await expect(page.getByTestId('product-home')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /command center|workspace/i })).toBeVisible();
    await expect(page.getByText(/needs your attention/i)).toBeVisible();
    await expect(page.getByText(/brand portfolio/i).first()).toBeVisible();
    await expect(page.getByText(/how brand intelligence works/i)).toBeVisible();

    // Must not be an empty shell
    const bodyText = await page.locator('[data-testid="product-home"]').innerText();
    expect(bodyText.length).toBeGreaterThan(120);

    await page
      .getByRole('link', { name: /view brand portfolio/i })
      .first()
      .click();
    await expect(page.getByTestId('brand-portfolio')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /brand/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /scan/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /profile/i })).toBeVisible();

    expect(consoleErrors.filter((e) => !/favicon/i.test(e))).toEqual([]);
  });
});
