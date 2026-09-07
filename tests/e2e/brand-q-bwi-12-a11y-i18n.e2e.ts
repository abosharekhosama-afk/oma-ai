import { test, expect } from '@playwright/test';
import { createBrandFlow, registerBrandOwner } from './helpers/brand-api';
import { webOrigin } from './helpers/brand-ui';
import { msg } from './helpers/i18n';

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
    await expect(
      page.getByRole('heading', { name: msg(testInfo, 'home.title'), level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
    expect(errors).toHaveLength(0);

    if (testInfo.project.name === 'ar-desktop') {
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    }
  });

  test('critical Brand Intelligence actions are keyboard-reachable', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const flow = await createBrandFlow(request, owner.cookies);
    const origin = webOrigin();
    await page.context().addCookies([
      { name: 'oma_session', value: owner.cookies.oma_session, url: origin },
      { name: 'oma_csrf', value: owner.cookies.oma_csrf, url: origin },
    ]);

    await page.goto('/app');
    await page.keyboard.press('Tab');
    // Reach primary nav Brand Intelligence via keyboard / role links
    const brandNav = page.getByRole('link', { name: /brand intelligence/i }).first();
    await brandNav.focus();
    await expect(brandNav).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/app\/brands/);

    await page.goto(`/app/brands/${flow.brandId}/profiles/${flow.profileVersionId}`);
    await expect(page.getByRole('heading', { name: 'Brand intelligence' })).toBeVisible({
      timeout: 30_000,
    });

    const noteSave = page.getByRole('button', { name: 'Save note' });
    await noteSave.focus();
    await expect(noteSave).toBeFocused();

    const compare = page.getByRole('link', { name: /compare/i }).first();
    await compare.focus();
    await expect(compare).toBeFocused();
  });
});
