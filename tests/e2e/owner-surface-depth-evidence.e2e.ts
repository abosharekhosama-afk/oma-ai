/**
 * Owner surface-depth evidence pack.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { installOwnerSession } from './helpers/brand-ui';

const OUT = path.join(process.cwd(), 'artifacts/owner-surface-depth-rebuild-004');
const META = path.join(process.cwd(), '.reference/004-visual-parity/ours/owner-surface-depth');

test.describe('Owner surface-depth evidence', () => {
  test.describe.configure({ timeout: 240_000 });

  test('capture specialized surfaces', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'evidence once');
    fs.mkdirSync(OUT, { recursive: true });
    fs.mkdirSync(META, { recursive: true });
    const gitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    await installOwnerSession(page, request);

    let consoleErrors = 0;
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors += 1;
    });

    const shots: Array<{
      file: string;
      route: string;
      criterion: string;
      ref: string;
      evidence: string;
      setup?: () => Promise<void>;
      viewport?: { width: number; height: number };
    }> = [
      {
        file: '01-command-center.png',
        route: '/app',
        criterion: 'CC action-first',
        ref: 'Linear+Workfront',
        evidence: 'ARCHIVED',
        setup: async () => {
          await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: '05-campaign-portfolio.png',
        route: '/app/campaigns',
        criterion: 'Campaign portfolio',
        ref: 'Planable',
        evidence: 'ARCHIVED',
        setup: async () => {
          await expect(page.getByTestId('demo-campaign-portfolio')).toBeVisible({
            timeout: 20_000,
          });
        },
      },
      {
        file: '06-content-calendar.png',
        route: '/app/content',
        criterion: 'Content calendar',
        ref: 'Planable',
        evidence: 'ARCHIVED',
        setup: async () => {
          await expect(page.getByTestId('demo-content')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: '07-content-composer.png',
        route: '/app/content',
        criterion: 'Content composer',
        ref: 'Planable',
        evidence: 'ARCHIVED',
        setup: async () => {
          await page.getByTestId('demo-content-view-grid').click();
          await page.locator('[data-testid^="demo-content-card-"]').first().click();
          await expect(page.getByTestId('demo-content-composer')).toBeVisible();
        },
      },
      {
        file: '08-requests-inbox.png',
        route: '/app/requests',
        criterion: 'Requests triage',
        ref: 'Workfront',
        evidence: 'DOC',
        setup: async () => {
          await expect(page.getByTestId('demo-requests')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: '10-kanban.png',
        route: '/app/tasks',
        criterion: 'Kanban depth',
        ref: 'Linear',
        evidence: 'ARCHIVED',
        setup: async () => {
          await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: '12-deliverables-grid.png',
        route: '/app/deliverables',
        criterion: 'Asset browser',
        ref: 'Frame.io+Planable',
        evidence: 'ARCHIVED',
        setup: async () => {
          await expect(page.getByTestId('demo-deliv-grid')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: '13-reviews-queue.png',
        route: '/app/reviews',
        criterion: 'Review queue cards',
        ref: 'Frame.io',
        evidence: 'DOC',
        setup: async () => {
          await expect(page.getByTestId('demo-review-queue')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: '14-schedule.png',
        route: '/app/schedule',
        criterion: 'Schedule',
        ref: 'Planable',
        evidence: 'ARCHIVED',
      },
      {
        file: '15-analytics.png',
        route: '/app/analytics',
        criterion: 'Analytics chart-first',
        ref: 'Smartly DOC',
        evidence: 'DOC',
        setup: async () => {
          await expect(page.getByTestId('demo-analytics')).toBeVisible({ timeout: 20_000 });
        },
      },
      {
        file: '16-team.png',
        route: '/app/team',
        criterion: 'Team workload',
        ref: 'Workfront',
        evidence: 'DOC',
      },
      {
        file: '17-activity.png',
        route: '/app/activity',
        criterion: 'Activity',
        ref: 'Linear',
        evidence: 'ARCHIVED',
      },
      {
        file: '18-settings.png',
        route: '/app/settings',
        criterion: 'Settings IA',
        ref: 'Linear',
        evidence: 'ARCHIVED',
      },
      {
        file: '20-mobile-content.png',
        route: '/app/content',
        criterion: 'Mobile content',
        ref: 'Planable',
        evidence: 'ARCHIVED',
        viewport: { width: 390, height: 844 },
      },
    ];

    const manifest: unknown[] = [];
    for (const shot of shots) {
      await page.setViewportSize(shot.viewport ?? { width: 1440, height: 900 });
      await page.goto(shot.route);
      if (shot.setup) await shot.setup();
      const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
      const target = path.join(OUT, shot.file);
      await page.screenshot({ path: target, fullPage: false });
      const meta = {
        file: shot.file,
        gitSha,
        route: shot.route,
        viewport: shot.viewport ?? { width: 1440, height: 900 },
        locale: 'en',
        computedFontFamily: fontFamily,
        dataState: 'demo-seed',
        primaryReference: shot.ref,
        evidenceLevel: shot.evidence,
        consoleErrorCount: consoleErrors,
        beforeAfter: 'after',
        acceptanceCriterion: shot.criterion,
      };
      manifest.push(meta);
      fs.writeFileSync(
        path.join(META, shot.file.replace('.png', '.json')),
        JSON.stringify(meta, null, 2),
      );
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
    await page.goto('/app/campaigns');
    await expect(page.getByTestId('demo-campaign-portfolio')).toBeVisible({ timeout: 20_000 });
    const arFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    await page.screenshot({ path: path.join(OUT, '19-arabic-desktop.png'), fullPage: false });
    const arMeta = {
      file: '19-arabic-desktop.png',
      gitSha,
      route: '/app/campaigns',
      viewport: { width: 1440, height: 900 },
      locale: 'ar',
      computedFontFamily: arFont,
      dataState: 'demo-seed',
      primaryReference: 'Planable+Noto',
      evidenceLevel: 'ARCHIVED',
      consoleErrorCount: consoleErrors,
      beforeAfter: 'after',
      acceptanceCriterion: 'AR RTL portfolio',
    };
    manifest.push(arMeta);
    fs.writeFileSync(path.join(META, '19-arabic-desktop.json'), JSON.stringify(arMeta, null, 2));
    fs.writeFileSync(path.join(META, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(
      path.join(OUT, 'MANIFEST.md'),
      [
        '# Owner surface-depth evidence',
        '',
        `- SHA: \`${gitSha}\``,
        `- OWNER_VISUAL_REVIEW: REJECTED`,
        `- VISUAL_REBUILD: COMPLETE_PENDING_RECERTIFICATION`,
        '',
        ...manifest.map(
          (m) =>
            `- \`${(m as { file: string }).file}\` — ${(m as { acceptanceCriterion: string }).acceptanceCriterion}`,
        ),
        '',
      ].join('\n'),
    );
    expect(manifest.length).toBeGreaterThan(12);
  });
});
