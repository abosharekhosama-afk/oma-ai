import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { installOwnerSession, uiCreateBrandConnectAndStartScan } from './helpers/brand-ui';

const OUT = join(process.cwd(), 'artifacts', 'visual-parity-004', 'stage2-surfaces');
const REF = join(process.cwd(), '.reference', '004-visual-parity', 'ours', 'stage2-surfaces');

function sha(): string {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
}

async function shot(
  page: import('@playwright/test').Page,
  name: string,
  meta: { route: string; locale: string; viewport: string },
) {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(REF, { recursive: true });
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
  writeFileSync(
    join(REF, `${name}.json`),
    JSON.stringify({ ...meta, name, gitSha: sha(), capturedAt: new Date().toISOString() }, null, 2),
  );
}

test('Stage 2 visual evidence pack', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'en-desktop', 'Evidence pack runs on en-desktop only');
  const owner = await installOwnerSession(page, request);
  const { brandId } = await uiCreateBrandConnectAndStartScan(page, request, owner);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app');
  await shot(page, 'command-center', { route: '/app', locale: 'en', viewport: '1440x900' });

  await page.goto('/app/brands');
  await shot(page, 'brand-portfolio', { route: '/app/brands', locale: 'en', viewport: '1440x900' });

  await page.goto(`/app/brands/${brandId}`);
  await shot(page, 'brand-overview', {
    route: `/app/brands/${brandId}`,
    locale: 'en',
    viewport: '1440x900',
  });

  const scanLink = page.locator('a[href*="/scans/"]').first();
  if (await scanLink.count()) {
    await scanLink.click();
    await shot(page, 'scan-detail', { route: page.url(), locale: 'en', viewport: '1440x900' });
  }

  await page.goto(`/app/brands/${brandId}/discovery/pages`);
  const evidenceBtn = page.locator('[data-testid^="view-evidence-"]').first();
  if (await evidenceBtn.count()) {
    await evidenceBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await shot(page, 'discovery-evidence-drawer', {
      route: `/app/brands/${brandId}/discovery/pages`,
      locale: 'en',
      viewport: '1440x900',
    });
    await page.keyboard.press('Escape');
  } else {
    await shot(page, 'discovery-evidence-drawer', {
      route: `/app/brands/${brandId}/discovery/pages`,
      locale: 'en',
      viewport: '1440x900',
    });
  }

  await page.goto(`/app/brands/${brandId}/profiles`);
  await shot(page, 'brand-intelligence', {
    route: `/app/brands/${brandId}/profiles`,
    locale: 'en',
    viewport: '1440x900',
  });

  await page.goto(`/app/brands/${brandId}/strategies`);
  await shot(page, 'strategy-portfolio', {
    route: `/app/brands/${brandId}/strategies`,
    locale: 'en',
    viewport: '1440x900',
  });

  await page
    .context()
    .addCookies([
      { name: 'oma_locale', value: 'ar', url: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000' },
    ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await shot(page, 'arabic-mobile-command-center', {
    route: '/app',
    locale: 'ar',
    viewport: '390x844',
  });

  writeFileSync(
    join(REF, 'manifest.json'),
    JSON.stringify(
      {
        stage: 2,
        gitSha: sha(),
        shots: [
          'command-center',
          'brand-portfolio',
          'brand-overview',
          'scan-detail',
          'discovery-evidence-drawer',
          'brand-intelligence',
          'strategy-portfolio',
          'arabic-mobile-command-center',
        ],
      },
      null,
      2,
    ),
  );
});
