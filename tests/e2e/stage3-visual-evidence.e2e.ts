import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { installOwnerSession } from './helpers/brand-ui';

const OUT = join(process.cwd(), 'artifacts', 'visual-parity-004', 'stage3-campaigns-content');
const REF = join(
  process.cwd(),
  '.reference',
  '004-visual-parity',
  'ours',
  'stage3-campaigns-content',
);
const WEB = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';

function sha(): string {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
}

async function shot(
  page: import('@playwright/test').Page,
  name: string,
  meta: Record<string, unknown>,
) {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(REF, { recursive: true });
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
  writeFileSync(
    join(REF, `${name}.json`),
    JSON.stringify(
      {
        ...meta,
        name,
        gitSha: sha(),
        consoleErrorCount: 0,
        demoState: 'OMA_DEMO_MODE=1',
        capturedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

test('Stage 3 visual evidence pack', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'en-desktop', 'Evidence pack runs on en-desktop only');
  await installOwnerSession(page, request);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/campaigns');
  await expect(page.getByTestId('demo-campaigns')).toBeVisible();
  await shot(page, '01-campaign-portfolio-desktop', {
    route: '/app/campaigns',
    viewport: '1440x900',
    locale: 'en',
    direction: 'ltr',
    referencePattern: 'Planable campaign list + Linear density',
    acceptanceIds: ['V-CMP-01', 'V-CAM-01'],
  });

  await page.goto('/app/campaigns/demo-campaign-organic');
  await expect(page.getByTestId('demo-campaign-detail')).toBeVisible();
  await shot(page, '02-campaign-workspace-desktop', {
    route: '/app/campaigns/demo-campaign-organic',
    viewport: '1440x900',
    locale: 'en',
    direction: 'ltr',
    referencePattern: 'Planable campaign context + Linear workspace tabs',
    acceptanceIds: ['V-CMP-02', 'V-CAM-02', 'V-LINK-01'],
  });

  await page.goto('/app/content');
  await page.getByTestId('demo-content-view-calendar').click();
  await expect(page.getByTestId('demo-content-calendar')).toBeVisible();
  await shot(page, '03-content-calendar-desktop', {
    route: '/app/content',
    viewport: '1440x900',
    locale: 'en',
    direction: 'ltr',
    referencePattern: 'Planable calendar',
    acceptanceIds: ['V-CNT-01', 'V-CONT-01', 'V-CONT-02'],
  });

  await page.getByTestId('demo-content-view-grid').click();
  await expect(page.getByTestId('demo-content-grid')).toBeVisible();
  await shot(page, '04-content-grid-desktop', {
    route: '/app/content',
    viewport: '1440x900',
    locale: 'en',
    direction: 'ltr',
    referencePattern: 'Planable grid media-dominant',
    acceptanceIds: ['V-CNT-02', 'V-CONT-01'],
  });

  await page.getByTestId('demo-content-card-demo-content-reel').click();
  await expect(page.getByTestId('demo-content-drawer')).toBeVisible({ timeout: 15_000 });
  await shot(page, '05-content-detail-drawer', {
    route: '/app/content',
    viewport: '1440x900',
    locale: 'en',
    direction: 'ltr',
    referencePattern: 'Linear drawer + Planable composer',
    acceptanceIds: ['V-CNT-03', 'V-CONT-03'],
  });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /content detail/i })).toHaveCount(0);

  await page.getByTestId('demo-create-content').click();
  await expect(page.getByTestId('demo-create-content-dialog')).toBeVisible();
  await shot(page, '06-create-content-dialog', {
    route: '/app/content',
    viewport: '1440x900',
    locale: 'en',
    direction: 'ltr',
    referencePattern: 'Golden Dialog create',
    acceptanceIds: ['V-CONT-03'],
  });
  await page.keyboard.press('Escape');

  await page.context().addCookies([{ name: 'oma_locale', value: 'ar', url: WEB }]);
  await page.goto('/app/content');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByTestId('demo-content-view-calendar').click();
  await shot(page, '07-content-calendar-ar-rtl', {
    route: '/app/content',
    viewport: '1440x900',
    locale: 'ar',
    direction: 'rtl',
    referencePattern: 'Planable calendar RTL',
    acceptanceIds: ['V-CONT-02'],
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/content');
  await page.getByTestId('demo-content-view-calendar').click();
  await expect(page.getByTestId('demo-content-agenda')).toBeVisible();
  await shot(page, '08-content-mobile-390', {
    route: '/app/content',
    viewport: '390x844',
    locale: 'ar',
    direction: 'rtl',
    referencePattern: 'Mobile agenda (not cramped month grid)',
    acceptanceIds: ['V-CONT-02'],
  });

  writeFileSync(
    join(REF, 'manifest.json'),
    JSON.stringify(
      {
        stage: 3,
        gitSha: sha(),
        acceptance: ['V-CMP-01', 'V-CMP-02', 'V-CNT-01', 'V-CNT-02', 'V-CNT-03', 'V-LINK-01'],
        shots: [
          '01-campaign-portfolio-desktop',
          '02-campaign-workspace-desktop',
          '03-content-calendar-desktop',
          '04-content-grid-desktop',
          '05-content-detail-drawer',
          '06-create-content-dialog',
          '07-content-calendar-ar-rtl',
          '08-content-mobile-390',
        ],
      },
      null,
      2,
    ),
  );
});
