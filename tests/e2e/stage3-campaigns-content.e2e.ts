import { test, expect } from '@playwright/test';
import { chooseOmaSelect } from './helpers/antd-select';
import {
  applyCampaignFilters,
  applyContentFilters,
  openCampaignFilters,
  openContentFilters,
} from './helpers/stage3-filters';
import { installOwnerSession } from './helpers/brand-ui';

const BLOCKED_HOSTS =
  /facebook\.com|graph\.facebook|meta\.com|tiktok\.com|googleapis\.com|openai\.com|anthropic\.com|semrush\.com|smartly\.io|workdrive|zoho\.com/i;

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

test.describe('Stage 3 Campaigns + Content visual rebuild', () => {
  test.describe.configure({ timeout: 180_000 });

  test('campaign portfolio filters, create, workspace, strategy link, content hub', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'primary Stage 3 journey');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/app');
    await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await nav.getByRole('link', { name: /^campaigns$/i }).click();
    await expect(page.getByTestId('demo-campaigns')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('demo-campaign-filters')).toBeVisible();

    await openCampaignFilters(page);
    await page.getByTestId('demo-campaign-filter-track').selectOption('ORGANIC');
    await applyCampaignFilters(page);
    await expect(page.getByRole('link', { name: /Summer Organic Always-On/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Back-to-Work Paid Push/i })).toHaveCount(0);

    await openCampaignFilters(page);
    await page.getByTestId('demo-campaign-filter-track').selectOption('PAID');
    await applyCampaignFilters(page);
    await expect(page.getByRole('link', { name: /Back-to-Work Paid Push/i })).toBeVisible();
    await openCampaignFilters(page);
    await page.getByTestId('demo-campaign-filter-track').selectOption('all');
    await page.getByTestId('demo-campaign-filter-status').selectOption('NEEDS_ATTENTION');
    await applyCampaignFilters(page);
    await expect(page.getByRole('link', { name: /Review Bottleneck Sprint/i })).toBeVisible();
    await openCampaignFilters(page);
    await page.getByTestId('demo-campaign-filter-status').selectOption('all');
    await applyCampaignFilters(page);

    await page.getByTestId('demo-create-campaign').click();
    await expect(page.getByTestId('demo-create-campaign-dialog')).toBeVisible();
    const campaignName = `P3 Campaign ${Date.now()}`;
    await page.getByTestId('demo-create-campaign-name').fill(campaignName);
    await page.getByTestId('demo-create-campaign-submit').click();
    await expect(page.getByTestId('demo-campaign-detail')).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByRole('heading', { name: campaignName })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto('/app/campaigns');
    await expect(page.getByRole('link', { name: campaignName })).toBeVisible();

    await page
      .getByRole('link', { name: /Summer Organic Always-On/i })
      .first()
      .click();
    await expect(page.getByTestId('demo-campaign-detail')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('demo-strategy-id')).toHaveText(/demo-strategy-q3/);
    const strategyLink = page.getByTestId('demo-campaign-strategy-link');
    await expect(strategyLink).toHaveAttribute('href', /\/strategies\/demo-strategy-q3/);
    await Promise.all([
      page.waitForURL(/\/app\/brands\/.+\/strategies\/demo-strategy-q3/, { timeout: 20_000 }),
      strategyLink.click(),
    ]);
    await expect(page.getByTestId('demo-strategy-document')).toBeVisible({ timeout: 15_000 });

    await page.goto('/app/campaigns/demo-campaign-organic');
    await expect(page.getByTestId('demo-campaign-detail')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('demo-campaign-tab-content').click();
    await Promise.all([
      page.waitForURL(/\/app\/content/, { timeout: 20_000 }),
      page.getByTestId('demo-campaign-content-demo-content-reel').click(),
    ]);
    await expect(page.getByTestId('demo-content')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('demo-content-drawer')).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /content detail/i })).toHaveCount(0);

    await page.getByTestId('demo-content-view-calendar').click();
    await expect(page.getByTestId('demo-content-calendar')).toBeVisible();
    await expect(page.getByTestId('demo-day-overflow')).toBeVisible();
    await page.getByTestId('demo-day-overflow').click();
    await expect(page.getByRole('dialog', { name: /day items/i })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('demo-content-view-feed').click();
    await expect(page.getByTestId('demo-content-feed')).toBeVisible();
    await page.getByTestId('demo-content-view-list').click();
    await expect(page.getByTestId('demo-content-list')).toBeVisible();
    await page.getByTestId('demo-content-view-grid').click();
    await expect(page.getByTestId('demo-content-grid')).toBeVisible();

    await openContentFilters(page);
    await chooseOmaSelect(page, 'demo-content-filter-campaign', 'demo-campaign-organic');
    await chooseOmaSelect(page, 'demo-content-filter-channel', 'Instagram');
    await chooseOmaSelect(page, 'demo-content-filter-status', 'IN_REVIEW');
    await applyContentFilters(page);
    await expect(page.getByTestId('demo-content-filter-chips')).toBeVisible();

    await page.getByTestId('demo-content-card-demo-content-carousel').click();
    await expect(page.getByTestId('demo-content-drawer')).toBeVisible();
    await expect(page.getByTestId('demo-content-campaign-link')).toBeVisible();
    await page.getByRole('tab', { name: /comments/i }).click();
    await expect(page.getByTestId('demo-content-comments')).toBeVisible();
    await page.getByRole('tab', { name: /edit/i }).click();
    await page.getByTestId('demo-content-caption').fill('P3 caption persist');
    await page.getByTestId('demo-content-save').click();
    await expect(page.getByText('Saved').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('demo-content-drawer')).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear all', exact: true }).click();

    await page.getByTestId('demo-create-content').click();
    await expect(page.getByTestId('demo-create-content-dialog')).toBeVisible();
    const title = `Stage3 Persist ${Date.now()}`;
    await page.getByTestId('demo-create-content-title').fill(title);
    await page.getByTestId('demo-create-content-submit').click();
    await expect(page.getByRole('dialog', { name: /content detail/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole('dialog', { name: /content detail/i }).getByText(title),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /content detail/i })).toHaveCount(0);
    await expect(page.getByText(title).first()).toBeVisible();
    await page.goto('/app/content');
    await expect(page.getByTestId('demo-content')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('demo-content-view-list').click();
    await expect(page.getByTestId('demo-content-list')).toBeVisible();
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByTestId('demo-content')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('demo-content-view-list').click();
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByTestId('demo-content-view-calendar').click();
    await expect(page.getByTestId('demo-content-calendar')).toBeVisible();

    guards.assertClean();
  });

  test('AR RTL desktop campaigns/content', async ({ page, request, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'ar-desktop', 'AR desktop');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await context.addCookies([
      { name: 'oma_locale', value: 'ar', url: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000' },
    ]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app/campaigns');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('demo-campaigns')).toBeVisible();
    await page.goto('/app/content');
    await expect(page.getByTestId('demo-content')).toBeVisible();
    await page.getByTestId('demo-content-view-calendar').click();
    await expect(page.getByTestId('demo-content-calendar')).toBeVisible();
    guards.assertClean();
  });

  test('tablet 1024 campaign table usable', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-tablet', 'tablet');
    await installOwnerSession(page, request);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/app/campaigns');
    await expect(page.getByTestId('demo-campaigns')).toBeVisible();
    if (await page.getByTestId('demo-campaigns-view-table').count()) {
      await page.getByTestId('demo-campaigns-view-table').click();
    }
    await expect(
      page.locator('.oma-campaign-table, [data-testid="demo-campaign-portfolio"]').first(),
    ).toBeVisible();
  });

  test('mobile 390 calendar agenda + content drawer', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-mobile', 'mobile');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/content');
    await expect(page.getByTestId('demo-content')).toBeVisible();
    await page.getByTestId('demo-content-view-calendar').click();
    await expect(page.getByTestId('demo-content-agenda')).toBeVisible();
    await expect(page.getByTestId('demo-content-date-strip')).toBeVisible();
    await expect(page.locator('.oma-cal-grid')).toBeHidden();
    await page.getByTestId('demo-create-content').scrollIntoViewIfNeeded();
    await page.getByTestId('demo-create-content').click();
    await expect(page.getByTestId('demo-create-content-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('demo-content-view-grid').click();
    await page.locator('[data-testid^="demo-content-card-"]').first().click();
    await expect(page.getByTestId('demo-content-drawer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('demo-content-drawer')).toHaveCount(0);
    guards.assertClean();
  });

  test('empty/error/denied honesty surfaces remain gated by demo mode', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'once');
    await installOwnerSession(page, request);
    await page.goto('/app/campaigns');
    await expect(page.getByTestId('demo-disclosure').first()).toBeVisible();
    await page.goto('/app/campaigns/demo-campaign-paid');
    await expect(page.getByTestId('demo-paid-planning-only')).toBeVisible();
    await expect(page.getByText(/Planning only|Not Connected/i).first()).toBeVisible();
    await page.goto('/app/content');
    await expect(
      page.getByText(/publishing is not connected|AI assistance not connected/i).first(),
    ).toBeVisible();
  });
});
