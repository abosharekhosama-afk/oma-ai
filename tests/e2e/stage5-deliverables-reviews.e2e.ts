import { test, expect } from '@playwright/test';
import { installOwnerSession } from './helpers/brand-ui';

const BLOCKED_HOSTS =
  /facebook\.com|graph\.facebook|meta\.com|tiktok\.com|googleapis\.com|openai\.com|anthropic\.com|semrush\.com|smartly\.io|workdrive|zoho\.com|frame\.io|adobe\.com/i;

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
            !/favicon|React DevTools|Download the React|401 \(Unauthorized\)|404 \(Not Found\)|Failed to load resource.*401|Failed to load resource.*404/i.test(
              e,
            ),
        ),
      ).toEqual([]);
    },
  };
}

test.describe('Stage 5 Deliverables + Reviews visual rebuild', () => {
  test('portfolio → review workspace → annotation → revision → approve', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'primary Stage 5 journey');
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/app');
    await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^deliverables$/i })
      .click();
    await expect(page.getByTestId('demo-deliverables')).toBeVisible();
    await expect(page.getByTestId('demo-deliv-filters')).toBeVisible();
    await expect(page.getByTestId('demo-deliv-grid')).toBeVisible();

    await page.getByTestId('demo-deliv-group-needs_review').click();
    await expect(page.getByTestId('demo-deliv-card-demo-deliv-carousel')).toBeVisible();
    await page.getByTestId('demo-deliv-view-list').click();
    await expect(page.getByTestId('demo-deliv-table')).toBeVisible();
    await page.getByTestId('demo-deliv-view-grid').click();
    await expect(page.getByTestId('demo-deliv-grid')).toBeVisible();
    await page.getByTestId('demo-deliv-view-list').click();
    await page.getByTestId('demo-deliv-row-demo-deliv-carousel').getByRole('link').click();
    await expect(page.getByTestId('demo-deliverable-detail')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Increase CTA contrast|Layla Haddad/i).first()).toBeVisible();

    await page.getByTestId('demo-open-review').click();
    await expect(page.getByTestId('demo-review-workspace')).toBeVisible();
    await expect(page.getByTestId('demo-media-canvas')).toBeVisible();
    await expect(page.getByTestId('demo-version-rail')).toBeVisible();

    await page.getByTestId('demo-version-demo-dv-car-v1').click();
    await expect(page.getByTestId('demo-active-version-label')).toContainText(/v1/i);
    await page.getByTestId('demo-version-demo-dv-car-v2').click();
    await expect(page.getByTestId('demo-active-version-label')).toContainText(/v2/i);

    await page.getByTestId('demo-review-compare-toggle').click();
    await expect(page.getByTestId('demo-version-compare')).toBeVisible();
    await expect(page.getByTestId('demo-compare-a')).toBeVisible();
    await expect(page.getByTestId('demo-compare-b')).toBeVisible();
    await page.getByTestId('demo-review-compare-toggle').click();
    await expect(page.getByTestId('demo-media-canvas')).toBeVisible();
    await expect(page.getByTestId('demo-version-compare')).toHaveCount(0);

    const canvas = page.getByTestId('demo-media-canvas');
    await canvas.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('demo-annotation-draft')).toBeVisible();
    await page.getByTestId('demo-annotation-body').fill('Stage5 pin: raise CTA contrast');
    await page.getByTestId('demo-annotation-save').click();
    await expect(page.getByTestId('demo-review-comments')).toContainText(/Stage5 pin/i);

    await page.getByTestId('demo-general-comment').fill('General note without pin');
    await page.getByTestId('demo-general-comment-submit').click();
    await expect(page.getByTestId('demo-review-comments')).toContainText(/General note/i);

    const resolveBtn = page.locator('[data-testid^="demo-resolve-"]').first();
    await resolveBtn.click();

    await page.getByTestId('demo-decide-changes').click();
    await expect(page.getByTestId('demo-decision-dialog')).toBeVisible();
    await page.getByTestId('demo-decision-reason').fill('Need stronger CTA on slide 2');
    await page.getByTestId('demo-decision-confirm').click();
    await expect(page.getByText(/CHANGES_REQUESTED/i).first()).toBeVisible({ timeout: 15_000 });

    const versionsBefore = await page.locator('[data-testid^="demo-version-"]').count();
    await page.getByTestId('demo-add-revision').click();
    await expect(page.locator('[data-testid^="demo-version-"]')).toHaveCount(versionsBefore + 1, {
      timeout: 15_000,
    });
    await expect(page.getByTestId('demo-version-demo-dv-car-v2')).toBeVisible();

    await page.getByTestId('demo-submit-review').click();
    await expect(page.getByText(/AWAITING_REVIEW/i).first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('demo-decide-approve').click();
    await expect(page.getByTestId('demo-decision-dialog')).toBeVisible();
    await page.getByTestId('demo-decision-confirm').click();
    await expect(page.getByText(/APPROVED/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('demo-approved-version')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('demo-deliverable-detail')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/APPROVED/i).first()).toBeVisible();
    await expect(page.getByTestId('demo-approved-version')).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^reviews$/i })
      .click();
    await expect(page.getByTestId('demo-reviews')).toBeVisible();
    await page.getByTestId('demo-review-tab-waiting').click();
    await page.getByTestId('demo-review-tab-approved').click();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /tasks board/i })
      .click();
    await expect(page.getByTestId('demo-tasks')).toBeVisible({ timeout: 15_000 });
    await page.goto('/app/tasks?task=demo-task-design');
    await expect(page.getByTestId('demo-task-drawer')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('demo-task-deliverable-link').click();
    await expect(page.getByTestId('demo-deliverable-detail')).toBeVisible({ timeout: 15_000 });

    await page.goto('/app/deliverables/demo-deliv-video?review=1');
    await expect(page.getByTestId('demo-review-workspace')).toBeVisible();
    await expect(page.getByTestId('demo-approved-version')).toContainText(/v1/i);

    await page.goto('/app/deliverables/demo-deliv-carousel');
    await expect(page.getByRole('link', { name: /demo-campaign-organic/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /demo-content-carousel/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /demo-request-1/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /demo-task-design/i })).toBeVisible();

    guards.assertClean();
  });

  test('AR RTL + tablet + mobile review + keyboard decision', async ({
    page,
    request,
  }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(
      !['ar-desktop', 'en-tablet', 'en-mobile'].includes(project),
      'responsive/locale Stage 5 coverage',
    );
    const guards = attachGuards(page);
    await installOwnerSession(page, request);

    if (project === 'ar-desktop') {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.context().addCookies([
        {
          name: 'oma_locale',
          value: 'ar',
          url: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000',
        },
      ]);
      await page.goto('/app/deliverables');
      await expect(page.getByTestId('demo-deliverables')).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      // Grid is default after surface-depth; open via grid card or table row.
      if (await page.getByTestId('demo-deliv-grid').count()) {
        await page
          .locator('[data-testid^="demo-deliv-card-"], a[href*="/app/deliverables/"]')
          .first()
          .click();
      } else {
        await page.getByTestId('demo-deliv-row-demo-deliv-static').getByRole('link').click();
      }
      await expect(page.getByTestId('demo-deliverable-detail')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('demo-open-review').click();
      await expect(page.getByTestId('demo-review-workspace')).toBeVisible();
    } else if (project === 'en-tablet') {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/app/reviews');
      await expect(page.getByTestId('demo-reviews')).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('demo-review-tab-waiting').click();
      await page.goto('/app/deliverables/demo-deliv-carousel?review=1');
      await expect(page.getByTestId('demo-review-workspace')).toBeVisible();
    } else {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/app/deliverables/demo-deliv-static?review=1');
      await expect(page.getByTestId('demo-review-workspace')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('demo-media-canvas')).toBeVisible();
      await page.getByTestId('demo-decide-changes').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('demo-decision-dialog')).toBeVisible();
      await page.getByTestId('demo-decision-reason').fill('Mobile keyboard reason');
      await page.getByTestId('demo-decision-confirm').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByText(/CHANGES_REQUESTED/i).first()).toBeVisible({ timeout: 15_000 });
    }

    guards.assertClean();
  });
});
