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
  if ((page.viewportSize()?.width ?? 1440) >= 1024) {
    const card = page.locator('.oma-post-card--calendar').first();
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(124);
    expect(box?.width ?? 0).toBeLessThanOrEqual(128);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(170);
    expect(box?.height ?? 0).toBeLessThanOrEqual(174);
  }
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
  await expect(page.getByTestId('demo-content-publish-state')).toContainText(
    /Planned date|تاريخ مخطط/,
  );
  await page.getByTestId('demo-content-schedule').click();
  await expect(page.getByTestId('demo-content-publish-state')).toContainText(
    /Scheduled locally|مجدول/,
  );
  await page.goto('/app/schedule');
  await expect(page.getByTestId('demo-schedule')).toBeVisible();
  await expect(page.getByTestId('demo-schedule')).toContainText(
    /External publishing is not connected|النشر الخارجي غير متصل/,
  );
  await page.getByTestId('demo-schedule-view-agenda').click();
  await expect(page.getByTestId('demo-schedule-agenda')).toBeVisible();
  await page.getByTestId('demo-schedule-view-queue').click();
  await expect(page.getByTestId('demo-schedule-queue')).toBeVisible();
  await page.getByTestId('demo-schedule-view-agenda').click();
  await page
    .getByTestId('demo-sched-card-demo-sched-2')
    .getByRole('button', { name: /open item|فتح/i })
    .click();
  await expect(page.getByTestId('demo-schedule-block-reason')).toBeVisible();
  await expect(page.getByTestId('demo-schedule-command')).toBeDisabled();
});
