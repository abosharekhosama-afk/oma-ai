import { test, expect } from '@playwright/test';
import { chooseOmaSelect } from './helpers/antd-select';
import { applyContentFilters, openContentFilters } from './helpers/stage3-filters';
import { installOwnerSession } from './helpers/brand-ui';

test('W1 content views keep a dated draft unscheduled until Schedule', async ({
  page,
  request,
}) => {
  await installOwnerSession(page, request);
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
  await expect(page.getByTestId('demo-content-cal-grid')).toHaveAttribute('data-columns', '7');
  if ((page.viewportSize()?.width ?? 1440) >= 1024) {
    const card = page.locator('.oma-post-card--calendar').first();
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    const cell = page.locator('.oma-cal-cell').filter({ has: card }).first();
    const cellBox = await cell.boundingBox();
    // Planable LIVE_VERIFIED: cards fluidly fill the day cell (not a fixed 126px chrome).
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(80);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(80);
    expect(cellBox).toBeTruthy();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
      (cellBox?.x ?? 0) + (cellBox?.width ?? 0) + 2,
    );
  }
  if (await page.getByTestId('demo-content-open-filters').isVisible()) {
    await openContentFilters(page);
    await chooseOmaSelect(page, 'demo-content-filter-approval', 'PARTIALLY_APPROVED');
    await applyContentFilters(page);
    await page.getByTestId('demo-content-view-list').click();
    await expect(page.getByTestId('demo-content-card-demo-content-carousel')).toBeVisible();
    await openContentFilters(page);
    await chooseOmaSelect(page, 'demo-content-filter-approval', 'all');
    await applyContentFilters(page);
    await page.getByTestId('demo-content-view-calendar').click();
  }
  await chooseOmaSelect(page, 'demo-content-approval-policy', 'OPTIONAL');
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
