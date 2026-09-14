import { test, expect } from '@playwright/test';
import { apiPost, createBrandFlow, registerBrandOwner } from './helpers/brand-api';
import { signOutUi } from './helpers/brand-ui';

const BLOCKED_HOSTS =
  /facebook\.com|graph\.facebook|meta\.com|tiktok\.com|googleapis\.com|openai\.com|anthropic\.com|semrush\.com|smartly\.io|workdrive|zoho\.com/i;

const WEB_ORIGIN = process.env.WEB_BASE_URL ?? process.env.WEB_ORIGIN ?? 'http://127.0.0.1:3000';

type Creds = { email: string; password: string };

async function createOwnerCreds(
  request: import('@playwright/test').APIRequestContext,
): Promise<Creds> {
  const owner = await registerBrandOwner(request);
  await createBrandFlow(request, owner.cookies);
  const reset = await apiPost(request, '/api/v1/demo/reset', owner.cookies, {});
  expect(reset.ok(), await reset.text()).toBeTruthy();
  return { email: owner.email, password: owner.password };
}

async function loginUi(page: import('@playwright/test').Page, creds: Creds) {
  await page.goto('/login');
  await page.getByLabel(/email|البريد/i).fill(creds.email);
  await page.getByLabel(/password|كلمة/i).fill(creds.password);
  await page.getByRole('button', { name: /sign in|تسجيل/i }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 30_000 });
}

async function logoutUi(page: import('@playwright/test').Page) {
  await signOutUi(page);
}

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

test.describe('Complete product demo certification', () => {
  test('owner linked journey, approval honesty, refresh and re-login', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'primary journey on en-desktop');
    const guards = attachGuards(page);
    const creds = await createOwnerCreds(request);
    await loginUi(page, creds);

    await expect(page.getByTestId('product-home')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('demo-disclosure').first()).toBeVisible();

    // Command Center next action → deliverable
    await page.getByRole('link', { name: /Review carousel v2/i }).click();
    await expect(page).toHaveURL(/\/app\/deliverables\/demo-deliv-carousel/);
    await expect(page.getByTestId('demo-deliverable-detail')).toBeVisible();
    await expect(page.getByText(/Increase CTA contrast|Layla Haddad/i).first()).toBeVisible();

    // Approve persists via Demo API — reload must keep APPROVED (demo honesty still shown)
    await page.getByTestId('demo-decide-approve').click();
    await expect(page.getByTestId('demo-decision-dialog')).toBeVisible();
    await page.getByTestId('demo-decision-confirm').click();
    await expect(page.getByText('APPROVED').first()).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByTestId('demo-deliverable-detail')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/APPROVED/i).first()).toBeVisible();
    await expect(
      page.getByText(/Demo review|storage not connected|Local demonstration/i).first(),
    ).toBeVisible();

    // Request + brief
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^requests$/i })
      .click();
    await expect(page.getByTestId('demo-requests')).toBeVisible();
    await page.getByRole('link', { name: /autumn lookbook/i }).click();
    await expect(page).toHaveURL(/\/app\/requests\/demo-request-1/);
    await expect(page.getByTestId('demo-request-detail')).toBeVisible();
    await expect(page.getByText(/Launch autumn palette|objective|audience/i).first()).toBeVisible();

    // Tasks kanban + overdue
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /tasks board/i })
      .click();
    await expect(page.getByTestId('demo-tasks')).toBeVisible();
    await expect(page.getByText(/OVERDUE|overdue|photo|retouch/i).first()).toBeVisible();

    // Campaigns organic + paid + strategy id
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^campaigns$/i })
      .click();
    await expect(
      page.getByRole('link', { name: /Summer Organic Always-On/i }).first(),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Back-to-Work Paid Push/i }).first()).toBeVisible();
    await page
      .getByRole('link', { name: /Summer Organic Always-On/i })
      .first()
      .click();
    await expect(page.getByTestId('demo-strategy-id')).toHaveText(/demo-strategy-q3/);
    await page
      .getByRole('navigation', { name: /main navigation/i })
      .getByRole('link', { name: /^campaigns$/i })
      .click();
    await page
      .getByRole('link', { name: /Back-to-Work Paid Push/i })
      .first()
      .click();
    await expect(page.getByTestId('demo-strategy-id')).toHaveText(/demo-strategy-q3/);

    // Content calendar/grid
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /content/i })
      .click();
    await expect(page.getByTestId('demo-content')).toBeVisible();
    await page.getByRole('button', { name: /calendar/i }).click();
    await expect(
      page.getByText(/Fabric story carousel|Studio morning reel/i).first(),
    ).toBeVisible();
    await page.getByRole('button', { name: /grid/i }).click();

    // Schedule + analytics honesty
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^schedule$/i })
      .click();
    await expect(page.getByTestId('demo-schedule')).toBeVisible();
    await expect(page.getByText(/not connected|publishing/i).first()).toBeVisible();
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^analytics$/i })
      .click();
    await expect(page.getByTestId('demo-analytics')).toBeVisible();
    await expect(page.getByText(/demo|not connected/i).first()).toBeVisible();

    // Team restricted badge + Activity + Settings
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^team$/i })
      .click();
    await expect(page.getByTestId('demo-team')).toBeVisible();
    await expect(page.getByText(/Restricted/i).first()).toBeVisible();
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^activity$/i })
      .click();
    await expect(page.getByTestId('demo-activity')).toBeVisible();
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^settings$/i })
      .click();
    await expect(page.getByTestId('demo-settings')).toBeVisible();
    await page.getByTestId('demo-settings-nav-integrations').click();
    await expect(page.getByTestId('demo-integrations')).toBeVisible();
    await expect(
      page.getByText(/NOT_CONNECTED|DEFERRED|Not Connected|Deferred/i).first(),
    ).toBeVisible();

    // Brand Intelligence + Company via shell
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /brand intelligence|brands/i })
      .click();
    await expect(page.getByTestId('brand-portfolio')).toBeVisible({ timeout: 20_000 });
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /company/i })
      .click();
    await expect(page.getByRole('heading', { name: /members|company|team/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Reviews inbox
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^reviews$/i })
      .click();
    await expect(page.getByTestId('demo-reviews')).toBeVisible();

    // Re-login consistency — same linked entities
    await logoutUi(page);
    await loginUi(page, creds);
    await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^campaigns$/i })
      .click();
    await expect(
      page.getByRole('link', { name: /Summer Organic Always-On/i }).first(),
    ).toBeVisible();
    await page
      .getByRole('link', { name: /Summer Organic Always-On/i })
      .first()
      .click();
    await expect(page.getByTestId('demo-strategy-id')).toHaveText(/demo-strategy-q3/);

    guards.assertClean();
  });

  test('Arabic RTL shell and Arabic mobile calendar', async ({
    page,
    request,
    context,
  }, testInfo) => {
    test.skip(
      !['ar-desktop', 'en-mobile'].includes(testInfo.project.name),
      'AR desktop + mobile projects',
    );
    const guards = attachGuards(page);
    await context.addCookies([{ name: 'oma_locale', value: 'ar', url: WEB_ORIGIN }]);
    const creds = await createOwnerCreds(request);
    await loginUi(page, creds);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    if (testInfo.project.name === 'ar-desktop') {
      await page.goto('/app/campaigns');
      await expect(page.getByTestId('demo-campaigns')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/هورايزون|عضوية|حملة/i).first()).toBeVisible();
      await page.goto('/app/deliverables');
      await expect(page.getByTestId('demo-deliverables')).toBeVisible();
    } else {
      await page.goto('/app/content');
      await expect(page.getByTestId('demo-content')).toBeVisible({ timeout: 15_000 });
    }
    guards.assertClean();
  });

  test('tablet and mobile reach home, tasks, and schedule', async ({ page, request }, testInfo) => {
    test.skip(
      !['en-tablet', 'en-mobile'].includes(testInfo.project.name),
      'viewport projects only',
    );
    const guards = attachGuards(page);
    const creds = await createOwnerCreds(request);
    await loginUi(page, creds);
    await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });
    await page.goto('/app/tasks');
    await expect(page.getByTestId('demo-tasks')).toBeVisible({ timeout: 15_000 });
    await page.goto('/app/schedule');
    await expect(page.getByTestId('demo-schedule')).toBeVisible();
    guards.assertClean();
  });
});

test.describe('Demo mode security (API)', () => {
  test('demo status reports enabled under test servers', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'once');
    // This is covered by vitest security suite against an isolated Nest app.
    // Playwright webServers always enable demo mode; assert status endpoint shape instead.
    const owner = await registerBrandOwner(request);
    const status = await request.get('/api/v1/demo/status', {
      headers: {
        cookie: Object.entries(owner.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
      },
    });
    expect(status.ok()).toBeTruthy();
    const body = await status.json();
    expect(body.data.enabled).toBe(true);
    expect(body.data.production_blocked).toBe(false);
  });
});
