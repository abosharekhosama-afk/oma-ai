import fs from 'node:fs';
import { test, expect } from '@playwright/test';

function creds() {
  const file = fs.existsSync('.review/004-credentials.json')
    ? '.review/004-credentials.json'
    : '.review/003-credentials.json';
  return JSON.parse(fs.readFileSync(file, 'utf8')).accounts.owner as {
    email: string;
    password: string;
  };
}

test('W1 content views keep a dated draft unscheduled until Schedule', async ({ page }) => {
  const account = creds();
  await page.goto('/login');
  await page.waitForSelector('[data-auth-ready="1"]');
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/app/);
  await page.goto('/app/content');
  await expect(page.getByTestId('demo-content')).toBeVisible();
  for (const mode of ['feed', 'calendar', 'list', 'grid'] as const) {
    await page.getByTestId(`demo-content-view-${mode}`).click();
    await expect(
      page.getByTestId(`demo-content-${mode === 'calendar' ? 'calendar' : mode}`),
    ).toBeVisible();
  }
  await page.getByTestId('demo-content-view-calendar').click();
  await expect(page.getByTestId('demo-content-saved')).toBeVisible();
  const approval = page.getByTestId('demo-content-filter-approval');
  if (await approval.isVisible()) {
    await approval.selectOption('PARTIALLY_APPROVED');
    await page.getByTestId('demo-content-view-list').click();
    await expect(page.getByTestId('demo-content-card-demo-content-carousel')).toBeVisible();
    await approval.selectOption('all');
    await page.getByTestId('demo-content-view-calendar').click();
  }
  await page.getByTestId('demo-content-approval-policy').selectOption('OPTIONAL');
  await page.getByTestId('demo-create-content').click();
  const title = `W1 draft ${Date.now()}`;
  await page.getByTestId('demo-create-content-title').fill(title);
  await page.getByTestId('demo-create-content-submit').click();
  await page.getByRole('tab', { name: /edit|تحرير/i }).click();
  await expect(page.getByTestId('demo-content-publish-state')).toContainText(/Planned date|تاريخ مخطط/);
  await page.getByTestId('demo-content-schedule').click();
  await expect(page.getByTestId('demo-content-publish-state')).toContainText(
    /Scheduled locally|مجدول/,
  );
});
