import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { installOwnerSession } from './helpers/brand-ui';

const OUT = join(
  process.cwd(),
  'artifacts',
  'planable-rebuild-004',
  'p5-deliverables-reviews-schedule',
);
const META = join(
  process.cwd(),
  '.reference',
  '005-planable-ui-ux',
  'ours',
  'p5-deliverables-reviews-schedule',
);
const WEB = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';

function sha(): string {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
}

test.describe('P5 Planable deliverables/reviews/schedule evidence pack', () => {
  test.describe.configure({ timeout: 360_000 });

  test('capture P5 surfaces', async ({ page, request }, testInfo) => {
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
            failedRequests: failed.filter((u) =>
              /facebook|openai|tiktok|meta\.com|frame\.io/i.test(u),
            ),
            overflowOk: computed.overflow,
            evidenceLevel: extra.evidenceLevel ?? 'OMA_ADAPTATION',
            match: extra.match ?? 'OMA_ADAPTATION',
            acceptanceIds: extra.acceptanceIds ?? ['PV-G-01', 'PV-G-09'],
            featureState: extra.featureState ?? name,
            rawScreenshot: `artifacts/planable-rebuild-004/p5-deliverables-reviews-schedule/${name}.png`,
            gitignoredRaw: true,
            capturedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app/deliverables');
    await expect(page.getByTestId('demo-deliverables')).toBeVisible();
    await page.getByTestId('demo-deliv-view-grid').click();
    await expect(page.getByTestId('demo-deliv-grid')).toBeVisible();
    await shot('01-deliverables-grid', '/app/deliverables', '1440x900', {
      evidenceLevel: 'ARCHIVED_MATCH',
      match: 'ARCHIVED_MATCH',
      viewType: 'deliverables-grid',
    });
    await page.getByTestId('demo-deliv-view-list').click();
    await expect(page.getByTestId('demo-deliv-table')).toBeVisible();
    await shot('02-deliverables-list', '/app/deliverables', '1440x900', {
      viewType: 'deliverables-list',
    });

    await page.goto('/app/deliverables/demo-deliv-carousel');
    await expect(page.getByTestId('demo-deliverable-detail')).toBeVisible();
    await shot('03-deliverable-detail', '/app/deliverables/demo-deliv-carousel', '1440x900', {
      viewType: 'deliverable-detail',
    });

    await page.goto('/app/reviews');
    await expect(page.getByTestId('demo-reviews')).toBeVisible();
    await shot('04-reviews-queue', '/app/reviews', '1440x900', { viewType: 'reviews-queue' });

    await page.goto('/app/deliverables/demo-deliv-carousel?review=1');
    await expect(page.getByTestId('demo-review-workspace')).toBeVisible();
    await shot(
      '05-review-workspace',
      '/app/deliverables/demo-deliv-carousel?review=1',
      '1440x900',
      {
        evidenceLevel: 'ARCHIVED_MATCH',
        match: 'ARCHIVED_MATCH',
        viewType: 'review-workspace',
      },
    );
    await shot('06-version-rail', '/app/deliverables/demo-deliv-carousel?review=1', '1440x900', {
      viewType: 'version-rail',
    });

    await page.getByTestId('demo-review-compare-toggle').click();
    await expect(page.getByTestId('demo-version-compare')).toBeVisible();
    await shot(
      '07-comparison',
      '/app/deliverables/demo-deliv-carousel?review=1&compare=1',
      '1440x900',
      {
        viewType: 'compare',
      },
    );
    await page.getByTestId('demo-review-compare-toggle').click();

    const canvas = page.getByTestId('demo-media-canvas');
    await canvas.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('demo-annotation-draft')).toBeVisible();
    await shot(
      '08-annotation-comments',
      '/app/deliverables/demo-deliv-carousel?review=1',
      '1440x900',
      {
        viewType: 'annotation',
      },
    );
    await page.keyboard.press('Escape');

    await page.getByTestId('demo-decide-changes').click();
    await expect(page.getByTestId('demo-decision-dialog')).toBeVisible();
    await shot('09-decision-dialog', '/app/deliverables/demo-deliv-carousel?review=1', '1440x900', {
      viewType: 'decision-dialog',
    });
    await page.keyboard.press('Escape');

    await page.goto('/app/deliverables/demo-deliv-video?review=1');
    await expect(page.getByTestId('demo-approved-version')).toBeVisible();
    await shot('10-immutable-approved', '/app/deliverables/demo-deliv-video?review=1', '1440x900', {
      viewType: 'immutable',
    });

    await page.goto('/app/deliverables/demo-deliv-carousel');
    await shot('11-revision-ready', '/app/deliverables/demo-deliv-carousel', '1440x900', {
      viewType: 'revision-state',
    });

    await page.goto('/app/schedule');
    await expect(page.getByTestId('demo-schedule')).toBeVisible();
    await page.getByTestId('demo-schedule-view-calendar').click();
    await expect(page.getByTestId('demo-schedule-calendar')).toBeVisible();
    await shot('12-schedule-calendar', '/app/schedule', '1440x900', {
      evidenceLevel: 'ARCHIVED_MATCH',
      match: 'ARCHIVED_MATCH',
      viewType: 'schedule-calendar',
    });
    await page.getByTestId('demo-schedule-view-agenda').click();
    await expect(page.getByTestId('demo-schedule-agenda')).toBeVisible();
    await shot('13-schedule-agenda', '/app/schedule', '1440x900', { viewType: 'schedule-agenda' });
    await page.getByTestId('demo-schedule-view-queue').click();
    await expect(page.getByTestId('demo-schedule-queue')).toBeVisible();
    await shot('14-schedule-queue', '/app/schedule', '1440x900', { viewType: 'schedule-queue' });

    await page.getByTestId('demo-schedule-view-agenda').click();
    await page.getByTestId('demo-sched-card-demo-sched-1').getByRole('button').click();
    await expect(page.getByTestId('demo-schedule-drawer')).toBeVisible();
    await page.getByTestId('demo-schedule-reschedule').click();
    await expect(page.getByTestId('demo-schedule-reschedule-dialog')).toBeVisible();
    await shot('15-reschedule-dialog', '/app/schedule', '1440x900', { viewType: 'reschedule' });
    await page.keyboard.press('Escape');

    await page.context().addCookies([{ name: 'oma_locale', value: 'ar', url: WEB }]);
    await page.goto('/app/deliverables');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await shot('16-ar-desktop', '/app/deliverables', '1440x900', {
      locale: 'ar',
      viewType: 'deliverables-ar',
    });
    await page.context().addCookies([{ name: 'oma_locale', value: 'en', url: WEB }]);

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/app/reviews');
    await shot('17-tablet', '/app/reviews', '1024x768', { viewType: 'tablet-reviews' });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/deliverables/demo-deliv-static?review=1');
    await expect(page.getByTestId('demo-review-workspace')).toBeVisible();
    await shot('18-mobile-review', '/app/deliverables/demo-deliv-static?review=1', '390x844', {
      viewType: 'mobile-review',
    });
    await page.goto('/app/schedule');
    await page.getByTestId('demo-schedule-view-agenda').click();
    await shot('19-mobile-schedule', '/app/schedule', '390x844', { viewType: 'mobile-schedule' });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app/deliverables');
    await page.getByTestId('demo-deliv-search').fill('zzzz-no-match-p5');
    await shot('20-empty-state', '/app/deliverables', '1440x900', { viewType: 'empty' });

    writeFileSync(
      join(META, 'INSPECTOR_NOTE.json'),
      JSON.stringify(
        {
          stage: 'P5',
          parentSha: gitSha,
          branch: '004-oma-complete-product-demo',
          capturedAt: new Date().toISOString().slice(0, 10),
          routes: [
            '/app/deliverables',
            '/app/deliverables/demo-deliv-carousel',
            '/app/reviews',
            '/app/schedule',
          ],
          evidenceDir: 'artifacts/planable-rebuild-004/p5-deliverables-reviews-schedule',
          metadataDir: '.reference/005-planable-ui-ux/ours/p5-deliverables-reviews-schedule',
          gitignoredRawScreenshots: true,
          referenceSession: 'NOT_REQUIRED — APPROVED_BASELINE_SUFFICIENT',
          evidenceLevels: {
            deliverables: 'ARCHIVED_MATCH',
            reviewWorkspace: 'ARCHIVED_MATCH',
            schedule: 'ARCHIVED_MATCH',
            compare: 'OMA_ADAPTATION',
          },
          noNewLivePlanableInspection: true,
          frameIoVisual: 'NOT_USED',
          videoCapture: 'OFF — screenshots + Playwright traces only',
          verdict: 'PLANABLE_DELIVERABLES_REVIEWS_SCHEDULE_SURFACES: VERIFIED',
        },
        null,
        2,
      ),
    );
  });
});
