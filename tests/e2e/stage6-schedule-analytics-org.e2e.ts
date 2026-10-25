import { test, expect } from '@playwright/test';
import { installOwnerSession } from './helpers/brand-ui';

const BLOCKED_HOSTS =
  /facebook\.com|graph\.facebook|meta\.com|tiktok\.com|googleapis\.com|openai\.com|anthropic\.com|semrush\.com|smartly\.io|workdrive|zoho\.com|frame\.io|adobe\.com/i;

function attachGuards(page: import('@playwright/test').Page) {
  const consoleErrors: string[] = [];
  const blockedRequests: string[] = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('request', (req) => {
    if (BLOCKED_HOSTS.test(req.url())) blockedRequests.push(req.url());
  });
  return {
    assertClean() {
      expect(blockedRequests).toEqual([]);
      expect(
        consoleErrors.filter(
          (e) =>
            !/favicon|React DevTools|Download the React|401 \(Unauthorized\)|404 \(Not Found\)|Failed to load resource.*401|Failed to load resource.*404/i.test(
              e,
            ),
        ),
      ).toEqual([]);
    },
  };
}

test.describe('Stage 6 Schedule Analytics Organization visual rebuild', () => {
  test('schedule → analytics → team → activity → settings journey', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'primary Stage 6 journey');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/app');
    await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });
    const nav = page.getByRole('navigation', { name: /main navigation/i });

    await nav.getByRole('link', { name: /^schedule$/i }).click();
    await expect(page.getByTestId('demo-schedule')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('demo-schedule-calendar')).toBeVisible();
    await page.getByTestId('demo-schedule-view-agenda').click();
    await expect(page.getByTestId('demo-schedule-agenda')).toBeVisible();
    await page.getByTestId('demo-schedule-view-queue').click();
    await expect(page.getByTestId('demo-schedule-queue')).toBeVisible();
    await page.getByTestId('demo-schedule-filter-readiness').selectOption('ready');
    await page.getByTestId('demo-schedule-clear').click();

    await page.getByTestId('demo-sched-card-demo-sched-1').getByRole('button').click();
    await expect(page.getByTestId('demo-schedule-drawer')).toBeVisible();
    await expect(page.getByTestId('demo-schedule-readiness')).toBeVisible();
    await expect(page.getByTestId('demo-publish-blocked')).toContainText(
      /publishing provider|not connected/i,
    );

    await page.getByTestId('demo-schedule-reschedule').click();
    await expect(page.getByTestId('demo-schedule-reschedule-dialog')).toBeVisible();
    await page.getByTestId('demo-schedule-planned-at').fill('2026-09-18T14:00');
    await page.getByTestId('demo-schedule-channels').fill('Instagram');
    await page.getByTestId('demo-schedule-save').click();
    await expect(page.getByText(/2026-09-18/i).first()).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByTestId('demo-schedule')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('demo-schedule-view-queue').click();
    await page.getByTestId('demo-sched-card-demo-sched-1').getByRole('button').click();
    await expect(page.getByTestId('demo-schedule-drawer')).toContainText(/2026-09-18/);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('demo-schedule-drawer')).toHaveCount(0, { timeout: 10_000 });

    await nav.getByRole('link', { name: /^analytics$/i }).click();
    await expect(page.getByTestId('work-analytics')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('analytics-social-note')).toBeVisible();
    await expect(page.getByTestId('analytics-social-note')).toBeVisible();
    await page.getByTestId('analytics-period').click();
    await page.getByTestId('analytics-period-menu').getByRole('option').first().click();
    await expect(page.getByTestId('analytics-series')).toBeAttached();
    await expect(page.getByTestId('analytics-status')).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^team$/i })
      .click();
    await expect(page.getByTestId('demo-team')).toBeVisible();
    await page.getByTestId('demo-team-filter-capacity').selectOption('at_risk');
    await page.getByTestId('demo-team-open-demo-member-layla').click();
    await expect(page.getByTestId('demo-team-drawer')).toBeVisible();
    await expect(page.getByTestId('demo-team-tasks-link')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('demo-team-drawer')).toHaveCount(0, { timeout: 10_000 });

    await page.getByTestId('demo-team-members-link').click();
    await expect(page.getByTestId('company-members')).toBeVisible({ timeout: 15_000 });

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^activity$/i })
      .click();
    await expect(page.getByTestId('demo-activity')).toBeVisible();
    await page.getByTestId('demo-activity-filter-source').selectOption('DEMO');
    const firstOpen = page.locator('[data-testid^="demo-activity-open-"]').first();
    await firstOpen.click();
    await expect(page.getByTestId('demo-activity-detail')).toBeVisible();
    await expect(page.getByTestId('demo-activity-detail')).toContainText(/Demonstration|Demo/i);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('demo-activity-detail')).toHaveCount(0, { timeout: 10_000 });

    await page
      .getByRole('navigation', { name: /main navigation/i })
      .getByRole('link', { name: /^settings$/i })
      .click();
    await expect(page.getByTestId('demo-settings')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('demo-settings-timezone').fill('Asia/Riyadh');
    await page.getByTestId('demo-settings-week-start').selectOption('sunday');
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/api/v1/demo/preferences') &&
          res.request().method() === 'PATCH' &&
          res.ok(),
        { timeout: 15_000 },
      ),
      page.getByTestId('demo-settings-save').click(),
    ]);
    await page.reload();
    await expect(page.getByTestId('demo-settings')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('demo-settings-timezone')).toHaveValue('Asia/Riyadh', {
      timeout: 15_000,
    });
    await page.getByTestId('demo-settings-nav-integrations').click();
    await expect(page.getByTestId('demo-integrations')).toBeVisible();
    await expect(
      page.getByTestId('demo-integrations').getByRole('button', { name: /^connect$/i }),
    ).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await page.getByTestId('demo-int-plan-int-publish').click();
    await expect(page.getByTestId('demo-int-plan-drawer')).toContainText(
      /No connect|final integration/i,
    );
    await page.getByTestId('demo-int-plan-drawer').getByRole('button').click();

    await page.goto('/app');
    await expect(page.getByTestId('product-home')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('home-schedule-week')).toBeVisible();

    guards.assertClean();
  });

  test('AR RTL + tablet + mobile Stage 6 surfaces', async ({ page, request }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(
      !['ar-desktop', 'en-tablet', 'en-mobile'].includes(project),
      'responsive/locale Stage 6 coverage',
    );
    const guards = attachGuards(page);
    await installOwnerSession(page, request);

    if (project === 'ar-desktop') {
      await page.context().addCookies([
        {
          name: 'oma_locale',
          value: 'ar',
          url: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000',
        },
      ]);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/app/analytics');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.getByTestId('work-analytics')).toBeVisible({ timeout: 20_000 });
      await page.goto('/app/schedule');
      await expect(page.getByTestId('demo-schedule')).toBeVisible();
    } else if (project === 'en-tablet') {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/app/team');
      await expect(page.getByTestId('demo-team-table')).toBeVisible({ timeout: 20_000 });
      await page.goto('/app/settings');
      await expect(page.getByTestId('demo-settings')).toBeVisible();
    } else {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/app/schedule');
      await expect(page.getByTestId('demo-schedule')).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('demo-schedule-view-agenda').click({ force: true });
      await expect(page.getByTestId('demo-schedule-agenda')).toBeVisible({ timeout: 10_000 });
    }

    guards.assertClean();
  });
});
