import { expect, test } from '@playwright/test';
import { apiGet, apiPatch, apiPost, createBrandFlow, registerBrandOwner } from './helpers/brand-api';

/**
 * Planable approval policies: REQUIRED blocks Schedule until every approver approved,
 * rejected posts can't be scheduled/published, planned date != schedule.
 * Set SHOT_DIR to also write screenshots (p2a-*.png).
 */
const SHOT_DIR = process.env.SHOT_DIR;
if (process.env.PW_CHROME) test.use({ launchOptions: { executablePath: process.env.PW_CHROME } });
const shot = async (page: import('@playwright/test').Page, name: string) => {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/p2a-${name}.png` });
};

test('approval policy REQUIRED gates scheduling (en + ar)', async ({ page, request, baseURL }) => {
  test.setTimeout(240_000);
  const owner = await registerBrandOwner(request);
  const { brandId } = await createBrandFlow(request, owner.cookies);

  const ws = await apiPatch(request, '/api/v1/workspace/settings', owner.cookies, {
    approval_mode: 'required',
    required_approvers: 2,
    timezone: 'Asia/Jerusalem',
  });
  expect(ws.status()).toBe(200);
  expect((await ws.json()).required_approvers).toBe(2);
  const prefs = await (await apiGet(request, `/api/v1/brands/${brandId}/content-preferences`, owner.cookies)).json();
  expect(prefs.data.approval_policy).toBe('REQUIRED');

  const planned = new Date(Date.now() + 2 * 864e5).toISOString();
  const mk = async (en: string, ar: string) =>
    (
      await (
        await apiPost(request, `/api/v1/brands/${brandId}/content`, owner.cookies, {
          title: { en, ar },
          caption: { en: `${en} caption`, ar: `${ar} — نص` },
          contentType: 'POST',
          channel: 'Instagram',
          track: 'ORGANIC',
          plannedAt: planned,
        })
      ).json()
    ).data as { id: string };

  const a = await mk('Cardamom latte launch', 'إطلاق لاتيه الهيل');
  const b = await mk('Flash sale 70% off', 'تخفيضات ٧٠٪');
  const c = await mk('Planned only – Friday reel', 'مخطط فقط – ريل الجمعة');

  // Planned date alone is not a schedule.
  const cRow = (await (await apiGet(request, `/api/v1/content/${c.id}`, owner.cookies)).json()).data;
  expect(cRow.schedule_state).toBe('UNSCHEDULED');
  expect(cRow.planned_at).toBeTruthy();

  await apiPost(request, `/api/v1/content/${a.id}/request-approval`, owner.cookies, {});
  const ap = await apiPost(request, `/api/v1/content/${a.id}/approve`, owner.cookies, {});
  const aRow = (await ap.json()).data;
  expect(aRow.approval_state).toBe('PARTIALLY_APPROVED');
  expect(aRow.approver_approved).toBe(1);
  expect(aRow.approver_required).toBe(2);
  // Same person can't approve twice.
  expect((await apiPost(request, `/api/v1/content/${a.id}/approve`, owner.cookies, {})).status()).toBe(409);
  const sa = await apiPost(request, `/api/v1/content/${a.id}/schedule`, owner.cookies, { scheduledAt: planned });
  expect(sa.status()).toBe(409);
  expect((await sa.json()).error.code).toBe('SCHEDULE_BLOCKED');

  await apiPost(request, `/api/v1/content/${b.id}/request-approval`, owner.cookies, {});
  await apiPost(request, `/api/v1/content/${b.id}/reject`, owner.cookies, {});
  const sb = await apiPost(request, `/api/v1/content/${b.id}/schedule`, owner.cookies, { scheduledAt: planned });
  expect((await sb.json()).error.code).toBe('CONTENT_REJECTED');
  expect((await apiPost(request, `/api/v1/content/${b.id}/mark-published`, owner.cookies, {})).status()).toBe(409);

  for (const loc of ['en', 'ar'] as const) {
    await page.context().clearCookies();
    const host = new URL(baseURL!).hostname;
    await page.context().addCookies([
      ...Object.entries(owner.cookies).map(([name, value]) => ({ name, value: String(value), domain: host, path: '/' })),
      { name: 'oma_locale', value: loc, domain: host, path: '/' },
    ]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/app/content?view=list&brand=${brandId}&item=${a.id}`);
    await expect(page.getByTestId('content-approval-progress')).toContainText(loc === 'ar' ? '1 من 2' : '1 of 2 approved', { timeout: 30_000 });
    await expect(page.getByTestId('content-publishing-not-connected')).toBeVisible();
    await expect(page.getByTestId('demo-content-schedule')).toBeDisabled();
    await page.waitForTimeout(800);
    await shot(page, `required-progress-${loc}`);

    await page.goto(`/app/content?view=list&brand=${brandId}&item=${b.id}`);
    await expect(page.getByTestId('content-schedule-blocked')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);
    await shot(page, `rejected-blocked-${loc}`);

    await page.goto(`/app/content?brand=${brandId}`);
    await page.waitForLoadState('networkidle');
    await page.getByTestId('workspace-row-menu').click();
    await page.getByRole('menuitem').first().click();
    await page.getByTestId('workspace-settings-panel').getByRole('button', { name: /Approvals|الموافقات/ }).click();
    await expect(page.getByTestId('ws-approvals')).toBeVisible();
    await expect(page.getByTestId('ws-required-approvers')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);
    await shot(page, `settings-approvals-${loc}`);
  }
});
