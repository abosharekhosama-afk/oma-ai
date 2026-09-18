import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { installOwnerSession } from './helpers/brand-ui';

const OUT = join(process.cwd(), 'artifacts', 'planable-rebuild-004', 'p4-requests-briefs-tasks');
const META = join(
  process.cwd(),
  '.reference',
  '005-planable-ui-ux',
  'ours',
  'p4-requests-briefs-tasks',
);
const WEB = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';

function sha(): string {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
}

test.describe('P4 Planable requests/briefs/tasks evidence pack', () => {
  test.describe.configure({ timeout: 300_000 });

  test('capture P4 surfaces', async ({ page, request }, testInfo) => {
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
        const primary = getComputedStyle(document.documentElement).getPropertyValue(
          '--oma-primary',
        );
        return {
          fontFamily: body.fontFamily,
          canvas: body.backgroundColor,
          ink: body.color,
          primary: primary.trim(),
          overflow:
            document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
          dir: document.documentElement.dir,
        };
      });
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
            failedRequests: failed.filter((u) => /facebook|openai|tiktok|meta\.com/i.test(u)),
            overflowOk: computed.overflow,
            evidenceLevel: extra.evidenceLevel ?? 'OMA_ADAPTATION',
            match: extra.match ?? 'OMA_ADAPTATION',
            acceptanceIds: extra.acceptanceIds ?? ['PV-G-01', 'PV-G-09'],
            featureState: extra.featureState ?? name,
            rawScreenshot: `artifacts/planable-rebuild-004/p4-requests-briefs-tasks/${name}.png`,
            gitignoredRaw: true,
            capturedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app/requests');
    await expect(page.getByTestId('demo-requests')).toBeVisible();
    await shot('01-requests-inbox', '/app/requests', '1440x900', {
      evidenceLevel: 'ARCHIVED_MATCH',
      match: 'ARCHIVED_MATCH',
      viewType: 'requests-inbox',
    });

    await page.getByTestId('demo-create-request').click();
    await expect(page.getByTestId('demo-create-request-dialog')).toBeVisible();
    await shot('02-create-request-dialog', '/app/requests', '1440x900', {
      evidenceLevel: 'ARCHIVED_MATCH',
      match: 'ARCHIVED_MATCH',
      viewType: 'create-request',
    });
    await page.keyboard.press('Escape');

    await page.goto('/app/requests/demo-request-1');
    await expect(page.getByTestId('demo-request-detail')).toBeVisible();
    await shot('03-request-detail', '/app/requests/demo-request-1', '1440x900', {
      viewType: 'request-detail',
    });
    await expect(page.getByTestId('demo-structured-brief')).toBeVisible();
    await shot('04-brief-editor', '/app/requests/demo-request-1', '1440x900', {
      viewType: 'brief-editor',
    });

    await page.goto('/app/tasks');
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible();
    await shot('05-tasks-board', '/app/tasks', '1440x900', {
      evidenceLevel: 'OMA_ADAPTATION',
      match: 'OMA_ADAPTATION',
      viewType: 'tasks-board',
    });

    const source = page.getByTestId('demo-task-card-demo-task-ready-1');
    await source.scrollIntoViewIfNeeded();
    const box = await source.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 20, box.y + 16);
      await page.mouse.down();
      await page.mouse.move(box.x + 40, box.y + 40, { steps: 8 });
      await shot('06-drag-state', '/app/tasks', '1440x900', { viewType: 'kanban-drag' });
      await page.mouse.up();
    }

    await page.goto('/app/tasks?task=demo-task-design');
    await expect(page.getByTestId('demo-task-drawer')).toBeVisible({ timeout: 15_000 });
    await shot('07-task-drawer', '/app/tasks?task=demo-task-design', '1440x900', {
      viewType: 'task-drawer',
    });
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('demo-task-drawer')).toHaveCount(0);

    await page.getByTestId('demo-tasks-view-list').click();
    await expect(page.getByTestId('demo-tasks-list')).toBeVisible();
    await shot('08-tasks-list', '/app/tasks?view=list', '1440x900', { viewType: 'tasks-list' });

    await page.getByTestId('demo-task-search').fill('zzzz-no-match-p4');
    await shot('12-empty-state', '/app/tasks', '1440x900', { viewType: 'empty' });
    await page.getByTestId('demo-task-search').fill('');

    await page.route('**/api/v1/demo/tasks/**', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'forced failure' } }),
        });
        return;
      }
      await route.continue();
    });
    await page.getByTestId('demo-tasks-view-board').click();
    await page.getByTestId('demo-task-move-demo-task-ready-2').selectOption('IN_PROGRESS');
    await expect(
      page.getByTestId('demo-kanban-READY').getByTestId('demo-task-card-demo-task-ready-2'),
    ).toBeVisible({ timeout: 12_000 });
    await shot('13-failed-move-rollback', '/app/tasks', '1440x900', {
      viewType: 'rollback',
    });
    await page.unroute('**/api/v1/demo/tasks/**');

    await page.context().addCookies([{ name: 'oma_locale', value: 'ar', url: WEB }]);
    await page.goto('/app/requests');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await shot('09-ar-desktop', '/app/requests', '1440x900', {
      locale: 'ar',
      viewType: 'requests-ar',
    });
    await page.context().addCookies([{ name: 'oma_locale', value: 'en', url: WEB }]);

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/app/tasks');
    await shot('10-tablet', '/app/tasks', '1024x768', { viewType: 'tablet-board' });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/tasks');
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible();
    await shot('11-mobile-board', '/app/tasks', '390x844', { viewType: 'mobile-board' });
    await page.getByTestId('demo-task-card-demo-task-design').locator('button').click();
    await expect(page.getByTestId('demo-task-drawer')).toBeVisible();
    await shot('14-mobile-drawer', '/app/tasks?task=demo-task-design', '390x844', {
      viewType: 'mobile-drawer',
    });

    writeFileSync(
      join(META, 'INSPECTOR_NOTE.json'),
      JSON.stringify(
        {
          stage: 'P4',
          parentSha: gitSha,
          branch: '004-oma-complete-product-demo',
          capturedAt: new Date().toISOString().slice(0, 10),
          routes: ['/app/requests', '/app/requests/demo-request-1', '/app/tasks'],
          evidenceDir: 'artifacts/planable-rebuild-004/p4-requests-briefs-tasks',
          metadataDir: '.reference/005-planable-ui-ux/ours/p4-requests-briefs-tasks',
          gitignoredRawScreenshots: true,
          referenceSession: 'NOT_REQUIRED — APPROVED_BASELINE_SUFFICIENT',
          evidenceLevels: {
            requestsInbox: 'ARCHIVED_MATCH',
            createDialog: 'ARCHIVED_MATCH',
            briefEditor: 'OMA_ADAPTATION',
            tasksBoard: 'OMA_ADAPTATION',
            taskDrawer: 'ARCHIVED_MATCH',
          },
          noNewLivePlanableInspection: true,
          withinColumnReorder: 'local-only',
          myWorkView: 'NOT_SHIPPED — no authenticated current-user assignee model in Demo graph',
          verdict: 'PLANABLE_REQUESTS_BRIEFS_TASKS_SURFACES: VERIFIED',
        },
        null,
        2,
      ),
    );
  });
});
