import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installOwnerSession } from './helpers/brand-ui';

const OUT = path.join(
  process.cwd(),
  'artifacts/visual-parity-004/stage4-requests-tasks-production',
);
const META = path.join(
  process.cwd(),
  '.reference/004-visual-parity/ours/stage4-requests-tasks-production',
);

async function sha(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    try {
      const res = await fetch('/api/health');
      return (await res.text()).slice(0, 40);
    } catch {
      return 'unknown';
    }
  });
}

test.describe('Stage 4 visual evidence', () => {
  test('capture Stage 4 surfaces', async ({ page, request }, testInfo) => {
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
      setup?: () => Promise<void>;
    }> = [
      {
        file: '01-requests-inbox-desktop.png',
        route: '/app/requests',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-REQ-01'],
      },
      {
        file: '02-request-detail-triage.png',
        route: '/app/requests/demo-request-1',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-REQ-02'],
      },
      {
        file: '03-structured-brief.png',
        route: '/app/requests/demo-request-1',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-BRF-01'],
        setup: async () => {
          await page.getByTestId('demo-structured-brief').scrollIntoViewIfNeeded();
        },
      },
      {
        file: '04-tasks-kanban-desktop.png',
        route: '/app/tasks',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-TSK-01', 'V-WRK-01'],
      },
      {
        file: '05-task-list-desktop.png',
        route: '/app/tasks',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-TSK-02'],
        setup: async () => {
          await page.getByTestId('demo-tasks-view-list').click();
          await expect(page.getByTestId('demo-tasks-list')).toBeVisible();
        },
      },
      {
        file: '06-task-detail-drawer.png',
        route: '/app/tasks?task=demo-task-design',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-TSK-03'],
      },
      {
        file: '07-task-comments-checklist.png',
        route: '/app/tasks?task=demo-task-design',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-TSK-03'],
        setup: async () => {
          await page.getByTestId('demo-task-checklist').scrollIntoViewIfNeeded();
        },
      },
      {
        file: '08-requests-ar-rtl.png',
        route: '/app/requests',
        viewport: { width: 1440, height: 900 },
        locale: 'ar',
        dir: 'rtl',
        acceptance: ['V-REQ-01', 'V-G-03'],
      },
      {
        file: '09-kanban-tablet.png',
        route: '/app/tasks',
        viewport: { width: 1024, height: 768 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-TSK-01'],
      },
      {
        file: '10-tasks-mobile-390.png',
        route: '/app/tasks',
        viewport: { width: 390, height: 844 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-TSK-01', 'V-TSK-02'],
      },
    ];

    for (const shot of shots) {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      await page.setViewportSize(shot.viewport);
      if (shot.locale === 'ar') {
        await page.context().addCookies([
          {
            name: 'oma_locale',
            value: 'ar',
            url: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000',
          },
        ]);
      }
      await page.goto(shot.route);
      if (shot.route.includes('requests') && !shot.route.includes('demo-request')) {
        await expect(page.getByTestId('demo-requests')).toBeVisible({ timeout: 20_000 });
      }
      if (shot.route.includes('/app/tasks')) {
        await expect(page.getByTestId('demo-tasks')).toBeVisible({ timeout: 20_000 });
      }
      if (shot.route.includes('demo-request')) {
        await expect(page.getByTestId('demo-request-detail')).toBeVisible({ timeout: 20_000 });
      }
      if (shot.setup) await shot.setup();
      const filePath = path.join(OUT, shot.file);
      await page.screenshot({ path: filePath, fullPage: false });
      const meta = {
        gitSha,
        route: shot.route,
        viewport: shot.viewport,
        locale: shot.locale,
        direction: shot.dir,
        demoState: 'OMA_DEMO_MODE=1 deterministic seed',
        userRole: 'owner',
        consoleErrorCount: consoleErrors.filter((e) => !/favicon|401|404|React DevTools/i.test(e))
          .length,
        mappedReferencePattern:
          shot.file.includes('kanban') || shot.file.includes('task')
            ? 'Linear density / panels / status move'
            : shot.file.includes('brief')
              ? 'Workfront brief structure'
              : 'Workfront intake + Planable content link cues',
        acceptanceIds: shot.acceptance,
        healthHint: await sha(page),
      };
      fs.writeFileSync(
        path.join(META, shot.file.replace('.png', '.json')),
        `${JSON.stringify(meta, null, 2)}\n`,
      );
    }
  });
});
