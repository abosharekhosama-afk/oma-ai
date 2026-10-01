import { expect, test, type Page } from '@playwright/test';
import { installOwnerSession } from './helpers/brand-ui';
import { switchContentView } from './helpers/content-view';

type IntegrityReport = {
  brokenImages: string[];
  overlaps: number;
  clippedSurfaces: number;
  overflow: boolean;
  nextDevOverlay: boolean;
  surfaceSample: Array<{ className: string; height: number }>;
};

async function integrity(page: Page, selectors: string): Promise<IntegrityReport> {
  return page.evaluate((sels) => {
    const brokenImages = [...document.images]
      .filter((img) => img.complete && (img.naturalWidth === 0 || img.naturalHeight === 0))
      .map((img) => img.currentSrc || img.src);

    const surfaces = [...document.querySelectorAll(sels)];
    const rects = surfaces.map((el) => ({
      el,
      r: el.getBoundingClientRect(),
      className: String((el as HTMLElement).className),
    }));
    let overlaps = 0;
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i]!.r;
        const b = rects[j]!.r;
        const ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const oy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (ox > 4 && oy > 4) overlaps += 1;
      }
    }

    const clippedSurfaces = rects.filter(({ el, r, className }) => {
      const hasMedia = Boolean(el.querySelector('img, .oma-content-card-media, .oma-post-card'));
      const multiChild = el.children.length >= 2;
      const surface = /card|row|feed|item|pill/i.test(className) && (hasMedia || multiChild);
      return surface && r.height > 0 && r.height <= 36;
    }).length;

    const root = document.documentElement;
    return {
      brokenImages,
      overlaps,
      clippedSurfaces,
      overflow: root.scrollWidth > root.clientWidth + 1,
      nextDevOverlay: Boolean(
        document.querySelector('nextjs-portal') || document.getElementById('__next-build-watcher'),
      ),
      surfaceSample: rects.slice(0, 6).map(({ className, r }) => ({
        className: className
          .replace(/css-[^\s]+/g, '')
          .trim()
          .slice(0, 80),
        height: Math.round(r.height),
      })),
    };
  }, selectors);
}

async function openContentView(page: Page, mode: 'grid' | 'list' | 'feed' | 'calendar') {
  await switchContentView(page, mode);
  await expect(page.getByTestId(`demo-content-view-current-${mode}`)).toBeVisible();
  await page.waitForTimeout(300);
}

test.describe('Planable rendered visual integrity', () => {
  test('content surfaces do not clip, overlap, or break media', async ({ page }, info) => {
    test.skip(info.project.name !== 'en-desktop', 'integrity probe runs once on en-desktop');

    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await installOwnerSession(page, page.request);
    await page.goto('/app/content');
    await expect(page.getByTestId('demo-content-filters')).toBeVisible({ timeout: 20_000 });

    for (const mode of ['grid', 'list', 'feed'] as const) {
      await openContentView(page, mode);
      const report = await integrity(
        page,
        '.oma-content-card-stage3, .oma-content-list-row, .oma-content-feed-item, .oma-cal-item',
      );
      expect(report.brokenImages, `${mode} broken images`).toEqual([]);
      expect(report.overlaps, `${mode} overlaps`).toBe(0);
      expect(report.clippedSurfaces, `${mode} clipped surfaces`).toBe(0);
      expect(report.overflow, `${mode} overflow`).toBe(false);
      if (mode === 'grid') {
        expect(
          report.surfaceSample.some((s) => s.height > 120),
          'grid cards taller than control',
        ).toBe(true);
      }
      if (mode === 'list') {
        expect(
          report.surfaceSample.some((s) => s.height > 40),
          'list rows taller than control',
        ).toBe(true);
      }
    }

    await openContentView(page, 'calendar');
    const cal = await integrity(page, '.oma-cal-item, .oma-post-card--calendar');
    expect(cal.brokenImages, 'calendar broken images').toEqual([]);
    expect(cal.clippedSurfaces, 'calendar clipped surfaces').toBe(0);

    const critical = consoleErrors.filter(
      (text) =>
        /hydration|did not match|unique "key" prop|Minified React error/i.test(text) &&
        !/Failed to load resource/i.test(text),
    );
    expect(critical, critical.join('\n')).toEqual([]);
  });

  test('schedule and reviews keep multi-line surfaces readable', async ({ page }, info) => {
    test.skip(info.project.name !== 'en-desktop', 'integrity probe runs once on en-desktop');
    await installOwnerSession(page, page.request);

    await page.goto('/app/schedule');
    await expect(page.getByTestId('demo-schedule')).toBeVisible({ timeout: 20_000 });
    const schedule = await integrity(page, '.oma-sched-pill, .oma-sched-card');
    expect(schedule.brokenImages).toEqual([]);
    expect(schedule.clippedSurfaces).toBe(0);
    expect(schedule.overflow).toBe(false);

    await page.goto('/app/reviews');
    await expect(page.getByTestId('demo-review-tabs')).toBeVisible({ timeout: 20_000 });
    const reviews = await integrity(page, '.oma-review-queue-card, .oma-review-tabs .ant-btn');
    expect(reviews.overflow).toBe(false);
    expect(reviews.brokenImages).toEqual([]);
  });
});
