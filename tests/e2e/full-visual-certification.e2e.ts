/**
 * Stage 7 — Full Visual Product Certification lifecycle.
 * One linked Owner journey across Foundation + Demo surfaces.
 * Intentional project filter: primary journey on en-desktop only.
 * Shell navigation proves IA; targeted deep links prove record integrity.
 */
import { test, expect } from '@playwright/test';
import { installOwnerSession, uiCreateBrandConnectAndStartScan } from './helpers/brand-ui';

const BLOCKED_HOSTS =
  /facebook\.com|graph\.facebook|meta\.com|tiktok\.com|googleapis\.com|openai\.com|anthropic\.com|semrush\.com|smartly\.io|workdrive|zoho\.com/i;

async function nav(page: import('@playwright/test').Page, name: RegExp, urlHint?: RegExp) {
  await page
    .getByRole('navigation', { name: /main navigation|التنقل الرئيسي/i })
    .getByRole('link', { name })
    .first()
    .click();
  if (urlHint) {
    await expect(page).toHaveURL(urlHint, { timeout: 15_000 });
  }
}

function attachGuards(page: import('@playwright/test').Page) {
  const consoleErrors: string[] = [];
  const blockedRequests: string[] = [];
  const failedInternal: string[] = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('request', (req) => {
    if (BLOCKED_HOSTS.test(req.url())) blockedRequests.push(req.url());
  });
  page.on('response', (res) => {
    const url = res.url();
    if (res.status() >= 500 && /127\.0\.0\.1|localhost/.test(url)) {
      failedInternal.push(`${res.status()} ${url}`);
    }
  });
  return {
    assertClean() {
      expect(blockedRequests, 'external hosts').toEqual([]);
      expect(failedInternal, '5xx internal').toEqual([]);
      expect(
        consoleErrors.filter(
          (e) =>
            !/favicon|React DevTools|Download the React|401 \(Unauthorized\)|404 \(Not Found\)|Failed to load resource.*(401|404)/i.test(
              e,
            ),
        ),
        'console errors',
      ).toEqual([]);
    },
  };
}

test.describe('Full visual product certification', () => {
  test.describe.configure({ timeout: 180_000 });

  test('linked lifecycle Brand→Analytics with review revision + org surfaces', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      true,
      'SUPERSEDED by OWNER_REMEDIATION_CERTIFICATION (owner-remediation-certification.e2e.ts); prior FULL_VISUAL_CERTIFICATION revoked by owner rejection',
    );
    const guards = attachGuards(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    const owner = await installOwnerSession(page, request);

    await expect(page.getByTestId('product-home')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('demo-command-center')).toBeVisible();
    await expect(page.getByTestId('demo-disclosure').first()).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();

    const { brandId } = await uiCreateBrandConnectAndStartScan(page, request, owner);
    await page.goto('/app');
    await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });
    await nav(page, /^Brand Intelligence$|^العلامات|^Brands$/i, /\/app\/brands/);
    await expect(page.getByTestId('brand-portfolio')).toBeVisible({ timeout: 20_000 });
    // Deep links prove Brand/Strategy record integrity after portfolio context.
    await page.goto(`/app/brands/${brandId}`);
    await expect(page.getByTestId('brand-workspace')).toBeVisible();
    await page.goto(`/app/brands/${brandId}/strategies`);
    await expect(page.getByTestId('strategy-create')).toBeVisible();

    await nav(page, /^Campaigns$|^الحملات$/i, /\/app\/campaigns/);
    await expect(page.getByTestId('demo-campaigns')).toBeVisible({ timeout: 20_000 });
    await page
      .getByRole('link', { name: /Summer Organic Always-On/i })
      .first()
      .click();
    await expect(page.getByTestId('demo-campaign-detail')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('demo-strategy-id')).toHaveText(/demo-strategy-q3/);

    await nav(page, /^Content Plan$|^المحتوى|Content$/i, /\/app\/content/);
    await expect(page.getByTestId('demo-content')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /calendar/i }).click();
    await expect(
      page.getByText(/Fabric story carousel|Studio morning reel/i).first(),
    ).toBeVisible();

    await nav(page, /^Requests$|^الطلبات$/i, /\/app\/requests/);
    await expect(page.getByTestId('demo-requests')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('link', { name: /autumn lookbook/i }).click();
    await expect(page.getByTestId('demo-request-detail')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Launch autumn palette|objective|audience/i).first()).toBeVisible();

    await nav(page, /Tasks board|^Tasks$|^المهام$/i, /\/app\/tasks/);
    await expect(page.getByTestId('demo-tasks')).toBeVisible({ timeout: 20_000 });
    await page.goto('/app/tasks?task=demo-task-design');
    await expect(page.getByTestId('demo-task-drawer')).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');

    await nav(page, /^Deliverables$|^المخرجات$/i, /\/app\/deliverables/);
    await expect(page.getByTestId('demo-deliverables')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('demo-deliv-group-needs_review').click();
    await page.getByTestId('demo-deliv-row-demo-deliv-carousel').getByRole('link').click();
    await expect(page.getByTestId('demo-deliverable-detail')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('demo-open-review').click();
    await expect(page.getByTestId('demo-review-workspace')).toBeVisible();
    await expect(page.getByTestId('demo-media-canvas')).toBeVisible();

    const canvas = page.getByTestId('demo-media-canvas');
    await canvas.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('demo-annotation-draft')).toBeVisible();
    await page.getByTestId('demo-annotation-body').fill('Cert pin: CTA contrast');
    await page.getByTestId('demo-annotation-save').click();
    await expect(page.getByTestId('demo-review-comments')).toContainText(/Cert pin/i);

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
    await page.getByTestId('demo-submit-review').click();
    await expect(page.getByText(/AWAITING_REVIEW/i).first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('demo-decide-approve').click();
    await page.getByTestId('demo-decision-confirm').click();
    await expect(page.getByText(/APPROVED/i).first()).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByText(/APPROVED/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('demo-approved-version')).toBeVisible();

    await nav(page, /^Schedule$|^الجدول$/i, /\/app\/schedule/);
    await expect(page.getByTestId('demo-schedule')).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(/not connected|publishing|Planning preview/i).first(),
    ).toBeVisible();
    await page.getByTestId('demo-schedule-view-agenda').click();
    const schedCard = page.locator('[data-testid^="demo-sched-card-"]').first();
    await schedCard.getByRole('button').first().click();
    await expect(page.getByTestId('demo-schedule-drawer')).toBeVisible();
    await page.getByTestId('demo-schedule-reschedule').click();
    await expect(page.getByTestId('demo-schedule-reschedule-dialog')).toBeVisible();
    await page.getByTestId('demo-schedule-planned-at').fill('2026-09-18T10:00');
    await page.getByTestId('demo-schedule-channels').fill('Instagram');
    await page.getByTestId('demo-schedule-save').click();
    await expect(page.getByText(/2026-09-18/i).first()).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByTestId('demo-schedule')).toBeVisible({ timeout: 15_000 });

    await nav(page, /^Analytics$|^التحليلات$/i, /\/app\/analytics/);
    await expect(page.getByTestId('demo-analytics')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('demo-analytics-sample-badge')).toBeVisible();
    await expect(page.getByTestId('demo-analytics-trend-table')).toBeAttached();

    await nav(page, /^Team$|^الفريق$/i, /\/app\/team/);
    await expect(page.getByTestId('demo-team')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('demo-team-members-link')).toBeVisible();

    await nav(page, /^Activity$|^النشاط$/i, /\/app\/activity/);
    await expect(page.getByTestId('demo-activity')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('demo-activity-filter-source').selectOption('DEMO');
    await expect(page.getByText(/Demonstration|Demo|workflow/i).first()).toBeVisible();
    await expect(page.getByText(/^Audit Log$/i)).toHaveCount(0);

    await nav(page, /^Settings$|^الإعدادات$/i, /\/app\/settings/);
    await expect(page.getByTestId('demo-settings')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('demo-settings-nav-integrations').click();
    await expect(page.getByTestId('demo-integrations')).toBeVisible();
    await expect(page.getByRole('button', { name: /^connect$/i })).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    await nav(page, /^Company$|^الشركة$/i, /\/app\/company/);
    await expect(page.getByTestId('company-members')).toBeVisible({ timeout: 20_000 });

    // Deep-link integrity: campaign + content still resolve after org surfaces.
    await page.goto('/app/campaigns/demo-campaign-organic');
    await expect(page.getByTestId('demo-campaign-detail')).toBeVisible();
    await page.goto('/app/content');
    await expect(page.getByTestId('demo-content')).toBeVisible();

    guards.assertClean();
  });

  test('responsive RTL tablet mobile sample surfaces', async ({ page, request }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(
      !['ar-desktop', 'en-tablet', 'en-mobile'].includes(project),
      'intentional: viewport/locale matrix projects',
    );
    const guards = attachGuards(page);
    await installOwnerSession(page, request);
    const web = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';

    if (project === 'ar-desktop') {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.context().addCookies([{ name: 'oma_locale', value: 'ar', url: web }]);
      await page.goto('/app', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });
      await nav(page, /Analytics|التحليلات/i, /\/app\/analytics/);
      await expect(page.getByTestId('demo-analytics')).toBeVisible({ timeout: 20_000 });
      await nav(page, /Schedule|الجدول/i, /\/app\/schedule/);
      await expect(page.getByTestId('demo-schedule')).toBeVisible({ timeout: 20_000 });
    } else if (project === 'en-tablet') {
      await page.setViewportSize({ width: 1024, height: 768 });
      await nav(page, /Tasks board|المهام|Tasks/i, /\/app\/tasks/);
      await expect(page.getByTestId('demo-tasks')).toBeVisible({ timeout: 20_000 });
      await nav(page, /^Campaigns$|الحملات/i, /\/app\/campaigns/);
      await expect(page.getByTestId('demo-campaigns')).toBeVisible({ timeout: 20_000 });
    } else {
      await page.setViewportSize({ width: 390, height: 844 });
      const { openPrimaryNavIfNeeded } = await import('./helpers/brand-ui');
      await openPrimaryNavIfNeeded(page);
      await page
        .getByRole('navigation', { name: /main navigation|التنقل الرئيسي/i })
        .getByRole('link', { name: /^Schedule$/i })
        .click();
      await expect(page).toHaveURL(/\/app\/schedule/);
      await expect(page.getByTestId('demo-schedule')).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('demo-schedule-view-agenda').click();
      await openPrimaryNavIfNeeded(page);
      await page
        .getByRole('navigation', { name: /main navigation|التنقل الرئيسي/i })
        .getByRole('link', { name: /Content/i })
        .click();
      await expect(page).toHaveURL(/\/app\/content/);
      await expect(page.getByTestId('demo-content')).toBeVisible({ timeout: 20_000 });
    }

    guards.assertClean();
  });
});
