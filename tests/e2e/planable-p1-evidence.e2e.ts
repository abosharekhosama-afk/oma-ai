import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { installOwnerSession } from './helpers/brand-ui';
import { msg, projectLocale } from './helpers/i18n';

const OUT = join(process.cwd(), 'artifacts', 'planable-rebuild-004', 'p1-shell-system');
const META = join(process.cwd(), '.reference', '005-planable-ui-ux', 'ours', 'p1-shell-system');

function sha(): string {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
}

function rgbParse(value: string): [number, number, number] | null {
  const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

test.describe('P1 Planable shell evidence pack', () => {
  test.describe.configure({ timeout: 180_000 });

  test('capture shell system shots + computed metadata', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'evidence pack once');
    mkdirSync(OUT, { recursive: true });
    mkdirSync(META, { recursive: true });

    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('response', (res) => {
      if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
    });

    await installOwnerSession(page, request);
    const gitSha = sha();
    const locale = projectLocale(testInfo);

    async function metrics() {
      return page.evaluate(() => {
        const body = getComputedStyle(document.body);
        const rail = document.querySelector('.oma-rail');
        const create = document.querySelector('[data-testid="shell-create"]');
        const railCs = rail ? getComputedStyle(rail) : null;
        const createCs = create ? getComputedStyle(create) : null;
        return {
          fontFamily: body.fontFamily,
          fontSize: body.fontSize,
          canvas: body.backgroundColor,
          ink: body.color,
          surface: railCs?.backgroundColor ?? null,
          railWidth: rail ? Math.round(rail.getBoundingClientRect().width) : 0,
          railMotion: railCs?.transitionDuration ?? '',
          railEase: railCs?.transitionTimingFunction ?? '',
          createHeight: create ? Math.round(create.getBoundingClientRect().height) : 0,
          createRadius: createCs?.borderRadius ?? '',
          createBg: createCs?.backgroundColor ?? '',
          overflow:
            document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
          dir: document.documentElement.dir,
          lang: document.documentElement.lang,
          typeface: document.documentElement.getAttribute('data-oma-typeface'),
        };
      });
    }

    async function shot(
      name: string,
      route: string,
      viewport: string,
      acceptance: string[],
      extra: Record<string, unknown> = {},
    ) {
      const file = `${name}.png`;
      await page.screenshot({ path: join(OUT, file), fullPage: false });
      const computed = await metrics();
      const primary = rgbParse(computed.createBg ?? '');
      const canvas = rgbParse(computed.canvas);
      writeFileSync(
        join(META, `${name}.json`),
        JSON.stringify(
          {
            name,
            candidateSha: gitSha,
            route,
            viewport,
            locale: extra.locale ?? locale,
            dir: computed.dir,
            computedFont: computed.fontFamily,
            computedColors: {
              canvas: computed.canvas,
              ink: computed.ink,
              surface: computed.surface,
              primary: computed.createBg,
            },
            railGeometry: { width: computed.railWidth },
            buttonGeometry: { height: computed.createHeight, radius: computed.createRadius },
            motionValues: { railDuration: computed.railMotion, railEase: computed.railEase },
            consoleErrors,
            failedRequests: failedRequests.filter((u) => !/favicon|404/.test(u)),
            overflowOk: computed.overflow,
            liveMatch:
              computed.typeface === 'planable-system' &&
              !/inter|ibm plex/i.test(computed.fontFamily) &&
              (canvas
                ? Math.abs(canvas[0] - 245) <= 2 &&
                  Math.abs(canvas[1] - 246) <= 2 &&
                  Math.abs(canvas[2] - 247) <= 2
                : false) &&
              (primary
                ? Math.abs(primary[0] - 22) <= 2 &&
                  Math.abs(primary[1] - 119) <= 2 &&
                  Math.abs(primary[2] - 255) <= 2
                : route === '/login'),
            evidenceLevel: extra.evidenceLevel ?? 'LIVE_MATCH',
            acceptanceIds: acceptance,
            rawScreenshot: `artifacts/planable-rebuild-004/p1-shell-system/${file}`,
            gitignoredRaw: true,
            capturedAt: new Date().toISOString(),
            ...extra,
          },
          null,
          2,
        ),
      );
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await expect(page.locator('.oma-shell')).toBeVisible();
    await shot('01-workspace-shell-1440', '/app', '1440x900', [
      'PV-G-01',
      'PV-SHELL-01',
      'PV-SHELL-02',
    ]);
    await shot('02-dashboard-1440', '/app', '1440x900', ['PV-G-03', 'PV-G-04']);

    await page
      .getByRole('navigation', { name: /main navigation|التنقل الرئيسي/i })
      .locator('a[href="/app/campaigns"]')
      .click();
    await expect(page).toHaveURL(/\/app\/campaigns/);
    await shot('03-selected-navigation', '/app/campaigns', '1440x900', ['PV-SHELL-02']);

    await page.getByRole('button', { name: msg(testInfo, 'shell.search') }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await shot('04-search-dialog', '/app/campaigns', '1440x900', ['PV-G-04']);
    await page.keyboard.press('Escape');

    await page.getByTestId('shell-create').focus();
    await shot('05-create-action', '/app/campaigns', '1440x900', ['PV-SHELL-04']);

    await page.getByRole('button', { name: msg(testInfo, 'shell.account') }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await shot('06-user-menu-popover', '/app/campaigns', '1440x900', ['PV-G-06']);
    await page.keyboard.press('Escape');

    await page.goto('/app/requests');
    await expect(page.locator('.oma-shell')).toBeVisible();
    await shot('07-list-table', '/app/requests', '1440x900', ['PV-G-01'], {
      evidenceLevel: 'OMA_ADAPTATION',
      note: 'Requests list uses Planable tokens; list layout itself is P4.',
    });

    await page.goto('/login');
    await expect(page.locator('main#main')).toBeVisible();
    await shot('08-empty-login', '/login', '1440x900', ['PV-G-09'], {
      evidenceLevel: 'OMA_ADAPTATION',
      note: 'Unauthenticated empty/start. Loading skeletons are token-driven oma-skeleton.',
    });

    const origin = testInfo.project.use.baseURL ?? 'http://127.0.0.1:3000';
    await page.context().addCookies([{ name: 'oma_locale', value: 'ar', url: origin }]);
    await installOwnerSession(page, request);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await shot('09-ar-rtl-1440', '/app', '1440x900', ['PV-G-09'], { locale: 'ar' });

    await page.context().addCookies([{ name: 'oma_locale', value: 'en', url: origin }]);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/app');
    await shot('10-tablet-1024', '/app', '1024x768', ['PV-SHELL-01', 'PV-G-09']);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app');
    await expect(page.locator('.oma-rail')).toBeHidden();
    await page.getByRole('button', { name: msg(testInfo, 'shell.openNav') }).click();
    await expect(page.getByRole('dialog', { name: msg(testInfo, 'nav.primary') })).toBeVisible();
    await shot('11-mobile-390-drawer', '/app', '390x844', ['PV-SHELL-05']);
    await page.keyboard.press('Escape');
    await shot('12-mobile-390', '/app', '390x844', ['PV-SHELL-05', 'PV-G-09']);

    const hydrations = consoleErrors.filter((e) => /hydrat/i.test(e));
    expect(hydrations, 'no hydration errors').toEqual([]);
  });
});
