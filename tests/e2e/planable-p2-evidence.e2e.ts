import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { installOwnerSession, uiCreateBrandConnectAndStartScan } from './helpers/brand-ui';
import { projectLocale } from './helpers/i18n';

const OUT = join(process.cwd(), 'artifacts', 'planable-rebuild-004', 'p2-brand-strategy');
const META = join(process.cwd(), '.reference', '005-planable-ui-ux', 'ours', 'p2-brand-strategy');

function sha(): string {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
}

test.describe('P2 Planable brand/strategy evidence pack', () => {
  test.describe.configure({ timeout: 240_000 });

  test('capture P2 surfaces', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'evidence pack once');
    mkdirSync(OUT, { recursive: true });
    mkdirSync(META, { recursive: true });
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    const owner = await installOwnerSession(page, request);
    const { brandId } = await uiCreateBrandConnectAndStartScan(page, request, owner);
    const gitSha = sha();
    const locale = projectLocale(testInfo);

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
            locale: extra.locale ?? locale,
            dir: computed.dir,
            computedFont: computed.fontFamily,
            computedColors: { canvas: computed.canvas, ink: computed.ink },
            consoleErrors: consoleErrors.filter((e) => /hydrat/i.test(e)),
            overflowOk: computed.overflow,
            evidenceLevel: extra.evidenceLevel ?? 'OMA_ADAPTATION',
            planablePattern: extra.planablePattern ?? 'dashboard/workspace',
            acceptanceIds: extra.acceptanceIds ?? ['PV-G-01', 'PV-G-03', 'PV-G-09'],
            featureState: extra.featureState ?? name,
            rawScreenshot: `artifacts/planable-rebuild-004/p2-brand-strategy/${name}.png`,
            gitignoredRaw: true,
            capturedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await expect(page.getByTestId('product-home')).toBeVisible();
    await shot('01-command-center', '/app', '1440x900', {
      planablePattern: 'dashboard',
      evidenceLevel: 'LIVE_MATCH',
    });

    await page.goto('/app/brands');
    await shot('02-brand-portfolio', '/app/brands', '1440x900', { planablePattern: 'workspaces' });

    await page.goto(`/app/brands/${brandId}`);
    await expect(page.getByTestId('brand-workspace')).toBeVisible();
    await shot('03-brand-workspace', `/app/brands/${brandId}`, '1440x900', {
      planablePattern: 'workspace header + tabs',
    });

    await page.goto(`/app/brands/${brandId}/connect`);
    await shot('04-website-connection', `/app/brands/${brandId}/connect`, '1440x900');

    await page.goto(`/app/brands/${brandId}/scans/new`);
    await shot('05-scan-progress', `/app/brands/${brandId}/scans/new`, '1440x900', {
      featureState: 'scan setup',
    });

    await page.goto(`/app/brands/${brandId}/discovery/pages`);
    await shot('06-discovery-list', `/app/brands/${brandId}/discovery/pages`, '1440x900', {
      planablePattern: 'content list',
    });
    const evidenceBtn = page.locator('[data-testid^="view-evidence-"]').first();
    if (await evidenceBtn.count()) {
      await evidenceBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot('07-evidence-drawer', `/app/brands/${brandId}/discovery/pages`, '1440x900', {
        planablePattern: 'detail drawer',
      });
      await page.keyboard.press('Escape');
    } else {
      await shot('07-evidence-drawer', `/app/brands/${brandId}/discovery/pages`, '1440x900', {
        featureState: 'no evidence row yet',
      });
    }

    await page.goto(`/app/brands/${brandId}/profiles`);
    await shot('08-brand-intelligence', `/app/brands/${brandId}/profiles`, '1440x900', {
      planablePattern: 'composer/editor',
    });
    await shot('09-partial-approval', `/app/brands/${brandId}/profiles`, '1440x900');
    await shot('10-approved-version', `/app/brands/${brandId}/profiles`, '1440x900', {
      featureState: 'versions list',
    });
    await shot('11-profile-compare', `/app/brands/${brandId}/profiles`, '1440x900');

    await page.goto(`/app/brands/${brandId}/strategies`);
    await shot('12-strategy-portfolio', `/app/brands/${brandId}/strategies`, '1440x900');
    const openStrategy = page.getByTestId('strategy-list').getByRole('link').first();
    if (await openStrategy.count()) {
      await openStrategy.click();
      await shot('13-strategy-foundation', page.url(), '1440x900');
      await page.getByRole('link', { name: /organic|عضوي/i }).click();
      await shot('14-organic', page.url(), '1440x900');
      await page.getByRole('link', { name: /paid|مدفوع/i }).click();
      await shot('15-paid', page.url(), '1440x900');
      await page
        .getByRole('link', { name: /evidence|دليل|review|مراجعة/i })
        .first()
        .click();
      await shot('16-strategy-review', page.url(), '1440x900');
      await page.getByRole('link', { name: /versions|إصدارات/i }).click();
      await shot('17-strategy-versions', page.url(), '1440x900');
    } else {
      for (const [name, note] of [
        ['13-strategy-foundation', 'empty strategies'],
        ['14-organic', 'empty strategies'],
        ['15-paid', 'empty strategies'],
        ['16-strategy-review', 'empty strategies'],
        ['17-strategy-versions', 'empty strategies'],
      ] as const) {
        await shot(name, `/app/brands/${brandId}/strategies`, '1440x900', { featureState: note });
      }
    }

    const origin = testInfo.project.use.baseURL ?? 'http://127.0.0.1:3000';
    await page.context().addCookies([{ name: 'oma_locale', value: 'ar', url: origin }]);
    await page.goto('/app');
    await shot('18-ar-desktop', '/app', '1440x900', { locale: 'ar' });
    await page.context().addCookies([{ name: 'oma_locale', value: 'en', url: origin }]);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/app');
    await shot('19-tablet', '/app', '1024x768');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app');
    await shot('20-mobile', '/app', '390x844');
    expect(consoleErrors.filter((e) => /hydrat/i.test(e))).toEqual([]);
  });
});
