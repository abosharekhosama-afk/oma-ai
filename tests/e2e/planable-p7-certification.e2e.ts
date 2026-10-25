/**
 * P7 active Planable full-product certification journey.
 * Replaces superseded pre-DEC-017 full-visual-certification skip(true) path.
 * Shell navigation proves IA; no API shortcuts for UI proof.
 */
import { test, expect } from '@playwright/test';
import { installOwnerSession } from './helpers/brand-ui';

const BLOCKED_HOSTS =
  /facebook\.com|graph\.facebook|meta\.com|tiktok\.com|googleapis\.com|openai\.com|anthropic\.com|semrush\.com|smartly\.io|workdrive|zoho\.com|frame\.io/i;

async function nav(page: import('@playwright/test').Page, name: RegExp, urlHint?: RegExp) {
  await page
    .getByRole('navigation', { name: /main navigation|التنقل الرئيسي/i })
    .getByRole('link', { name })
    .first()
    .click();
  if (urlHint) await expect(page).toHaveURL(urlHint, { timeout: 15_000 });
}

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

test.describe('P7 Planable full product certification', () => {
  test.describe.configure({ timeout: 240_000 });

  test('shell journey Command Center → org surfaces', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'primary certification journey');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await page.setViewportSize({ width: 1440, height: 900 });

    await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('demo-disclosure').first()).toBeVisible();

    await nav(page, /Brand Intelligence|العلامات/i, /\/app\/brands/);
    await expect(page.getByTestId('brand-portfolio')).toBeVisible({ timeout: 20_000 });

    await nav(page, /^Campaigns$|الحملات/i, /\/app\/campaigns/);
    await expect(page.getByTestId('demo-campaigns')).toBeVisible({ timeout: 15_000 });

    await nav(page, /Content Plan|^Content$|المحتوى/i, /\/app\/content/);
    await expect(page.getByTestId('demo-content')).toBeVisible({ timeout: 15_000 });

    await nav(page, /^Requests$|الطلبات/i, /\/app\/requests/);
    await expect(page.getByTestId('demo-requests')).toBeVisible({ timeout: 15_000 });

    await nav(page, /Tasks|^Tasks$|المهام/i, /\/app\/tasks/);
    await expect(page.getByTestId('demo-tasks')).toBeVisible({ timeout: 15_000 });
    await page.goto('/app/tasks?task=demo-task-design');
    await expect(page.getByTestId('demo-task-drawer')).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');

    await nav(page, /^Deliverables$|المخرجات/i, /\/app\/deliverables/);
    await expect(page.getByTestId('demo-deliverables')).toBeVisible({ timeout: 15_000 });

    await nav(page, /^Reviews$|المراجعات/i, /\/app\/reviews/);
    await expect(page.getByTestId('demo-reviews')).toBeVisible({ timeout: 15_000 });

    await page.goto('/app/deliverables/demo-deliv-carousel?review=1');
    await expect(page.getByTestId('demo-review-workspace')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('demo-review-compare-toggle').click();
    await expect(page.getByTestId('demo-version-compare')).toBeVisible();

    await nav(page, /^Schedule$|الجدول/i, /\/app\/schedule/);
    await expect(page.getByTestId('demo-schedule')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('demo-schedule-view-queue').click();
    await page.getByTestId('demo-sched-card-demo-sched-1').getByRole('button').click();
    await expect(page.getByTestId('demo-schedule-drawer')).toBeVisible();
    await expect(page.getByTestId('demo-publish-blocked')).toBeVisible();
    await page.keyboard.press('Escape');

    await nav(page, /^Analytics$|التحليلات/i, /\/app\/analytics/);
    await expect(page.getByTestId('work-analytics')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('analytics-social-note')).toBeVisible();

    await nav(page, /^Team$|الفريق/i, /\/app\/team/);
    await expect(page.getByTestId('demo-team')).toBeVisible({ timeout: 15_000 });

    await nav(page, /^Activity$|النشاط/i, /\/app\/activity/);
    await expect(page.getByTestId('demo-activity')).toBeVisible({ timeout: 15_000 });

    await nav(page, /^Settings$|الإعدادات/i, /\/app\/settings/);
    await expect(page.getByTestId('demo-settings')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('demo-settings-nav-integrations').click();
    await expect(page.getByTestId('demo-integrations')).toBeVisible();
    await expect(page.getByRole('button', { name: /^connect$/i })).toHaveCount(0);

    await page.getByTestId('demo-settings-members-link').click();
    await expect(page.getByTestId('company-members')).toBeVisible({ timeout: 15_000 });

    await page.goto('/app');
    await page.evaluate(() => {
      document.querySelectorAll('nextjs-portal').forEach((el) => el.remove());
    });
    const bell = page.getByTestId('shell-notifications-trigger');
    await expect(bell).toBeVisible({ timeout: 10_000 });
    await bell.click({ force: true });
    await expect(page.getByTestId('shell-notifications-panel')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');

    // Alias contamination check on computed tokens
    const tokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        primary: root.getPropertyValue('--oma-primary').trim(),
        violet: root.getPropertyValue('--oma-violet').trim(),
        motionPanel: root.getPropertyValue('--motion-panel').trim(),
      };
    });
    expect(tokens.primary.toLowerCase()).toBe('#1677ff');
    expect(tokens.violet).toBe('');
    expect(tokens.motionPanel).toBe('');

    guards.assertClean();
  });
});
