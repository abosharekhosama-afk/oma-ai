import { test, expect } from '@playwright/test';
import { msg } from './helpers/i18n';

test('quickstart index smoke', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: msg(testInfo, 'app.name') })).toBeVisible();
});
