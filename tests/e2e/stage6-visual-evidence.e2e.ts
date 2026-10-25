import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installOwnerSession } from './helpers/brand-ui';

const OUT = path.join(
  process.cwd(),
  'artifacts/visual-parity-004/stage6-schedule-analytics-organization',
);
const META = path.join(
  process.cwd(),
  '.reference/004-visual-parity/ours/stage6-schedule-analytics-organization',
);
const WEB = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';

async function healthHint(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    try {
      const res = await fetch('/api/health');
      return (await res.text()).slice(0, 40);
    } catch {
      return 'unknown';
    }
  });
}

test.describe('Stage 6 visual evidence', () => {
  test('capture Stage 6 surfaces', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'evidence once');
    fs.mkdirSync(OUT, { recursive: true });
    fs.mkdirSync(META, { recursive: true });
    await installOwnerSession(page, request);
    const gitSha = process.env.GIT_SHA ?? 'pending';

    const shots: Array<{
      file: string;
      route: string;
      viewport: { width: number; height: number };
      locale: string;
      dir: string;
      acceptance: string[];
      source: string;
      setup?: () => Promise<void>;
    }> = [
      {
        file: '01-schedule-calendar.png',
        route: '/app/schedule',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-SCH-01', 'V-SCH-02'],
        source: 'Demo',
        setup: async () => {
          await page.getByTestId('demo-schedule-view-calendar').click();
          await expect(page.getByTestId('demo-schedule-calendar')).toBeVisible();
        },
      },
      {
        file: '02-schedule-agenda-readiness.png',
        route: '/app/schedule',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-SCH-01'],
        source: 'Demo',
        setup: async () => {
          await page.getByTestId('demo-schedule-view-agenda').click();
          await page.getByTestId('demo-sched-card-demo-sched-1').getByRole('button').click();
          await expect(page.getByTestId('demo-schedule-drawer')).toBeVisible();
        },
      },
      {
        file: '03-schedule-mobile-390.png',
        route: '/app/schedule',
        viewport: { width: 390, height: 844 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-SCH-02'],
        source: 'Demo',
        setup: async () => {
          await page.getByTestId('demo-schedule-view-agenda').click();
        },
      },
      {
        file: '04-analytics-overview.png',
        route: '/app/analytics',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-ANL-01', 'V-ANL-02'],
        source: 'Demo',
      },
      {
        file: '05-analytics-campaign-breakdown.png',
        route: '/app/analytics',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-ANL-01'],
        source: 'Demo',
        setup: async () => {
          await page.getByTestId('analytics-status').scrollIntoViewIfNeeded();
        },
      },
      {
        file: '06-analytics-ar-rtl.png',
        route: '/app/analytics',
        viewport: { width: 1440, height: 900 },
        locale: 'ar',
        dir: 'rtl',
        acceptance: ['V-ANL-01', 'V-ANL-02'],
        source: 'Demo',
      },
      {
        file: '07-team-workload.png',
        route: '/app/team',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-TEAM-01'],
        source: 'Hybrid',
      },
      {
        file: '08-team-member-drawer.png',
        route: '/app/team',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-TEAM-01'],
        source: 'Hybrid',
        setup: async () => {
          await page.getByTestId('demo-team-open-demo-member-layla').click();
          await expect(page.getByTestId('demo-team-drawer')).toBeVisible();
        },
      },
      {
        file: '09-company-members.png',
        route: '/app/company/members',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-ORG-01'],
        source: 'Foundation',
      },
      {
        file: '10-activity-stream.png',
        route: '/app/activity',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-ACT-01'],
        source: 'Hybrid',
      },
      {
        file: '11-activity-detail.png',
        route: '/app/activity',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-ACT-01'],
        source: 'Hybrid',
        setup: async () => {
          await page.locator('[data-testid^="demo-activity-open-"]').first().click();
          await expect(page.getByTestId('demo-activity-detail')).toBeVisible();
        },
      },
      {
        file: '12-settings-general.png',
        route: '/app/settings',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-SET-01'],
        source: 'Demo',
      },
      {
        file: '13-settings-integrations.png',
        route: '/app/settings',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-INT-01'],
        source: 'Demo',
        setup: async () => {
          await page.getByTestId('demo-settings-nav-integrations').click();
          await expect(page.getByTestId('demo-integrations')).toBeVisible();
        },
      },
      {
        file: '14-organization-tablet.png',
        route: '/app/team',
        viewport: { width: 1024, height: 768 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-TEAM-01', 'V-LINK-04'],
        source: 'Hybrid',
      },
    ];

    for (const shot of shots) {
      const consoleErrors: string[] = [];
      const externalHosts: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('request', (req) => {
        if (/frame\.io|adobe\.com|facebook\.com|openai\.com|smartly/i.test(req.url())) {
          externalHosts.push(req.url());
        }
      });
      await page.setViewportSize(shot.viewport);
      await page
        .context()
        .addCookies([{ name: 'oma_locale', value: shot.locale === 'ar' ? 'ar' : 'en', url: WEB }]);
      await page.goto(shot.route, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: '404' })).toHaveCount(0);
      if (shot.route.includes('/schedule')) {
        await expect(page.getByTestId('demo-schedule')).toBeVisible({ timeout: 20_000 });
      } else if (shot.route.includes('/analytics')) {
        await expect(page.getByTestId('work-analytics')).toBeVisible({ timeout: 20_000 });
      } else if (shot.route.includes('/team')) {
        await expect(page.getByTestId('demo-team')).toBeVisible({ timeout: 20_000 });
      } else if (shot.route.includes('/activity')) {
        await expect(page.getByTestId('demo-activity')).toBeVisible({ timeout: 20_000 });
      } else if (shot.route.includes('/settings')) {
        await expect(page.getByTestId('demo-settings')).toBeVisible({ timeout: 20_000 });
      } else if (shot.route.includes('/company/members')) {
        await expect(page.getByTestId('company-members')).toBeVisible({ timeout: 20_000 });
      }
      if (shot.setup) await shot.setup();
      await page.screenshot({ path: path.join(OUT, shot.file), fullPage: false });
      const meta = {
        gitSha,
        route: shot.route,
        viewport: shot.viewport,
        locale: shot.locale,
        direction: shot.dir,
        role: 'owner',
        sourceType: shot.source,
        dataState: 'OMA_DEMO_MODE=1 deterministic seed',
        consoleErrorCount: consoleErrors.filter((e) => !/favicon|401|404|React DevTools/i.test(e))
          .length,
        externalNetworkRequestCount: externalHosts.length,
        evidenceReferencePattern: shot.file.includes('schedule')
          ? 'Planable scheduling calendar (DOC)'
          : shot.file.includes('analytics')
            ? 'Smartly performance organization honesty (DOC)'
            : shot.file.includes('settings') || shot.file.includes('integrations')
              ? 'Linear settings IA + deferred integrations (DOC)'
              : 'Workfront workload / activity (DOC)',
        acceptanceIds: shot.acceptance,
        healthHint: await healthHint(page),
      };
      fs.writeFileSync(
        path.join(META, shot.file.replace('.png', '.json')),
        `${JSON.stringify(meta, null, 2)}\n`,
      );
    }
  });
});
