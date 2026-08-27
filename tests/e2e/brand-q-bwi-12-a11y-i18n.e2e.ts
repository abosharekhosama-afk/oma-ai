import { test, expect } from '@playwright/test';
import { registerBrandOwner } from './helpers/brand-api';

test.describe('Q-BWI-12 a11y i18n', () => {
  test('app shell loads in EN and AR without console errors', async ({
    page,
    request,
  }, testInfo) => {
    const owner = await registerBrandOwner(request);
    await page.context().addCookies([
      {
        name: 'oma_session',
        value: owner.cookies.oma_session,
        url: 'http://127.0.0.1:3000',
      },
      {
        name: 'oma_csrf',
        value: owner.cookies.oma_csrf,
        url: 'http://127.0.0.1:3000',
      },
    ]);

    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: /workspace|dashboard|brand/i })).toBeVisible({
      timeout: 15_000,
    });
    expect(errors).toHaveLength(0);

    if (testInfo.project.name === 'ar-desktop') {
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    }
  });
});
