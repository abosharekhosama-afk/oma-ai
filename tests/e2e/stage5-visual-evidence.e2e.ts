import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installOwnerSession } from './helpers/brand-ui';

const OUT = path.join(process.cwd(), 'artifacts/visual-parity-004/stage5-deliverables-reviews');
const META = path.join(
  process.cwd(),
  '.reference/004-visual-parity/ours/stage5-deliverables-reviews',
);
const WEB = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';

async function healthHint(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    try {
      const res = await fetch('/api/health');
      return (await res.text()).slice(0, 40);
    } catch {
      return 'unknown';
    }
  });
}

test.describe('Stage 5 visual evidence', () => {
  test('capture Stage 5 deliverables/reviews surfaces', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'evidence once');
    fs.mkdirSync(OUT, { recursive: true });
    fs.mkdirSync(META, { recursive: true });
    await installOwnerSession(page, request);
    const gitSha = process.env.GIT_SHA ?? 'pending';

    const shots: Array<{
      file: string;
      route: string;
      viewport: { width: number; height: number };
      locale: string;
      dir: string;
      acceptance: string[];
      role?: string;
      deliverableState?: string;
      assetId?: string;
      setup?: () => Promise<void>;
    }> = [
      {
        file: '01-deliverables-portfolio.png',
        route: '/app/deliverables',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-DEL-01'],
      },
      {
        file: '02-review-queue.png',
        route: '/app/reviews',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-REV-01'],
      },
      {
        file: '03-deliverable-detail.png',
        route: '/app/deliverables/demo-deliv-carousel',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-DEL-01', 'V-LINK-03'],
        deliverableState: 'AWAITING_REVIEW / carousel v2',
        assetId: 'stage5-carousel-v2.svg',
      },
      {
        file: '04-dark-review-canvas.png',
        route: '/app/deliverables/demo-deliv-carousel?review=1',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-REV-02'],
        deliverableState: 'review workspace dark canvas',
        assetId: 'stage5-carousel-v2.svg',
      },
      {
        file: '05-annotation-comments.png',
        route: '/app/deliverables/demo-deliv-carousel?review=1',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-REV-03'],
        setup: async () => {
          await expect(page.getByTestId('demo-review-comments')).toBeVisible();
          await page.getByTestId('demo-review-comments').scrollIntoViewIfNeeded();
        },
      },
      {
        file: '06-version-history.png',
        route: '/app/deliverables/demo-deliv-video?review=1',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-VER-01'],
        deliverableState: 'approved v1 + current v3',
        assetId: 'stage5-video-v2.svg',
        setup: async () => {
          await expect(page.getByTestId('demo-version-rail')).toBeVisible();
        },
      },
      {
        file: '07-version-compare.png',
        route: '/app/deliverables/demo-deliv-carousel?review=1&compare=1',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-VER-01'],
        setup: async () => {
          await expect(page.getByTestId('demo-version-compare')).toBeVisible();
        },
      },
      {
        file: '08-request-changes-dialog.png',
        route: '/app/deliverables/demo-deliv-carousel?review=1',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-APR-01'],
        setup: async () => {
          await page.getByTestId('demo-decide-changes').click();
          await expect(page.getByTestId('demo-decision-dialog')).toBeVisible();
        },
      },
      {
        file: '09-approved-immutable-state.png',
        route: '/app/deliverables/demo-deliv-reel',
        viewport: { width: 1440, height: 900 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-APR-01', 'V-VER-01'],
        deliverableState: 'APPROVED immutable reel v1',
        assetId: 'video-poster.svg',
      },
      {
        file: '10-review-ar-rtl.png',
        route: '/app/deliverables/demo-deliv-static?review=1',
        viewport: { width: 1440, height: 900 },
        locale: 'ar',
        dir: 'rtl',
        acceptance: ['V-REV-02', 'V-G-03'],
      },
      {
        file: '11-review-tablet.png',
        route: '/app/deliverables/demo-deliv-carousel?review=1',
        viewport: { width: 1024, height: 768 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-REV-02'],
      },
      {
        file: '12-review-mobile-390.png',
        route: '/app/deliverables/demo-deliv-static?review=1',
        viewport: { width: 390, height: 844 },
        locale: 'en',
        dir: 'ltr',
        acceptance: ['V-REV-02'],
      },
    ];

    for (const shot of shots) {
      const consoleErrors: string[] = [];
      const externalHosts: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('request', (req) => {
        if (/frame\.io|adobe\.com|facebook\.com|openai\.com/i.test(req.url())) {
          externalHosts.push(req.url());
        }
      });
      await page.setViewportSize(shot.viewport);
      if (shot.locale === 'ar') {
        await page.context().addCookies([{ name: 'oma_locale', value: 'ar', url: WEB }]);
      } else {
        await page.context().addCookies([{ name: 'oma_locale', value: 'en', url: WEB }]);
      }
      await page.goto(shot.route, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: '404' })).toHaveCount(0);
      if (shot.route === '/app/deliverables' || shot.route.startsWith('/app/deliverables?')) {
        await expect(page.getByTestId('demo-deliverables')).toBeVisible({ timeout: 20_000 });
      } else if (shot.route.includes('/app/reviews')) {
        await expect(page.getByTestId('demo-reviews')).toBeVisible({ timeout: 20_000 });
      } else if (shot.route.includes('/app/deliverables/')) {
        await expect(page.getByTestId('demo-deliverable-detail')).toBeVisible({ timeout: 20_000 });
      }
      if (shot.setup) await shot.setup();
      const filePath = path.join(OUT, shot.file);
      await page.screenshot({ path: filePath, fullPage: false });
      const meta = {
        gitSha,
        route: shot.route,
        viewport: shot.viewport,
        locale: shot.locale,
        direction: shot.dir,
        role: shot.role ?? 'owner',
        deliverableVersionState: shot.deliverableState ?? 'seed',
        demoAssetIdentifier: shot.assetId ?? 'local /demo/*',
        consoleErrorCount: consoleErrors.filter((e) => !/favicon|401|404|React DevTools/i.test(e))
          .length,
        externalNetworkRequestCount: externalHosts.length,
        evidenceReferencePattern:
          shot.file.includes('compare') || shot.file.includes('version')
            ? 'Frame.io version rail / compare (DOC)'
            : shot.file.includes('review') || shot.file.includes('annotation')
              ? 'Frame.io dark canvas + Planable approval clarity (DOC)'
              : shot.file.includes('queue')
                ? 'Planable My approvals + Linear density (DOC)'
                : 'Workfront production handoff + Planable portfolio (DOC)',
        acceptanceIds: shot.acceptance,
        healthHint: await healthHint(page),
      };
      fs.writeFileSync(
        path.join(META, shot.file.replace('.png', '.json')),
        `${JSON.stringify(meta, null, 2)}\n`,
      );
    }
  });
});
