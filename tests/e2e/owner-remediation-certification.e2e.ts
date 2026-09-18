/**
 * Independent certification of owner-rejection remediation.
 * Videos recorded via Playwright; copied to artifacts after run.
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { installOwnerSession } from './helpers/brand-ui';

const OUT = path.join(process.cwd(), 'artifacts/owner-remediation-certification-004');
const SHOTS = path.join(OUT, 'screenshots');
const VIDS = path.join(OUT, 'videos');
const META = path.join(
  process.cwd(),
  '.reference/004-visual-parity/ours/owner-remediation-certification',
);

const BLOCKED =
  /facebook\.com|graph\.facebook|meta\.com|tiktok\.com|googleapis\.com|openai\.com|anthropic\.com|semrush\.com|smartly\.io|workdrive|zoho\.com/i;

function attachGuards(page: Page) {
  const consoleErrors: string[] = [];
  const blocked: string[] = [];
  const failed: string[] = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('request', (r) => {
    if (BLOCKED.test(r.url())) blocked.push(r.url());
  });
  page.on('requestfailed', (r) => failed.push(r.url()));
  return {
    consoleErrors,
    blocked,
    failed,
    assertClean() {
      expect(blocked).toEqual([]);
      expect(
        consoleErrors.filter(
          (e) =>
            !/favicon|React DevTools|Download the React|401 \(Unauthorized\)|404 \(Not Found\)|Failed to load resource.*401|Failed to load resource.*404/i.test(
              e,
            ),
        ),
      ).toEqual([]);
    },
  };
}

async function dragCardToColumn(page: Page, taskId: string, columnId: string) {
  await page.getByTestId('demo-tasks-board').evaluate((el) => {
    el.scrollLeft = 0;
  });
  const source = page.getByTestId(`demo-task-card-${taskId}`);
  const target = page.getByTestId(`demo-kanban-${columnId}`);
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const s = await source.boundingBox();
  const t = await target.boundingBox();
  if (!s || !t) throw new Error('drag boxes missing');
  await page.mouse.move(s.x + 20, s.y + 16);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2, t.y + 56, { steps: 16 });
  await page.mouse.up();
}

async function assertFont(page: Page, expectFamily: RegExp) {
  const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(family.toLowerCase()).toMatch(expectFamily);
  return family;
}

const VIDEO_NAMES: Record<string, string> = {
  '01 shell navigation + command menu + typography EN': '01-shell-navigation-and-command-menu.webm',
  '02 kanban discover DnD persist reload': '02-kanban-drag-persist-reload.webm',
  '03 content calendar + drawer composer': '03-content-calendar-and-drawer.webm',
  '04 request brief task handoff': '04-request-brief-task-handoff.webm',
  '05 review version annotation decision path': '05-review-version-annotation-decision.webm',
  '06 mobile navigation + kanban + AR fonts': '06-mobile-navigation-kanban.webm',
};

test.use({
  // Videos already archived under artifacts/; enable locally with OMA_CERT_VIDEO=1.
  video:
    process.env.OMA_CERT_VIDEO === '1' ? { mode: 'on', size: { width: 1440, height: 900 } } : 'off',
});

test.describe('Owner remediation certification', () => {
  test.describe.configure({ mode: 'serial' });
  // Pre-DEC-017 remediation pack retained for regression anchors.
  // Active Planable full certification: planable-p7-certification.e2e.ts

  test.afterEach(async ({ page }, testInfo) => {
    if (process.env.OMA_CERT_VIDEO !== '1') return;
    const destName = VIDEO_NAMES[testInfo.title];
    if (!destName) return;
    if (testInfo.status !== 'passed' && testInfo.status !== 'skipped') return;
    const video = page.video();
    await page.close();
    if (!video) return;
    try {
      fs.mkdirSync(VIDS, { recursive: true });
      fs.mkdirSync(META, { recursive: true });
      const dest = path.join(VIDS, destName);
      await video.saveAs(dest);
      fs.writeFileSync(
        path.join(META, `${destName}.json`),
        JSON.stringify(
          {
            gitSha: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
            video: destName,
            test: testInfo.title,
            project: testInfo.project.name,
            status: testInfo.status,
            bytes: fs.statSync(dest).size,
          },
          null,
          2,
        ),
      );
    } catch {
      /* ignore if video unavailable */
    }
  });

  test('01 shell navigation + command menu + typography EN', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'cert primary');
    fs.mkdirSync(SHOTS, { recursive: true });
    fs.mkdirSync(VIDS, { recursive: true });
    fs.mkdirSync(META, { recursive: true });
    const guards = attachGuards(page);
    const owner = await installOwnerSession(page, request);
    await page.setViewportSize({ width: 1440, height: 900 });

    // Login surface font (already authenticated session; visit login after sign-out later optional)
    await page.goto('/app');
    await expect(page.getByTestId('product-home')).toBeVisible({ timeout: 20_000 });
    const font = await assertFont(page, /system-ui|segoe ui|-apple-system|roboto/);
    await expect(page.getByTestId('demo-command-center')).toBeVisible();
    await expect(page.getByTestId('home-overdue-tasks-board')).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, '01-command-center.png'), fullPage: false });

    const nav = page.getByRole('navigation', { name: /main navigation/i });
    for (const name of [
      /home/i,
      /brand intelligence/i,
      /campaigns/i,
      /content plan/i,
      /requests/i,
      /tasks board/i,
      /deliverables/i,
      /^reviews$/i,
      /schedule/i,
      /analytics/i,
      /team/i,
      /activity/i,
      /^company$/i,
      /settings/i,
    ]) {
      await expect(nav.getByRole('link', { name })).toBeVisible();
    }

    await page.keyboard.press('Meta+k');
    await expect(page.locator('#oma-command-input')).toBeVisible();
    await page.locator('#oma-command-input').fill('kanban');
    await page
      .locator('.oma-command-results')
      .getByRole('button', { name: /tasks board/i })
      .first()
      .click({ force: true });
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 15_000 });

    fs.writeFileSync(
      path.join(META, '01-command-center.json'),
      JSON.stringify(
        {
          gitSha: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
          route: '/app',
          viewport: { width: 1440, height: 900 },
          locale: 'en',
          computedFontFamily: font,
          surfaceArchetype: 'action-workboard',
          evidenceLevel: 'ARCHIVED+DOC',
          interaction: 'shell-nav+command-kanban',
          consoleErrors: guards.consoleErrors.length,
          failedRequests: guards.failed.length,
          externalHosts: guards.blocked.length,
          acceptanceIds: ['V-HOME-01', 'V-SHELL-02', 'V-TSK-01'],
        },
        null,
        2,
      ),
    );
    guards.assertClean();
    void owner;
  });

  test('02 kanban discover DnD persist reload', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'cert primary');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/app');
    await page
      .getByRole('navigation', { name: /main navigation/i })
      .getByRole('link', { name: /tasks board/i })
      .click();
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('demo-tasks-view-board')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('demo-tasks-view-list')).toBeVisible();

    await page.screenshot({ path: path.join(SHOTS, '08-kanban-default.png'), fullPage: false });

    await dragCardToColumn(page, 'demo-task-ready-1', 'IN_PROGRESS');
    await expect(
      page.getByTestId('demo-kanban-IN_PROGRESS').getByTestId('demo-task-card-demo-task-ready-1'),
    ).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(SHOTS, '09-kanban-drag-state.png'), fullPage: false });

    await page.reload();
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByTestId('demo-kanban-IN_PROGRESS').getByTestId('demo-task-card-demo-task-ready-1'),
    ).toBeVisible();

    // keyboard/a11y select alternative
    await page.getByTestId('demo-task-move-demo-task-ready-1').selectOption('READY');
    await expect(
      page.getByTestId('demo-kanban-READY').getByTestId('demo-task-card-demo-task-ready-1'),
    ).toBeVisible({ timeout: 15_000 });

    // invalid transition
    await dragCardToColumn(page, 'demo-task-done-archive', 'IN_PROGRESS');
    await expect(page.getByText(/invalid task status move/i)).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('demo-task-open-demo-task-design').click();
    await expect(page.getByTestId('demo-task-drawer')).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, '10-task-drawer.png'), fullPage: false });
    await page.keyboard.press('Escape');

    guards.assertClean();
  });

  test('03 content calendar + drawer composer', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'cert primary');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await page
      .getByRole('navigation', { name: /main navigation/i })
      .getByRole('link', { name: /content plan/i })
      .click();
    await expect(page.getByTestId('demo-content')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(SHOTS, '05-content-calendar.png'), fullPage: false });
    await page.getByTestId('demo-content-view-grid').click();
    await expect(page.getByTestId('demo-content-grid')).toBeVisible({ timeout: 10_000 });
    const contentCard = page.getByTestId('demo-content-card-demo-content-carousel');
    await expect(contentCard).toBeVisible({ timeout: 15_000 });
    await contentCard.click();
    await expect(page.getByTestId('demo-content-drawer')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('demo-content-composer')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('demo-content-composer-preview')).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, '05b-content-composer.png'), fullPage: false });
    await page.keyboard.press('Escape');
    guards.assertClean();
  });

  test('04 request brief task handoff', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'cert primary');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await page
      .getByRole('navigation', { name: /main navigation/i })
      .getByRole('link', { name: /^requests$/i })
      .click();
    await expect(page.getByTestId('demo-requests')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(SHOTS, '06-requests-triage.png'), fullPage: false });
    await page
      .getByRole('link', { name: /autumn lookbook|lookbook assets/i })
      .first()
      .click();
    await expect(page.getByTestId('demo-request-detail')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('demo-structured-brief')).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, '07-structured-brief.png'), fullPage: false });
    guards.assertClean();
  });

  test('05 review version annotation decision path', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'cert primary');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await page
      .getByRole('navigation', { name: /main navigation/i })
      .getByRole('link', { name: /deliverables/i })
      .click();
    await expect(page.getByTestId('demo-deliv-grid')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(SHOTS, '11-deliverables-grid.png'), fullPage: false });
    await page
      .getByRole('navigation', { name: /main navigation/i })
      .getByRole('link', { name: /^reviews$/i })
      .click();
    await expect(page.getByTestId('demo-review-queue')).toBeVisible({ timeout: 15_000 });
    await page.locator('.oma-review-queue-card').first().click();
    await expect(page.getByTestId('demo-review-workspace')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('demo-version-rail')).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, '12-dark-review.png'), fullPage: false });
    guards.assertClean();
  });

  test('06 mobile navigation + kanban + AR fonts', async ({ page, request }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'en-mobile' && testInfo.project.name !== 'en-desktop',
      'mobile sample',
    );
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    if (testInfo.project.name === 'en-desktop') {
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.goto('/app/tasks');
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 20_000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    );
    expect(overflow).toBe(false);
    await page.screenshot({ path: path.join(SHOTS, '18-mobile-kanban.png'), fullPage: false });

    // Arabic desktop fonts
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.context().addCookies([
      {
        name: 'oma_locale',
        value: 'ar',
        url: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000',
      },
    ]);
    await page.goto('/app/tasks');
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 20_000 });
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');
    const arFont = await assertFont(page, /noto|arabic/);
    await page.screenshot({ path: path.join(SHOTS, '17-ar-desktop-kanban.png'), fullPage: false });
    fs.writeFileSync(
      path.join(META, '17-ar-desktop-kanban.json'),
      JSON.stringify(
        {
          computedFontFamily: arFont,
          locale: 'ar',
          dir,
          acceptanceIds: ['V-TSK-01', 'i18n-AR'],
        },
        null,
        2,
      ),
    );

    // reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/app/campaigns');
    await expect(page.getByTestId('demo-campaign-portfolio')).toBeVisible({ timeout: 15_000 });

    guards.assertClean();
  });

  test('07 surface differentiation + lifecycle anchors', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'cert primary');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await page.setViewportSize({ width: 1440, height: 900 });

    const checks: Array<{ href: string; testid: string; marker: string; shot: string }> = [
      {
        href: '/app/campaigns',
        testid: 'demo-campaign-portfolio',
        marker: 'oma-campaign-portfolio',
        shot: '04-campaign-portfolio.png',
      },
      {
        href: '/app/analytics',
        testid: 'demo-analytics-trend',
        marker: 'oma-analytics-primary',
        shot: '14-analytics.png',
      },
      {
        href: '/app/schedule',
        testid: 'demo-schedule',
        marker: 'demo-schedule',
        shot: '13-schedule.png',
      },
      {
        href: '/app/team',
        testid: 'demo-team',
        marker: 'oma-workload-bar',
        shot: '15-team-workload.png',
      },
      {
        href: '/app/settings',
        testid: 'demo-settings',
        marker: 'oma-settings-layout',
        shot: '16-settings.png',
      },
      {
        href: '/app/activity',
        testid: 'demo-activity',
        marker: 'demo-activity',
        shot: '15b-activity.png',
      },
    ];

    for (const c of checks) {
      await page.goto(c.href);
      await expect(page.getByTestId(c.testid)).toBeVisible({ timeout: 20_000 });
      if (c.marker.startsWith('oma-') || c.marker.startsWith('demo-')) {
        await expect(
          page.locator(`.${c.marker}, [data-testid="${c.marker}"]`).first(),
        ).toBeVisible();
      }
      await page.screenshot({ path: path.join(SHOTS, c.shot), fullPage: false });
    }

    // Brand portfolio discoverability (empty-state still proves IA entry)
    await page
      .getByRole('navigation', { name: /main navigation/i })
      .getByRole('link', { name: /brand intelligence/i })
      .click();
    await expect(page.getByTestId('brand-portfolio')).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(SHOTS, '02-brand-portfolio.png'), fullPage: false });

    // Strategy handoff: Campaign detail exposes linked strategy (href + navigation when available)
    await page
      .getByRole('navigation', { name: /main navigation/i })
      .getByRole('link', { name: /campaigns/i })
      .click();
    await expect(page.getByTestId('demo-campaign-portfolio')).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole('link', { name: /Summer Organic Always-On/i })
      .first()
      .click();
    await expect(page.getByTestId('demo-campaign-detail')).toBeVisible({ timeout: 15_000 });
    const strategyLink = page.getByTestId('demo-campaign-strategy-link');
    await expect(strategyLink).toHaveAttribute('href', /\/strategies\//);
    await Promise.all([
      page.waitForURL(/\/strategies\//, { timeout: 20_000 }),
      strategyLink.click(),
    ]);
    await expect(page.getByTestId('demo-strategy-document')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(SHOTS, '03-strategy-workspace.png'),
      fullPage: false,
    });

    // Brand create via portfolio CTA when empty — proves BI entry without URL memorization
    await page
      .getByRole('navigation', { name: /main navigation/i })
      .getByRole('link', { name: /brand intelligence/i })
      .click();
    await expect(page.getByTestId('brand-portfolio')).toBeVisible({ timeout: 15_000 });
    const existingBrand = page.locator('a.oma-table-primary[href*="/app/brands/"]').first();
    if (await existingBrand.count()) {
      await existingBrand.click();
    } else {
      await page
        .getByRole('link', { name: /create brand/i })
        .first()
        .click();
      await expect(page.getByRole('heading', { name: /create brand/i })).toBeVisible({
        timeout: 10_000,
      });
      await page.getByLabel(/brand name/i).fill(`Cert Brand ${Date.now().toString().slice(-5)}`);
      await page.getByRole('button', { name: /create brand/i }).click();
      await expect(page).toHaveURL(/\/app\/brands\/[^/]+/, { timeout: 20_000 });
    }
    await expect(page.getByTestId('brand-workspace')).toBeVisible({
      timeout: 15_000,
    });
    await page.screenshot({ path: path.join(SHOTS, '02b-brand-workspace.png'), fullPage: false });

    await page
      .getByRole('navigation', { name: /main navigation/i })
      .locator('a[href="/app/company/members"]')
      .click();
    await expect(page).toHaveURL(/\/app\/company\/members/, { timeout: 20_000 });
    await expect(page.getByTestId('company-members')).toBeVisible({ timeout: 15_000 });

    guards.assertClean();
  });

  test('08 API failure rolls kanban card back', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'cert primary');
    const consoleErrors: string[] = [];
    const blocked: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('request', (r) => {
      if (BLOCKED.test(r.url())) blocked.push(r.url());
    });
    await installOwnerSession(page, request);
    await page.goto('/app/tasks');
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 15_000 });

    await page.route('**/api/v1/demo/tasks/**', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'forced failure' } }),
        });
        return;
      }
      await route.continue();
    });

    await dragCardToColumn(page, 'demo-task-ready-1', 'IN_PROGRESS');
    await expect(
      page.getByTestId('demo-kanban-READY').getByTestId('demo-task-card-demo-task-ready-1'),
    ).toBeVisible({ timeout: 12_000 });
    expect(blocked).toEqual([]);
    expect(
      consoleErrors.filter(
        (e) =>
          !/favicon|React DevTools|500|Failed to load resource|forced failure|demo\/tasks/i.test(e),
      ),
    ).toEqual([]);
  });
});
