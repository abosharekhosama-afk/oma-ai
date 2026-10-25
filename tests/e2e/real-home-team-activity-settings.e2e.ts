import { expect, test } from '@playwright/test';
import { apiGet, apiPatch, apiPost, createBrandFlow, registerBrandOwner } from './helpers/brand-api';

/** Real Home/Team/Activity/Settings surfaces. Set SHOT_DIR for p2b-*.png screenshots. */
const SHOT_DIR = process.env.SHOT_DIR;
if (process.env.PW_CHROME) test.use({ launchOptions: { executablePath: process.env.PW_CHROME } });
const shot = async (page: import('@playwright/test').Page, name: string) => {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/p2b-${name}.png` });
};

test('real home, activity, team, settings (en + ar)', async ({ page, request, baseURL }) => {
  test.setTimeout(300_000);
  const owner = await registerBrandOwner(request);
  const { brandId } = await createBrandFlow(request, owner.cookies);
  const me = await (await apiGet(request, '/api/v1/auth/me', owner.cookies)).json();
  const userId = me.user.id as string;

  // Settings: route exists (was 404 in prod), timezone persists.
  const ws = await apiPatch(request, '/api/v1/workspace/settings', owner.cookies, { timezone: 'Asia/Jerusalem' });
  expect(ws.status()).toBe(200);
  // Labels: flat nameEn/nameAr (what the settings panel sends) is a 201, not a 500.
  const lbl = await apiPost(request, `/api/v1/brands/${brandId}/content-labels`, owner.cookies, {
    nameEn: 'Promo', nameAr: 'عرض', color: '#e11d48',
  });
  expect(lbl.status()).toBeLessThan(300);

  const today = new Date();
  const iso = (d: number) => new Date(today.getTime() + d * 864e5).toISOString();
  const camp = (await (await apiPost(request, `/api/v1/brands/${brandId}/campaigns`, owner.cookies, {
    name: { en: 'Winter Warmers', ar: 'دفء الشتاء' }, track: 'ORGANIC',
    timelineStart: iso(-5).slice(0, 10), timelineEnd: iso(25).slice(0, 10),
  })).json()).data;
  await apiPatch(request, `/api/v1/campaigns/${camp.id}`, owner.cookies, { status: 'ACTIVE' });

  const mk = async (en: string, ar: string, d: number) =>
    (await (await apiPost(request, `/api/v1/brands/${brandId}/content`, owner.cookies, {
      title: { en, ar }, caption: { en, ar }, contentType: 'POST', channel: 'Instagram',
      track: 'ORGANIC', campaignId: camp.id, plannedAt: iso(d),
    })).json()).data as { id: string };
  const p1 = await mk('Cardamom latte is back', 'عاد لاتيه الهيل', 2);
  const p2 = await mk('Loyalty card relaunch', 'إعادة إطلاق بطاقة الولاء', 3);
  await apiPost(request, `/api/v1/content/${p1.id}/request-approval`, owner.cookies, {});
  await apiPost(request, `/api/v1/content/${p1.id}/approve`, owner.cookies, {});
  await apiPost(request, `/api/v1/content/${p1.id}/schedule`, owner.cookies, { scheduledAt: iso(2), timezone: 'Asia/Jerusalem' });
  await apiPost(request, `/api/v1/content/${p2.id}/request-approval`, owner.cookies, {});

  await apiPost(request, `/api/v1/brands/${brandId}/tasks`, owner.cookies, {
    title: { en: 'Design menu board – Abdoun', ar: 'تصميم لوحة القائمة – عبدون' },
    status: 'IN_PROGRESS', priority: 'URGENT', assigneeUserId: userId, dueAt: iso(-1), campaignId: camp.id,
  });
  await apiPost(request, `/api/v1/brands/${brandId}/tasks`, owner.cookies, {
    title: { en: 'Book studio for origin shoot', ar: 'حجز الاستوديو للتصوير' },
    status: 'READY', priority: 'HIGH', assigneeUserId: userId, dueAt: iso(2),
  });

  const home = (await (await apiGet(request, '/api/v1/home', owner.cookies)).json()).data;
  expect(home.counts.overdue_tasks).toBe(1);
  expect(home.counts.content_in_review).toBe(1);
  expect(home.my_tasks.length).toBe(2);
  expect(home.upcoming_schedule.length).toBe(1);
  expect(home.checklist.find((s: { id: string }) => s.id === 'campaign').done).toBe(true);

  const act = await (await apiGet(request, '/api/v1/activity?limit=50', owner.cookies)).json();
  expect(act.items.length).toBeGreaterThan(3);
  expect(act.items.some((i: { action: string }) => i.action === 'content.approved')).toBe(true);

  // Solo owner: approval outcome lands in the inbox; the request they made does not.
  const notif = await (await apiGet(request, '/api/v1/notifications', owner.cookies)).json();
  const types = (notif.items as Array<{ type: string }>).map((n) => n.type);
  expect(types).toContain('content.approved');
  expect(types).not.toContain('content.approval_requested');

  const host = new URL(baseURL!).hostname;
  for (const loc of ['en', 'ar'] as const) {
    await page.context().clearCookies();
    await page.context().addCookies([
      ...Object.entries(owner.cookies).map(([name, value]) => ({ name, value: String(value), domain: host, path: '/' })),
      { name: 'oma_locale', value: loc, domain: host, path: '/' },
    ]);
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors: string[] = [];
    page.on('response', (r) => {
      if (r.url().includes('/api/v1/demo')) errors.push(r.url());
    });

    await page.goto('/app');
    await expect(page.getByTestId('home-my-tasks')).toContainText(loc === 'ar' ? 'عبدون' : 'Abdoun', { timeout: 30_000 });
    await expect(page.getByTestId('home-upcoming-schedule')).toBeVisible();
    await page.waitForTimeout(800);
    await shot(page, `home-${loc}`);

    await page.goto('/app/activity');
    await expect(page.getByTestId('activity-item').first()).toBeVisible({ timeout: 30_000 });
    await shot(page, `activity-${loc}`);

    await page.goto('/app/team');
    await expect(page.getByTestId('team-permissions').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('team-no-remove').first()).toBeVisible();
    await shot(page, `team-${loc}`);

    await page.goto('/app/settings');
    await expect(page.getByTestId('settings-workspace-timezone')).toHaveValue('Asia/Jerusalem', { timeout: 30_000 });
    await shot(page, `settings-workspace-${loc}`);
    await page.getByTestId('demo-settings-nav-integrations').click();
    await expect(page.getByTestId('settings-integrations-honest')).toBeVisible();
    await shot(page, `settings-integrations-${loc}`);

    await page.goto('/app/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await shot(page, `schedule-${loc}`);

    expect(errors, 'no demo endpoint calls').toEqual([]);
  }
});
