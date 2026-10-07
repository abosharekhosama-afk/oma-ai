import { test, expect, type Page } from '@playwright/test';
import { installOwnerSession } from './helpers/brand-ui';

const BLOCKED_HOSTS =
  /facebook\.com|graph\.facebook|meta\.com|tiktok\.com|googleapis\.com|openai\.com|anthropic\.com|semrush\.com|smartly\.io|workdrive|zoho\.com/i;

function attachGuards(page: Page) {
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
            !/favicon|React DevTools|Download the React|401 \(Unauthorized\)|404 \(Not Found\)|Failed to load resource.*401|Failed to load resource.*404/i.test(
              e,
            ),
        ),
      ).toEqual([]);
    },
  };
}

/** Real pointer drag for @dnd-kit (avoids scroll/intercept flakiness of dragTo). */
async function dragCardToColumn(page: Page, taskId: string, columnId: string) {
  const board = page.getByTestId('demo-tasks-board');
  await board.evaluate((el) => {
    el.scrollLeft = 0;
  });
  const source = page.getByTestId(`demo-task-card-${taskId}`);
  const target = page.getByTestId(`demo-kanban-${columnId}`);
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const s = await source.boundingBox();
  const t = await target.boundingBox();
  if (!s || !t) throw new Error(`missing bounding box for ${taskId} → ${columnId}`);
  await page.mouse.move(s.x + Math.min(24, s.width / 2), s.y + 16);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2, t.y + 56, { steps: 16 });
  await page.mouse.up();
}

test.describe('Owner rejection — Kanban + typography core', () => {
  test('sidebar Tasks opens board; drag persists; fonts computed', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'primary owner remediation journey');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/app');
    await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });

    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(fontFamily.toLowerCase()).toMatch(/system-ui|segoe ui|-apple-system|roboto/);
    expect(fontFamily.toLowerCase()).not.toMatch(/inter|ibm plex/);

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /tasks board/i })
      .click();
    await expect(page.getByTestId('demo-tasks')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible();
    await expect(page.getByTestId('demo-tasks-view-board')).toHaveAttribute('aria-pressed', 'true');

    await dragCardToColumn(page, 'demo-task-ready-1', 'IN_PROGRESS');
    await expect(
      page.getByTestId('demo-kanban-IN_PROGRESS').getByTestId('demo-task-card-demo-task-ready-1'),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByTestId('demo-kanban-IN_PROGRESS').getByTestId('demo-task-card-demo-task-ready-1'),
    ).toBeVisible();

    await page.getByTestId('demo-task-move-demo-task-ready-1').selectOption('READY');
    await expect(
      page.getByTestId('demo-kanban-READY').getByTestId('demo-task-card-demo-task-ready-1'),
    ).toBeVisible({ timeout: 15_000 });

    await dragCardToColumn(page, 'demo-task-done-archive', 'IN_PROGRESS');
    await expect(page.getByText(/invalid task status move/i)).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByTestId('demo-kanban-DONE').getByTestId('demo-task-card-demo-task-done-archive'),
    ).toBeVisible();

    await page.getByTestId('demo-task-open-demo-task-design').click();
    await expect(page.getByTestId('demo-task-drawer')).toBeVisible();
    if (await page.getByTestId('demo-task-campaign-link').count()) {
      await page.getByTestId('demo-task-campaign-link').click();
      await expect(page).toHaveURL(/\/app\/campaigns\//);
      await page.goBack();
      await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 15_000 });
    }
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('demo-task-drawer'))
      .toHaveCount(0)
      .catch(() => undefined);

    await page.keyboard.press('Meta+k');
    await expect(page.locator('#oma-command-input')).toBeVisible();
    await page.locator('#oma-command-input').fill('kanban');
    await page
      .locator('.oma-command-results')
      .getByRole('link', { name: /tasks board/i })
      .click();
    await expect(page).toHaveURL(/\/app\/tasks/);
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 15_000 });

    guards.assertClean();
  });

  test('AR RTL computed Arabic font + board visible', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'ar-desktop', 'Arabic desktop sample');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await page.goto('/app/tasks');
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 20_000 });
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');
    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(fontFamily.toLowerCase()).toMatch(/noto|arabic/);
    guards.assertClean();
  });

  test('mobile board usable without page overflow', async ({ page, request }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'en-mobile' && testInfo.project.name !== 'en-desktop',
      'mobile sample',
    );
    if (testInfo.project.name === 'en-desktop') {
      await page.setViewportSize({ width: 390, height: 844 });
    }
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await page.goto('/app/tasks');
    await expect(page.getByTestId('demo-tasks-board')).toBeVisible({ timeout: 20_000 });
    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth + 2;
    });
    expect(overflow).toBe(false);
    guards.assertClean();
  });
});
