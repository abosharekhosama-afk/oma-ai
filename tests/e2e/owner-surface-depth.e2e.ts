import { test, expect } from '@playwright/test';
import { installOwnerSession } from './helpers/brand-ui';
import { switchContentView } from './helpers/content-view';

const BLOCKED =
  /facebook\.com|graph\.facebook|meta\.com|tiktok\.com|googleapis\.com|openai\.com|anthropic\.com|semrush\.com|smartly\.io|workdrive|zoho\.com/i;

test.describe('Owner surface-depth journey', () => {
  test('navigation discoverability + specialized surfaces', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'primary depth journey');
    const errors: string[] = [];
    const blocked: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('request', (r) => {
      if (BLOCKED.test(r.url())) blocked.push(r.url());
    });

    await installOwnerSession(page, request);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/app');
    await expect(page.getByTestId('product-home')).toHaveClass(/oma-surface-cc/);
    await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /campaigns/i })
      .click();
    await expect(page.getByTestId('demo-campaign-portfolio')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('demo-campaigns-view-table').click();
    await expect(page.locator('[data-testid^="demo-campaign-row-"]').first()).toBeVisible();
    await page.getByTestId('demo-campaigns-view-portfolio').click();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /content plan/i })
      .click();
    await expect(page.getByTestId('demo-content')).toBeVisible({ timeout: 15_000 });
    await switchContentView(page, 'grid');
    await expect(page.getByTestId('demo-content-grid')).toBeVisible();
    await page.locator('[data-testid^="demo-content-card-"]').first().click();
    await expect(page.getByTestId('demo-content-composer')).toBeVisible();
    await expect(page.getByTestId('demo-content-composer-preview')).toBeVisible();
    await page.keyboard.press('Escape');

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /tasks board/i })
      .click();
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 15_000 });

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /deliverables/i })
      .click();
    await expect(page.getByTestId('demo-deliv-grid')).toBeVisible({ timeout: 15_000 });

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^reviews$/i })
      .click();
    await expect(page.getByTestId('demo-review-queue')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.oma-review-queue-card').first()).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /analytics/i })
      .click();
    await expect(page.getByTestId('demo-analytics-trend')).toBeVisible({ timeout: 15_000 });

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /settings/i })
      .click();
    await expect(page.getByTestId('demo-settings-nav-general')).toBeVisible({ timeout: 15_000 });

    expect(blocked).toEqual([]);
    expect(
      errors.filter((e) => !/favicon|React DevTools|401|404|Failed to load resource/i.test(e)),
    ).toEqual([]);
  });
});
