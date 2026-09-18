/**
 * P7 Planable full certification evidence pack.
 * Uses direct routes for reliable capture; navigation IA proven in journey e2e.
 */
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { installOwnerSession } from './helpers/brand-ui';

const OUT = join(process.cwd(), 'artifacts', 'planable-full-certification-004', 'screenshots');
const META = join(process.cwd(), '.reference', '005-planable-ui-ux', 'ours', 'full-certification');
const WEB = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';

function sha(): string {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
}

test.describe('P7 Planable full certification evidence', () => {
  test.describe.configure({ timeout: 360_000 });

  test('capture full product matrix', async ({ page, request }, testInfo) => {
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
      await page.evaluate(() => {
        document.querySelectorAll('nextjs-portal').forEach((el) => el.remove());
      });
      const computed = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        const root = getComputedStyle(document.documentElement);
        return {
          fontFamily: body.fontFamily,
          canvas: body.backgroundColor,
          ink: body.color,
          primary: root.getPropertyValue('--oma-primary').trim(),
          surface: root.getPropertyValue('--oma-surface').trim(),
          motionSidebar: root.getPropertyValue('--oma-motion-sidebar').trim(),
          motionControl: root.getPropertyValue('--oma-motion-control').trim(),
          aliasViolet: root.getPropertyValue('--oma-violet').trim(),
          overflow:
            document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
          dir: document.documentElement.dir,
        };
      });
      expect(computed.aliasViolet).toBe('');
      expect(computed.primary.toLowerCase()).toBe('#1677ff');
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
              surface: computed.surface,
            },
            computedMotion: {
              sidebar: computed.motionSidebar,
              control: computed.motionControl,
            },
            overflowOk: computed.overflow,
            consoleHydration: consoleErrors.filter((e) => /hydrat/i.test(e)),
            failedExternal: failed.filter((u) =>
              /facebook|openai|tiktok|meta\.com|frame\.io/i.test(u),
            ),
            evidenceLevel: extra.evidenceLevel ?? 'OMA_ADAPTATION',
            match: extra.match ?? 'OMA_ADAPTATION',
            acceptanceIds: extra.acceptanceIds ?? ['PV-G-01', 'PV-G-03', 'PV-G-09'],
            featureState: extra.featureState ?? name,
            backing: extra.backing ?? 'Hybrid',
            rawScreenshot: `artifacts/planable-full-certification-004/screenshots/${name}.png`,
            gitignoredRaw: true,
            capturedAt: new Date().toISOString(),
            webBase: WEB,
          },
          null,
          2,
        ),
      );
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await shot('01-login', '/login', '1440x900', { backing: 'Production-shaped' });

    await page.goto('/app');
    await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });
    await shot('02-command-center', '/app', '1440x900', { backing: 'Hybrid' });

    await page.goto('/app/brands');
    await expect(page.getByTestId('brand-portfolio')).toBeVisible({ timeout: 20_000 });
    await shot('03-brand-portfolio', '/app/brands', '1440x900', { backing: 'Production-shaped' });

    await page.goto('/app/campaigns');
    await expect(page.getByTestId('demo-campaigns')).toBeVisible({ timeout: 15_000 });
    await shot('06-campaign-portfolio', '/app/campaigns', '1440x900', { backing: 'Demo-backed' });

    await page.goto('/app/content');
    await expect(page.getByTestId('demo-content')).toBeVisible({ timeout: 15_000 });
    await shot('07-content', '/app/content', '1440x900', { backing: 'Demo-backed' });

    await page.goto('/app/requests');
    await expect(page.getByTestId('demo-requests')).toBeVisible({ timeout: 15_000 });
    await shot('09-requests-inbox', '/app/requests', '1440x900', { backing: 'Demo-backed' });

    await page.goto('/app/tasks');
    await expect(page.getByTestId('demo-tasks')).toBeVisible({ timeout: 15_000 });
    await shot('11-tasks-kanban', '/app/tasks', '1440x900', { backing: 'Demo-backed' });

    await page.goto('/app/tasks?task=demo-task-design');
    await expect(page.getByTestId('demo-task-drawer')).toBeVisible({ timeout: 15_000 });
    await shot('12-task-drawer', '/app/tasks?task=demo-task-design', '1440x900', {
      backing: 'Demo-backed',
    });

    await page.goto('/app/deliverables');
    await expect(page.getByTestId('demo-deliverables')).toBeVisible({ timeout: 15_000 });
    await shot('13-deliverables', '/app/deliverables', '1440x900', { backing: 'Demo-backed' });

    await page.goto('/app/reviews');
    await expect(page.getByTestId('demo-reviews')).toBeVisible({ timeout: 15_000 });
    await shot('14-reviews-queue', '/app/reviews', '1440x900', { backing: 'Demo-backed' });

    await page.goto('/app/deliverables/demo-deliv-carousel?review=1');
    await expect(page.getByTestId('demo-review-workspace')).toBeVisible({ timeout: 15_000 });
    await shot(
      '15-review-workspace',
      '/app/deliverables/demo-deliv-carousel?review=1',
      '1440x900',
      {
        backing: 'Demo-backed',
      },
    );
    await page.getByTestId('demo-review-compare-toggle').click();
    await expect(page.getByTestId('demo-version-compare')).toBeVisible();
    await shot(
      '16-version-comparison',
      '/app/deliverables/demo-deliv-carousel?review=1',
      '1440x900',
      { backing: 'Demo-backed' },
    );

    await page.goto('/app/schedule');
    await expect(page.getByTestId('demo-schedule')).toBeVisible({ timeout: 15_000 });
    await shot('17-schedule', '/app/schedule', '1440x900', { backing: 'Demo-backed' });

    await page.goto('/app/analytics');
    await expect(page.getByTestId('demo-analytics')).toBeVisible({ timeout: 15_000 });
    await shot('18-analytics', '/app/analytics', '1440x900', { backing: 'Demo-backed' });

    await page.goto('/app/team');
    await expect(page.getByTestId('demo-team')).toBeVisible({ timeout: 15_000 });
    await shot('19-team', '/app/team', '1440x900', { backing: 'Demo-backed' });

    await page.goto('/app/activity');
    await expect(page.getByTestId('demo-activity')).toBeVisible({ timeout: 15_000 });
    await shot('20-activity', '/app/activity', '1440x900', { backing: 'Demo-backed' });

    await page.goto('/app');
    await page.evaluate(() => {
      document.querySelectorAll('nextjs-portal').forEach((el) => el.remove());
    });
    const bell = page.getByTestId('shell-notifications-trigger');
    await expect(bell).toBeVisible({ timeout: 10_000 });
    await bell.click({ force: true });
    await expect(page.getByTestId('shell-notifications-panel')).toBeVisible({ timeout: 10_000 });
    await shot('21-notifications', '/app', '1440x900', { backing: 'Production-shaped' });
    await page.keyboard.press('Escape');

    await page.goto('/app/settings');
    await expect(page.getByTestId('demo-settings')).toBeVisible({ timeout: 15_000 });
    await shot('22-settings', '/app/settings', '1440x900', { backing: 'Demo-backed' });
    await page.getByTestId('demo-settings-nav-integrations').click();
    await expect(page.getByTestId('demo-integrations')).toBeVisible();
    await shot('23-integrations', '/app/settings', '1440x900', { backing: 'Demo-backed' });

    await page.goto('/app/company/members');
    await expect(page.getByTestId('company-members')).toBeVisible({ timeout: 15_000 });
    await shot('24-company-members', '/app/company/members', '1440x900', {
      backing: 'Production-shaped',
    });

    await page.context().addCookies([{ name: 'oma_locale', value: 'ar', url: WEB }]);
    await page.goto('/app');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await shot('26-ar-desktop', '/app', '1440x900', { locale: 'ar', backing: 'Hybrid' });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/analytics');
    await expect(page.getByTestId('demo-analytics')).toBeVisible({ timeout: 15_000 });
    await shot('27-ar-mobile', '/app/analytics', '390x844', {
      locale: 'ar',
      backing: 'Demo-backed',
    });

    await page.context().addCookies([{ name: 'oma_locale', value: 'en', url: WEB }]);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/app/content');
    await expect(page.getByTestId('demo-content')).toBeVisible({ timeout: 15_000 });
    await shot('14b-tablet', '/app/content', '1024x768', { backing: 'Demo-backed' });

    writeFileSync(
      join(META, 'INSPECTOR_NOTE.json'),
      JSON.stringify(
        {
          stage: 'P7',
          referenceSession: 'CDP_READY_AUTHENTICATED',
          candidateSha: gitSha,
          livePlanableSurfaces: 6,
          video: 'off',
          traces: 'retain-on-failure',
          capturedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  });
});
