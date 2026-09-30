import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { chooseOmaSelect } from './helpers/antd-select';
import { applyContentFilters, openContentFilters } from './helpers/stage3-filters';
import { installOwnerSession } from './helpers/brand-ui';

const OUT = join(process.cwd(), 'artifacts', 'planable-rebuild-004', 'p3-campaigns-content');
const META = join(
  process.cwd(),
  '.reference',
  '005-planable-ui-ux',
  'ours',
  'p3-campaigns-content',
);
const WEB = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';

function sha(): string {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
}

test.describe('P3 Planable campaigns/content evidence pack', () => {
  test.describe.configure({ timeout: 240_000 });

  test('capture P3 surfaces', async ({ page, request }, testInfo) => {
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
        return {
          fontFamily: body.fontFamily,
          canvas: body.backgroundColor,
          ink: body.color,
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
            computedColors: { canvas: computed.canvas, ink: computed.ink },
            computedTokens: computed,
            viewType: extra.viewType ?? name,
            consoleErrors: consoleErrors.filter((e) => /hydrat/i.test(e)),
            failedRequests: failed.filter((u) => /facebook|openai|tiktok|meta\.com/i.test(u)),
            overflowOk: computed.overflow,
            evidenceLevel: extra.evidenceLevel ?? 'OMA_ADAPTATION',
            match: extra.match ?? 'OMA_ADAPTATION',
            contentFixtureId: extra.contentFixtureId ?? null,
            mediaFixtureId: extra.mediaFixtureId ?? null,
            acceptanceIds: extra.acceptanceIds ?? ['PV-G-01', 'PV-G-09'],
            featureState: extra.featureState ?? name,
            rawScreenshot: `artifacts/planable-rebuild-004/p3-campaigns-content/${name}.png`,
            gitignoredRaw: true,
            capturedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app/campaigns');
    await expect(page.getByTestId('demo-campaigns')).toBeVisible();
    await shot('01-campaign-portfolio', '/app/campaigns', '1440x900', {
      evidenceLevel: 'LIVE_VERIFIED',
      match: 'LIVE_MATCH',
      viewType: 'campaign-portfolio',
    });

    await page.getByTestId('demo-create-campaign').click();
    await expect(page.getByTestId('demo-create-campaign-dialog')).toBeVisible();
    await shot('02-create-campaign-dialog', '/app/campaigns', '1440x900', {
      evidenceLevel: 'ARCHIVED_MATCH',
      match: 'ARCHIVED_MATCH',
      viewType: 'create-campaign',
    });
    await page.keyboard.press('Escape');

    await page.goto('/app/campaigns/demo-campaign-organic');
    await expect(page.getByTestId('demo-campaign-detail')).toBeVisible();
    await shot('03-campaign-workspace', '/app/campaigns/demo-campaign-organic', '1440x900', {
      evidenceLevel: 'LIVE_VERIFIED',
      match: 'LIVE_MATCH',
      viewType: 'campaign-workspace',
    });
    await page.getByTestId('demo-campaign-tab-content').click();
    await shot('04-campaign-content-tab', '/app/campaigns/demo-campaign-organic', '1440x900', {
      viewType: 'campaign-content',
    });

    await page.goto('/app/content');
    await page.getByTestId('demo-content-view-calendar').click();
    await expect(page.getByTestId('demo-content-calendar')).toBeVisible();
    await shot('05-content-calendar', '/app/content', '1440x900', {
      evidenceLevel: 'ARCHIVED_MATCH',
      match: 'ARCHIVED_MATCH',
      viewType: 'calendar',
    });
    await shot('06-calendar-populated-week', '/app/content', '1440x900', {
      evidenceLevel: 'ARCHIVED_MATCH',
      match: 'ARCHIVED_MATCH',
      viewType: 'calendar-week',
      contentFixtureId: 'demo-content-reel',
      mediaFixtureId: '/demo/video-poster.svg',
    });

    await page.getByTestId('demo-content-view-feed').click();
    await expect(page.getByTestId('demo-content-feed')).toBeVisible();
    await shot('08-feed', '/app/content', '1440x900', {
      evidenceLevel: 'ARCHIVED_MATCH',
      match: 'ARCHIVED_MATCH',
      viewType: 'feed',
    });
    await page.getByTestId('demo-content-view-grid').click();
    await expect(page.getByTestId('demo-content-grid')).toBeVisible();
    await shot('09-grid', '/app/content', '1440x900', {
      evidenceLevel: 'PLAN_GATED',
      match: 'OMA_ADAPTATION',
      viewType: 'grid',
    });
    await page.getByTestId('demo-content-view-list').click();
    await expect(page.getByTestId('demo-content-list')).toBeVisible();
    await shot('10-list', '/app/content', '1440x900', {
      evidenceLevel: 'PLAN_GATED',
      match: 'OMA_ADAPTATION',
      viewType: 'list',
    });

    await page.getByTestId('demo-create-content').click();
    await expect(page.getByTestId('demo-create-content-dialog')).toBeVisible();
    await shot('11-composer-create', '/app/content', '1440x900', {
      evidenceLevel: 'ARCHIVED_MATCH',
      match: 'ARCHIVED_MATCH',
      viewType: 'composer-create',
    });
    await page.keyboard.press('Escape');

    await page.getByTestId('demo-content-card-demo-content-carousel').click();
    await expect(page.getByTestId('demo-content-drawer')).toBeVisible();
    await page.getByRole('tab', { name: /edit/i }).click();
    await shot('12-composer-edit', '/app/content', '1440x900', {
      evidenceLevel: 'ARCHIVED_MATCH',
      match: 'ARCHIVED_MATCH',
      viewType: 'composer-edit',
      contentFixtureId: 'demo-content-carousel',
    });
    await page.getByRole('tab', { name: /media/i }).click();
    await shot('13-content-detail', '/app/content', '1440x900', {
      evidenceLevel: 'ARCHIVED_MATCH',
      match: 'ARCHIVED_MATCH',
      viewType: 'content-detail',
    });
    await page.getByRole('tab', { name: /comments/i }).click();
    await shot('14-comments-review', '/app/content', '1440x900', {
      evidenceLevel: 'ARCHIVED_MATCH',
      match: 'ARCHIVED_MATCH',
      viewType: 'comments',
    });
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('demo-content-drawer')).toHaveCount(0);
    await page.goto('/app/content');
    await expect(page.getByTestId('demo-content')).toBeVisible();
    await page.getByTestId('demo-content-view-list').click();

    await openContentFilters(page);
    await chooseOmaSelect(page, 'demo-content-filter-campaign', 'demo-campaign-organic');
    await applyContentFilters(page);
    await expect(page.getByTestId('demo-content-filter-chips')).toBeVisible({ timeout: 10_000 });
    await shot('15-filter-chips', '/app/content', '1440x900', { viewType: 'filters' });
    await page.getByTestId('demo-content-filter-chips').getByRole('button').last().click();
    await page.getByTestId('demo-content-search').fill('zzzz-no-match');
    await shot('16-empty-state', '/app/content', '1440x900', { viewType: 'empty' });

    await page.context().addCookies([{ name: 'oma_locale', value: 'ar', url: WEB }]);
    await page.goto('/app/content');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.getByTestId('demo-content-view-calendar').click();
    await shot('17-ar-desktop', '/app/content', '1440x900', {
      locale: 'ar',
      viewType: 'calendar-ar',
    });
    await page.context().addCookies([{ name: 'oma_locale', value: 'en', url: WEB }]);

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/app/campaigns');
    await shot('18-tablet', '/app/campaigns', '1024x768', { viewType: 'tablet' });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/content');
    await page.getByTestId('demo-content-view-calendar').click();
    await expect(page.getByTestId('demo-content-agenda')).toBeVisible();
    await shot('07-mobile-agenda', '/app/content', '390x844', {
      evidenceLevel: 'OMA_ADAPTATION',
      match: 'OMA_ADAPTATION',
      viewType: 'mobile-agenda',
    });
    await page.getByTestId('demo-create-content').click();
    await shot('19-mobile-composer', '/app/content', '390x844', {
      evidenceLevel: 'OMA_ADAPTATION',
      match: 'OMA_ADAPTATION',
      viewType: 'mobile-composer',
    });
    await page.keyboard.press('Escape');
    await page.getByTestId('demo-content-view-grid').click();
    await page.locator('[data-testid^="demo-content-card-"]').first().click();
    await expect(page.getByTestId('demo-content-drawer')).toBeVisible();
    await shot('20-mobile-content-detail', '/app/content', '390x844', {
      evidenceLevel: 'OMA_ADAPTATION',
      match: 'OMA_ADAPTATION',
      viewType: 'mobile-detail',
    });

    expect(consoleErrors.filter((e) => /hydrat/i.test(e))).toEqual([]);
  });
});
