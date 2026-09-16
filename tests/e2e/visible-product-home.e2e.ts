import { test, expect } from '@playwright/test';
import { createBrandFlow, registerBrandOwner } from './helpers/brand-api';

/**
 * Visible product experience — Owner landing must explain itself.
 * Uses the normal login form. When review seed credentials are absent,
 * creates a real owner + brand via API then logs in through the UI.
 */
test.describe('Visible product home', () => {
  test('owner landing shows portfolio summary and needs-action', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');

    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    let email = process.env.OMA_REVIEW_OWNER_EMAIL;
    let password = process.env.OMA_REVIEW_OWNER_PASSWORD;

    if (!email || !password) {
      const owner = await registerBrandOwner(request);
      await createBrandFlow(request, owner.cookies);
      email = owner.email;
      password = owner.password;
    }

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app/, { timeout: 30_000 });

    await expect(page.getByTestId('product-home')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /command center|workspace/i })).toBeVisible();
    await expect(page.getByText(/brand portfolio/i).first()).toBeVisible();
    await expect(page.getByText(/needs your attention|needs action/i).first()).toBeVisible();

    const bodyText = await page.locator('[data-testid="product-home"]').innerText();
    expect(bodyText.length).toBeGreaterThan(120);

    const portfolioLink = page.getByRole('link', { name: /view brand portfolio/i }).first();
    if (await portfolioLink.isVisible()) {
      await portfolioLink.click();
    } else {
      await page
        .getByRole('link', { name: /^brands$/i })
        .first()
        .click();
    }
    await expect(page.getByTestId('brand-portfolio')).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByTestId('brand-workspace-grid').or(page.locator('.oma-empty')),
    ).toBeVisible();

    expect(consoleErrors.filter((e) => !/favicon/i.test(e))).toEqual([]);
  });
});
