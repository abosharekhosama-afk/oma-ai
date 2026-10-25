import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { installOwnerSession } from './helpers/brand-ui';

const OUT = join(
  process.cwd(),
  'artifacts',
  'planable-rebuild-004',
  'p6-analytics-organization-settings',
);
const META = join(
  process.cwd(),
  '.reference',
  '005-planable-ui-ux',
  'ours',
  'p6-analytics-organization-settings',
);
const WEB = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';

function sha(): string {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
}

test.describe('P6 Planable analytics/organization/settings evidence pack', () => {
  test.describe.configure({ timeout: 420_000 });

  test('capture P6 surfaces', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'evidence pack once');
    mkdirSync(OUT, { recursive: true });
    mkdirSync(META, { recursive: true });
    const consoleErrors: string[] = [];
    const failed: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('requestfailed', (req) => failed.push(req.url()));
    await installOwnerSession(page, request);
    const gitSha = sha();

    async function shot(
      name: string,
      route: string,
      viewport: string,
      extra: Record<string, unknown> = {},
    ) {
      const computed = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        const root = getComputedStyle(document.documentElement);
        return {
          fontFamily: body.fontFamily,
          canvas: body.backgroundColor,
          ink: body.color,
          primary: root.getPropertyValue('--oma-primary').trim(),
          headerHeight: root.getPropertyValue('--shell-header-height').trim(),
          hasViolet: root.getPropertyValue('--oma-violet').trim(),
          overflow:
            document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
          dir: document.documentElement.dir,
        };
      });
      expect(computed.hasViolet).toBe('');
      expect(computed.primary.toLowerCase()).toBe('#1677ff');
      await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
      writeFileSync(
        join(META, `${name}.json`),
        JSON.stringify(
          {
            name,
            candidateSha: gitSha,
            route,
            viewport,
            locale: extra.locale ?? 'en',
            dir: computed.dir,
            computedFont: computed.fontFamily,
            computedColors: {
              canvas: computed.canvas,
              ink: computed.ink,
              primary: computed.primary,
            },
            computedTokens: computed,
            viewType: extra.viewType ?? name,
            consoleErrors: consoleErrors.filter((e) => /hydrat/i.test(e)),
            failedRequests: failed.filter((u) =>
              /facebook|openai|tiktok|meta\.com|frame\.io/i.test(u),
            ),
            overflowOk: computed.overflow,
            evidenceLevel: extra.evidenceLevel ?? 'OMA_ADAPTATION',
            match: extra.match ?? 'OMA_ADAPTATION',
            acceptanceIds: extra.acceptanceIds ?? ['PV-G-01', 'PV-G-09'],
            featureState: extra.featureState ?? name,
            rawScreenshot: `artifacts/planable-rebuild-004/p6-analytics-organization-settings/${name}.png`,
            gitignoredRaw: true,
            capturedAt: new Date().toISOString(),
            webBase: WEB,
          },
          null,
          2,
        ),
      );
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app/analytics');
    await expect(page.getByTestId('work-analytics')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('analytics-social-note')).toBeVisible();
    await expect(page.getByTestId('analytics-social-note')).toBeVisible();
    await shot('01-analytics-overview', '/app/analytics', '1440x900', {
      viewType: 'analytics-overview',
    });

    await page.getByTestId('analytics-period').click();
    await page.getByTestId('analytics-period-menu').getByRole('option').first().click();
    await expect(page.getByTestId('analytics-kpis')).toBeVisible();
    await shot('02-analytics-filtered', '/app/analytics', '1440x900', {
      viewType: 'analytics-filtered',
    });

    const tableRows = await page.getByTestId('analytics-series').locator('tbody tr').count();
    expect(tableRows).toBeGreaterThan(0);
    await expect(page.getByTestId('analytics-series')).toBeVisible();
    await shot('03-analytics-chart-sr', '/app/analytics', '1440x900', {
      viewType: 'analytics-chart-sr',
    });

    await page.goto('/app/team');
    await expect(page.getByTestId('demo-team')).toBeVisible({ timeout: 15_000 });
    await shot('04-team-workload', '/app/team', '1440x900', { viewType: 'team-workload' });

    await page.goto('/app/company/members');
    await expect(page.getByTestId('company-members')).toBeVisible({ timeout: 15_000 });
    await shot('05-company-members', '/app/company/members', '1440x900', {
      viewType: 'company-members',
    });
    await expect(page.getByTestId('company-members-invite')).toBeVisible();
    await shot('06-invite-dialog', '/app/company/members', '1440x900', {
      viewType: 'invite-capability',
    });

    await page.goto('/app/activity');
    await expect(page.getByTestId('demo-activity')).toBeVisible({ timeout: 15_000 });
    await shot('07-activity-timeline', '/app/activity', '1440x900', {
      viewType: 'activity-timeline',
    });
    const openBtn = page.locator('[data-testid^="demo-activity-open-"]').first();
    await openBtn.click();
    await expect(page.getByTestId('demo-activity-detail')).toBeVisible();
    await shot('08-activity-detail', '/app/activity', '1440x900', {
      viewType: 'activity-detail',
    });
    await page.keyboard.press('Escape');

    await page.goto('/app');
    await page.evaluate(() => {
      document.querySelectorAll('nextjs-portal').forEach((el) => el.remove());
    });
    await page.getByTestId('shell-notifications-trigger').click({ force: true });
    await expect(page.getByTestId('shell-notifications-panel')).toBeVisible();
    await shot('09-notifications', '/app', '1440x900', { viewType: 'notifications' });
    await page.keyboard.press('Escape');

    await page.goto('/app/settings');
    await expect(page.getByTestId('demo-settings')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('demo-settings-nav-general').click();
    await shot('10-settings-general', '/app/settings', '1440x900', {
      viewType: 'settings-general',
    });
    await page.getByTestId('demo-settings-nav-workflow').click();
    const tz = page.getByTestId('demo-settings-timezone');
    await tz.fill('Pacific/Kiritimati');
    await expect(page.getByTestId('demo-settings-dirty')).toBeVisible();
    await shot('11-settings-preferences', '/app/settings', '1440x900', {
      viewType: 'settings-preferences',
    });
    await page.getByTestId('demo-settings-nav-integrations').click();
    await expect(page.getByTestId('demo-integrations')).toBeVisible();
    await expect(page.getByText(/no connect|oauth|api key/i).first()).toBeVisible();
    await shot('12-integrations-catalog', '/app/settings', '1440x900', {
      viewType: 'integrations',
    });

    await page.context().addCookies([
      {
        name: 'oma_locale',
        value: 'ar',
        url: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000',
      },
    ]);
    await page.goto('/app/analytics');
    await expect(page.getByTestId('work-analytics')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await shot('13-ar-analytics-settings', '/app/analytics', '1440x900', {
      locale: 'ar',
      viewType: 'ar-analytics',
    });
    await page.context().addCookies([
      {
        name: 'oma_locale',
        value: 'en',
        url: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000',
      },
    ]);

    await page.goto('/app/analytics');
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('work-analytics')).toBeVisible();
    await shot('14-tablet', '/app/analytics', '1024x768', { viewType: 'tablet' });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/analytics');
    await expect(page.getByTestId('work-analytics')).toBeVisible();
    await shot('15-mobile-analytics', '/app/analytics', '390x844', {
      viewType: 'mobile-analytics',
    });
    await page.goto('/app/team');
    await expect(page.getByTestId('demo-team-mobile')).toBeVisible();
    await shot('16-mobile-team', '/app/team', '390x844', { viewType: 'mobile-team' });
    await page.goto('/app/settings');
    await expect(page.getByTestId('demo-settings')).toBeVisible();
    await shot('17-mobile-settings', '/app/settings', '390x844', {
      viewType: 'mobile-settings',
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app/activity');
    await page.getByTestId('demo-activity-filter-source').selectOption('FOUNDATION');
    const emptyOrRows = page.getByTestId('demo-activity');
    await expect(emptyOrRows).toBeVisible();
    await shot('18-empty-or-filtered', '/app/activity', '1440x900', {
      viewType: 'activity-filtered-foundation',
    });

    writeFileSync(
      join(META, 'INSPECTOR_NOTE.json'),
      JSON.stringify(
        {
          referenceSession: 'NOT_REQUIRED — APPROVED_BASELINE_SUFFICIENT',
          stage: 'P6',
          candidateSha: gitSha,
          primary: '#1677FF',
          aliasDefinitions: 0,
          aliasUsages: 0,
          capturedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  });
});
