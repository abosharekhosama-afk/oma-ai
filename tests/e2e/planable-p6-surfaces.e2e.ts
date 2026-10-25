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

test.describe('P6 Planable analytics organization settings journey', () => {
  test('analytics → team → activity → settings → members honesty', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'primary P6 journey');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await page.setViewportSize({ width: 1440, height: 900 });

    const nav = page.getByRole('navigation', { name: /main navigation/i });

    await page.goto('/app');
    await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });
    await nav.getByRole('link', { name: /^analytics$/i }).click();
    await expect(page.getByTestId('work-analytics')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('analytics-social-note')).toBeVisible();
    await expect(page.getByTestId('analytics-social-note')).toBeVisible();
    await expect(page.getByTestId('analytics-kpis')).toBeVisible();
    await page.getByTestId('analytics-period').selectOption('7');
    await expect(page.getByTestId('analytics-series')).toBeVisible();
    guards.assertClean();

    await nav.getByRole('link', { name: /^team$/i }).click();
    await expect(page.getByTestId('demo-team')).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-testid^="demo-team-open-"]').first().click();
    await expect(page.getByTestId('demo-team-drawer')).toBeVisible();
    await expect(page.getByTestId('demo-team-tasks-link')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('demo-team-members-link')).toBeVisible();
    guards.assertClean();

    await nav.getByRole('link', { name: /^activity$/i }).click();
    await expect(page.getByTestId('demo-activity')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('demo-activity-filter-source').selectOption('DEMO');
    await page.locator('[data-testid^="demo-activity-open-"]').first().click();
    await expect(page.getByTestId('demo-activity-detail')).toBeVisible();
    await expect(page.getByTestId('demo-activity-detail')).toContainText(/demo|workflow|audited/i);
    await page.keyboard.press('Escape');
    guards.assertClean();

    await nav.getByRole('link', { name: /^settings$/i }).click();
    await expect(page.getByTestId('demo-settings')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('demo-settings-nav-general').click();
    const week = page.getByTestId('demo-settings-week-start');
    const current = await week.inputValue();
    const next = current === 'monday' ? 'sunday' : 'monday';
    await week.selectOption(next);
    await expect(page.getByTestId('demo-settings-dirty')).toBeVisible();
    await page.getByTestId('demo-settings-save').click();
    await page.reload();
    await expect(page.getByTestId('demo-settings')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('demo-settings-week-start')).toHaveValue(next);
    await page.getByTestId('demo-settings-nav-integrations').click();
    await expect(page.getByTestId('demo-integrations')).toBeVisible();
    await expect(page.getByTestId('demo-integrations')).toContainText(/Not Connected|Deferred/i);
    await expect(page.getByRole('button', { name: /^connect$/i })).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.getByTestId('demo-settings-members-link')).toBeVisible();
    guards.assertClean();

    await page.getByTestId('demo-settings-members-link').click();
    await expect(page.getByTestId('company-members')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('company-members-invite')).toBeVisible();
    guards.assertClean();

    await page.context().addCookies([
      {
        name: 'oma_locale',
        value: 'ar',
        url: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000',
      },
    ]);
    await page.goto('/app/settings');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('demo-settings')).toBeVisible({ timeout: 20_000 });
    guards.assertClean();

    await page.context().addCookies([
      {
        name: 'oma_locale',
        value: 'en',
        url: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000',
      },
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/team');
    await expect(page.getByTestId('demo-team-mobile')).toBeVisible({ timeout: 15_000 });
    await page.goto('/app/activity');
    await expect(page.getByTestId('demo-activity')).toBeVisible();
    await page.goto('/app/settings');
    await expect(page.getByTestId('demo-settings-nav-integrations')).toBeVisible();
    guards.assertClean();
  });
});
