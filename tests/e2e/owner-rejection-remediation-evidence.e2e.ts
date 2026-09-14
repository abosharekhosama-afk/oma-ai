/**
 * Owner rejection remediation evidence (core experience).
 * Captures after Inter/Kanban rebuild — must use current SHA only.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { installOwnerSession } from './helpers/brand-ui';

const OUT = path.join(process.cwd(), 'artifacts/owner-rejection-remediation-004');
const META = path.join(process.cwd(), '.reference/004-visual-parity/ours/owner-remediation');

test.describe('Owner rejection remediation evidence', () => {
  test.describe.configure({ timeout: 180_000 });

  test('capture before/after-style core surfaces', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'evidence once');
    fs.mkdirSync(OUT, { recursive: true });
    fs.mkdirSync(META, { recursive: true });
    const gitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    await installOwnerSession(page, request);

    let consoleErrors = 0;
    const failed: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors += 1;
    });
    page.on('requestfailed', (req) => failed.push(req.url()));

    const shots: Array<{
      file: string;
      route: string;
      viewport: { width: number; height: number };
      locale: string;
      criterion: string;
      setup?: () => Promise<void>;
    }> = [
      {
        file: 'after-shell-home.png',
        route: '/app',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        criterion: 'IA Command Center + overdue→board',
        setup: async () => {
          await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: 'after-tasks-board-default.png',
        route: '/app/tasks',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        criterion: 'Kanban default discoverable',
        setup: async () => {
          await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: 'after-kanban-drag-state.png',
        route: '/app/tasks',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        criterion: 'DnD lift/drop',
        setup: async () => {
          await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 20_000 });
          await page.getByTestId('demo-task-card-demo-task-ready-2').scrollIntoViewIfNeeded();
          const source = page.getByTestId('demo-task-card-demo-task-ready-2');
          const target = page.getByTestId('demo-kanban-IN_PROGRESS');
          const s = await source.boundingBox();
          const t = await target.boundingBox();
          if (!s || !t) throw new Error('drag boxes');
          await page.mouse.move(s.x + 20, s.y + 16);
          await page.mouse.down();
          await page.mouse.move(t.x + t.width / 2, t.y + 56, { steps: 16 });
          await page.mouse.up();
          await expect(
            page
              .getByTestId('demo-kanban-IN_PROGRESS')
              .getByTestId('demo-task-card-demo-task-ready-2'),
          ).toBeVisible({ timeout: 15_000 });
        },
      },
      {
        file: 'after-task-drawer.png',
        route: '/app/tasks?task=demo-task-design',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        criterion: 'Task drawer',
        setup: async () => {
          await expect(page.getByTestId('demo-task-drawer')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: 'after-content-calendar.png',
        route: '/app/content',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        criterion: 'Content surface',
      },
      {
        file: 'after-requests.png',
        route: '/app/requests',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        criterion: 'Requests',
        setup: async () => {
          await expect(page.getByTestId('demo-requests')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: 'after-schedule.png',
        route: '/app/schedule',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        criterion: 'Schedule',
      },
      {
        file: 'after-analytics.png',
        route: '/app/analytics',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        criterion: 'Analytics',
      },
      {
        file: 'after-settings.png',
        route: '/app/settings',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        criterion: 'Settings prefs',
      },
      {
        file: 'after-mobile-tasks.png',
        route: '/app/tasks',
        viewport: { width: 390, height: 844 },
        locale: 'en',
        criterion: 'Mobile Kanban',
        setup: async () => {
          await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 20_000 });
        },
      },
    ];

    const manifest: unknown[] = [];
    for (const shot of shots) {
      await page.setViewportSize(shot.viewport);
      await page.goto(shot.route);
      if (shot.setup) await shot.setup();
      const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
      const target = path.join(OUT, shot.file);
      await page.screenshot({ path: target, fullPage: false });
      manifest.push({
        file: shot.file,
        gitSha,
        route: shot.route,
        viewport: shot.viewport,
        locale: shot.locale,
        computedFontFamily: fontFamily,
        consoleErrorCount: consoleErrors,
        failedRequests: failed.length,
        beforeAfter: 'after',
        acceptanceCriterion: shot.criterion,
        referenceMapping: 'Linear board density / Planable content hierarchy (DEC-013)',
      });
    }

    // Arabic sample
    await page.context().addCookies([
      {
        name: 'oma_locale',
        value: 'ar',
        url: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000',
      },
    ]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app/tasks');
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 20_000 });
    const arFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    await page.screenshot({
      path: path.join(OUT, 'after-arabic-tasks-board.png'),
      fullPage: false,
    });
    manifest.push({
      file: 'after-arabic-tasks-board.png',
      gitSha,
      route: '/app/tasks',
      viewport: { width: 1440, height: 900 },
      locale: 'ar',
      computedFontFamily: arFont,
      consoleErrorCount: consoleErrors,
      failedRequests: failed.length,
      beforeAfter: 'after',
      acceptanceCriterion: 'AR RTL typography',
      referenceMapping: 'Noto Sans Arabic companion',
    });

    fs.writeFileSync(path.join(META, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(
      path.join(OUT, 'MANIFEST.md'),
      [
        '# Owner rejection remediation evidence',
        '',
        `- SHA: \`${gitSha}\``,
        `- OWNER_VISUAL_REVIEW: REJECTED`,
        `- VISUAL_REBUILD: IN_PROGRESS`,
        `- FULL_VISUAL_CERTIFICATION: INVALIDATED_BY_OWNER`,
        '',
        ...manifest.map(
          (m) =>
            `- \`${(m as { file: string }).file}\` — ${(m as { acceptanceCriterion: string }).acceptanceCriterion} — font: \`${(m as { computedFontFamily: string }).computedFontFamily}\``,
        ),
        '',
      ].join('\n'),
    );
    expect(manifest.length).toBeGreaterThan(8);
  });
});
