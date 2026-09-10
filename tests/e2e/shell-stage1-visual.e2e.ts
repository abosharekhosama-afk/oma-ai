import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { installOwnerSession } from './helpers/brand-ui';
import { msg, projectLocale } from './helpers/i18n';

const OUT = join(process.cwd(), 'artifacts', 'visual-parity-004', 'stage1-shell');
const REF = join(process.cwd(), '.reference', '004-visual-parity', 'ours', 'stage1-shell');

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
  const file = `${name}.png`;
  await page.screenshot({ path: join(OUT, file), fullPage: false });
  writeFileSync(
    join(REF, `${name}.json`),
    JSON.stringify(
      {
        name,
        route: meta.route,
        locale: meta.locale,
        viewport: meta.viewport,
        gitSha: sha(),
        capturedAt: new Date().toISOString(),
        path: `artifacts/visual-parity-004/stage1-shell/${file}`,
      },
      null,
      2,
    ),
  );
}

test('Stage 1 visual evidence pack', async ({ page, request }, testInfo) => {
  // Capture once on en-desktop to avoid duplicate AR/tablet/mobile project noise.
  test.skip(testInfo.project.name !== 'en-desktop', 'Evidence pack runs on en-desktop only');

  await installOwnerSession(page, request);
  const gitSha = sha();
  const locale = projectLocale(testInfo);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app');
  await expect(page.locator('.oma-shell')).toBeVisible();
  if ((await page.locator('.oma-shell').getAttribute('data-rail')) === 'collapsed') {
    await page.getByRole('button', { name: msg(testInfo, 'shell.expandNav') }).click();
  }
  await shot(page, 'desktop-expanded', { route: '/app', locale, viewport: '1440x900' });

  await page.getByRole('button', { name: msg(testInfo, 'shell.collapseNav') }).click();
  await shot(page, 'desktop-collapsed', { route: '/app', locale, viewport: '1440x900' });
  await page.getByRole('button', { name: msg(testInfo, 'shell.expandNav') }).click();

  await page.getByRole('button', { name: msg(testInfo, 'shell.search') }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await shot(page, 'modal-command-search', { route: '/app', locale, viewport: '1440x900' });
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: msg(testInfo, 'shell.account') }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await shot(page, 'dropdown-user-menu', { route: '/app', locale, viewport: '1440x900' });
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/app');
  await shot(page, 'tablet-shell', { route: '/app', locale, viewport: '1024x900' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app');
  await page.getByRole('button', { name: msg(testInfo, 'shell.openNav') }).click();
  await expect(page.getByRole('dialog', { name: msg(testInfo, 'nav.primary') })).toBeVisible();
  await shot(page, 'mobile-nav-drawer', { route: '/app', locale, viewport: '390x844' });
  await page.keyboard.press('Escape');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/app');
  await shot(page, 'reduced-motion', { route: '/app', locale, viewport: '390x844' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/campaigns');
  await shot(page, 'surface-loading-or-empty', {
    route: '/app/campaigns',
    locale,
    viewport: '1440x900',
  });

  await page
    .context()
    .addCookies([
      { name: 'oma_locale', value: 'ar', url: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000' },
    ]);
  await page.goto('/app');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await shot(page, 'arabic-rtl-shell', { route: '/app', locale: 'ar', viewport: '1440x900' });

  writeFileSync(
    join(REF, 'manifest.json'),
    JSON.stringify(
      {
        stage: 1,
        gitSha,
        capturedAt: new Date().toISOString(),
        shots: [
          'desktop-expanded',
          'desktop-collapsed',
          'tablet-shell',
          'mobile-nav-drawer',
          'arabic-rtl-shell',
          'modal-command-search',
          'dropdown-user-menu',
          'reduced-motion',
          'surface-loading-or-empty',
        ],
      },
      null,
      2,
    ),
  );
});
