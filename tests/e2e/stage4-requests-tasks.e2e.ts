import { test, expect } from '@playwright/test';
import { chooseOmaSelect } from './helpers/antd-select';
import { installOwnerSession } from './helpers/brand-ui';

const BLOCKED_HOSTS =
  /facebook\.com|graph\.facebook|meta\.com|tiktok\.com|googleapis\.com|openai\.com|anthropic\.com|semrush\.com|smartly\.io|workdrive|zoho\.com/i;

function attachGuards(page: import('@playwright/test').Page) {
  const consoleErrors: string[] = [];
  const blockedRequests: string[] = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('request', (req) => {
    if (BLOCKED_HOSTS.test(req.url())) blockedRequests.push(req.url());
  });
  return {
    assertClean() {
      expect(blockedRequests).toEqual([]);
      expect(
        consoleErrors.filter(
          (e) =>
            !/favicon|React DevTools|Download the React|401 \(Unauthorized\)|404 \(Not Found\)|Failed to load resource.*401|Failed to load resource.*404|500 \(Internal Server Error\)|forced failure|demo\/tasks/i.test(
              e,
            ),
        ),
      ).toEqual([]);
    },
  };
}

test.describe('Stage 4 Requests + Tasks visual rebuild', () => {
  test('requests inbox → create → brief → convert → board move → drawer', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'primary Stage 4 journey');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/app');
    await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^requests$/i })
      .click();
    await expect(page.getByTestId('demo-requests')).toBeVisible();
    await expect(page.getByTestId('demo-request-filters')).toBeVisible();
    await expect(page.getByTestId('demo-request-table')).toBeVisible();

    await page.getByTestId('demo-request-search').fill('autumn');
    await expect(page.getByRole('link', { name: /autumn lookbook/i }).first()).toBeVisible();
    await page.getByTestId('demo-request-clear-filters').click();
    await page.getByTestId('demo-request-group-untriaged').click();
    await expect(page.getByTestId('demo-request-row-demo-request-4')).toBeVisible();
    await page.getByTestId('demo-request-clear-filters').click();

    await page.getByTestId('demo-create-request').click();
    await expect(page.getByTestId('demo-create-request-dialog')).toBeVisible();
    const title = `Stage4 Persist ${Date.now()}`;
    await page.getByTestId('demo-create-request-title-input').fill(title);
    await page.getByTestId('demo-create-request-description').fill('Structured intake for Stage 4');
    await page.getByTestId('demo-create-request-submit').click();
    await expect(page.getByTestId('demo-request-detail')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('demo-request-detail')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await expect(page.getByTestId('demo-structured-brief')).toBeVisible();
    await page.getByTestId('demo-brief-overview').click();
    await page.getByTestId('demo-brief-overview').fill('Overview for production');
    await page.getByTestId('demo-brief-objective').fill('Ship bilingual static set');
    await page.getByTestId('demo-brief-audience').fill('Warm prospects');
    await page.getByTestId('demo-brief-key-message').fill('Quiet craft');
    await page.getByTestId('demo-brief-deliverable').fill('Static set');
    await page.getByTestId('demo-brief-channels').fill('Instagram, TikTok');
    await page.getByTestId('demo-brief-formats').fill('1080x1080');
    await page.getByTestId('demo-brief-tone').fill('Calm');
    await page.getByTestId('demo-brief-mandatory').fill('Logo clear space');
    await page.getByTestId('demo-brief-cta').fill('Shop neutrals');
    await page.getByTestId('demo-brief-acceptance').fill('Client signs off');
    await page.getByTestId('demo-brief-acceptance').blur();
    await page.getByTestId('demo-brief-save').click();
    await expect(page.getByTestId('demo-brief-ready-state')).toContainText(/ready for production/i);
    await page.getByTestId('demo-request-convert').click();
    await expect(page.getByTestId('demo-tasks')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('demo-task-drawer')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('demo-task-drawer')).toHaveCount(0, { timeout: 10_000 });
    await expect(page).not.toHaveURL(/task=/);
    await page.goto('/app/tasks');
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('demo-tasks-board').evaluate((el) => {
      el.scrollLeft = 0;
    });
    const source = page.getByTestId('demo-task-card-demo-task-ready-1');
    const target = page.getByTestId('demo-kanban-IN_PROGRESS');
    await source.scrollIntoViewIfNeeded();
    await target.scrollIntoViewIfNeeded();
    const s = await source.boundingBox();
    const t = await target.boundingBox();
    if (!s || !t) throw new Error('kanban drag boxes missing');
    await page.mouse.move(s.x + 20, s.y + 16);
    await page.mouse.down();
    await page.mouse.move(t.x + t.width / 2, t.y + 56, { steps: 16 });
    await page.mouse.up();
    await expect(
      page.getByTestId('demo-kanban-IN_PROGRESS').getByTestId('demo-task-card-demo-task-ready-1'),
    ).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('demo-task-drawer')).toHaveCount(0);
    await expect(
      page.getByTestId('demo-kanban-IN_PROGRESS').getByTestId('demo-task-card-demo-task-ready-1'),
    ).toBeVisible();
    await expect(page.getByTestId('demo-task-move-demo-task-ready-1')).toHaveValue('IN_PROGRESS');

    await page.getByTestId('demo-tasks-view-list').click();
    await expect(page.getByTestId('demo-tasks-list')).toBeVisible();
    await page.getByTestId('demo-tasks-view-board').click();

    await page.getByTestId('demo-task-open-demo-task-design').click();
    await expect(page.getByTestId('demo-task-drawer')).toBeVisible();
    await page.getByTestId('demo-task-assignee').fill('Rami Khalil');
    await page.getByTestId('demo-task-assignee').blur();
    await chooseOmaSelect(page, 'demo-task-priority', 'URGENT');
    await page.getByTestId('demo-checklist-new').fill('Stage4 checklist item');
    await page.getByTestId('demo-checklist-new').press('Enter');
    await expect(page.getByText('Stage4 checklist item')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('demo-task-comment-input').fill('Stage4 comment');
    await page.getByTestId('demo-task-comment-input').press('Enter');
    await expect(page.getByText('Stage4 comment')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('demo-task-activity')).toBeVisible();

    await page.getByTestId('demo-task-request-link').click();
    await expect(page.getByTestId('demo-request-detail')).toBeVisible();
    await page.getByTestId('demo-request-campaign-link').click();
    await expect(page.getByTestId('demo-campaign-detail')).toBeVisible();

    guards.assertClean();
  });

  test('AR RTL desktop requests/tasks', async ({ page, request, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'ar-desktop', 'AR desktop');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await context.addCookies([
      { name: 'oma_locale', value: 'ar', url: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000' },
    ]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app/requests');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('demo-requests')).toBeVisible();
    await page.goto('/app/tasks');
    await expect(page.getByTestId('demo-tasks')).toBeVisible();
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible();
    guards.assertClean();
  });

  test('tablet 1024 kanban usable', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-tablet', 'tablet');
    await installOwnerSession(page, request);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/app/tasks');
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible();
    await expect(page.getByTestId('demo-kanban-IN_PROGRESS')).toBeVisible();
  });

  test('mobile 390 tasks + drawer', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-mobile', 'mobile');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/tasks');
    await expect(page.getByTestId('demo-tasks')).toBeVisible();
    await page.getByTestId('demo-task-card-demo-task-design').locator('button').click();
    await expect(page.getByTestId('demo-task-drawer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('demo-task-drawer')).toHaveCount(0);
    await page.goto('/app/requests');
    await expect(page.getByTestId('demo-requests')).toBeVisible();
    await expect(page.locator('.oma-req-mobile-card').first()).toBeVisible();
    guards.assertClean();
  });

  test('keyboard drawer/dialog + honesty', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'once');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await page.goto('/app/requests');
    await page.getByTestId('demo-create-request').click();
    await expect(page.getByTestId('demo-create-request-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('demo-create-request-dialog')).toHaveCount(0);
    await page.goto('/app/tasks?task=demo-task-design');
    await expect(page.getByTestId('demo-task-drawer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('demo-task-drawer')).toHaveCount(0);
    await page.goto('/app/requests/demo-request-1');
    await expect(page.getByTestId('demo-brief-ai-honesty')).toBeVisible();
    guards.assertClean();
  });

  test('API failure rolls kanban card back', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'once');
    const guards = attachGuards(page);
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
    const source = page.getByTestId('demo-task-card-demo-task-ready-2');
    const target = page.getByTestId('demo-kanban-IN_PROGRESS');
    await source.scrollIntoViewIfNeeded();
    await target.scrollIntoViewIfNeeded();
    const s = await source.boundingBox();
    const t = await target.boundingBox();
    if (!s || !t) throw new Error('kanban drag boxes missing');
    await page.mouse.move(s.x + 20, s.y + 16);
    await page.mouse.down();
    await page.mouse.move(t.x + t.width / 2, t.y + 56, { steps: 12 });
    await page.mouse.up();
    await expect(
      page.getByTestId('demo-kanban-READY').getByTestId('demo-task-card-demo-task-ready-2'),
    ).toBeVisible({ timeout: 12_000 });
    guards.assertClean();
  });

  test('reduced motion keeps board usable', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'once');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installOwnerSession(page, request);
    await page.goto('/app/tasks');
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible();
    await expect(page.getByTestId('demo-kanban-READY')).toBeVisible();
    await page.getByTestId('demo-task-move-demo-task-copy-li').selectOption('IN_PROGRESS');
    await expect(
      page.getByTestId('demo-kanban-IN_PROGRESS').getByTestId('demo-task-card-demo-task-copy-li'),
    ).toBeVisible({ timeout: 12_000 });
  });
});
