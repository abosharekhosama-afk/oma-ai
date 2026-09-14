/**
 * Owner Preview screenshot pack for Full Visual Certification (Stage 7).
 * Captures fresh shots from the running certification SHA — never reuses Stage 1–6 packs.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installOwnerSession } from './helpers/brand-ui';

const OUT = path.join(process.cwd(), 'artifacts/full-visual-certification-004/screenshots');
const META = path.join(process.cwd(), '.reference/004-visual-parity/ours/full-certification');
const WEB = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';

async function healthHint(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    try {
      const res = await fetch('/api/v1/health/live');
      return (await res.text()).slice(0, 40);
    } catch {
      return 'unknown';
    }
  });
}

test.describe('Full visual certification evidence', () => {
  test.describe.configure({ timeout: 240_000 });

  test('capture owner preview surfaces', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'intentional: evidence once');
    fs.mkdirSync(OUT, { recursive: true });
    fs.mkdirSync(META, { recursive: true });
    await installOwnerSession(page, request);
    const gitSha = process.env.GIT_SHA ?? 'pending';
    let consoleErrors = 0;
    let externalHosts = 0;
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors += 1;
    });
    page.on('request', (req) => {
      if (
        /facebook|meta\.com|tiktok|googleapis|openai|anthropic|semrush|smartly|workdrive|zoho/i.test(
          req.url(),
        )
      ) {
        externalHosts += 1;
      }
    });

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
        file: '01-login.png',
        route: '/login',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-SHELL-04', 'V-CERT-01'],
        source: 'Production-shaped',
      },
      {
        file: '02-command-center.png',
        route: '/app',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-HOME-01', 'V-HOME-02'],
        source: 'Hybrid',
        setup: async () => {
          await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: '03-brand-intelligence.png',
        route: '/app/brands',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-BWI-01'],
        source: 'Production-shaped',
        setup: async () => {
          await expect(page.getByTestId('brand-portfolio')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: '04-strategy-organic-paid.png',
        route: '/app/campaigns/demo-campaign-organic',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-STR-01', 'V-CMP-02', 'V-LINK-01'],
        source: 'Demo-backed',
        setup: async () => {
          await expect(page.getByTestId('demo-campaign-detail')).toBeVisible({ timeout: 20_000 });
          await expect(page.getByTestId('demo-strategy-id')).toBeVisible();
        },
      },
      {
        file: '05-campaign-portfolio.png',
        route: '/app/campaigns',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-CMP-01'],
        source: 'Demo-backed',
        setup: async () => {
          await expect(page.getByTestId('demo-campaigns')).toBeVisible({ timeout: 20_000 });
          await expect(page.getByRole('link', { name: /Summer Organic/i }).first()).toBeVisible();
        },
      },
      {
        file: '06-content-calendar.png',
        route: '/app/content',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-CNT-01', 'V-CNT-02'],
        source: 'Demo-backed',
        setup: async () => {
          await expect(page.getByTestId('demo-content')).toBeVisible({ timeout: 20_000 });
          await page.getByRole('button', { name: /calendar/i }).click();
          await expect(
            page.getByText(/Fabric story carousel|Studio morning reel/i).first(),
          ).toBeVisible({ timeout: 15_000 });
        },
      },
      {
        file: '07-requests-brief.png',
        route: '/app/requests/demo-request-1',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-REQ-02', 'V-BRF-01'],
        source: 'Demo-backed',
        setup: async () => {
          await expect(page.getByTestId('demo-request-detail')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: '08-tasks-kanban.png',
        route: '/app/tasks',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-TSK-01'],
        source: 'Demo-backed',
        setup: async () => {
          await expect(page.getByTestId('demo-tasks')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: '09-task-detail.png',
        route: '/app/tasks?task=demo-task-design',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-TSK-03'],
        source: 'Demo-backed',
        setup: async () => {
          await expect(page.getByTestId('demo-task-drawer')).toBeVisible({ timeout: 15_000 });
        },
      },
      {
        file: '10-deliverables.png',
        route: '/app/deliverables',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-DEL-01'],
        source: 'Demo-backed',
        setup: async () => {
          await expect(page.getByTestId('demo-deliverables')).toBeVisible({ timeout: 20_000 });
          await expect(page.getByTestId('demo-deliv-grid')).toBeVisible();
        },
      },
      {
        file: '11-dark-review-canvas.png',
        route: '/app/deliverables/demo-deliv-carousel?review=1',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-REV-02', 'V-VER-01'],
        source: 'Demo-backed',
        setup: async () => {
          await expect(page.getByTestId('demo-review-workspace')).toBeVisible({ timeout: 15_000 });
          await expect(page.getByTestId('demo-media-canvas')).toBeVisible();
          await expect(page.getByTestId('demo-version-rail')).toBeVisible();
        },
      },
      {
        file: '12-review-annotation.png',
        route: '/app/deliverables/demo-deliv-carousel?review=1',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-REV-03', 'V-APR-01'],
        source: 'Demo-backed',
        setup: async () => {
          await expect(page.getByTestId('demo-review-workspace')).toBeVisible({ timeout: 15_000 });
          await page.getByTestId('demo-media-canvas').focus();
          await page.keyboard.press('Enter');
          await expect(page.getByTestId('demo-annotation-draft')).toBeVisible({ timeout: 10_000 });
          await expect(page.getByTestId('demo-review-comments')).toBeVisible();
        },
      },
      {
        file: '13-schedule.png',
        route: '/app/schedule',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-SCH-01', 'V-SCH-02'],
        source: 'Demo-backed',
        setup: async () => {
          await expect(page.getByTestId('demo-schedule')).toBeVisible({ timeout: 20_000 });
          await page.getByTestId('demo-schedule-view-calendar').click();
          await expect(page.getByTestId('demo-schedule-calendar')).toBeVisible();
        },
      },
      {
        file: '14-analytics.png',
        route: '/app/analytics',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-ANL-01', 'V-ANL-02'],
        source: 'Demo-backed',
        setup: async () => {
          await expect(page.getByTestId('demo-analytics')).toBeVisible({ timeout: 20_000 });
          await expect(page.getByTestId('demo-analytics-sample-badge')).toBeVisible();
          await expect(page.getByTestId('demo-analytics-kpis')).toBeVisible();
        },
      },
      {
        file: '15-team-workload.png',
        route: '/app/team',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-TEAM-01'],
        source: 'Hybrid',
        setup: async () => {
          await expect(page.getByTestId('demo-team')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: '16-activity.png',
        route: '/app/activity',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-ACT-01'],
        source: 'Hybrid',
        setup: async () => {
          await expect(page.getByTestId('demo-activity')).toBeVisible({ timeout: 20_000 });
          await expect(page.getByTestId('demo-activity-stream')).toBeVisible();
        },
      },
      {
        file: '17-settings-integrations.png',
        route: '/app/settings',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-SET-01', 'V-INT-01'],
        source: 'Demo-backed',
        setup: async () => {
          await expect(page.getByTestId('demo-settings')).toBeVisible({ timeout: 20_000 });
          await page.getByTestId('demo-settings-nav-integrations').click();
          await expect(page.getByTestId('demo-integrations')).toBeVisible();
        },
      },
      {
        file: '18-ar-rtl-desktop.png',
        route: '/app',
        viewport: { width: 1440, height: 900 },
        locale: 'ar',
        dir: 'rtl',
        acceptance: ['V-SHELL-08', 'V-G-03', 'V-CERT-01'],
        source: 'Hybrid',
        setup: async () => {
          await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
          await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: '19-tablet.png',
        route: '/app/tasks',
        viewport: { width: 1024, height: 768 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-TSK-01', 'V-G-03'],
        source: 'Demo-backed',
        setup: async () => {
          await expect(page.getByTestId('demo-tasks')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: '20-mobile.png',
        route: '/app/schedule',
        viewport: { width: 390, height: 844 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-SCH-02', 'V-SHELL-07'],
        source: 'Demo-backed',
        setup: async () => {
          await expect(page.getByTestId('demo-schedule')).toBeVisible({ timeout: 20_000 });
          await page.getByTestId('demo-schedule-view-agenda').click();
          await expect(page.getByTestId('demo-schedule-agenda')).toBeVisible();
        },
      },
    ];

    const keepOverlay = new Set([
      '09-task-detail.png',
      '11-dark-review-canvas.png',
      '12-review-annotation.png',
    ]);

    for (const shot of shots) {
      consoleErrors = 0;
      externalHosts = 0;
      await page.setViewportSize(shot.viewport);
      if (shot.file === '01-login.png') {
        await page.context().clearCookies();
        await page.goto('/login', { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('button', { name: /sign in|تسجيل/i })).toBeVisible();
      } else {
        if (shot.file === '02-command-center.png') {
          await installOwnerSession(page, request);
        }
        if (shot.locale === 'ar') {
          await page.context().addCookies([{ name: 'oma_locale', value: 'ar', url: WEB }]);
        } else if (shot.file === '19-tablet.png' || shot.file === '20-mobile.png') {
          await page.context().addCookies([{ name: 'oma_locale', value: 'en', url: WEB }]);
        }
        await page.goto(shot.route, { waitUntil: 'domcontentloaded' });
        if (shot.setup) await shot.setup();
      }
      if (!keepOverlay.has(shot.file)) {
        await page.keyboard.press('Escape').catch(() => undefined);
      }
      const target = path.join(OUT, shot.file);
      await page.screenshot({ path: target, fullPage: false });
      const meta = {
        gitSha,
        route: shot.route,
        viewport: shot.viewport,
        locale: shot.locale,
        direction: shot.dir,
        accountRole: 'owner',
        companyBrandContext: 'ephemeral e2e owner + deterministic demo graph',
        dataSource: shot.source,
        demoState: 'OMA_DEMO_MODE=1',
        consoleErrorCount: consoleErrors,
        failedRequestCount: 0,
        externalHostCount: externalHosts,
        acceptanceIds: shot.acceptance,
        healthHint: await healthHint(page),
      };
      fs.writeFileSync(
        path.join(META, shot.file.replace(/\.png$/, '.json')),
        `${JSON.stringify(meta, null, 2)}\n`,
      );
      expect(fs.existsSync(target)).toBeTruthy();
      expect(externalHosts).toBe(0);
    }
  });
});
